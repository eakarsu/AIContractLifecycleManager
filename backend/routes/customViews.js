const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

// In-memory storage for template/clause rules (since no table exists)
let clauseRules = [
  { id: 1, name: 'Cap Liability at 12 months', clause_type: 'liability', rule: 'liability_cap <= 12 * monthly_fee', severity: 'high', active: true, created_at: new Date().toISOString() },
  { id: 2, name: 'Require Mutual NDA', clause_type: 'confidentiality', rule: 'mutual = true', severity: 'standard', active: true, created_at: new Date().toISOString() },
  { id: 3, name: 'Force Majeure must include pandemic', clause_type: 'force_majeure', rule: 'includes("pandemic")', severity: 'standard', active: true, created_at: new Date().toISOString() },
  { id: 4, name: 'Termination notice >= 30 days', clause_type: 'termination', rule: 'notice_days >= 30', severity: 'high', active: true, created_at: new Date().toISOString() },
  { id: 5, name: 'IP ownership reverts on termination', clause_type: 'ip_ownership', rule: 'reverts_on_termination = true', severity: 'critical', active: false, created_at: new Date().toISOString() },
];
let nextRuleId = 6;

// GET /api/custom-views/pipeline-funnel — VIZ #1: contract pipeline funnel
router.get('/pipeline-funnel', auth, async (req, res) => {
  try {
    const stages = [
      { key: 'draft', label: 'Draft', statuses: ['draft'] },
      { key: 'review', label: 'Review', statuses: ['under_review', 'negotiation', 'pending'] },
      { key: 'executed', label: 'Executed', statuses: ['active', 'executed'] },
      { key: 'renewal', label: 'Renewal', statuses: ['expired', 'terminated', 'archived'] },
    ];
    const funnel = [];
    for (const s of stages) {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(value),0)::numeric AS total_value
         FROM contracts WHERE status = ANY($1::text[])`,
        [s.statuses]
      );
      funnel.push({
        stage: s.key,
        label: s.label,
        count: r.rows[0].count,
        total_value: parseFloat(r.rows[0].total_value),
      });
    }
    const total = funnel.reduce((a, b) => a + b.count, 0) || 1;
    funnel.forEach(f => { f.percentage = +((f.count / total) * 100).toFixed(1); });
    res.json({ funnel, total_contracts: total, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/custom-views/clause-risk-heatmap — VIZ #2: clause type x risk severity heatmap
router.get('/clause-risk-heatmap', auth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT clause_type, severity, COUNT(*)::int AS count
      FROM clauses
      WHERE clause_type IS NOT NULL
      GROUP BY clause_type, severity
      ORDER BY clause_type
    `);
    const clauseTypes = Array.from(new Set(r.rows.map(x => x.clause_type)));
    const severities = ['standard', 'high', 'critical'];
    const matrix = clauseTypes.map(ct => {
      const row = { clause_type: ct };
      let total = 0;
      severities.forEach(sev => {
        const found = r.rows.find(x => x.clause_type === ct && x.severity === sev);
        const v = found ? found.count : 0;
        row[sev] = v;
        total += v;
      });
      row.total = total;
      return row;
    });
    // Max for color scaling
    let max = 0;
    matrix.forEach(row => severities.forEach(s => { if (row[s] > max) max = row[s]; }));
    res.json({ severities, matrix, max, clause_types: clauseTypes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/custom-views/contract-summary/:id?  — NON-VIZ #1: contract summary "PDF" (text)
router.get('/contract-summary/:id?', auth, async (req, res) => {
  try {
    let contract;
    if (req.params.id) {
      const r = await pool.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
      if (r.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
      contract = r.rows[0];
    } else {
      const r = await pool.query('SELECT * FROM contracts ORDER BY created_at DESC LIMIT 1');
      if (r.rows.length === 0) return res.status(404).json({ error: 'No contracts' });
      contract = r.rows[0];
    }
    const clauseRes = await pool.query('SELECT id, title, clause_type, severity FROM clauses WHERE contract_id = $1', [contract.id]);
    const obligationRes = await pool.query('SELECT COUNT(*)::int AS c FROM obligations WHERE contract_id = $1', [contract.id]);
    const riskRes = await pool.query('SELECT * FROM risk_assessments WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 1', [contract.id]);

    const lines = [];
    lines.push('CONTRACT SUMMARY (PDF-ready)');
    lines.push('============================');
    lines.push(`Title: ${contract.title}`);
    lines.push(`Type: ${contract.contract_type}`);
    lines.push(`Status: ${contract.status}`);
    lines.push(`Parties: ${contract.party_a || 'N/A'} <-> ${contract.party_b || 'N/A'}`);
    lines.push(`Value: ${contract.currency || 'USD'} ${contract.value || 0}`);
    lines.push(`Period: ${contract.start_date || 'N/A'} to ${contract.end_date || 'N/A'}`);
    lines.push(`Jurisdiction: ${contract.jurisdiction || 'N/A'}`);
    lines.push(`Risk Level: ${contract.risk_level || 'medium'}`);
    lines.push('');
    lines.push(`Clauses: ${clauseRes.rows.length}`);
    clauseRes.rows.slice(0, 10).forEach(c => lines.push(`  - [${c.severity}] ${c.title} (${c.clause_type})`));
    lines.push('');
    lines.push(`Obligations: ${obligationRes.rows[0].c}`);
    if (riskRes.rows[0]) {
      lines.push(`Latest Risk Score: ${riskRes.rows[0].overall_score} (${riskRes.rows[0].risk_level})`);
    }
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);

    const text = lines.join('\n');
    res.json({
      contract_id: contract.id,
      title: contract.title,
      summary_text: text,
      pdf_data_uri: `data:text/plain;base64,${Buffer.from(text).toString('base64')}`,
      sections: {
        header: { title: contract.title, type: contract.contract_type, status: contract.status },
        parties: { a: contract.party_a, b: contract.party_b },
        financial: { value: contract.value, currency: contract.currency },
        clauses_count: clauseRes.rows.length,
        obligations_count: obligationRes.rows[0].c,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// /api/custom-views/clause-rules  — NON-VIZ #2: clause/template rules CRUD
router.get('/clause-rules', auth, (req, res) => {
  res.json({ rules: clauseRules, total: clauseRules.length });
});

router.post('/clause-rules', auth, (req, res) => {
  const { name, clause_type, rule, severity, active } = req.body || {};
  if (!name || !rule) return res.status(400).json({ error: 'name and rule required' });
  const newRule = {
    id: nextRuleId++,
    name,
    clause_type: clause_type || 'general',
    rule,
    severity: severity || 'standard',
    active: active !== false,
    created_at: new Date().toISOString(),
  };
  clauseRules.push(newRule);
  res.status(201).json(newRule);
});

router.put('/clause-rules/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = clauseRules.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Rule not found' });
  clauseRules[idx] = { ...clauseRules[idx], ...req.body, id };
  res.json(clauseRules[idx]);
});

router.delete('/clause-rules/:id', auth, (req, res) => {
  const id = parseInt(req.params.id);
  const before = clauseRules.length;
  clauseRules = clauseRules.filter(r => r.id !== id);
  if (clauseRules.length === before) return res.status(404).json({ error: 'Rule not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;
