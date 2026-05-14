import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import {
  FiEdit3, FiList, FiActivity, FiUsers, FiRefreshCw, FiShield,
  FiBriefcase, FiDatabase, FiSend, FiClock
} from 'react-icons/fi';

// 8 new custom non-CRUD AI tools (matches backend /api/ai/aiCustom)
const tools = [
  { id: 'auto-redline', name: 'Auto-Redline', icon: <FiEdit3/>, color: '#ef4444',
    desc: 'AI-detect changes between two contract versions',
    fields: [
      { name: 'contract_id', label: 'Contract ID (optional)', type: 'number' },
      { name: 'version_a', label: 'Version A (Original)', type: 'textarea', required: true },
      { name: 'version_b', label: 'Version B (Revised)', type: 'textarea', required: true },
    ]},
  { id: 'clause-library/search', name: 'Clause Library Search', icon: <FiList/>, color: '#f59e0b',
    desc: 'Search clauses with AI-suggested matches',
    fields: [
      { name: 'query', label: 'Search Query', required: true },
      { name: 'clause_type', label: 'Clause Type', type: 'select',
        options: ['confidentiality','liability','ip_ownership','termination','force_majeure','payment','indemnification','data_protection','warranty','non_solicitation','governing_law','dispute_resolution'] },
      { name: 'jurisdiction', label: 'Jurisdiction' },
      { name: 'industry', label: 'Industry' },
    ]},
  { id: 'amendment-impact', name: 'Amendment Impact', icon: <FiActivity/>, color: '#8b5cf6',
    desc: 'Analyze impact of amendment on dependent items',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
      { name: 'amendment_id', label: 'Amendment ID', type: 'number' },
      { name: 'amendment_text', label: 'Amendment Text (if no ID)', type: 'textarea' },
    ]},
  { id: 'negotiation-simulator', name: 'Negotiation Simulator', icon: <FiUsers/>, color: '#ec4899',
    desc: 'Simulate negotiation rounds against counterparty',
    fields: [
      { name: 'contract_type', label: 'Contract Type' },
      { name: 'our_position', label: 'Our Position', type: 'textarea', required: true },
      { name: 'counterparty_profile', label: 'Counterparty Profile', type: 'textarea', required: true },
      { name: 'scenario', label: 'Scenario', type: 'textarea' },
    ]},
  { id: 'renewal-generator', name: 'Renewal Generator', icon: <FiRefreshCw/>, color: '#10b981',
    desc: 'Auto-draft renewal terms from contract history',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
      { name: 'market_changes', label: 'Market Changes', type: 'textarea' },
      { name: 'our_priorities', label: 'Our Priorities (comma-separated)' },
    ]},
  { id: 'compliance-drift', name: 'Compliance Drift Detector', icon: <FiShield/>, color: '#06b6d4',
    desc: 'Detect drift against current regulations',
    fields: [
      { name: 'contract_id', label: 'Contract ID', type: 'number', required: true },
      { name: 'regulations', label: 'Regulations (comma-separated)' },
      { name: 'regulation_changes', label: 'Recent Changes Context', type: 'textarea' },
    ]},
  { id: 'party-intelligence', name: 'Party Intelligence', icon: <FiBriefcase/>, color: '#6366f1',
    desc: 'Aggregated counterparty dossier',
    fields: [
      { name: 'party_id', label: 'Party ID', type: 'number' },
      { name: 'party_name', label: 'Party Name (if no ID)' },
    ]},
];

export default function AICustomToolsPage() {
  const [activeTool, setActiveTool] = useState(tools[0].id);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const tool = tools.find(t => t.id === activeTool);

  useEffect(() => { setForm({}); setResult(null); setError(null); }, [activeTool]);

  const loadHistory = async () => {
    try {
      const { data } = await api.get('/ai/results', { params: { feature: activeTool, limit: 20 } });
      setResults(data.data || []);
    } catch (e) { setError(e.response?.data?.error || e.message); }
  };

  useEffect(() => { if (showHistory) loadHistory(); }, [showHistory, activeTool]);

  const submit = async () => {
    setError(null); setResult(null);
    const required = tool.fields.filter(f => f.required);
    const missing = required.find(f => !form[f.name] || String(form[f.name]).trim() === '');
    if (missing) { setError(`${missing.label} is required`); return; }
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.our_priorities && typeof form.our_priorities === 'string') {
        payload.our_priorities = form.our_priorities.split(',').map(s => s.trim()).filter(Boolean);
      }
      const { data } = await api.post(`/ai/${activeTool}`, payload);
      setResult(data);
      if (showHistory) loadHistory();
    } catch (e) {
      setError(e.response?.data?.error || e.message);
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
          <h1 className="page-title">AI Custom Tools</h1>
          <p className="page-subtitle">8 advanced AI features for contract lifecycle</p>
        </div>
        <button className="btn btn-secondary" onClick={() => setShowHistory(!showHistory)}>
          <FiClock/> {showHistory ? 'Hide History' : 'Show History'}
        </button>
      </div>

      <div className="ai-tools-grid">
        {tools.map(t => (
          <div key={t.id} className={`ai-tool-card ${activeTool===t.id?'active':''}`} onClick={() => setActiveTool(t.id)}>
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
                <textarea className="form-textarea" rows={4}
                  value={form[f.name] || ''}
                  onChange={e => setForm({...form, [f.name]: e.target.value})}
                  placeholder={`Enter ${f.label.toLowerCase()}...`}/>
              ) : f.type === 'select' ? (
                <select className="form-select"
                  value={form[f.name] || ''}
                  onChange={e => setForm({...form, [f.name]: e.target.value})}>
                  <option value="">Select...</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
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
          {showHistory && (
            <div style={{marginTop: 24}}>
              <h3>Recent Results ({tool.name})</h3>
              {results.length === 0 && <div className="empty-state">No history yet</div>}
              {results.map(r => (
                <div key={r.id} className="ai-result-card" style={{marginBottom: 8}}>
                  <div className="ai-result-header">
                    <span className="badge">#{r.id}</span>
                    <span className="ai-result-meta">{new Date(r.created_at).toLocaleString()}</span>
                    {r.contract_id && <span className="ai-result-meta">Contract #{r.contract_id}</span>}
                  </div>
                  <pre className="ai-result-json" style={{maxHeight: 200, overflow: 'auto'}}>
                    {JSON.stringify(r.output, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
