const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { callOpenRouter, parseAIJson } = require('../services/aiHelper');
const router = express.Router();

// Configure multer for contract evidence uploads, 20MB max
const uploadDir = path.join(__dirname, '..', 'uploads', 'documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Only PDF, DOC/DOCX, TXT, MD, CSV, or JSON files are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

async function ensureDocumentSchema() {
  await pool.query(`
    ALTER TABLE documents
      ADD COLUMN IF NOT EXISTS title VARCHAR(500),
      ADD COLUMN IF NOT EXISTS file_name VARCHAR(500),
      ADD COLUMN IF NOT EXISTS filename VARCHAR(500),
      ADD COLUMN IF NOT EXISTS original_name VARCHAR(500),
      ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0',
      ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'
  `);
  await pool.query(`
    UPDATE documents
       SET filename = COALESCE(filename, file_name),
           original_name = COALESCE(original_name, file_name),
           title = COALESCE(title, original_name, file_name, 'Document')
  `);
}

function parseMetadata(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return { raw: String(value) }; }
}

function extractTextPreview(doc) {
  const stored = doc.filename || doc.file_name;
  if (!stored) return { text: '', extraction_status: 'no_file_reference' };
  const filePath = path.join(uploadDir, stored);
  if (!fs.existsSync(filePath)) return { text: '', extraction_status: 'file_not_found' };
  const ext = path.extname(stored).toLowerCase();
  const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm'];
  if (!textExtensions.includes(ext)) {
    return {
      text: '',
      extraction_status: 'metadata_only',
      note: 'Binary document text extraction requires a PDF/DOCX parser service for production OCR.',
    };
  }
  const text = fs.readFileSync(filePath, 'utf8').slice(0, 12000);
  return { text, extraction_status: 'text_extracted' };
}

function detectDocumentControls(doc, text) {
  const haystack = `${doc.title || ''} ${doc.document_type || ''} ${doc.file_name || ''} ${text || ''}`.toLowerCase();
  const controls = [
    { key: 'termination', label: 'Termination', pattern: /terminat|expiration|renewal/ },
    { key: 'payment', label: 'Payment Terms', pattern: /payment|invoice|fee|price|amount/ },
    { key: 'liability', label: 'Liability', pattern: /liability|indemn|damages|cap/ },
    { key: 'privacy', label: 'Privacy/Data Protection', pattern: /privacy|personal data|gdpr|ccpa|data protection/ },
    { key: 'security', label: 'Security', pattern: /security|soc 2|breach|incident|audit/ },
    { key: 'ip', label: 'IP Ownership', pattern: /intellectual property|ip ownership|license/ },
  ];
  return controls
    .filter((control) => control.pattern.test(haystack))
    .map(({ key, label }) => ({ key, label, status: 'detected' }));
}

