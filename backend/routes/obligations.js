const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/obligations — with pagination, due_date and status tracking
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, status, party, overdue } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (party) { params.push(`%${party}%`); conditions.push(`responsible_party ILIKE $${params.length}`); }
    if (overdue === 'true') { conditions.push(`due_date < NOW() AND status != 'completed'`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM obligations ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM obligations ${whereStr} ORDER BY due_date ASC NULLS LAST, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/obligations/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM obligations WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Obligation not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/obligations
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, title, description, responsible_party, due_date, status, penalty } = req.body;
    if (!contract_id || !title) return res.status(400).json({ error: 'contract_id and title are required' });
    const r = await pool.query(
      `INSERT INTO obligations (contract_id, title, description, responsible_party, due_date, status, penalty, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [contract_id, title, description || null, responsible_party || null,
       due_date ? new Date(due_date) : null, status || 'pending', penalty || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/obligations/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, responsible_party, due_date, status, penalty } = req.body;
    const r = await pool.query(
      'UPDATE obligations SET title=$1, description=$2, responsible_party=$3, due_date=$4, status=$5, penalty=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [title, description || null, responsible_party || null,
       due_date ? new Date(due_date) : null, status || 'pending', penalty || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Obligation not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/obligations/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM obligations WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Obligation not found' });
    res.json({ message: 'Obligation deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
