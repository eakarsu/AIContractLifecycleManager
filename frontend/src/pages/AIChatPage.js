import React, { useState, useRef, useEffect } from 'react';
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

export default function AIChatPage() {
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
      const { data } = await api.post(`/ai/${activeTool}`, payload);
      const content = data.result || data.response || data.analysis || data.draft || data.review || data.clause || data.comparison || data.compliance || data.strategy || data.summary || JSON.stringify(data, null, 2);
      setMessages(prev => [...prev, { role:'assistant', content, tokens: data.tokens_used }]);
    } catch (err) {
      setMessages(prev => [...prev, { role:'assistant', content:`Error: ${err.response?.data?.error || err.message}` }]);
    }
    setLoading(false); setForm({});
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const fields = toolFields[activeTool];

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
