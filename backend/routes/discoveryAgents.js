const router = require('express').Router();
const axios = require('axios');
const auth = require('../middleware/auth');

const ai = async (prompt) => {
  const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
    messages: [{ role: 'user', content: prompt }]
  }, { headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' } });
  const c = r.data.choices[0].message.content;
  try { return JSON.parse(c); } catch { return { analysis: c }; }
};

router.post('/analyze-relevance', auth, async (req, res) => {
  try {
    const { document_text, case_description } = req.body;
    const result = await ai(`Analyze this document for legal relevance to the case.\n\nDocument: ${document_text}\nCase: ${case_description}\n\nJSON: {"relevance_score":85,"key_findings":[{"finding":"string","importance":"string"}],"entities_found":[{"name":"string","type":"string","role":"string"}],"dates_mentioned":[{"date":"string","context":"string"}],"privilege_assessment":{"is_privileged":false,"reason":"string"},"recommendation":"string"}`);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/check-privilege', auth, async (req, res) => {
  try {
    const { document_text } = req.body;
    const result = await ai(`Check if this document is protected by attorney-client privilege.\n\nDocument: ${document_text}\n\nJSON: {"is_privileged":false,"privilege_type":"string","confidence":0.9,"reasoning":"string","parties_involved":[{"name":"string","role":"string"}],"recommendations":["string"]}`);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/extract-timeline', auth, async (req, res) => {
  try {
    const { document_text } = req.body;
    const result = await ai(`Extract chronological events from this legal document.\n\nDocument: ${document_text}\n\nJSON: {"events":[{"date":"string","description":"string","parties_involved":["string"],"significance":"string"}],"date_range":{"earliest":"string","latest":"string"},"key_periods":[{"period":"string","description":"string"}],"gaps_identified":["string"]}`);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
