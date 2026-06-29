import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ReactMarkdown from 'react-markdown';
import { FiMessageSquare, FiFileText, FiSearch, FiAlertTriangle, FiList, FiCopy, FiShield, FiUsers, FiBookOpen, FiSend } from 'react-icons/fi';

const tools = [
  { id:'chat', name:'Contract Assistant', icon:<FiMessageSquare/>, desc:'Ask anything about contracts', color:'#6366f1' },
  { id:'draft-contract', name:'Draft Contract', icon:<FiFileText/>, desc:'Generate professional contracts', color:'#3b82f6' },
  { id:'review-contract', name:'Review Contract', icon:<FiSearch/>, desc:'Analyze contracts for issues', color:'#8b5cf6' },
  { id:'analyze-risk', name:'Risk Analysis', icon:<FiAlertTriangle/>, desc:'Assess contract risk profile', color:'#ef4444' },
  { id:'generate-clause', name:'Generate Clause', icon:<FiList/>, desc:'Create specific clause types', color:'#f59e0b' },
  { id:'compare-contracts', name:'Compare Contracts', icon:<FiCopy/>, desc:'Compare two contract versions', color:'#06b6d4' },
  { id:'check-compliance', name:'Compliance Check', icon:<FiShield/>, desc:'Check regulatory compliance', color:'#10b981' },
  { id:'negotiate', name:'Negotiation Strategy', icon:<FiUsers/>, desc:'Develop negotiation tactics', color:'#ec4899' },
  { id:'summarize', name:'Summarize Contract', icon:<FiBookOpen/>, desc:'Summarize for any audience', color:'#f97316' },
];

const toolFields = {
  'draft-contract': [
    { name:'contract_type', label:'Contract Type', type:'select', options:['Service Agreement','NDA','Employment','License','Lease','Partnership','Supply Agreement','DPA','Consulting','Distribution'] },
    { name:'party_a', label:'Party A' }, { name:'party_b', label:'Party B' },
    { name:'jurisdiction', label:'Jurisdiction' }, { name:'key_terms', label:'Key Terms', type:'textarea' },
  ],
  'review-contract': [
    { name:'contract_text', label:'Contract Text', type:'textarea', required:true },
    { name:'focus', label:'Focus Area', type:'select', options:['comprehensive','risk','compliance','negotiation','termination','ip'] },
  ],
  'analyze-risk': [
    { name:'contract_text', label:'Contract Text', type:'textarea', required:true },
    { name:'industry', label:'Industry' }, { name:'contract_value', label:'Contract Value' },
  ],
  'generate-clause': [
    { name:'clause_type', label:'Clause Type', type:'select', options:['confidentiality','liability','ip_ownership','termination','force_majeure','payment','indemnification','data_protection','warranty','non_solicitation','governing_law','dispute_resolution'] },
    { name:'context', label:'Contract Context', type:'textarea' }, { name:'jurisdiction', label:'Jurisdiction' },
  ],
  'compare-contracts': [
    { name:'contract_a', label:'Contract A Text', type:'textarea', required:true },
    { name:'contract_b', label:'Contract B Text', type:'textarea', required:true },
  ],
  'check-compliance': [
    { name:'contract_text', label:'Contract Text', type:'textarea', required:true },
    { name:'regulations', label:'Regulations (comma-separated)' }, { name:'jurisdiction', label:'Jurisdiction' },
  ],
  'negotiate': [
    { name:'contract_text', label:'Contract Text', type:'textarea', required:true },
    { name:'your_position', label:'Your Position', type:'textarea' }, { name:'priority', label:'Priority Areas' },
  ],
  'summarize': [
    { name:'contract_text', label:'Contract Text', type:'textarea', required:true },
    { name:'audience', label:'Audience', type:'select', options:['executive','legal','technical','non-technical','board'] },
    { name:'length', label:'Length', type:'select', options:['brief','standard','detailed'] },
  ],
};

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

const chatPresets = [
  { label: 'List contracts', input: 'List contracts' },
  { label: 'Open renewals', input: 'Open renewals' },
  { label: 'Create obligation', input: 'Create obligation for monthly security report' },
  { label: 'Run redline', input: 'Run auto redline for contract 1' },
  { label: 'Send notifications', input: 'Send expiry notifications' },
  { label: 'Dashboard counts', input: 'How many contracts and obligations do we have?' },
];