// GET /api/documents
router.get('/', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, document_type } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (document_type) { params.push(document_type); conditions.push(`document_type = $${params.length}`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM documents ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT id, contract_id, title, document_type,
              COALESCE(file_name, original_name, filename) AS file_name,
              file_size, version, uploaded_by, metadata, status, created_at, updated_at
       FROM documents ${whereStr} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/documents/:id/intelligence
router.get('/:id/intelligence', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const r = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = r.rows[0];
    const extraction = extractTextPreview(doc);
    const metadata = parseMetadata(doc.metadata);
    const detectedControls = detectDocumentControls(doc, extraction.text);
    const missing = [];
    if (!doc.contract_id) missing.push('contract_id');
    if (!doc.document_type) missing.push('document_type');
    if (!doc.file_name && !doc.filename) missing.push('file_name');
    if (!doc.uploaded_by) missing.push('uploaded_by');
    if (!doc.status) missing.push('status');
    const extractionPenalty = extraction.extraction_status === 'text_extracted' ? 0 : 15;

    res.json({
      document_id: doc.id,
      title: doc.title || doc.file_name || `Document #${doc.id}`,
      status: missing.length ? 'needs_metadata' : 'ready',
      extraction_status: extraction.extraction_status,
      preview: extraction.text ? extraction.text.slice(0, 1500) : '',
      metadata,
      detected_controls: detectedControls,
      readiness: {
        score: Math.max(0, 100 - missing.length * 15 - (detectedControls.length ? 0 : 10) - extractionPenalty),
        missing_fields: missing,
        recommendations: [
          ...(missing.length ? [`Complete missing metadata: ${missing.join(', ')}.`] : ['Document metadata is complete.']),
          detectedControls.length ? 'Map detected clauses to clause library controls.' : 'Add clause tags or upload parseable text to improve intelligence.',
          extraction.extraction_status === 'text_extracted'
            ? 'Review extracted text preview and validate clause mapping.'
            : 'Connect file storage and PDF/DOCX OCR extraction for production-grade file intelligence.',
        ],
      },
      note: extraction.note,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/documents/:id/ai-review
router.post('/:id/ai-review', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const r = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = r.rows[0];
    const extraction = extractTextPreview(doc);
    const intelligence = {
      document_id: doc.id,
      title: doc.title || doc.file_name || `Document #${doc.id}`,
      document_type: doc.document_type,
      metadata: parseMetadata(doc.metadata),
      extraction_status: extraction.extraction_status,
      preview: extraction.text.slice(0, 6000),
    };
    const ai = await callOpenRouter(
      'You are a contract lifecycle document intelligence analyst. Return strict JSON with executive_summary, key_findings, clause_risks, missing_metadata, recommended_actions, confidence. Do not use markdown fences.',
      `Analyze this contract document record for CLM readiness, audit readiness, clause risk, metadata gaps, and next actions.\n${JSON.stringify(intelligence, null, 2)}`,
      { temperature: 0.2, maxTokens: 2500 }
    );
    const parsed = parseAIJson(ai.content) || {
      executive_summary: ai.content,
      key_findings: ['The AI response could not be parsed into structured sections.'],
      recommended_actions: ['Run the review again or inspect provider output.'],
      confidence: 0.3,
    };
    res.json({
      document_id: doc.id,
      title: intelligence.title,
      model: ai.model,
      analysis: parsed,
      extraction_status: extraction.extraction_status,
      generated_at: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/documents/:id
router.get('/:id', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const r = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/documents/:id/download
router.get('/:id/download', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const r = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = r.rows[0];
    const filePath = path.join(uploadDir, doc.filename || doc.file_name || '');
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(filePath, doc.original_name || doc.file_name || doc.filename);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/documents — upload a document or create document metadata
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    await ensureDocumentSchema();
    const { contract_id, title, document_type, file_name, file_size, version, uploaded_by, metadata, status } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const storedFileName = req.file?.filename || file_name || null;
    const originalName = req.file?.originalname || file_name || null;
    const r = await pool.query(
      `INSERT INTO documents
        (contract_id, title, document_type, file_name, filename, original_name, file_size, mime_type, version, uploaded_by, metadata, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW()) RETURNING *`,
      [
        contract_id,
        title || originalName || 'Document',
        document_type || 'general',
        originalName,
        storedFileName,
        originalName,
        req.file?.size || file_size || null,
        req.file?.mimetype || null,
        version || '1.0',
        uploaded_by || req.user?.email || 'Authenticated User',
        metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : '{}',
        status || 'active',
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (req.file) fs.unlink(path.join(uploadDir, req.file.filename), () => {});
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const { contract_id, title, document_type, file_name, file_size, version, uploaded_by, metadata, status } = req.body;
    const r = await pool.query(
      `UPDATE documents
          SET contract_id=$1, title=$2, document_type=$3, file_name=$4, original_name=$4,
              file_size=$5, version=$6, uploaded_by=$7, metadata=$8, status=$9, updated_at=NOW()
        WHERE id=$10 RETURNING *`,
      [
        contract_id || null,
        title || 'Document',
        document_type || 'general',
        file_name || null,
        file_size || null,
        version || '1.0',
        uploaded_by || null,
        metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : '{}',
        status || 'active',
        req.params.id,
      ]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Document not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/documents/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureDocumentSchema();
    const r = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    // Remove file from disk
    const filePath = path.join(uploadDir, r.rows[0].filename || '');
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    res.json({ message: 'Document deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Handle multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err.message.includes('Only PDF')) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
