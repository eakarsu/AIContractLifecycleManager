import React, { useState } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import { FiCheckSquare, FiRefreshCw, FiActivity, FiSend, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';

// Advanced AI tools (matches backend /api/ai routes in routes/aiNew.js)
const tools = [
  { id: 'obligation-extractor', name: 'Obligation Extractor', icon: <FiCheckSquare/>, color: '#10b981',
    desc: 'Extract every obligation, deadline, and penalty from contract text',
    fields: [
      { name: 'contract_text', label: 'Contract Text', type: 'textarea', required: true },
    ]},
  { id: 'renewal-advisor', name: 'Renewal Advisor', icon: <FiRefreshCw/>, color: '#3b82f6',
    desc: 'Recommend renewal terms based on contract history',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
    ]},
  { id: 'contract-health', name: 'Contract Health', icon: <FiActivity/>, color: '#f59e0b',
    desc: 'Score lifecycle health from obligations, milestones, approvals',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
    ]},
  { id: 'predict-renewal-success', name: 'Predict Renewal Success', icon: <FiTrendingUp/>, color: '#8b5cf6',
    desc: 'Predict renewal probability and recommended pre-renewal actions',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
    ]},
  { id: 'predict-approval-likelihood', name: 'Predict Approval Likelihood', icon: <FiCheckCircle/>, color: '#ef4444',
    desc: 'Predict approval outcome and identify bottleneck steps',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
    ]},
];

export default function AIAdvancedPage() {
  const [activeTool, setActiveTool] = useState(tools[0].id);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const tool = tools.find(t => t.id === activeTool);

  const submit = async () => {
    setError(null); setResult(null);
    const required = tool.fields.filter(f => f.required);
    const missing = required.find(f => !form[f.name] || String(form[f.name]).trim() === '');
    if (missing) { setError(`${missing.label} is required`); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.contract_id !== undefined && form.contract_id !== '') {
        payload.contract_id = Number(form.contract_id);
      }
      const { data } = await api.post(`/ai/${activeTool}`, payload);
      setResult(data);
    } catch (e) {
      const status = e.response?.status;
      const errMsg = e.response?.data?.error || e.message;
      if (status === 503) {
        setError('AI service unavailable — OPENROUTER_API_KEY is not set on the server.');
      } else {
        setError(errMsg);
      }
    }
    setLoading(false);
  };

  const renderResult = () => {
    if (!result) return null;
    const { model, usage, raw, ...content } = result;
    return (
      <div className="ai-result-card">
        <div className="ai-result-header">
          <span className="badge">Result</span>
          {model && <span className="ai-result-meta">Model: {model}</span>}
          {usage?.total_tokens && <span className="ai-result-meta">Tokens: {usage.total_tokens}</span>}
        </div>
        {raw ? (
          <div className="ai-raw-output"><ReactMarkdown>{raw}</ReactMarkdown></div>
        ) : (
          <pre className="ai-result-json">{JSON.stringify(content, null, 2)}</pre>
        )}
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Advanced Tools</h1>
          <p className="page-subtitle">Obligation extraction, renewal advice, contract health</p>
        </div>
      </div>

      <div className="ai-tools-grid">
        {tools.map(t => (
          <div key={t.id}
               className={`ai-tool-card ${activeTool===t.id?'active':''}`}
               onClick={() => { setActiveTool(t.id); setForm({}); setResult(null); setError(null); }}>
            <div className="ai-tool-icon" style={{color:t.color}}>{t.icon}</div>
            <div className="ai-tool-name">{t.name}</div>
            <div className="ai-tool-desc">{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="ai-chat-container">
        <div className="ai-form">
          {tool.fields.map(f => (
            <div key={f.name} className="form-group">
              <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
              {f.type === 'textarea' ? (
                <textarea className="form-textarea" rows={8}
                          value={form[f.name] || ''}
                          onChange={e => setForm({...form, [f.name]: e.target.value})}
                          placeholder={`Enter ${f.label.toLowerCase()}...`}/>
              ) : (
                <input className="form-input" type={f.type || 'text'}
                       value={form[f.name] || ''}
                       onChange={e => setForm({...form, [f.name]: e.target.value})}
                       placeholder={`Enter ${f.label.toLowerCase()}...`}/>
              )}
            </div>
          ))}

          <div style={{marginTop: 12}}>
            <button className="btn btn-primary" onClick={submit} disabled={loading}>
              <FiSend/> {loading ? 'Running...' : 'Run AI Tool'}
            </button>
          </div>

          {error && <div className="alert alert-error" style={{marginTop: 12}}>{error}</div>}
        </div>

        <div className="chat-messages" style={{maxHeight: 'none'}}>
          {loading && <div className="loading"><div className="spinner"></div>Running {tool.name}...</div>}
          {renderResult()}
        </div>
      </div>
    </div>
  );
}
