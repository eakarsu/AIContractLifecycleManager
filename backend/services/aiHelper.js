/**
 * Shared AI helper for OpenRouter calls.
 * Implements:
 *  - Single configured model (anthropic/claude-3-5-sonnet-20241022)
 *  - 3-strategy parseAIJson (raw JSON, ```json fence, first {...} block)
 *  - openRouterCall wrapper with retry on transient errors
 */

const axios = require('axios');

const DEFAULT_MODEL = 'anthropic/claude-3-5-sonnet-20241022';

async function callOpenRouter(systemPrompt, userMessage, { temperature = 0.5, maxTokens = 3000, model = DEFAULT_MODEL } = {}) {
  const url = `${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`;
  const payload = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature,
    max_tokens: maxTokens
  };
  const headers = {
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
    'X-Title': 'AI Contract Lifecycle Manager'
  };

  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await axios.post(url, payload, { headers, timeout: 90000 });
      return {
        content: r.data.choices?.[0]?.message?.content || '',
        model: r.data.model,
        usage: r.data.usage,
        raw: r.data
      };
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      // Retry on 5xx and rate limit errors
      if (status && status < 500 && status !== 429) break;
      await new Promise(res => setTimeout(res, 800 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/**
 * 3-strategy AI JSON parser:
 *   1. Try direct JSON.parse on the whole response
 *   2. Try extracting from ```json ... ``` fenced block
 *   3. Try extracting first balanced {...} block
 * Returns the parsed object or null if all strategies fail.
 */
function parseAIJson(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Strategy 1: direct parse
  try { return JSON.parse(trimmed); } catch (_) { /* continue */ }

  // Strategy 2: ```json fenced block
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1].trim()); } catch (_) { /* continue */ }
  }

  // Strategy 3: first balanced {...} block
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)); } catch (_) { /* continue */ }
  }

  return null;
}

/**
 * Persist AI result to ai_results JSONB table (creates table on first call).
 * Returns the inserted row id.
 */
async function saveAIResult(pool, { feature, contract_id, user_id, input, output, model, usage }) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_results (
        id SERIAL PRIMARY KEY,
        feature VARCHAR(100) NOT NULL,
        contract_id INTEGER,
        user_id INTEGER,
        input JSONB,
        output JSONB,
        model VARCHAR(255),
        usage JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ai_results_feature ON ai_results(feature);
      CREATE INDEX IF NOT EXISTS idx_ai_results_contract ON ai_results(contract_id);
    `);
    const r = await pool.query(
      `INSERT INTO ai_results (feature, contract_id, user_id, input, output, model, usage)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        feature,
        contract_id || null,
        user_id || null,
        input ? JSON.stringify(input) : null,
        output ? JSON.stringify(output) : null,
        model || null,
        usage ? JSON.stringify(usage) : null
      ]
    );
    return r.rows[0].id;
  } catch (err) {
    // Don't fail the request if persisting result fails
    console.error('saveAIResult error:', err.message);
    return null;
  }
}

module.exports = { callOpenRouter, parseAIJson, saveAIResult, DEFAULT_MODEL };
