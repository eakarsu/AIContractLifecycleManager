const express = require('express');
const axios = require('axios');
const pool = require('../db');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

const AI_SYSTEM = 'You are an expert contract lawyer and lifecycle management specialist.';
const AI_MODEL = 'anthropic/claude-3-5-sonnet-20241022';

const aiCall = async (userMsg, temp = 0.5, maxTokens = 3000) => {
  if (!process.env.OPENROUTER_API_KEY) {
    const err = new Error('AI service unavailable: OPENROUTER_API_KEY not set');
    err.statusCode = 503;
    throw err;
  }
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: AI_MODEL,
      messages: [
        { role: 'system', content: AI_SYSTEM },
        { role: 'user', content: userMsg }
      ],
      temperature: temp,
      max_tokens: maxTokens,
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Contract Lifecycle Manager',
      }
    }
  );
  return response.data.choices?.[0]?.message?.content || '';
};

const parseJson = (text) => {
  let str = text.trim();
  const match = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) str = match[1].trim();
  return JSON.parse(str);
};

// POST /api/ai/obligation-extractor
// {contract_text} → extracts all obligations with party, deadline, penalty
router.post('/obligation-extractor', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_text } = req.body;
    if (!contract_text) return res.status(400).json({ error: 'contract_text is required' });

    const content = await aiCall(
      `Analyze this contract text and extract ALL obligations. For each obligation identify the responsible party, deadline, and any penalties for non-compliance.

Contract Text:
${contract_text.slice(0, 8000)}

Respond with this exact JSON structure:
{
  "total_obligations": 0,
  "obligations": [
    {
      "id": 1,
      "title": "Brief obligation title",
      "description": "Full obligation description",
      "responsible_party": "Which party (Party A / Party B / Both / Third Party)",
      "obligation_type": "payment|delivery|reporting|confidentiality|compliance|maintenance|other",
      "deadline": "Specific date or timeframe (null if ongoing)",
      "is_recurring": false,
      "recurrence_pattern": "monthly/quarterly/annually/null",
      "penalty": "Penalty for non-compliance (null if none specified)",
      "penalty_amount": "Dollar amount or percentage if specified (null if none)",
      "priority": "high|medium|low",
      "clause_reference": "Section or clause number from the contract",
      "notes": "Additional context or caveats"
    }
  ],
  "summary": {
    "high_priority_count": 0,
    "payment_obligations": 0,
    "upcoming_deadlines": "Description of most urgent deadlines",
    "total_potential_penalties": "Summary of financial exposure"
  }
}`,
      0.3,
      4000
    );

    let result;
    try { result = parseJson(content); }
    catch (e) { return res.json({ raw: content }); }

    res.json(result);
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: err.message });
    console.error('Obligation extractor error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/renewal-advisor
// {contract_id} → fetches contract from DB, suggests renewal terms
router.post('/renewal-advisor', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    // Fetch contract with related data
    const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contract_id]);
    if (contractRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    const contract = contractRes.rows[0];

    // Fetch renewals, obligations, amendments for context
    const [renewalsRes, obligationsRes, amendmentsRes] = await Promise.all([
      pool.query('SELECT * FROM renewals WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 5', [contract_id]),
      pool.query('SELECT * FROM obligations WHERE contract_id = $1', [contract_id]),
      pool.query('SELECT * FROM amendments WHERE contract_id = $1 ORDER BY version_number DESC LIMIT 3', [contract_id]),
    ]);

    const context = {
      contract: contract,
      renewals: renewalsRes.rows,
      obligations: obligationsRes.rows,
      recent_amendments: amendmentsRes.rows
    };

    const content = await aiCall(
      `You are advising on contract renewal for the following contract. Based on the contract details, history, and current obligations, provide specific renewal recommendations.

Contract Details:
${JSON.stringify(context, null, 2).slice(0, 6000)}

Provide renewal advice in this JSON format:
{
  "contract_id": ${contract_id},
  "contract_title": "${contract.title || 'Contract'}",
  "renewal_recommendation": "renew|renegotiate|terminate|extend",
  "confidence": "high|medium|low",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "suggested_terms": {
    "duration": "Recommended new contract duration",
    "price_adjustment": "Recommended price change with justification",
    "new_clauses": ["Clause to add 1", "Clause to add 2"],
    "clauses_to_remove": ["Clause to remove or weaken"],
    "clauses_to_strengthen": ["Clause to make more enforceable"]
  },
  "risk_assessment": {
    "overall_risk": "low|medium|high",
    "risks": ["Risk 1", "Risk 2"],
    "mitigations": ["Mitigation 1", "Mitigation 2"]
  },
  "negotiation_priorities": ["Priority 1", "Priority 2", "Priority 3"],
  "timeline": {
    "start_negotiations_by": "Recommended date to begin negotiations",
    "target_renewal_date": "Target completion date",
    "notice_period_compliance": true
  },
  "executive_summary": "2-3 sentence executive summary of the renewal recommendation"
}`,
      0.5,
      3000
    );

    let result;
    try { result = parseJson(content); }
    catch (e) { return res.json({ contract_id, raw: content }); }

    res.json(result);
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: err.message });
    console.error('Renewal advisor error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/contract-health
// {contract_id} → fetches obligations/milestones, returns health score and risk flags
router.post('/contract-health', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contract_id]);
    if (contractRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    const contract = contractRes.rows[0];

    const [obligationsRes, milestonesRes, approvalsRes, renewalsRes] = await Promise.all([
      pool.query('SELECT * FROM obligations WHERE contract_id = $1', [contract_id]),
      pool.query('SELECT * FROM milestones WHERE contract_id = $1', [contract_id]),
      pool.query('SELECT * FROM approvals WHERE contract_id = $1', [contract_id]),
      pool.query('SELECT * FROM renewals WHERE contract_id = $1 ORDER BY renewal_date DESC LIMIT 1', [contract_id]),
    ]);

    const obligations = obligationsRes.rows;
    const milestones = milestonesRes.rows;
    const approvals = approvalsRes.rows;
    const renewals = renewalsRes.rows;

    // Compute quick stats for context
    const now = new Date();
    const overdueObligations = obligations.filter(o => o.due_date && new Date(o.due_date) < now && o.status !== 'completed');
    const overdueMilestones = milestones.filter(m => m.due_date && new Date(m.due_date) < now && m.status !== 'completed');
    const completedObligations = obligations.filter(o => o.status === 'completed');
    const pendingApprovals = approvals.filter(a => a.status === 'pending');

    const contextData = {
      contract,
      stats: {
        total_obligations: obligations.length,
        completed_obligations: completedObligations.length,
        overdue_obligations: overdueObligations.length,
        total_milestones: milestones.length,
        overdue_milestones: overdueMilestones.length,
        pending_approvals: pendingApprovals.length,
        upcoming_renewal: renewals[0] || null,
      },
      overdue_obligations: overdueObligations,
      overdue_milestones: overdueMilestones,
      pending_approvals: pendingApprovals,
    };

    const content = await aiCall(
      `Assess the health of this contract based on its obligations, milestones, and approval status.

Contract Health Data:
${JSON.stringify(contextData, null, 2).slice(0, 5000)}

Provide a comprehensive health assessment in this exact JSON format:
{
  "contract_id": ${contract_id},
  "contract_title": "${contract.title || 'Contract'}",
  "health_score": 85,
  "health_grade": "A|B|C|D|F",
  "status": "healthy|at_risk|critical|expired",
  "assessment_date": "${new Date().toISOString()}",
  "risk_flags": [
    {
      "severity": "high|medium|low",
      "category": "obligation|milestone|approval|renewal|compliance|other",
      "title": "Risk title",
      "description": "Detailed risk description",
      "recommended_action": "Specific action to take"
    }
  ],
  "positive_indicators": ["Positive finding 1", "Positive finding 2"],
  "metrics": {
    "obligation_completion_rate": 0,
    "milestone_completion_rate": 0,
    "days_until_renewal": null,
    "overdue_items_count": 0,
    "pending_approvals_count": 0
  },
  "priority_actions": [
    {
      "priority": 1,
      "action": "Action description",
      "deadline": "When to complete by",
      "owner": "Who should do this"
    }
  ],
  "executive_summary": "3-4 sentence overall contract health summary with key concerns and recommendations"
}`,
      0.3,
      3000
    );

    let result;
    try {
      result = parseJson(content);
      // Ensure computed metrics are accurate
      if (result.metrics) {
        result.metrics.obligation_completion_rate = obligations.length > 0
          ? Math.round((completedObligations.length / obligations.length) * 100) : 100;
        result.metrics.overdue_items_count = overdueObligations.length + overdueMilestones.length;
        result.metrics.pending_approvals_count = pendingApprovals.length;
      }
    } catch (e) { return res.json({ contract_id, raw: content }); }

    res.json(result);
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: err.message });
    console.error('Contract health error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/predict-renewal-success
// {contract_id} → predicts renewal probability and recommended pre-renewal actions
router.post('/predict-renewal-success', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contract_id]);
    if (contractRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    const contract = contractRes.rows[0];

    const [renewalsRes, obligationsRes, amendmentsRes, risksRes] = await Promise.all([
      pool.query('SELECT * FROM renewals WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 10', [contract_id]),
      pool.query('SELECT * FROM obligations WHERE contract_id = $1', [contract_id]),
      pool.query('SELECT * FROM amendments WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 5', [contract_id]),
      pool.query('SELECT * FROM risk_assessments WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 1', [contract_id]),
    ]);

    const obligations = obligationsRes.rows;
    const completed = obligations.filter(o => o.status === 'completed').length;
    const overdue = obligations.filter(o => o.due_date && new Date(o.due_date) < new Date() && o.status !== 'completed').length;

    const ctx = {
      contract,
      renewal_history: renewalsRes.rows,
      obligation_stats: { total: obligations.length, completed, overdue },
      recent_amendments: amendmentsRes.rows,
      latest_risk_assessment: risksRes.rows[0] || null,
    };

    const content = await aiCall(
      `Predict renewal success for the following contract using its history, obligations, amendments, and risk profile.\n\nContext:\n${JSON.stringify(ctx, null, 2).slice(0, 6000)}\n\nRespond in JSON exactly:\n{\n  "contract_id": ${contract_id},\n  "renewal_probability": 0.0,\n  "confidence": "high|medium|low",\n  "predicted_outcome": "renew|renegotiate|terminate|extend",\n  "key_drivers": [{"factor": "string", "impact": "positive|negative|neutral", "weight": "high|medium|low"}],\n  "recommended_actions": [{"priority": 1, "action": "string", "owner": "string", "deadline": "string"}],\n  "risk_signals": ["string"],\n  "executive_summary": "2-3 sentences"\n}`,
      0.4,
      3000
    );

    let result;
    try { result = parseJson(content); }
    catch (e) { return res.json({ contract_id, raw: content }); }
    res.json(result);
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: err.message });
    console.error('Predict renewal success error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// POST /api/ai/predict-approval-likelihood
// {contract_id} → predicts approval outcome and bottleneck steps
router.post('/predict-approval-likelihood', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [contract_id]);
    if (contractRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    const contract = contractRes.rows[0];

    const [approvalsRes, risksRes, complianceRes] = await Promise.all([
      pool.query('SELECT * FROM approvals WHERE contract_id = $1 ORDER BY created_at ASC', [contract_id]),
      pool.query('SELECT * FROM risk_assessments WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 1', [contract_id]),
      pool.query('SELECT * FROM compliance_checks WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 5', [contract_id]),
    ]);

    const approvals = approvalsRes.rows;
    const pending = approvals.filter(a => a.status === 'pending' || a.status === 'in_review');
    const rejected = approvals.filter(a => a.status === 'rejected');
    const approved = approvals.filter(a => a.status === 'approved');

    const ctx = {
      contract,
      approval_chain: approvals,
      stats: { total: approvals.length, pending: pending.length, approved: approved.length, rejected: rejected.length },
      latest_risk_assessment: risksRes.rows[0] || null,
      compliance_findings: complianceRes.rows,
    };

    const content = await aiCall(
      `Predict approval likelihood for the following contract based on its approval chain, risk and compliance status.\n\nContext:\n${JSON.stringify(ctx, null, 2).slice(0, 6000)}\n\nRespond in JSON exactly:\n{\n  "contract_id": ${contract_id},\n  "approval_probability": 0.0,\n  "confidence": "high|medium|low",\n  "predicted_outcome": "approved|rejected|stalled|conditional",\n  "expected_days_to_decision": 0,\n  "bottleneck_steps": [{"approver": "string", "approval_type": "string", "reason": "string", "severity": "high|medium|low"}],\n  "recommended_actions": [{"priority": 1, "action": "string", "owner": "string"}],\n  "risk_signals": ["string"],\n  "executive_summary": "2-3 sentences"\n}`,
      0.4,
      3000
    );

    let result;
    try { result = parseJson(content); }
    catch (e) { return res.json({ contract_id, raw: content }); }
    res.json(result);
  } catch (err) {
    if (err.statusCode === 503) return res.status(503).json({ error: err.message });
    console.error('Predict approval likelihood error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

module.exports = router;
