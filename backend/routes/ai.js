const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { aiRateLimiter } = require('../middleware/rateLimiter');
const { callOpenRouter, saveAIResult } = require('../services/aiHelper');
const router = express.Router();

const aiCall = async (system, userMsg, temp = 0.7) => {
  const r = await callOpenRouter(system, userMsg, { temperature: temp, maxTokens: 4096 });
  return { choices: [{ message: { content: r.content } }], model: r.model, usage: r.usage };
};

// Chat - General contract assistant
router.post('/chat', auth, aiRateLimiter, async (req, res) => {
  try {
    const { message, conversation_id } = req.body;
    const data = await aiCall(
      'You are an expert contract lawyer and contract lifecycle management specialist. Help users draft, review, negotiate, and manage contracts. Provide specific legal guidance, risk analysis, and compliance advice. Always note that your advice should be reviewed by qualified legal counsel.',
      message
    );
    const reply = data.choices?.[0]?.message?.content || 'No response';
    let convId = conversation_id;
    if (!convId) {
      const r = await pool.query('INSERT INTO conversations (title, model, status) VALUES ($1,$2,$3) RETURNING id',
        [message.substring(0, 100), process.env.OPENROUTER_MODEL, 'active']);
      convId = r.rows[0].id;
    }
    await pool.query('INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1,$2,$3)', [convId, 'user', message]);
    await pool.query('INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1,$2,$3)', [convId, 'assistant', reply]);
    res.json({ conversation_id: convId, message: reply, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    console.error('AI Error:', err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Draft Contract
router.post('/draft-contract', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_type, parties, key_terms, jurisdiction, duration } = req.body;
    const data = await aiCall(
      'You are a senior contract attorney. Draft professional, legally sound contracts with clear language, proper structure, and comprehensive terms. Include standard protective clauses.',
      `Draft a ${contract_type || 'service agreement'} contract:\n\nParties: ${parties || 'Party A and Party B'}\nKey Terms: ${key_terms || 'Standard terms'}\nJurisdiction: ${jurisdiction || 'United States'}\nDuration: ${duration || '12 months'}\n\nInclude:\n1. Recitals and definitions\n2. Scope of work/services\n3. Payment terms\n4. Confidentiality clause\n5. Intellectual property rights\n6. Limitation of liability\n7. Termination provisions\n8. Dispute resolution\n9. Force majeure\n10. General provisions\n11. Signature blocks`,
      0.5
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Review Contract
router.post('/review-contract', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_text, review_focus } = req.body;
    const focuses = {
      'comprehensive': 'Perform a comprehensive legal review covering all aspects.',
      'risk': 'Focus on identifying legal risks, liabilities, and exposure points.',
      'compliance': 'Focus on regulatory compliance issues and requirements.',
      'negotiation': 'Identify terms favorable to the other party and suggest counter-proposals.',
      'termination': 'Analyze termination clauses, exit strategies, and wind-down provisions.',
      'ip': 'Focus on intellectual property rights, ownership, and licensing terms.',
    };
    const data = await aiCall(
      'You are a contract review specialist. Analyze contracts thoroughly, identify risks, and provide actionable recommendations with specific clause references.',
      `${focuses[review_focus] || focuses['comprehensive']}\n\nContract Text:\n${contract_text}\n\nProvide:\n1. Executive Summary\n2. Key Findings (rated by severity: Critical/High/Medium/Low)\n3. Risk Assessment Score (1-10)\n4. Missing Clauses\n5. Ambiguous Language\n6. Recommended Changes with specific wording\n7. Compliance Issues\n8. Overall Assessment`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Analyze Risk
router.post('/analyze-risk', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_text, industry, contract_value } = req.body;
    const data = await aiCall(
      'You are a legal risk analyst specializing in contract risk assessment. Evaluate contracts for financial, legal, operational, and reputational risks.',
      `Analyze the risk profile of this contract:\n\n${contract_text}\n\nIndustry: ${industry || 'General'}\nContract Value: ${contract_value || 'Not specified'}\n\nProvide:\n1. Overall Risk Score (1-100)\n2. Risk Category Breakdown:\n   - Financial Risk (score + details)\n   - Legal Risk (score + details)\n   - Operational Risk (score + details)\n   - Compliance Risk (score + details)\n   - Reputational Risk (score + details)\n3. Top 5 Risk Factors\n4. Mitigation Recommendations\n5. Red Flags\n6. Risk Heat Map (text-based)\n7. Recommended Actions`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Generate Clause
router.post('/generate-clause', auth, aiRateLimiter, async (req, res) => {
  try {
    const { clause_type, context, jurisdiction, tone } = req.body;
    const data = await aiCall(
      'You are a contract clause drafting specialist. Write precise, enforceable contract clauses that protect client interests while remaining fair and balanced.',
      `Generate a ${clause_type || 'confidentiality'} clause:\n\nContext: ${context || 'Standard business agreement'}\nJurisdiction: ${jurisdiction || 'United States'}\nTone: ${tone || 'professional and balanced'}\n\nProvide:\n1. Clause Title\n2. Full Clause Text (ready to insert)\n3. Plain-Language Summary\n4. Key Protections\n5. Potential Negotiation Points\n6. Alternative Versions (strong/balanced/light)\n7. Related Clauses to Consider`,
      0.5
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Compare Contracts
router.post('/compare-contracts', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_a, contract_b } = req.body;
    const data = await aiCall(
      'You are a contract comparison specialist. Analyze differences between contract versions, highlight material changes, and assess their implications.',
      `Compare these two contract versions:\n\n--- Contract A ---\n${contract_a}\n\n--- Contract B ---\n${contract_b}\n\nProvide:\n1. Summary of Changes\n2. Material Differences (table format)\n3. Added Clauses\n4. Removed Clauses\n5. Modified Terms\n6. Impact Assessment\n7. Risk Changes (better/worse/neutral)\n8. Recommendation`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Compliance Check
router.post('/check-compliance', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_text, regulations, industry } = req.body;
    const data = await aiCall(
      'You are a regulatory compliance expert. Assess contracts against applicable laws, regulations, and industry standards.',
      `Check this contract for compliance:\n\n${contract_text}\n\nRegulations: ${regulations || 'GDPR, SOX, HIPAA (if applicable)'}\nIndustry: ${industry || 'General'}\n\nProvide:\n1. Compliance Score (1-100)\n2. Regulatory Requirements Met\n3. Compliance Gaps\n4. Required Additions\n5. Clause-by-Clause Compliance Map\n6. Jurisdiction-Specific Issues\n7. Data Protection Assessment\n8. Remediation Priority List`,
      0.3
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Negotiate Terms
router.post('/negotiate', auth, aiRateLimiter, async (req, res) => {
  try {
    const { original_terms, desired_outcome, leverage_points } = req.body;
    const data = await aiCall(
      'You are an expert contract negotiator. Develop negotiation strategies, counter-proposals, and persuasive arguments for contract terms.',
      `Develop a negotiation strategy:\n\nOriginal Terms:\n${original_terms}\n\nDesired Outcome: ${desired_outcome || 'More favorable terms'}\nLeverage Points: ${leverage_points || 'Not specified'}\n\nProvide:\n1. Negotiation Strategy\n2. Counter-Proposal Language\n3. Key Arguments\n4. Concession Points (what to give)\n5. Must-Haves (non-negotiable)\n6. Nice-to-Haves\n7. Walk-Away Points\n8. Suggested Timeline\n9. Communication Script`,
      0.6
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Summarize Contract
router.post('/summarize', auth, aiRateLimiter, async (req, res) => {
  try {
    const { contract_text, audience } = req.body;
    const data = await aiCall(
      'You are a legal document summarizer. Create clear, accurate summaries of contracts for various audiences while preserving critical details.',
      `Summarize this contract for ${audience || 'business executives'}:\n\n${contract_text}\n\nProvide:\n1. One-Paragraph Executive Summary\n2. Key Terms Table\n3. Financial Obligations\n4. Important Dates and Deadlines\n5. Rights and Responsibilities\n6. Termination Conditions\n7. Risk Highlights\n8. Action Items`,
      0.4
    );
    res.json({ result: data.choices?.[0]?.message?.content, model: data.model, usage: data.usage, raw_response: data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.error?.message || err.message });
  }
});

// Conversations
router.get('/conversations', auth, async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM conversations ORDER BY created_at DESC')).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/conversations/:id', auth, async (req, res) => {
  try {
    const conv = await pool.query('SELECT * FROM conversations WHERE id = $1', [req.params.id]);
    if (conv.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const msgs = await pool.query('SELECT * FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC', [req.params.id]);
    res.json({ ...conv.rows[0], messages: msgs.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
router.delete('/conversations/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM conversation_messages WHERE conversation_id = $1', [req.params.id]);
    await pool.query('DELETE FROM conversations WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
