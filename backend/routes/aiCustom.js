/**
 * AI custom non-CRUD features for AIContractLifecycleManager (per audit):
 *  1. POST /auto-redline                  Detect changes between two contract versions
 *  2. POST /clause-library/search         Searchable clause library with AI suggestions
 *  3. POST /amendment-impact              Analyze amendment impact across contract
 *  4. POST /negotiation-simulator         Simulate negotiation against counterparty
 *  5. POST /renewal-generator             Auto-draft renewal terms based on history
 *  6. POST /compliance-drift              Detect drift against latest regulations
 *  7. POST /party-intelligence            Aggregate party info, history, risk
 *  8. GET  /results                       Browse persisted ai_results
 */

const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, parseAIJson, saveAIResult } = require('../services/aiHelper');

const router = express.Router();

const SYSTEM = 'You are an expert contract lawyer and lifecycle management specialist. Always respond with valid JSON when requested.';

function userId(req) { return req.user?.id || req.user?.userId; }

// 1) Auto-Redline: AI-detected changes between two contract versions with explanations
router.post('/auto-redline', auth, aiRateLimiter, async (req, res) => {
  try {
    const { version_a, version_b, contract_id } = req.body;
    if (!version_a || !version_b) return res.status(400).json({ error: 'version_a and version_b are required' });

    const prompt = `Compare these two contract versions and produce a detailed redline analysis.

VERSION A (Original):
${String(version_a).slice(0, 8000)}

VERSION B (Revised):
${String(version_b).slice(0, 8000)}

Return JSON:
{
  "summary": "1-2 sentence summary of the redline",
  "changes": [
    {
      "id": 1,
      "type": "addition|deletion|modification",
      "section": "Section reference or clause name",
      "original_text": "Text in version A (or null for additions)",
      "revised_text": "Text in version B (or null for deletions)",
      "explanation": "Plain-English explanation of what changed",
      "impact": "favorable|unfavorable|neutral",
      "recommended_action": "accept|reject|counter",
      "counter_suggestion": "Suggested counter-language if action=counter, else null",
      "severity": "low|medium|high|critical"
    }
  ],
  "stats": {
    "additions": 0,
    "deletions": 0,
    "modifications": 0,
    "favorable_count": 0,
    "unfavorable_count": 0,
    "critical_changes": 0
  },
  "overall_assessment": "Comprehensive assessment of the redline as a package",
  "negotiation_strategy": "Recommended response strategy"
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.3, maxTokens: 4000 });
    const parsed = parseAIJson(r.content);
    const output = parsed || { raw: r.content };
    await saveAIResult(pool, {
      feature: 'auto-redline', contract_id, user_id: userId(req),
      input: { version_a_len: String(version_a).length, version_b_len: String(version_b).length },
      output, model: r.model, usage: r.usage
    });
    res.json({ ...output, model: r.model, usage: r.usage });
  } catch (err) {
    console.error('auto-redline error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 2) Clause Library Search: searchable clause library with AI-suggested matches
router.post('/clause-library/search', auth, aiRateLimiter, async (req, res) => {
  try {
    const { query, clause_type, jurisdiction, industry } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    // Pull existing clauses from DB (limit to 30 most relevant)
    const params = [];
    const conds = [];
    if (clause_type) { params.push(clause_type); conds.push(`clause_type = $${params.length}`); }
    if (query) { params.push(`%${query}%`); conds.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const dbRes = await pool.query(`SELECT id, title, clause_type, content, plain_language FROM clauses ${where} ORDER BY created_at DESC LIMIT 30`, params);
    const existing = dbRes.rows;

    const prompt = `User searching contract clause library for: "${query}"
Filters: type=${clause_type || 'any'}, jurisdiction=${jurisdiction || 'US'}, industry=${industry || 'general'}.

Existing clauses in library:
${existing.map(c => `[${c.id}] ${c.title} (${c.clause_type}): ${(c.content || '').slice(0, 200)}`).join('\n') || '(none)'}

Return JSON:
{
  "matched_clauses": [
    { "id": 0, "title": "string", "relevance_score": 0.95, "match_reason": "why this matches" }
  ],
  "ai_suggested_clauses": [
    {
      "title": "Suggested new clause",
      "clause_type": "type",
      "content": "Full clause text ready to insert",
      "plain_language": "Plain-English summary",
      "rationale": "Why this clause helps"
    }
  ],
  "search_query": "${query}",
  "result_count": 0
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.4, maxTokens: 3000 });
    const parsed = parseAIJson(r.content);
    const output = parsed || { raw: r.content, matched_clauses: existing.map(c => ({ id: c.id, title: c.title, relevance_score: 0.5 })) };
    await saveAIResult(pool, { feature: 'clause-library-search', user_id: userId(req), input: { query, clause_type, jurisdiction, industry }, output, model: r.model, usage: r.usage });
    res.json({ ...output, model: r.model, usage: r.usage });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 3) Amendment Impact Analysis
router.post('/amendment-impact', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id, amendment_id, amendment_text } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const [cRes, oRes, mRes] = await Promise.all([
      pool.query('SELECT * FROM contracts WHERE id=$1', [contract_id]),
      pool.query('SELECT * FROM obligations WHERE contract_id=$1', [contract_id]),
      pool.query('SELECT * FROM milestones WHERE contract_id=$1', [contract_id]),
    ]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });

    let amendmentBody = amendment_text;
    if (amendment_id) {
      const aRes = await pool.query('SELECT * FROM amendments WHERE id=$1', [amendment_id]);
      if (aRes.rows[0]) amendmentBody = JSON.stringify(aRes.rows[0]);
    }
    if (!amendmentBody) return res.status(400).json({ error: 'amendment_text or amendment_id is required' });

    const prompt = `Analyze the impact of this proposed amendment on the contract and its dependents.

Contract: ${JSON.stringify(cRes.rows[0]).slice(0, 2000)}
Obligations: ${JSON.stringify(oRes.rows).slice(0, 2000)}
Milestones: ${JSON.stringify(mRes.rows).slice(0, 2000)}
Amendment: ${String(amendmentBody).slice(0, 4000)}

Return JSON:
{
  "contract_id": ${contract_id},
  "impact_score": 0,
  "impact_level": "low|medium|high|critical",
  "affected_obligations": [{ "obligation_id": 0, "title": "", "change_type": "modified|removed|added", "description": "" }],
  "affected_milestones": [{ "milestone_id": 0, "title": "", "change_type": "string", "description": "" }],
  "financial_impact": { "direction": "increase|decrease|none", "estimated_amount": "string", "explanation": "string" },
  "risk_changes": [{ "category": "string", "before": "string", "after": "string", "delta": "string" }],
  "approval_recommendation": "approve|reject|negotiate",
  "executive_summary": "2-3 sentence summary"
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.3, maxTokens: 3000 });
    const parsed = parseAIJson(r.content) || { raw: r.content };
    await saveAIResult(pool, { feature: 'amendment-impact', contract_id, user_id: userId(req), input: { amendment_id }, output: parsed, model: r.model, usage: r.usage });
    res.json({ ...parsed, model: r.model, usage: r.usage });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 4) Negotiation Simulator: simulate against counterparty positions with outcomes
router.post('/negotiation-simulator', auth, aiRateLimiter, async (req, res) => {
  try {
    const { our_position, counterparty_profile, scenario, contract_type } = req.body;
    if (!our_position || !counterparty_profile) {
      return res.status(400).json({ error: 'our_position and counterparty_profile are required' });
    }

    const prompt = `Simulate a contract negotiation between our team and the counterparty.