const toolPresets = {
  'draft-contract': [
    { label: 'SaaS services', form: { contract_type: 'Service Agreement', party_a: 'Northstar Analytics Inc.', party_b: 'Acme Manufacturing LLC', jurisdiction: 'New York, United States', key_terms: '12-month term, $18,000 monthly subscription, uptime SLA, standard support, mutual confidentiality, data processing terms, limitation of liability capped at 12 months of fees.' }, input: 'Draft in a balanced commercial tone with clear sections and practical definitions.' },
    { label: 'Mutual NDA', form: { contract_type: 'NDA', party_a: 'Blue Harbor Capital', party_b: 'Vector Robotics', jurisdiction: 'Delaware, United States', key_terms: 'Mutual disclosure, 3-year confidentiality period, exclusions for independently developed information, no license grant, equitable relief, return or destruction on request.' }, input: 'Make the NDA concise but enforceable.' },
  ],
  'review-contract': [
    { label: 'Comprehensive MSA', form: { contract_text: 'Master Services Agreement: Vendor provides managed analytics services. Customer must pay invoices within 15 days. Vendor may suspend access for non-payment. Liability is uncapped for all claims. Customer indemnifies Vendor for third-party claims. Agreement renews automatically for one-year terms unless either party gives 15 days notice.', focus: 'comprehensive' }, input: 'Prioritize business risks and missing protective clauses.' },
    { label: 'Termination focus', form: { contract_text: 'Either party may terminate for convenience with 180 days notice. Vendor may terminate immediately if Customer disputes an invoice. Upon termination, all fees through the full term become immediately due.', focus: 'termination' }, input: 'Identify unfair exit provisions and propose replacement wording.' },
  ],
  'analyze-risk': [
    { label: 'High-value SaaS', form: { contract_text: 'Three-year SaaS agreement with automated renewal, uncapped liability for customer, vendor audit rights on 48 hours notice, broad data usage rights, and limited termination rights.', industry: 'SaaS / Technology', contract_value: '750000' }, input: 'Score risk and give mitigation steps.' },
    { label: 'Construction supply', form: { contract_text: 'Supplier provides critical construction materials. Delivery dates are estimates only. Buyer accepts price escalation after purchase order. Warranty period is 30 days. No liquidated damages.', industry: 'Construction', contract_value: '2100000' }, input: 'Focus on operational and financial exposure.' },
  ],
  'generate-clause': [
    { label: 'Data protection', form: { clause_type: 'data_protection', context: 'Vendor processes customer personal data for analytics services and may use approved subprocessors. Customer needs audit rights, breach notice, deletion, and regulatory cooperation.', jurisdiction: 'California, United States' }, input: 'Use balanced SaaS vendor/customer language.' },
    { label: 'Liability cap', form: { clause_type: 'liability', context: 'B2B services agreement with recurring monthly fees, professional services, and potential confidentiality/data breach exposure.', jurisdiction: 'New York, United States' }, input: 'Include carve-outs and a super-cap for data breach claims.' },
  ],
  'compare-contracts': [
    { label: 'Renewal change', form: { contract_a: 'Term renews annually unless either party gives 60 days notice. Fees may increase by up to 3% annually. Liability cap equals fees paid in prior 12 months.', contract_b: 'Term renews automatically unless Customer gives 15 days notice. Fees may increase at Vendor discretion. Liability cap excludes payment obligations only.' }, input: 'Summarize business impact and negotiation priorities.' },
    { label: 'Data rights change', form: { contract_a: 'Vendor may process customer data solely to provide services and must delete data within 30 days after termination.', contract_b: 'Vendor may use customer data to improve services and develop aggregated analytics. Deletion occurs upon commercially reasonable schedule.' }, input: 'Highlight privacy and data ownership changes.' },
  ],
  'check-compliance': [
    { label: 'GDPR DPA', form: { contract_text: 'Vendor processes EU personal data but breach notice is commercially reasonable. Subprocessors may be added without notice. Data deletion is available upon paid request.', regulations: 'GDPR, UK GDPR', jurisdiction: 'European Union' }, input: 'Identify compliance gaps and required clause changes.' },
    { label: 'HIPAA vendor', form: { contract_text: 'Vendor hosts healthcare customer files. Agreement includes confidentiality but no business associate obligations, no breach timing, and no subcontractor restrictions.', regulations: 'HIPAA, HITECH', jurisdiction: 'United States' }, input: 'List missing BAA controls.' },
  ],
  negotiate: [
    { label: 'Reduce indemnity', form: { contract_text: 'Customer indemnifies Vendor for all third-party claims, including claims caused by Vendor negligence. Liability is uncapped. Vendor may terminate immediately for any breach.', your_position: 'We are the customer. We need mutual indemnity, fault-based obligations, a liability cap, and notice/cure rights.', priority: 'indemnity, liability cap, termination' }, input: 'Give a negotiation plan with fallback positions.' },
    { label: 'Vendor-friendly fallback', form: { contract_text: 'Customer requests unlimited liability for data breach, extensive audit rights, and 90-day termination for convenience.', your_position: 'We are the vendor. We can accept meaningful security commitments but need predictable liability and operationally reasonable audits.', priority: 'liability, audits, data security' }, input: 'Propose balanced concessions.' },
  ],
  summarize: [
    { label: 'Executive brief', form: { contract_text: 'Five-year distribution agreement with exclusivity, annual minimum purchase commitments, quarterly rebates, termination for missed targets, and audit rights for sales reporting.', audience: 'executive', length: 'brief' }, input: 'Emphasize obligations, financial exposure, and decisions needed.' },
    { label: 'Legal detailed', form: { contract_text: 'Software license with source code escrow, customer audit rights, strict confidentiality, IP ownership retained by licensor, indemnity for infringement, and maintenance SLA credits.', audience: 'legal', length: 'detailed' }, input: 'Break down key legal terms and risk flags.' },
  ],
};

