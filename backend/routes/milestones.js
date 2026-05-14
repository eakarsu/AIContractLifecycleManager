const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/milestones/overdue — milestones past due date not completed
router.get('/overdue', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT m.*, c.title as contract_title, c.contract_number
       FROM milestones m
       LEFT JOIN contracts c ON m.contract_id = c.id
       WHERE m.due_date < NOW() AND m.status != 'completed'
       ORDER BY m.due_date ASC`
    );
    res.json({ data: r.rows, count: r.rows.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/milestones — with pagination
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

    const countRes = await pool.query(`SELECT COUNT(*) FROM milestones ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM milestones ${whereStr} ORDER BY due_date ASC NULLS LAST, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/milestones/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM milestones WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/milestones
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, title, description, due_date, status, payment_amount } = req.body;
    if (!contract_id || !title) return res.status(400).json({ error: 'contract_id and title are required' });
    const r = await pool.query(
      `INSERT INTO milestones (contract_id, title, description, due_date, status, payment_amount, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING *`,
      [contract_id, title, description || null, due_date ? new Date(due_date) : null,
       status || 'pending', payment_amount || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/milestones/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, description, due_date, status, payment_amount } = req.body;
    const r = await pool.query(
      'UPDATE milestones SET title=$1, description=$2, due_date=$3, status=$4, payment_amount=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [title, description || null, due_date ? new Date(due_date) : null,
       status || 'pending', payment_amount || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/milestones/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM milestones WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Milestone not found' });
    res.json({ message: 'Milestone deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
