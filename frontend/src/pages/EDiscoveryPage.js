import React, { useState } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import { FiSearch, FiLock, FiClock, FiSend } from 'react-icons/fi';

const tools = [
  { id: 'analyze-relevance', name: 'Document Relevance', icon: <FiSearch/>, color: '#6366f1',
    desc: 'Score how relevant a document is to a legal case',
    fields: [
      { name: 'document_text', label: 'Document Text', type: 'textarea', required: true },
      { name: 'case_description', label: 'Case Description', type: 'textarea', required: true },
    ]
  },
  { id: 'check-privilege', name: 'Privilege Check', icon: <FiLock/>, color: '#ef4444',
    desc: 'Detect attorney-client privilege protection',
    fields: [
      { name: 'document_text', label: 'Document Text', type: 'textarea', required: true },
    ]
  },
  { id: 'extract-timeline', name: 'Timeline Extractor', icon: <FiClock/>, color: '#10b981',
    desc: 'Extract chronological events from a document',
    fields: [
      { name: 'document_text', label: 'Document Text', type: 'textarea', required: true },
    ]
  },
];

const presetButtonStyle = {
  padding: '7px 11px',
  borderRadius: 8,
  border: '1px solid #bfdbfe',
  background: '#eff6ff',
  color: '#1d4ed8',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
};

const toolPresets = {
  'analyze-relevance': [
    { label: 'Termination email', form: { document_text: 'Email from Vendor COO: We should terminate the Acme implementation unless they accept the revised pricing by Friday. Their team missed two data delivery deadlines, and we need to preserve all communications about service credits.', case_description: 'Dispute over SaaS implementation delays, termination rights, missed milestones, and service credit obligations.' } },
    { label: 'Pricing memo', form: { document_text: 'Internal memo: proposed 18% renewal increase for Acme due to usage spikes. Sales is concerned customer will challenge auto-renewal notice timing and audit the overage calculations.', case_description: 'Contract renewal dispute involving price increase, notice requirements, usage calculations, and audit rights.' } },
  ],
  'check-privilege': [
    { label: 'Counsel email', form: { document_text: 'From: General Counsel. To: CFO. Subject: Legal advice on Acme termination. My legal assessment is that immediate termination may breach the 30-day cure provision. I recommend sending a reservation of rights letter first.' } },
    { label: 'Business update', form: { document_text: 'From: Account Manager. To: Sales VP. Subject: Acme renewal. Customer is frustrated with onboarding delays and wants a discount. I think we can close if we offer a one-time service credit.' } },
  ],
  'extract-timeline': [
    { label: 'Dispute narrative', form: { document_text: 'On January 5, the parties signed the MSA. On February 10, Customer delivered initial data. On March 1, Vendor missed the onboarding milestone. On March 15, Customer sent notice of breach. On April 1, Vendor offered service credits.' } },
    { label: 'Renewal sequence', form: { document_text: 'The renewal notice was sent on May 2. Customer objected on May 15. Vendor sent revised pricing on May 22. Procurement requested backup usage data on June 3. Legal escalated the dispute on June 10.' } },
  ],
};

