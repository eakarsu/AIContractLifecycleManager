const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/approvals
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, status, approver_id } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (approver_id) { params.push(approver_id); conditions.push(`approver_id = $${params.length}`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM approvals ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM approvals ${whereStr} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/approvals/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM approvals WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/approvals
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, approver_id, approver_name, approver_email, approval_type, due_date, notes } = req.body;
    if (!contract_id || !approval_type) return res.status(400).json({ error: 'contract_id and approval_type are required' });
    const r = await pool.query(
      `INSERT INTO approvals (contract_id, approver_id, approver_name, approver_email, approval_type, status, due_date, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,NOW(),NOW()) RETURNING *`,
      [contract_id, approver_id || null, approver_name || null, approver_email || null, approval_type,
       due_date ? new Date(due_date) : null, notes || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/approvals/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { approver_id, approver_name, approver_email, approval_type, status, due_date, notes } = req.body;
    const r = await pool.query(
      'UPDATE approvals SET approver_id=$1, approver_name=$2, approver_email=$3, approval_type=$4, status=$5, due_date=$6, notes=$7, updated_at=NOW() WHERE id=$8 RETURNING *',
      [approver_id || null, approver_name || null, approver_email || null, approval_type, status || 'pending',
       due_date ? new Date(due_date) : null, notes || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/approvals/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM approvals WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json({ message: 'Approval deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/approvals/:id/approve — approve a contract
router.put('/:id/approve', auth, async (req, res) => {
  try {
    const { comments } = req.body;
    const r = await pool.query(
      'UPDATE approvals SET status=$1, decision_date=NOW(), comments=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      ['approved', comments || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json({ message: 'Approval granted', approval: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/approvals/:id/reject — reject a contract
router.put('/:id/reject', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    const r = await pool.query(
      'UPDATE approvals SET status=$1, decision_date=NOW(), comments=$2, updated_at=NOW() WHERE id=$3 RETURNING *',
      ['rejected', reason || null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json({ message: 'Approval rejected', approval: r.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
