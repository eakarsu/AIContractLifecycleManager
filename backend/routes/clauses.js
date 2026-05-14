const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const axios = require('axios');
const router = express.Router();

const AI_SYSTEM = 'You are an expert contract lawyer and lifecycle management specialist.';

const aiCall = async (userMsg, temp = 0.5) => {
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: 'anthropic/claude-3-5-sonnet-20241022',
      messages: [{ role: 'system', content: AI_SYSTEM }, { role: 'user', content: userMsg }],
      temperature: temp,
      max_tokens: 3000,
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

// GET /api/clauses — list with pagination
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { contract_id, clause_type, search } = req.query;

    const params = [];
    const conditions = [];
    if (contract_id) { params.push(contract_id); conditions.push(`contract_id = $${params.length}`); }
    if (clause_type) { params.push(clause_type); conditions.push(`clause_type = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(title ILIKE $${params.length} OR content ILIKE $${params.length})`); }
    const whereStr = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM clauses ${whereStr}`, params);
    const total = parseInt(countRes.rows[0].count);
    params.push(limit, offset);
    const dataRes = await pool.query(
      `SELECT * FROM clauses ${whereStr} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: dataRes.rows, total, page, limit, total_pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/clauses/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM clauses WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Clause not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/clauses
router.post('/', auth, async (req, res) => {
  try {
    const { contract_id, clause_type, title, content, variations } = req.body;
    if (!clause_type || !title) return res.status(400).json({ error: 'clause_type and title are required' });
    const r = await pool.query(
      'INSERT INTO clauses (contract_id, clause_type, title, content, variations, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,NOW(),NOW()) RETURNING *',
      [contract_id || null, clause_type, title, content || null, variations ? JSON.stringify(variations) : null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/clauses/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { contract_id, clause_type, title, content, variations } = req.body;
    const r = await pool.query(
      'UPDATE clauses SET contract_id=$1, clause_type=$2, title=$3, content=$4, variations=$5, updated_at=NOW() WHERE id=$6 RETURNING *',
      [contract_id || null, clause_type, title, content || null, variations ? JSON.stringify(variations) : null, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Clause not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/clauses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM clauses WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Clause not found' });
    res.json({ message: 'Clause deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/clauses/:id/ai-generate — AI generates/rewrites clause content
router.post('/:id/ai-generate', auth, async (req, res) => {
  try {
    const { clause_type, context } = req.body;
    const clauseRow = await pool.query('SELECT * FROM clauses WHERE id = $1', [req.params.id]);
    const clause = clauseRow.rows[0];
    const effectiveType = clause_type || clause?.clause_type || 'general';
    const effectiveContext = context || clause?.content || 'Standard business agreement';

    const content = await aiCall(
      `Generate a professional, enforceable contract clause of type "${effectiveType}".
Context/existing content: ${effectiveContext}

Provide:
1. Clause Title
2. Full legally-sound clause text ready to insert
3. Plain-language summary
4. Key protections offered
5. Alternative versions (strict / balanced / lenient)

Format the response clearly with section headers.`
    );

    if (clause) {
      const updated = await pool.query(
        'UPDATE clauses SET content=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
        [content, req.params.id]
      );
      return res.json({ clause: updated.rows[0], ai_content: content });
    }
    res.json({ ai_content: content });
  } catch (err) { res.status(500).json({ error: err.response?.data?.error?.message || err.message }); }
});

module.exports = router;
