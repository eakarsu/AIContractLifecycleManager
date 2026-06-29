const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

async function ensureObligationSchema() {
  await pool.query(`
    ALTER TABLE obligations
      ADD COLUMN IF NOT EXISTS obligated_party VARCHAR(255),
      ADD COLUMN IF NOT EXISTS obligation_type VARCHAR(50) DEFAULT 'performance',
      ADD COLUMN IF NOT EXISTS frequency VARCHAR(50) DEFAULT 'one-time',
      ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'
  `);
}

// GET /api/obligations — with pagination, due_date and status tracking
router.get('/', auth, async (req, res) => {
  try {
    await ensureObligationSchema();
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, status, party, overdue } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (party) { params.push(`%${party}%`); conditions.push(`obligated_party ILIKE $${params.length}`); }
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
    await ensureObligationSchema();
    const r = await pool.query('SELECT * FROM obligations WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Obligation not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/obligations
router.post('/', auth, async (req, res) => {
  try {
    await ensureObligationSchema();
    const { contract_id, title, description, obligated_party, obligation_type, due_date, frequency, status, priority } = req.body;
    if (!contract_id || !title) return res.status(400).json({ error: 'contract_id and title are required' });
    const r = await pool.query(
      `INSERT INTO obligations
        (contract_id, title, description, obligated_party, obligation_type, due_date, frequency, status, priority, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
      [
        contract_id,
        title,
        description || null,
        obligated_party || null,
        obligation_type || 'performance',
        due_date ? new Date(due_date) : null,
        frequency || 'one-time',
        status || 'pending',
        priority || 'medium',
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/obligations/:id
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureObligationSchema();
    const { contract_id, title, description, obligated_party, obligation_type, due_date, frequency, status, priority } = req.body;
    const r = await pool.query(
      `UPDATE obligations
          SET contract_id=$1, title=$2, description=$3, obligated_party=$4, obligation_type=$5,
              due_date=$6, frequency=$7, status=$8, priority=$9, updated_at=NOW()
        WHERE id=$10 RETURNING *`,
      [
        contract_id || null,
        title,
        description || null,
        obligated_party || null,
        obligation_type || 'performance',
        due_date ? new Date(due_date) : null,
        frequency || 'one-time',
        status || 'pending',
        priority || 'medium',
        req.params.id,
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Obligation not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/obligations/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureObligationSchema();
    const r = await pool.query('DELETE FROM obligations WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Obligation not found' });
    res.json({ message: 'Obligation deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