Contract Type: ${contract_type || 'commercial agreement'}
Our Position: ${typeof our_position === 'string' ? our_position : JSON.stringify(our_position)}
Counterparty Profile: ${typeof counterparty_profile === 'string' ? counterparty_profile : JSON.stringify(counterparty_profile)}
Scenario: ${scenario || 'standard negotiation'}

Run a 5-round simulation. For each round, predict counterparty response, recommend our move, and project outcome trajectory.

Return JSON:
{
  "rounds": [
    {
      "round": 1,
      "our_move": "string",
      "predicted_counterparty_response": "string",
      "tactic_used": "anchoring|concession|pressure|reciprocity|deadline",
      "outcome_delta": "favorable|unfavorable|neutral",
      "tension_level": "low|medium|high"
    }
  ],
  "final_outcome": {
    "agreement_likelihood": 0.0,
    "estimated_terms": "string",
    "value_captured_pct": 0,
    "concessions_made": ["string"],
    "concessions_won": ["string"]
  },
  "key_insights": ["insight"],
  "recommended_strategy": "Detailed playbook for actual negotiation",
  "risk_factors": ["string"]
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.7, maxTokens: 3500 });
    const parsed = parseAIJson(r.content) || { raw: r.content };
    await saveAIResult(pool, { feature: 'negotiation-simulator', user_id: userId(req), input: { contract_type, scenario }, output: parsed, model: r.model, usage: r.usage });
    res.json({ ...parsed, model: r.model, usage: r.usage });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 5) Renewal Auto-Generator: draft renewal terms based on historical amendments and data
