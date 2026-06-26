import React, { useState, useEffect } from 'react';
import api from '../services/api';
import AIResultRenderer from '../components/AIResultRenderer';
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
  'auto-redline': [
    { label: 'Liability revision', form: { contract_id: '1', version_a: 'Liability is capped at fees paid in the twelve months before the claim. Neither party is liable for consequential damages.', version_b: 'Customer liability is uncapped. Vendor liability is capped at fees paid in the three months before the claim. Consequential damages exclusion does not apply to Customer payment obligations.' } },
    { label: 'Data rights revision', form: { contract_id: '2', version_a: 'Vendor may process Customer Data solely to provide the services and must delete it within 30 days after termination.', version_b: 'Vendor may use Customer Data to improve services, train analytics models, and create aggregated benchmarks. Deletion will occur on a commercially reasonable schedule.' } },
  ],
  'clause-library/search': [
    { label: 'Data breach', form: { query: 'Need a breach notification clause with timing, cooperation, regulator support, and customer notice rights', clause_type: 'data_protection', jurisdiction: 'California, United States', industry: 'SaaS' } },
    { label: 'Indemnity', form: { query: 'Find balanced indemnification language for IP infringement and third-party claims', clause_type: 'indemnification', jurisdiction: 'Delaware, United States', industry: 'Technology' } },
  ],
  'amendment-impact': [
    { label: 'Pricing amendment', form: { contract_id: '3', amendment_id: '2', amendment_text: 'Amendment increases annual fees by 12%, changes renewal notice from 60 days to 30 days, and removes service credit remedies for scheduled maintenance windows.' } },
    { label: 'Security amendment', form: { contract_id: '6', amendment_id: '', amendment_text: 'Amendment adds SOC 2 reporting, 48-hour breach notice, annual penetration test summary, and approval rights over new subprocessors.' } },
  ],
  'negotiation-simulator': [
    { label: 'Customer stance', form: { contract_type: 'SaaS Master Services Agreement', our_position: 'We are the customer. We need a 12-month liability cap, breach super-cap, audit rights, deletion obligations, and a 30-day cure period before termination.', counterparty_profile: 'Vendor is growth-stage, wants fast close, resists uncapped obligations, and prefers standard online terms.', scenario: 'Counterparty rejected mutual indemnity and proposed unilateral suspension rights for any payment dispute.' } },
    { label: 'Vendor stance', form: { contract_type: 'Data Processing Addendum', our_position: 'We are the vendor. We can accept subprocessors notice and breach cooperation but need reasonable audit limits and no open-ended indemnity.', counterparty_profile: 'Enterprise customer with strict procurement, strong privacy team, and a hard deadline before quarter close.', scenario: 'Customer asks for unlimited liability for privacy claims and onsite audits twice per year.' } },
  ],
  'renewal-generator': [
    { label: 'Upsell renewal', form: { contract_id: '4', market_changes: 'Cloud infrastructure costs increased 8%, customer usage grew 34%, and competitor pricing moved toward usage-based tiers.', our_priorities: 'margin protection, multi-year commitment, expanded data add-on, stronger payment terms' } },
    { label: 'Retention renewal', form: { contract_id: '11', market_changes: 'Customer satisfaction is mixed due to onboarding delays, but service usage remains high and switching costs are meaningful.', our_priorities: 'retain account, fix SLA concerns, avoid discounting below 5%, secure reference rights' } },
  ],
  'compliance-drift': [
    { label: 'Privacy drift', form: { contract_id: '5', regulations: 'GDPR, CCPA, CPRA', regulation_changes: 'New privacy guidance emphasizes deletion rights, subprocessors transparency, automated decision-making disclosures, and cross-border transfer controls.' } },
    { label: 'Healthcare drift', form: { contract_id: '13', regulations: 'HIPAA, HITECH, state privacy laws', regulation_changes: 'Customer now stores patient-related metadata in the platform and requires business associate-style safeguards and breach notice timing.' } },
  ],
  'party-intelligence': [
    { label: 'By party ID', form: { party_id: '1', party_name: '' } },
    { label: 'By party name', form: { party_id: '', party_name: 'Acme Manufacturing LLC' } },
  ],
};

export default function AICustomToolsPage() {
  const [activeTool, setActiveTool] = useState(tools[0].id);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const tool = tools.find(t => t.id === activeTool);
  const presets = toolPresets[activeTool] || [];
  const applyPreset = (preset) => {
    setForm(preset.form || {});
    setResult(null);
    setError(null);
  };

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
          <AIResultRenderer result={result} title={tool.name} />
          {showHistory && (
            <div style={{marginTop: 24}}>
              <h3>Recent Results ({tool.name})</h3>
              {results.length === 0 && <div className="empty-state">No history yet</div>}
              {results.map(r => (
                <AIResultRenderer
                  key={r.id}
                  result={{ ai_result: r.output, model: r.model, usage: r.usage }}
                  title={`Result #${r.id}${r.contract_id ? ` · Contract #${r.contract_id}` : ''} · ${new Date(r.created_at).toLocaleString()}`}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
