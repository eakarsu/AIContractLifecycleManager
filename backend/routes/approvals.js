const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

async function ensureApprovalSchema() {
  await pool.query(`
    ALTER TABLE approvals
      ADD COLUMN IF NOT EXISTS approver_id INTEGER,
      ADD COLUMN IF NOT EXISTS due_date DATE,
      ADD COLUMN IF NOT EXISTS notes TEXT
  `);
}

// GET /api/approvals
router.get('/', auth, async (req, res) => {
  try {
    await ensureApprovalSchema();
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
    await ensureApprovalSchema();
    const r = await pool.query('SELECT * FROM approvals WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/approvals
router.post('/', auth, async (req, res) => {
  try {
    await ensureApprovalSchema();
    const { contract_id, approver_id, approver_name, approver_email, approval_type, status, comments, due_date, notes, priority } = req.body;
    if (!contract_id || !approval_type) return res.status(400).json({ error: 'contract_id and approval_type are required' });
    const r = await pool.query(
      `INSERT INTO approvals
        (contract_id, approver_id, approver_name, approver_email, approval_type, status, comments, due_date, notes, priority, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW()) RETURNING *`,
      [
        contract_id,
        approver_id || null,
        approver_name || null,
        approver_email || null,
        approval_type,
        status || 'pending',
        comments || null,
        due_date ? new Date(due_date) : null,
        notes || null,
        priority || 'normal',
      ]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/approvals/:id
router.put('/:id', auth, async (req, res) => {
  try {
    await ensureApprovalSchema();
    const { contract_id, approver_id, approver_name, approver_email, approval_type, status, comments, due_date, notes, priority } = req.body;
    const r = await pool.query(
      `UPDATE approvals
          SET contract_id=$1, approver_id=$2, approver_name=$3, approver_email=$4,
              approval_type=$5, status=$6, comments=$7, due_date=$8, notes=$9, priority=$10, updated_at=NOW()
        WHERE id=$11 RETURNING *`,
      [
        contract_id || null,
        approver_id || null,
        approver_name || null,
        approver_email || null,
        approval_type,
        status || 'pending',
        comments || null,
        due_date ? new Date(due_date) : null,
        notes || null,
        priority || 'normal',
        req.params.id,
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/approvals/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureApprovalSchema();
    const r = await pool.query('DELETE FROM approvals WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Approval not found' });
    res.json({ message: 'Approval deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/approvals/:id/approve — approve a contract
router.put('/:id/approve', auth, async (req, res) => {
  try {
    await ensureApprovalSchema();
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
    await ensureApprovalSchema();
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