router.post('/renewal-generator', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id, market_changes, our_priorities } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const [cRes, aRes, oRes, rRes] = await Promise.all([
      pool.query('SELECT * FROM contracts WHERE id=$1', [contract_id]),
      pool.query('SELECT * FROM amendments WHERE contract_id=$1 ORDER BY version_number DESC LIMIT 10', [contract_id]),
      pool.query('SELECT * FROM obligations WHERE contract_id=$1', [contract_id]),
      pool.query('SELECT * FROM renewals WHERE contract_id=$1 ORDER BY created_at DESC LIMIT 5', [contract_id]),
    ]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });

    const prompt = `Generate a complete renewal proposal for this contract based on historical performance and amendments.

Contract: ${JSON.stringify(cRes.rows[0]).slice(0, 1500)}
Past Amendments: ${JSON.stringify(aRes.rows).slice(0, 2000)}
Active Obligations: ${JSON.stringify(oRes.rows).slice(0, 1500)}
Past Renewals: ${JSON.stringify(rRes.rows).slice(0, 1500)}
Market Changes: ${market_changes || 'none specified'}
Our Priorities: ${our_priorities ? (Array.isArray(our_priorities) ? our_priorities.join(', ') : our_priorities) : 'cost optimization, risk reduction'}

Return JSON:
{
  "contract_id": ${contract_id},
  "renewal_recommendation": "renew|renegotiate|terminate",
  "proposed_terms": {
    "duration_months": 12,
    "value": 0,
    "currency": "USD",
    "price_change_pct": 0,
    "auto_renew": true,
    "notice_period_days": 60,
    "key_changes": ["change description"]
  },
  "draft_renewal_text": "Full multi-paragraph renewal addendum draft",
  "new_clauses_to_add": [{ "title": "string", "rationale": "string" }],
  "clauses_to_remove": [{ "title": "string", "rationale": "string" }],
  "negotiation_levers": ["string"],
  "risk_assessment": { "level": "low|medium|high", "factors": ["string"] },
  "executive_summary": "string"
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.4, maxTokens: 4000 });
    const parsed = parseAIJson(r.content) || { raw: r.content };
    await saveAIResult(pool, { feature: 'renewal-generator', contract_id, user_id: userId(req), input: { market_changes, our_priorities }, output: parsed, model: r.model, usage: r.usage });
    res.json({ ...parsed, model: r.model, usage: r.usage });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 6) Compliance Drift Detector: flag contracts no longer compliant with regulation changes
router.post('/compliance-drift', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_id, regulation_changes, regulations } = req.body;
    if (!contract_id) return res.status(400).json({ error: 'contract_id is required' });

    const cRes = await pool.query('SELECT * FROM contracts WHERE id=$1', [contract_id]);
    if (cRes.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });

    const clausesRes = await pool.query('SELECT id, title, clause_type, content FROM clauses WHERE contract_id=$1', [contract_id]);

    const prompt = `Analyze this contract for compliance drift against current regulations.

Contract: ${JSON.stringify(cRes.rows[0]).slice(0, 1500)}
Clauses: ${JSON.stringify(clausesRes.rows).slice(0, 3000)}
Regulations to check: ${regulations || 'GDPR, CCPA, SOX, HIPAA, PCI-DSS (as applicable)'}
Recent Regulation Changes: ${regulation_changes || 'use your knowledge of 2024-2025 regulatory updates'}

