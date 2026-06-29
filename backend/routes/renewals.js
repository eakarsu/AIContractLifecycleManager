const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

async function ensureRenewalSchema() {
  await pool.query(`
    ALTER TABLE renewals
      ADD COLUMN IF NOT EXISTS renewal_type VARCHAR(50) DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS new_start_date DATE,
      ADD COLUMN IF NOT EXISTS new_end_date DATE,
      ADD COLUMN IF NOT EXISTS new_value NUMERIC(15,2),
      ADD COLUMN IF NOT EXISTS terms_changed BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS notice_date DATE
  `);
}

// GET /api/renewals/upcoming — renewals due in next 90 days
router.get('/upcoming', auth, async (req, res) => {
  try {
    await ensureRenewalSchema();
    const days = parseInt(req.query.days) || 90;
    const r = await pool.query(
      `SELECT r.*, c.title as contract_title
       FROM renewals r
       LEFT JOIN contracts c ON r.contract_id = c.id
       WHERE COALESCE(r.notice_date, r.new_start_date) BETWEEN NOW() AND NOW() + ($1::int * INTERVAL '1 day')
       AND r.status != 'completed'
       ORDER BY COALESCE(r.notice_date, r.new_start_date) ASC`,
      [days]
    );
    res.json({ data: r.rows, count: r.rows.length, window_days: days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/renewals
router.get('/', auth, async (req, res) => {
  try {
    await ensureRenewalSchema();
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
      `SELECT * FROM renewals ${whereStr} ORDER BY COALESCE(notice_date, new_start_date) ASC NULLS LAST, created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/renewals/:id
router.get('/:id', auth, async (req, res) => {
  try {
    await ensureRenewalSchema();
    const r = await pool.query('SELECT * FROM renewals WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Renewal not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/renewals
router.post('/', auth, async (req, res) => {
  try {
    await ensureRenewalSchema();
    const { contract_id, renewal_type, new_start_date, new_end_date, new_value, terms_changed, notice_date, status, notes } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });
    const r = await pool.query(
      `INSERT INTO renewals
        (contract_id, renewal_type, new_start_date, new_end_date, new_value, terms_changed, notice_date, status, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
      [
        contract_id,
        renewal_type || 'manual',
        new_start_date ? new Date(new_start_date) : null,
        new_end_date ? new Date(new_end_date) : null,
        new_value === '' || new_value == null ? null : Number(new_value),
        String(terms_changed) === 'true' || terms_changed === true,
        notice_date ? new Date(notice_date) : null,
        status || 'pending',
        notes || null,
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/renewals/:id
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureRenewalSchema();
    const { contract_id, renewal_type, new_start_date, new_end_date, new_value, terms_changed, notice_date, status, notes } = req.body;
    const r = await pool.query(
      `UPDATE renewals
          SET contract_id=$1, renewal_type=$2, new_start_date=$3, new_end_date=$4,
              new_value=$5, terms_changed=$6, notice_date=$7, status=$8, notes=$9, updated_at=NOW()
        WHERE id=$10 RETURNING *`,
      [
        contract_id || null,
        renewal_type || 'manual',
        new_start_date ? new Date(new_start_date) : null,
        new_end_date ? new Date(new_end_date) : null,
        new_value === '' || new_value == null ? null : Number(new_value),
        String(terms_changed) === 'true' || terms_changed === true,
        notice_date ? new Date(notice_date) : null,
        status || 'pending',
        notes || null,
        req.params.id,
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Renewal not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/renewals/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureRenewalSchema();
    const r = await pool.query('DELETE FROM renewals WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Renewal not found' });
    res.json({ message: 'Renewal deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