export default function AIChatPage() {
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const send = async () => {
    if (loading) return;
    let payload, userMsg;
    if (activeTool === 'chat') {
      if (!input.trim()) return;
      payload = { message: input };
      userMsg = input;
    } else {
      const fields = toolFields[activeTool];
      const req = fields?.find(f => f.required);
      if (req && !form[req.name]?.trim()) return;
      payload = { ...form };
      if (input.trim()) payload.message = input;
      const toolName = tools.find(t => t.id === activeTool)?.name || activeTool;
      userMsg = `[${toolName}] ${input || Object.entries(form).filter(([,v])=>v).map(([k,v])=>`${k}: ${String(v).substring(0,60)}`).join(', ')}`;
    }
    setMessages(prev => [...prev, { role:'user', content:userMsg }]);
    setInput(''); setLoading(true);
    try {
      const { data } = activeTool === 'chat'
        ? await api.post('/system-chat/message', payload)
        : await api.post(`/ai/${activeTool}`, payload);
      if (data.action === 'navigate' && data.view) navigate(data.view);
      const content = data.reply || data.result || data.response || data.analysis || data.draft || data.review || data.clause || data.comparison || data.compliance || data.strategy || data.summary || JSON.stringify(data, null, 2);
      const actionLabel = data.action ? `Action: ${data.action}` : null;
      setMessages(prev => [...prev, { role:'assistant', content, tokens: data.tokens_used || data.usage?.total_tokens, actionLabel, data }]);
    } catch (err) {
      setMessages(prev => [...prev, { role:'assistant', content:`Error: ${err.response?.data?.error || err.message}` }]);
    }
    setLoading(false); setForm({});
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const fields = toolFields[activeTool];
  const presets = activeTool === 'chat' ? chatPresets : (toolPresets[activeTool] || []);
  const applyPreset = (preset) => {
    setForm(preset.form || {});
    setInput(preset.input || '');
  };

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">AI Contract Assistant</h1><p className="page-subtitle">Powered by AI for contract lifecycle management</p></div></div>
      <div className="ai-tools-grid">
        {tools.map(t => (
          <div key={t.id} className={`ai-tool-card ${activeTool===t.id?'active':''}`} onClick={() => { setActiveTool(t.id); setForm({}); }}>
            <div className="ai-tool-icon" style={{color:t.color}}>{t.icon}</div>
            <div className="ai-tool-name">{t.name}</div>
            <div className="ai-tool-desc">{t.desc}</div>
          </div>
        ))}
      </div>
      <div className="ai-chat-container">
        {presets.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {presets.map(preset => (
              <button key={preset.label} type="button" onClick={() => applyPreset(preset)} style={presetButtonStyle}>
                {preset.label}
              </button>
            ))}
          </div>
        )}
        {fields && (
          <div className="ai-form">
            {fields.map(f => (
              <div key={f.name} className={f.type === 'textarea' ? '' : 'ai-form-row'} style={f.type === 'textarea' ? {} : {display:'grid',gridTemplateColumns:'1fr',gap:12}}>
                <div className="form-group">
                  <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
                  {f.type === 'textarea' ? <textarea className="form-textarea" value={form[f.name]||''} onChange={e=>setForm({...form,[f.name]:e.target.value})} rows={3} placeholder={`Enter ${f.label.toLowerCase()}...`} />
                  : f.type === 'select' ? <select className="form-select" value={form[f.name]||''} onChange={e=>setForm({...form,[f.name]:e.target.value})}><option value="">Select...</option>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select>
                  : <input className="form-input" value={form[f.name]||''} onChange={e=>setForm({...form,[f.name]:e.target.value})} placeholder={`Enter ${f.label.toLowerCase()}...`} />}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="chat-messages">
          {messages.length === 0 && <div className="empty-state"><div className="empty-icon">&#9878;</div><div className="empty-text">Select a tool and start a conversation</div></div>}
          {messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role}`}>
              <div className="chat-avatar">{m.role === 'user' ? '👤' : '⚖'}</div>
              <div className="chat-content">
                {m.role === 'assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : m.content}
                {m.actionLabel && <div className="chat-meta"><span>{m.actionLabel}</span>{m.data?.view && <span>View: {m.data.view}</span>}</div>}
                {m.tokens && <div className="chat-meta"><span>Tokens: {m.tokens}</span></div>}
              </div>
            </div>
          ))}
          {loading && <div className="chat-message assistant"><div className="chat-avatar">⚖</div><div className="chat-content"><div className="loading"><div className="spinner"></div>Analyzing...</div></div></div>}
          <div ref={messagesEnd}/>
        </div>
        <div className="chat-input-area">
          <textarea className="chat-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder={activeTool==='chat'?'Ask about contracts...':'Add additional instructions (optional)...'} />
          <button className="btn btn-primary chat-send" onClick={send} disabled={loading}><FiSend/> Send</button>
        </div>
      </div>
    </div>
  );
}