function ResultDisplay({ result }) {
  if (!result) return null;
  if (result.raw || typeof result === 'string') {
    return <ReactMarkdown>{result.raw || result}</ReactMarkdown>;
  }
  return (
    <div className="ai-result">
      {result.relevance_score !== undefined && (
        <div className="ai-score-big">
          <div className="ai-score-num">{result.relevance_score}</div>
          <div className="ai-score-text">Relevance Score</div>
        </div>
      )}
      {result.is_privileged !== undefined && (
        <div className={`ai-callout ${result.is_privileged ? 'ai-callout-danger' : 'ai-callout-success'}`}>
          <h4>{result.is_privileged ? 'PRIVILEGED' : 'Not Privileged'}</h4>
          {result.privilege_type && <p><strong>Type:</strong> {result.privilege_type}</p>}
          {result.confidence !== undefined && <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(0)}%</p>}
          {result.reasoning && <p>{result.reasoning}</p>}
        </div>
      )}
      {result.key_findings && Array.isArray(result.key_findings) && (
        <div className="ai-section">
          <h4>Key Findings</h4>
          {result.key_findings.map((f, i) => (
            <div key={i} className="ai-row">
              <strong>{f.finding}</strong>
              {f.importance && <p style={{color:'var(--text-secondary)',fontSize:13}}>{f.importance}</p>}
            </div>
          ))}
        </div>
      )}
      {result.entities_found && Array.isArray(result.entities_found) && (
        <div className="ai-section">
          <h4>Entities</h4>
          {result.entities_found.map((e, i) => (
            <div key={i} className="ai-row">
              <strong>{e.name}</strong> <span className="badge badge-pending">{e.type}</span>
              {e.role && <p style={{color:'var(--text-secondary)',fontSize:13}}>{e.role}</p>}
            </div>
          ))}
        </div>
      )}
      {result.dates_mentioned && Array.isArray(result.dates_mentioned) && (
        <div className="ai-section">
          <h4>Dates Mentioned</h4>
          {result.dates_mentioned.map((d, i) => (
            <div key={i} className="ai-row"><strong>{d.date}</strong> — {d.context}</div>
          ))}
        </div>
      )}
      {result.events && Array.isArray(result.events) && (
        <div className="ai-section">
          <h4>Timeline</h4>
          {result.events.map((e, i) => (
            <div key={i} className="ai-timeline-item">
              <div className="ai-timeline-date">{e.date}</div>
              <div className="ai-timeline-body">
                <strong>{e.description}</strong>
                {e.parties_involved && <p style={{fontSize:12,color:'var(--text-secondary)'}}>Parties: {e.parties_involved.join(', ')}</p>}
                {e.significance && <p style={{fontSize:12,marginTop:4}}>{e.significance}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {result.parties_involved && Array.isArray(result.parties_involved) && (
        <div className="ai-section">
          <h4>Parties Involved</h4>
          {result.parties_involved.map((p, i) => (
            <div key={i} className="ai-row"><strong>{p.name}</strong> — {p.role}</div>
          ))}
        </div>
      )}
      {result.recommendations && Array.isArray(result.recommendations) && (
        <div className="ai-callout ai-callout-info">
          <h4>Recommendations</h4>
          <ul>{result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      {result.recommendation && <div className="ai-callout ai-callout-info"><h4>Recommendation</h4><p>{result.recommendation}</p></div>}
      {result.privilege_assessment && (
        <div className="ai-callout">
          <h4>Privilege Assessment</h4>
          <p><strong>Privileged:</strong> {result.privilege_assessment.is_privileged ? 'Yes' : 'No'}</p>
          {result.privilege_assessment.reason && <p>{result.privilege_assessment.reason}</p>}
        </div>
      )}
      {result.date_range && (
        <div className="ai-callout ai-callout-info">
          <h4>Date Range</h4>
          <p>From <strong>{result.date_range.earliest}</strong> to <strong>{result.date_range.latest}</strong></p>
        </div>
      )}
      {result.gaps_identified && Array.isArray(result.gaps_identified) && result.gaps_identified.length > 0 && (
        <div className="ai-callout ai-callout-warning">
          <h4>Gaps Identified</h4>
          <ul>{result.gaps_identified.map((g, i) => <li key={i}>{g}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

export default function EDiscoveryPage() {
  const [activeTool, setActiveTool] = useState(tools[0].id);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const tool = tools.find(t => t.id === activeTool);
  const presets = toolPresets[activeTool] || [];
  const applyPreset = (preset) => {
    setForm(preset.form || {});
    setResult(null);
    setError(null);
  };

  const submit = async () => {
    const missing = tool.fields.filter(f => f.required && !form[f.name]?.trim());
    if (missing.length) { setError(`Required: ${missing.map(f => f.label).join(', ')}`); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const { data } = await api.post(`/discovery-agents/${activeTool}`, form);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">eDiscovery AI Agents</h1>
          <p className="page-subtitle">Document relevance, privilege detection, timeline extraction</p>
        </div>
      </div>
      <div className="ai-tools-grid">
        {tools.map(t => (
          <div key={t.id} className={`ai-tool-card ${activeTool === t.id ? 'active' : ''}`}
               onClick={() => { setActiveTool(t.id); setForm({}); setResult(null); setError(null); }}>
            <div className="ai-tool-icon" style={{color: t.color}}>{t.icon}</div>
            <div className="ai-tool-name">{t.name}</div>
            <div className="ai-tool-desc">{t.desc}</div>
          </div>
        ))}
      </div>
      <div className="ai-chat-container">
        <div className="ai-form">
          {presets.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              {presets.map(preset => (
                <button key={preset.label} type="button" onClick={() => applyPreset(preset)} style={presetButtonStyle}>
                  {preset.label}
                </button>
              ))}
            </div>
          )}
          {tool.fields.map(f => (
            <div className="form-group" key={f.name}>
              <label className="form-label">{f.label}{f.required && ' *'}</label>
              <textarea className="form-textarea" rows={f.name === 'document_text' ? 8 : 3}
                        value={form[f.name] || ''}
                        onChange={e => setForm({...form, [f.name]: e.target.value})}
                        placeholder={`Paste ${f.label.toLowerCase()} here...`} />
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button className="btn btn-primary" onClick={submit} disabled={loading}>
              <FiSend/> {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>
        {error && <div className="ai-callout ai-callout-danger" style={{marginTop:16}}>{error}</div>}
        {loading && <div className="loading"><div className="spinner"></div>Running AI analysis...</div>}
        {result && (
          <div style={{marginTop:24}}>
            <h3 style={{marginBottom:16,fontSize:16,color:'var(--text-secondary)'}}>Result</h3>
            <ResultDisplay result={result} />
          </div>
        )}
      </div>
    </div>
  );
}
