const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

async function ensureAmendmentSchema() {
  await pool.query(`
    ALTER TABLE amendments
      ADD COLUMN IF NOT EXISTS amendment_type VARCHAR(50) DEFAULT 'modification',
      ADD COLUMN IF NOT EXISTS changes JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS version_number INTEGER,
      ADD COLUMN IF NOT EXISTS requested_by VARCHAR(255),
      ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255)
  `);
  await pool.query(`
    UPDATE amendments a
       SET version_number = ranked.version_number
      FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY contract_id ORDER BY created_at, id) AS version_number
          FROM amendments
         WHERE version_number IS NULL
      ) ranked
     WHERE a.id = ranked.id
  `);
}

// GET /api/amendments — list with pagination and version tracking
router.get('/', auth, async (req, res) => {
  try {
    await ensureAmendmentSchema();
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, status } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM amendments ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM amendments ${whereStr} ORDER BY version_number DESC, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/amendments/:id
router.get('/:id', auth, async (req, res) => {
  try {
    await ensureAmendmentSchema();
    const r = await pool.query('SELECT * FROM amendments WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Amendment not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/amendments — auto-increments version_number per contract
router.post('/', auth, async (req, res) => {
  try {
    await ensureAmendmentSchema();
    const { contract_id, title, description, amendment_type, changes, effective_date, status, requested_by, approved_by } = req.body;
    if (!contract_id || !title) return res.status(400).json({ error: 'contract_id and title are required' });

    // Get next version number for this contract
    const versionRes = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM amendments WHERE contract_id = $1',
      [contract_id]
    );
    const versionNumber = versionRes.rows[0].next_version;

    const r = await pool.query(
      `INSERT INTO amendments
        (contract_id, title, description, amendment_type, changes, version_number, effective_date, status, requested_by, approved_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [
        contract_id,
        title,
        description || null,
        amendment_type || 'modification',
        changes ? (typeof changes === 'string' ? JSON.stringify({ text: changes }) : JSON.stringify(changes)) : '[]',
        versionNumber,
        effective_date ? new Date(effective_date) : null,
        status || 'draft',
        requested_by || null,
        approved_by || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/amendments/:id
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureAmendmentSchema();
    const { contract_id, title, description, amendment_type, changes, effective_date, status, requested_by, approved_by } = req.body;
    const r = await pool.query(
      `UPDATE amendments
          SET contract_id=$1, title=$2, description=$3, amendment_type=$4, changes=$5,
              effective_date=$6, status=$7, requested_by=$8, approved_by=$9, updated_at=NOW()
        WHERE id=$10 RETURNING *`,
      [
        contract_id || null,
        title,
        description || null,
        amendment_type || 'modification',
        changes ? (typeof changes === 'string' ? JSON.stringify({ text: changes }) : JSON.stringify(changes)) : '[]',
        effective_date ? new Date(effective_date) : null,
        status || 'draft',
        requested_by || null,
        approved_by || null,
        req.params.id,
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Amendment not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/amendments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureAmendmentSchema();
    const r = await pool.query('DELETE FROM amendments WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Amendment not found' });
    res.json({ message: 'Amendment deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
