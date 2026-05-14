const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/amendments — list with pagination and version tracking
router.get('/', auth, async (req, res) => {
  try {
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
    const r = await pool.query('SELECT * FROM amendments WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Amendment not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/amendments — auto-increments version_number per contract
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, title, description, changes, effective_date, status } = req.body;
    if (!contract_id || !title) return res.status(400).json({ error: 'contract_id and title are required' });

    // Get next version number for this contract
    const versionRes = await pool.query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM amendments WHERE contract_id = $1',
      [contract_id]
    );
    const versionNumber = versionRes.rows[0].next_version;

    const r = await pool.query(
      `INSERT INTO amendments (contract_id, title, description, changes, version_number, effective_date, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [contract_id, title, description || null, changes ? JSON.stringify(changes) : null, versionNumber,
       effective_date ? new Date(effective_date) : null, status || 'draft']
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/amendments/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, changes, effective_date, status } = req.body;
    const r = await pool.query(
      'UPDATE amendments SET title=$1, description=$2, changes=$3, effective_date=$4, status=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [title, description || null, changes ? JSON.stringify(changes) : null,
       effective_date ? new Date(effective_date) : null, status || 'draft', req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Amendment not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/amendments/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM amendments WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Amendment not found' });
    res.json({ message: 'Amendment deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
