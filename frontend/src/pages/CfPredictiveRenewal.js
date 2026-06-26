// // === Batch 02 Gaps & Frontend Mounts ===
import React, { useState } from 'react';
import AIResultRenderer from '../components/AIResultRenderer';

/**
 * Gap/CFS Feature Page: Predictive renewal
 * Slug: predictive-renewal
 * Backend: /api/cf-predictive-renewal
 */
export default function PredictiveRenewalPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const sampleRequests = [
      {
          "label": "Scenario",
          "value": "Run Predictive renewal for a realistic customer case.\nContext: a team needs a practical recommendation based on incomplete operating data.\nGoal: identify the best action, key risks, missing information, and expected business impact.\nReturn: summary, prioritized action plan, assumptions, and follow-up questions."
      },
      {
          "label": "Data sample",
          "value": "Analyze this Predictive renewal data sample.\nInput records:\n- Record 1: urgent, customer impact high, owner unassigned\n- Record 2: medium priority, blocked by missing data\n- Record 3: recurring issue, automation opportunity\nReturn structured findings, anomalies, recommendations, and confidence."
      },
      {
          "label": "Executive review",
          "value": "Prepare an executive review for Predictive renewal.\nAudience: business owner, operations lead, and implementation team.\nInclude impact, risk, estimated effort, decision points, and a concise next-step plan."
      }
  ];

  const applySampleRequest = (value) => {
    setInput(value);
    setError(null);
    setResult(null);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem('token');
      let body;
      try { body = JSON.parse(input); } catch (_) { body = { input }; }
      const res = await fetch('/api/cf-predictive-renewal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto', color: '#e5e7eb' }}>
      <h2 style={{ marginBottom: 8 }}>Predictive renewal</h2>
      <p style={{ opacity: 0.75, marginBottom: 16 }}>Predict which contracts will be renegotiated; proactively model scenarios before renewal discussions.</p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ fontSize: 13, opacity: 0.85 }}>
          Input (text or JSON):
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {sampleRequests.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => applySampleRequest(sample.value)}
              style={{ padding: '6px 10px', background: '#eef2ff', color: '#1e3a8a', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >
              {sample.label}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          placeholder='Describe the case or paste JSON, e.g. {"context": "..."}'
          style={{
            padding: 10,
            borderRadius: 6,
            border: '1px solid #374151',
            background: '#111827',
            color: '#e5e7eb',
            fontFamily: 'monospace',
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px',
            borderRadius: 6,
            border: 'none',
            background: loading ? '#6b7280' : '#2563eb',
            color: '#fff',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 600,
            alignSelf: 'flex-start',
          }}
        >
          {loading ? 'Running...' : 'Run Analysis'}
        </button>
      </form>
      {error && (
        <div style={{ marginTop: 16, padding: 12, background: '#7f1d1d', borderRadius: 6, color: '#fee2e2' }}>
          Error: {error}
        </div>
      )}
      <AIResultRenderer result={result} title="AI Analysis" />
    </div>
  );
}
