const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();

const AI_SYSTEM = 'You are an expert contract lawyer and lifecycle management specialist.';

const aiCall = async (userMsg, temp = 0.5) => {
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'system', content: AI_SYSTEM }, { role: 'user', content: userMsg }],
      temperature: temp,
      max_tokens: 4000,
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Contract Lifecycle Manager',
      }
    }
  );
  return response.data.choices?.[0]?.message?.content || '';
};

// GET /api/templates
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_type, search } = req.query;

    const params = [];
    const conditions = [];
    if (contract_type) { params.push(contract_type); conditions.push(`contract_type = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR description ILIKE $${params.length})`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM contract_templates ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM contract_templates ${whereStr} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/templates/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM contract_templates WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/templates
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, contract_type, content, variables, sections } = req.body;
    if (!name || !contract_type) return res.status(400).json({ error: 'name and contract_type are required' });
    const r = await pool.query(
      'INSERT INTO contract_templates (name, description, contract_type, content, variables, sections, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *',
      [name, description || null, contract_type, content || null, variables ? JSON.stringify(variables) : null, sections ? JSON.stringify(sections) : null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/templates/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, contract_type, content, variables, sections } = req.body;
    const r = await pool.query(
      'UPDATE contract_templates SET name=$1, description=$2, contract_type=$3, content=$4, variables=$5, sections=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [name, description || null, contract_type, content || null, variables ? JSON.stringify(variables) : null, sections ? JSON.stringify(sections) : null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/templates/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM contract_templates WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/templates/ai-template — AI creates full contract template
router.post('/ai-template', auth, async (req, res) => {
  try {
    const { contract_type, parties, jurisdiction, key_terms, duration } = req.body;
    if (!contract_type) return res.status(400).json({ error: 'contract_type is required' });

    const content = await aiCall(
      `Create a comprehensive, professional contract template for a ${contract_type}.

Parties: ${parties || 'Party A (Service Provider) and Party B (Client)'}
Jurisdiction: ${jurisdiction || 'United States'}
Key Terms: ${key_terms || 'Standard commercial terms'}
Duration: ${duration || '12 months'}

Generate a complete, legally sound contract template including:
1. Title and recitals
2. Definitions section
3. Scope of work / services
4. Payment terms and schedule
5. Intellectual property rights
6. Confidentiality and non-disclosure
7. Representations and warranties
8. Limitation of liability
9. Indemnification
10. Termination provisions
11. Dispute resolution and governing law
12. Force majeure
13. General provisions (severability, entire agreement, amendments)
14. Signature blocks with date fields

Use [PLACEHOLDER] format for variables that need to be filled in.`,
      0.4
    );

    // Save the generated template to DB
    const r = await pool.query(
      'INSERT INTO contract_templates (name, description, contract_type, content, created_at, updated_at) VALUES ($1,$2,$3,$4,NOW(),NOW()) RETURNING *',
      [
        `AI-Generated ${contract_type} Template`,
        `Automatically generated ${contract_type} contract template for ${parties || 'standard parties'}`,
        contract_type,
        content
      ]
    );
    res.status(201).json({ template: r.rows[0], ai_content: content });
  } catch (err) { res.status(500).json({ error: err.response?.data?.error?.message || err.message }); }
});

module.exports = router;
