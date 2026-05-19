const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/renewals/upcoming — renewals due in next 90 days
router.get('/upcoming', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 90;
    const r = await pool.query(
      `SELECT r.*, c.title as contract_title, c.contract_number
       FROM renewals r
       LEFT JOIN contracts c ON r.contract_id = c.id
       WHERE r.renewal_date BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
       AND r.status != 'completed'
       ORDER BY r.renewal_date ASC`,
      []
    );
    res.json({ data: r.rows, count: r.rows.length, window_days: days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/renewals
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

    const countRes = await pool.query(`SELECT COUNT(*) FROM renewals ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM renewals ${whereStr} ORDER BY renewal_date ASC NULLS LAST, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/renewals/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM renewals WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Renewal not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/renewals
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, renewal_date, renewal_terms, auto_renew, notice_period_days, status, notes } = req.body;
    if (!contract_id || !renewal_date) return res.status(400).json({ error: 'contract_id and renewal_date are required' });
    const r = await pool.query(
      `INSERT INTO renewals (contract_id, renewal_date, renewal_terms, auto_renew, notice_period_days, status, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW()) RETURNING *`,
      [contract_id, new Date(renewal_date), renewal_terms || null, auto_renew || false,
       notice_period_days || null, status || 'pending', notes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/renewals/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { renewal_date, renewal_terms, auto_renew, notice_period_days, status, notes } = req.body;
    const r = await pool.query(
      'UPDATE renewals SET renewal_date=$1, renewal_terms=$2, auto_renew=$3, notice_period_days=$4, status=$5, notes=$6, updated_at=NOW() WHERE id=$7 RETURNING *',
      [renewal_date ? new Date(renewal_date) : null, renewal_terms || null, auto_renew || false,
       notice_period_days || null, status || 'pending', notes || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Renewal not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/renewals/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM renewals WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Renewal not found' });
    res.json({ message: 'Renewal deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
