const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/audit?contract_id=&page=&limit= — paginated audit log
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, user_id, action, entity_type, from_date, to_date } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (user_id) { params.push(user_id); conditions.push(`user_id = $${params.length}`); }
    if (action) { params.push(action); conditions.push(`action = $${params.length}`); }
    if (entity_type) { params.push(entity_type); conditions.push(`entity_type = $${params.length}`); }
    if (from_date) { params.push(new Date(from_date)); conditions.push(`created_at >= $${params.length}`); }
    if (to_date) { params.push(new Date(to_date)); conditions.push(`created_at <= $${params.length}`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM audit_log ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM audit_log ${whereStr} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/audit — log an audit event
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, action, entity_type, entity_id, details, ip_address } = req.body;
    if (!action || !entity_type) return res.status(400).json({ error: 'action and entity_type are required' });
    const userId = req.user?.id || req.user?.userId;
    const r = await pool.query(
      `INSERT INTO audit_log (contract_id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) RETURNING *`,
      [contract_id || null, userId || null, action, entity_type, entity_id || null,
       details ? JSON.stringify(details) : null, ip_address || req.ip]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/audit/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM audit_log WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Audit log entry not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
