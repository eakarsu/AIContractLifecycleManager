const express = require('express');
const router = express.Router();

let rows = [
  { id: 1, contract: 'MSA-104', obligation: 'Quarterly SOC2 report', owner: 'Security', evidence: 'SOC2 bridge letter', dueDate: '2026-06-15', status: 'pending' },
  { id: 2, contract: 'DPA-088', obligation: 'Subprocessor notice', owner: 'Privacy', evidence: 'notice log export', dueDate: '2026-05-29', status: 'complete' },
  { id: 3, contract: 'SOW-210', obligation: 'Insurance certificate', owner: 'Legal ops', evidence: 'COI renewal', dueDate: '2026-05-25', status: 'blocked' }
];

router.get('/', (_req, res) => {
  const summary = rows.reduce((acc, row) => {
    acc.total += 1;
    acc.blocked += row.status === 'blocked' ? 1 : 0;
    acc.pending += row.status === 'pending' ? 1 : 0;
    return acc;
  }, { total: 0, blocked: 0, pending: 0 });
  res.json({ rows, summary });
});

router.post('/', (req, res) => {
  const item = { id: Date.now(), contract: req.body.contract || 'contract TBD', obligation: req.body.obligation || 'obligation TBD', owner: req.body.owner || 'owner TBD', evidence: req.body.evidence || 'evidence TBD', dueDate: req.body.dueDate || 'TBD', status: req.body.status || 'pending' };
  rows = [item, ...rows];
  res.status(201).json(item);
});

module.exports = router;
