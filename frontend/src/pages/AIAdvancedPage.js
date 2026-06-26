import React, { useState } from 'react';
import api from '../services/api';
import AIResultRenderer from '../components/AIResultRenderer';
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
  'obligation-extractor': [
    { label: 'SaaS obligations', form: { contract_text: 'Customer must pay invoices within 30 days. Vendor must maintain 99.9% uptime, provide breach notice within 48 hours, complete onboarding within 20 business days, and deliver quarterly security reports. Customer must provide implementation data within 10 days after kickoff. Late payment accrues 1.5% monthly interest.' } },
    { label: 'Construction milestones', form: { contract_text: 'Contractor shall complete foundation work by March 15, framing by May 1, and final inspection by July 30. Owner must approve change orders within five business days. Contractor must maintain insurance certificates and submit safety reports weekly.' } },
  ],
  'renewal-advisor': [
    { label: 'Contract 1', form: { contract_id: '1' } },
    { label: 'Contract 7', form: { contract_id: '7' } },
    { label: 'Contract 12', form: { contract_id: '12' } },
  ],
  'contract-health': [
    { label: 'Contract 2', form: { contract_id: '2' } },
    { label: 'Contract 8', form: { contract_id: '8' } },
    { label: 'Contract 14', form: { contract_id: '14' } },
  ],
  'predict-renewal-success': [
    { label: 'Contract 3', form: { contract_id: '3' } },
    { label: 'Contract 9', form: { contract_id: '9' } },
    { label: 'Contract 15', form: { contract_id: '15' } },
  ],
  'predict-approval-likelihood': [
    { label: 'Contract 4', form: { contract_id: '4' } },
    { label: 'Contract 10', form: { contract_id: '10' } },
    { label: 'Contract 16', form: { contract_id: '16' } },
  ],
};

export default function AIAdvancedPage() {
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
          <AIResultRenderer result={result} title={tool.name} />
        </div>
      </div>
    </div>
  );
}