Return JSON:
{
  "contract_id": ${contract_id},
  "drift_score": 0,
  "compliance_status": "compliant|drift_detected|non_compliant",
  "regulations_checked": ["string"],
  "drifts": [
    {
      "regulation": "string",
      "specific_requirement": "string",
      "current_clause_id": 0,
      "current_clause_text": "string",
      "drift_severity": "low|medium|high|critical",
      "remediation": "What needs to change",
      "suggested_clause_text": "Updated clause text"
    }
  ],
  "missing_clauses": [{ "regulation": "string", "required_clause": "string", "suggested_text": "string" }],
  "remediation_priority": [{ "rank": 1, "drift_id": 1, "deadline_days": 30 }],
  "executive_summary": "string"
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.3, maxTokens: 4000 });
    const parsed = parseAIJson(r.content) || { raw: r.content };
    await saveAIResult(pool, { feature: 'compliance-drift', contract_id, user_id: userId(req), input: { regulations, regulation_changes }, output: parsed, model: r.model, usage: r.usage });
    res.json({ ...parsed, model: r.model, usage: r.usage });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 7) Party Intelligence Aggregator
router.post('/party-intelligence', auth, aiRateLimiter, async (req, res) => {
  try {
    const { party_id, party_name } = req.body;
    if (!party_id && !party_name) return res.status(400).json({ error: 'party_id or party_name is required' });

    let party = null;
    if (party_id) {
      const r = await pool.query('SELECT * FROM parties WHERE id=$1', [party_id]);
      party = r.rows[0];
    } else {
      const r = await pool.query('SELECT * FROM parties WHERE name ILIKE $1 LIMIT 1', [party_name]);
      party = r.rows[0];
    }
    if (!party) return res.status(404).json({ error: 'Party not found' });

    // Find all contracts mentioning this party (party_a or party_b)
    const contractsRes = await pool.query(
      `SELECT * FROM contracts WHERE party_a ILIKE $1 OR party_b ILIKE $1 ORDER BY created_at DESC LIMIT 50`,
      [`%${party.name}%`]
    );

    // Aggregate stats
    const total = contractsRes.rows.length;
    const totalValue = contractsRes.rows.reduce((s, c) => s + (parseFloat(c.value) || 0), 0);
    const byStatus = contractsRes.rows.reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {});
    const byRisk = contractsRes.rows.reduce((acc, c) => { acc[c.risk_level] = (acc[c.risk_level] || 0) + 1; return acc; }, {});

    const prompt = `Generate a party intelligence dossier for this counterparty using the data below.

Party Profile: ${JSON.stringify(party).slice(0, 1500)}
Stats: total_contracts=${total}, total_value=${totalValue}, by_status=${JSON.stringify(byStatus)}, by_risk=${JSON.stringify(byRisk)}
Recent Contracts: ${JSON.stringify(contractsRes.rows.slice(0, 10)).slice(0, 3000)}

Return JSON:
{
  "party_id": ${party.id},
  "party_name": "${party.name}",
  "summary": "1 paragraph executive summary",
  "relationship_health": "excellent|good|fair|poor",
  "trust_score": 0,
  "stats": ${JSON.stringify({ total_contracts: total, total_value: totalValue, by_status: byStatus, by_risk: byRisk })},
  "negotiation_style": "Inferred negotiation style and tendencies",
  "common_pain_points": ["string"],
  "leverage_points": ["string"],
  "risk_indicators": [{ "type": "string", "severity": "low|medium|high", "description": "string" }],
  "recommended_engagement_strategy": "string",
  "next_actions": ["string"]
}`;

    const r = await callOpenRouter(SYSTEM, prompt, { temperature: 0.4, maxTokens: 3000 });
    const parsed = parseAIJson(r.content) || { raw: r.content };
    await saveAIResult(pool, { feature: 'party-intelligence', user_id: userId(req), input: { party_id: party.id }, output: parsed, model: r.model, usage: r.usage });
    res.json({ ...parsed, model: r.model, usage: r.usage });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// 8) Browse persisted ai_results (paginated)
router.get('/results', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { feature, contract_id } = req.query;

    // Ensure table exists
    await pool.query(`CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY, feature VARCHAR(100) NOT NULL, contract_id INTEGER, user_id INTEGER,
      input JSONB, output JSONB, model VARCHAR(255), usage JSONB, created_at TIMESTAMP DEFAULT NOW()
    )`);

    const params = [];
    const conds = [];
    if (feature) { params.push(feature); conds.push(`feature = $${params.length}`); }
    if (contract_id) { params.push(contract_id); conds.push(`contract_id = $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countR = await pool.query(`SELECT COUNT(*) FROM ai_results ${where}`, params);
    const total = parseInt(countR.rows[0].count);
    params.push(limit, offset);
    const dataR = await pool.query(`SELECT * FROM ai_results ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    res.json({ data: dataR.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/results/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM ai_results WHERE id=$1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
