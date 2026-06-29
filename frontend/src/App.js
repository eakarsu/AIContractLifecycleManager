import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ReactMarkdown from 'react-markdown';
import api from './services/api';
import { FiGrid, FiFileText, FiList, FiCopy, FiUsers, FiCheckSquare, FiCheckCircle, FiEdit3, FiRefreshCw, FiShield, FiAlertTriangle, FiFlag, FiFolder, FiActivity, FiSettings, FiMessageSquare, FiChevronLeft, FiChevronRight, FiLogOut, FiZap, FiSearch, FiCpu, FiSend, FiX, FiMinimize2 } from 'react-icons/fi';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CrudPage from './components/CrudPage';
import AICustomToolsPage from './pages/AICustomToolsPage';
import AIAdvancedPage from './pages/AIAdvancedPage';
import EDiscoveryPage from './pages/EDiscoveryPage';
import CustomViewsPage from './pages/CustomViewsPage';
import ObligationEvidenceRoom from './pages/ObligationEvidenceRoom';
import PlatformOpsPage from './pages/PlatformOpsPage';

// // === Batch 02 Gaps & Frontend Mounts ===
import CfAgenticContractNegotiation from './pages/CfAgenticContractNegotiation';
import CfPredictiveRenewal from './pages/CfPredictiveRenewal';
import CfRegulatoryChangeImpact from './pages/CfRegulatoryChangeImpact';
import CfPortfolioAnalytics from './pages/CfPortfolioAnalytics';
import CfVariantGenerationForNegotiation from './pages/CfVariantGenerationForNegotiation';
import GapAmendmentsLacksAnalyzeAmendmentImpact from './pages/GapAmendmentsLacksAnalyzeAmendmentImpact';
import GapRenewalsLacksPredictRenewalSuccessOrPredictRenewalTe from './pages/GapRenewalsLacksPredictRenewalSuccessOrPredictRenewalTe';
import GapApprovalsLacksPredictApprovalLikelihood from './pages/GapApprovalsLacksPredictApprovalLikelihood';
import GapPartiesLacksCounterpartyRiskScoring from './pages/GapPartiesLacksCounterpartyRiskScoring';
import GapLimitedThirdPartyIntegrationsNoDocusignSlackHubspotO from './pages/GapLimitedThirdPartyIntegrationsNoDocusignSlackHubspotO';
import GapNoAutomatedRenewalReminderOrAutoEscalationWorkflow from './pages/GapNoAutomatedRenewalReminderOrAutoEscalationWorkflow';
import GapNoAnalyticsDashboardContractSpendRiskHeatmapCycleTim from './pages/GapNoAnalyticsDashboardContractSpendRiskHeatmapCycleTim';
import GapNoVariantPlaybookManagementAlternativeTemplateSequence from './pages/GapNoVariantPlaybookManagementAlternativeTemplateSequence';
import GapNoWebhooks from './pages/GapNoWebhooks';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

import TimelineView from './pages/TimelineView';

const pages = [
  { path:'/contracts', label:'Contracts', icon:<FiFileText/>, api:'contracts',
    columns:['title','contract_type','status','party_a','party_b','value','risk_level'],
    fields:[
      {name:'title',label:'Title',required:true},
      {name:'contract_type',label:'Type',type:'select',options:['service_agreement','license_agreement','nda','employment','lease','supply_agreement','partnership','dpa','framework','insurance','joint_venture','integration','construction','consulting','distribution','merger']},
      {name:'status',label:'Status',type:'select',options:['draft','under_review','negotiation','pending','active','executed','expired','terminated','archived']},
      {name:'party_a',label:'Party A'},{name:'party_b',label:'Party B'},
      {name:'value',label:'Value',type:'number'},{name:'currency',label:'Currency'},
      {name:'start_date',label:'Start Date',type:'date'},{name:'end_date',label:'End Date',type:'date'},
      {name:'jurisdiction',label:'Jurisdiction'},{name:'description',label:'Description',type:'textarea'},
      {name:'risk_level',label:'Risk Level',type:'select',options:['low','medium','high','critical']},
    ]},
  { path:'/clauses', label:'Clauses', icon:<FiList/>, api:'clauses',
    columns:['title','clause_type','severity','is_negotiable','contract_id','status'],
    fields:[
      {name:'title',label:'Title',required:true},
      {name:'clause_type',label:'Type',type:'select',options:['confidentiality','liability','ip_ownership','termination','force_majeure','payment','indemnification','data_protection','warranty','non_solicitation','governing_law','assignment','dispute_resolution','insurance','audit']},
      {name:'content',label:'Content',type:'textarea'},{name:'plain_language',label:'Plain Language',type:'textarea'},
      {name:'severity',label:'Severity',type:'select',options:['standard','high','critical']},
      {name:'is_negotiable',label:'Negotiable',type:'select',options:['true','false']},
      {name:'contract_id',label:'Contract ID',type:'number'},{name:'section_number',label:'Section #'},
      {name:'status',label:'Status',type:'select',options:['active','draft','archived']},
    ]},
  { path:'/templates', label:'Templates', icon:<FiCopy/>, api:'templates',
    columns:['name','template_type','jurisdiction','industry','usage_count','status'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'template_type',label:'Type',type:'select',options:['service_agreement','nda','employment','license','dpa','partnership','contractor','lease','supply','joint_venture','consulting','tos','severance','distribution','merger']},
      {name:'description',label:'Description',type:'textarea'},{name:'content',label:'Content',type:'textarea'},
      {name:'jurisdiction',label:'Jurisdiction'},{name:'industry',label:'Industry'},
      {name:'usage_count',label:'Usage Count',type:'number'},
      {name:'is_public',label:'Public',type:'select',options:['true','false']},
      {name:'status',label:'Status',type:'select',options:['active','draft','archived']},
    ]},
  { path:'/parties', label:'Parties', icon:<FiUsers/>, api:'parties',
    columns:['name','party_type','email','industry','jurisdiction','status','contracts_count'],
    fields:[
      {name:'name',label:'Name',required:true},
      {name:'party_type',label:'Type',type:'select',options:['company','individual','government','nonprofit']},
      {name:'email',label:'Email'},{name:'phone',label:'Phone'},{name:'address',label:'Address',type:'textarea'},
      {name:'jurisdiction',label:'Jurisdiction'},{name:'tax_id',label:'Tax ID'},{name:'industry',label:'Industry'},
      {name:'status',label:'Status',type:'select',options:['active','inactive','blocked']},
    ]},
  { path:'/obligations', label:'Obligations', icon:<FiCheckSquare/>, api:'obligations',
    columns:['title','contract_id','obligated_party','obligation_type','due_date','status','priority'],
    fields:[
      {name:'title',label:'Title',required:true},{name:'contract_id',label:'Contract ID',type:'number'},
      {name:'description',label:'Description',type:'textarea'},{name:'obligated_party',label:'Obligated Party'},
      {name:'obligation_type',label:'Type',type:'select',options:['performance','payment','reporting','compliance','insurance','purchase','restriction','deliverable']},
      {name:'due_date',label:'Due Date',type:'date'},{name:'frequency',label:'Frequency',type:'select',options:['one-time','weekly','bi-weekly','monthly','quarterly','annual','ongoing']},
      {name:'status',label:'Status',type:'select',options:['pending','active','completed','overdue','waived']},
      {name:'priority',label:'Priority',type:'select',options:['low','medium','high','critical']},
    ]},
  { path:'/approvals', label:'Approvals', icon:<FiCheckCircle/>, api:'approvals',
    columns:['contract_id','approver_name','approval_type','status','priority'],
    fields:[
      {name:'contract_id',label:'Contract ID',type:'number'},{name:'approver_name',label:'Approver',required:true},
      {name:'approver_email',label:'Email'},{name:'approval_type',label:'Type',type:'select',options:['legal_review','financial_review','executive_approval','department_approval','board_approval','compliance_review']},
      {name:'status',label:'Status',type:'select',options:['pending','in_review','approved','rejected','deferred']},
      {name:'comments',label:'Comments',type:'textarea'},{name:'priority',label:'Priority',type:'select',options:['normal','high','urgent']},
    ]},
  { path:'/amendments', label:'Amendments', icon:<FiEdit3/>, api:'amendments',
    columns:['title','contract_id','amendment_type','effective_date','status','requested_by'],
    fields:[
      {name:'title',label:'Title',required:true},{name:'contract_id',label:'Contract ID',type:'number'},
      {name:'description',label:'Description',type:'textarea'},{name:'amendment_type',label:'Type',type:'select',options:['modification','addition','deletion','extension','correction']},
      {name:'effective_date',label:'Effective Date',type:'date'},
      {name:'status',label:'Status',type:'select',options:['draft','pending','negotiation','approved','rejected','executed']},
      {name:'requested_by',label:'Requested By'},{name:'approved_by',label:'Approved By'},
    ]},
  { path:'/renewals', label:'Renewals', icon:<FiRefreshCw/>, api:'renewals',
    columns:['contract_id','renewal_type','new_start_date','new_end_date','new_value','status'],
    fields:[
      {name:'contract_id',label:'Contract ID',type:'number'},
      {name:'renewal_type',label:'Type',type:'select',options:['auto','manual','negotiation']},
      {name:'new_start_date',label:'New Start',type:'date'},{name:'new_end_date',label:'New End',type:'date'},
      {name:'new_value',label:'New Value',type:'number'},{name:'terms_changed',label:'Terms Changed',type:'select',options:['true','false']},
      {name:'notice_date',label:'Notice Date',type:'date'},{name:'status',label:'Status',type:'select',options:['pending','approved','negotiation','declined','expired']},
      {name:'notes',label:'Notes',type:'textarea'},
    ]},
  { path:'/risks', label:'Risk Assessment', icon:<FiAlertTriangle/>, api:'risks',
    columns:['title','contract_id','overall_score','risk_level','status'],
    fields:[
      {name:'title',label:'Title',required:true},{name:'contract_id',label:'Contract ID',type:'number'},
      {name:'overall_score',label:'Overall Score',type:'number'},{name:'risk_level',label:'Risk Level',type:'select',options:['low','medium','high','critical']},
      {name:'financial_risk',label:'Financial Risk',type:'number'},{name:'legal_risk',label:'Legal Risk',type:'number'},
      {name:'operational_risk',label:'Operational Risk',type:'number'},{name:'compliance_risk',label:'Compliance Risk',type:'number'},
      {name:'assessor',label:'Assessor'},{name:'status',label:'Status',type:'select',options:['pending','in_progress','completed','needs_review']},
    ]},
  { path:'/compliance', label:'Compliance', icon:<FiShield/>, api:'compliance',
    columns:['title','contract_id','regulation','compliance_score','status','checked_by'],
    fields:[
      {name:'title',label:'Title',required:true},{name:'contract_id',label:'Contract ID',type:'number'},
      {name:'regulation',label:'Regulation'},{name:'compliance_score',label:'Score',type:'number'},
      {name:'status',label:'Status',type:'select',options:['pending','in_progress','passed','conditional','failed']},
      {name:'checked_by',label:'Checked By'},{name:'next_review',label:'Next Review',type:'date'},
    ]},
  { path:'/milestones', label:'Milestones', icon:<FiFlag/>, api:'milestones',
    columns:['title','contract_id','milestone_type','due_date','status','payment_amount'],
    fields:[
      {name:'title',label:'Title',required:true},{name:'contract_id',label:'Contract ID',type:'number'},
      {name:'description',label:'Description',type:'textarea'},{name:'milestone_type',label:'Type',type:'select',options:['deliverable','payment','kickoff','audit','construction','inspection','launch','financial','milestone']},
      {name:'due_date',label:'Due Date',type:'date'},{name:'completed_date',label:'Completed',type:'date'},
      {name:'status',label:'Status',type:'select',options:['pending','in_progress','completed','overdue','cancelled']},
      {name:'payment_amount',label:'Payment Amount',type:'number'},{name:'responsible_party',label:'Responsible Party'},
    ]},
  { path:'/documents', label:'Documents', icon:<FiFolder/>, api:'documents',
    columns:['title','contract_id','document_type','file_name','file_size','version','status'],
    fields:[
      {name:'title',label:'Title',required:true},{name:'contract_id',label:'Contract ID',type:'number'},
      {name:'document_type',label:'Type',type:'select',options:['contract','sow','nda','lease','appendix','term_sheet','compliance','insurance','business_plan','blueprint','schedule','proposal','license','amendment']},
      {name:'file_name',label:'File Name'},{name:'file_size',label:'File Size'},{name:'version',label:'Version'},
      {name:'uploaded_by',label:'Uploaded By'},{name:'status',label:'Status',type:'select',options:['active','draft','archived','superseded']},
    ]},
  { path:'/audit', label:'Audit Log', icon:<FiActivity/>, api:'audit',
    columns:['contract_id','action','entity_type','performed_by','created_at'],
    fields:[
      {name:'contract_id',label:'Contract ID',type:'number'},{name:'action',label:'Action',required:true},
      {name:'entity_type',label:'Entity Type'},{name:'entity_id',label:'Entity ID',type:'number'},
      {name:'performed_by',label:'Performed By'},{name:'ip_address',label:'IP Address'},
    ]},
  { path:'/settings', label:'Settings', icon:<FiSettings/>, api:'settings',
    columns:['key','value','category'],
    fields:[
      {name:'key',label:'Key',required:true},{name:'value',label:'Value',required:true},
      {name:'category',label:'Category',type:'select',options:['contracts','renewals','approvals','risk','compliance','documents','amendments','notifications','audit','ai','templates','milestones']},
      {name:'description',label:'Description',type:'textarea'},
    ]},
];

function ProtectedRoute({ children }) {
  return localStorage.getItem('token') ? children : <Navigate to="/login" />;
}

function Sidebar({ collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const logout = () => { localStorage.removeItem('token'); navigate('/login'); };
  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">CL</div>
        <span className="sidebar-title">Contract AI</span>
        <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <FiChevronRight/> : <FiChevronLeft/>}
        </button>
      </div>
      <div className="sidebar-section-title">Main</div>
      <ul className="nav-items">
        <NavLink to="/dashboard" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiGrid/></span><span className="nav-label">Dashboard</span></NavLink>
        <NavLink to="/ai-custom" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiZap/></span><span className="nav-label">AI Custom Tools</span></NavLink>
        <NavLink to="/ai-advanced" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiCpu/></span><span className="nav-label">AI Advanced</span></NavLink>
        <NavLink to="/ai-ediscovery" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiSearch/></span><span className="nav-label">eDiscovery</span></NavLink>
        <NavLink to="/custom-views" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiGrid/></span><span className="nav-label">Contract Views</span></NavLink>
        <NavLink to="/obligation-evidence-room" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiFolder/></span><span className="nav-label">Evidence Room</span></NavLink>
        <NavLink to="/platform-ops" className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon"><FiSettings/></span><span className="nav-label">Platform Ops</span></NavLink>
      </ul>
      <div className="sidebar-section-title">Contracts</div>
      <ul className="nav-items">
        {pages.slice(0,4).map(p => (<NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span></NavLink>))}
      </ul>
      <div className="sidebar-section-title">Lifecycle</div>
      <ul className="nav-items">
        {pages.slice(4,8).map(p => (<NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span></NavLink>))}
      </ul>
      <div className="sidebar-section-title">Governance</div>
      <ul className="nav-items">
        {pages.slice(8).map(p => (<NavLink key={p.path} to={p.path} className={({isActive})=>`nav-item ${isActive?'active':''}`}><span className="nav-icon">{p.icon}</span><span className="nav-label">{p.label}</span></NavLink>))}
      </ul>
      <div style={{marginTop:'auto',padding:'12px 8px',borderTop:'1px solid var(--border)'}}>
        <div className="nav-item" onClick={logout}><span className="nav-icon"><FiLogOut/></span><span className="nav-label">Logout</span></div>
      </div>
    </div>
  );
}

function SystemChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Ask me to list, open, create, update, delete, run AI tools, send notifications, or answer contract questions.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const message = input.trim();
    if (!message || loading) return;
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);
    try {
      const { data } = await api.post('/system-chat/message', { message });
      if (data.action === 'navigate' && data.view) navigate(data.view);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || data.error || 'Done.',
        action: data.action,
        view: data.view,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.response?.data?.error || err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  const quickPrompts = [
    'List contracts',
    'Open renewals',
    'Create obligation for monthly security report',
    'Run auto redline for contract 1',
    'Check platform health',
    'Test Salesforce integration',
    'Prepare audit binder',
    'Send test notification',
  ];

  return (
    <div className={`system-chat ${open ? 'open' : ''}`}>
      {open && (
        <div className="system-chat-panel">
          <div className="system-chat-header">
            <div>
              <div className="system-chat-kicker">System Chatbot</div>
              <div className="system-chat-title">Contract AI Copilot</div>
            </div>
            <div className="system-chat-header-actions">
              <button type="button" className="system-chat-icon-btn" onClick={() => setOpen(false)} aria-label="Minimize chat"><FiMinimize2 /></button>
              <button type="button" className="system-chat-icon-btn" onClick={() => { setMessages([]); setInput(''); }} aria-label="Clear chat"><FiX /></button>
            </div>
          </div>
          <div className="system-chat-prompts">
            {quickPrompts.map(prompt => (
              <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}</button>
            ))}
          </div>
          <div className="system-chat-messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`system-chat-message ${message.role}`}>
                <div className="system-chat-bubble">
                  {message.role === 'assistant' ? <ReactMarkdown>{message.content}</ReactMarkdown> : message.content}
                  {(message.action || message.view) && (
                    <div className="system-chat-meta">
                      {message.action && <span>{message.action}</span>}
                      {message.view && <span>{message.view}</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="system-chat-message assistant">
                <div className="system-chat-bubble muted">Working...</div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="system-chat-input-row">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to do anything this app provides..."
            />
            <button type="button" onClick={send} disabled={loading || !input.trim()} aria-label="Send chat message"><FiSend /></button>
          </div>
        </div>
      )}
      <button type="button" className="system-chat-launcher" onClick={() => setOpen(value => !value)} aria-label="Open system chatbot">
        <FiMessageSquare />
        <span>Chat</span>
      </button>
    </div>
  );
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className={`main-content ${collapsed ? 'expanded' : ''}`}>
        <Routes>
        <Route path="/insights/timeline" element={<ProtectedRoute><TimelineView /></ProtectedRoute>} />
        <Route path="/codex/custom-viz" element={<ProtectedRoute><CodexCustomVizFeature /></ProtectedRoute>} />
        <Route path="/codex/operations" element={<ProtectedRoute><CodexOperationsFeature /></ProtectedRoute>} />

          <Route path="/dashboard" element={<Dashboard pages={pages}/>} />
          <Route path="/ai-chat" element={<Navigate to="/dashboard"/>} />
          <Route path="/ai-custom" element={<AICustomToolsPage/>} />
          <Route path="/ai-advanced" element={<AIAdvancedPage/>} />
          <Route path="/ai-ediscovery" element={<EDiscoveryPage/>} />
          <Route path="/custom-views" element={<CustomViewsPage/>} />
          <Route path="/obligation-evidence-room" element={<ObligationEvidenceRoom/>} />
          <Route path="/platform-ops" element={<PlatformOpsPage/>} />
          {pages.map(p => (<Route key={p.path} path={p.path} element={<CrudPage title={p.label} apiPath={p.api} columns={p.columns} fields={p.fields} />}/>))}
          <Route path="*" element={<Navigate to="/dashboard"/>} />
        
        {/* // === Batch 02 Gaps & Frontend Mounts === */}
        <Route path="/cf/agentic-contract-negotiation" element={<CfAgenticContractNegotiation />} />
        <Route path="/cf/predictive-renewal" element={<CfPredictiveRenewal />} />
        <Route path="/cf/regulatory-change-impact" element={<CfRegulatoryChangeImpact />} />
        <Route path="/cf/portfolio-analytics" element={<CfPortfolioAnalytics />} />
        <Route path="/cf/variant-generation-for-negotiation" element={<CfVariantGenerationForNegotiation />} />
        <Route path="/gap/amendments-lacks-analyze-amendment-impact" element={<GapAmendmentsLacksAnalyzeAmendmentImpact />} />
        <Route path="/gap/renewals-lacks-predict-renewal-success-or-predict-renewal-te" element={<GapRenewalsLacksPredictRenewalSuccessOrPredictRenewalTe />} />
        <Route path="/gap/approvals-lacks-predict-approval-likelihood" element={<GapApprovalsLacksPredictApprovalLikelihood />} />
        <Route path="/gap/parties-lacks-counterparty-risk-scoring" element={<GapPartiesLacksCounterpartyRiskScoring />} />
        <Route path="/gap/limited-third-party-integrations-no-docusign-slack-hubspot-o" element={<GapLimitedThirdPartyIntegrationsNoDocusignSlackHubspotO />} />
        <Route path="/gap/no-automated-renewal-reminder-or-auto-escalation-workflow" element={<GapNoAutomatedRenewalReminderOrAutoEscalationWorkflow />} />
        <Route path="/gap/no-analytics-dashboard-contract-spend-risk-heatmap-cycle-tim" element={<GapNoAnalyticsDashboardContractSpendRiskHeatmapCycleTim />} />
        <Route path="/gap/no-variant-playbook-management-alternative-template-sequence" element={<GapNoVariantPlaybookManagementAlternativeTemplateSequence />} />
        <Route path="/gap/no-webhooks" element={<GapNoWebhooks />} />
      </Routes>
      </div>
      <SystemChatWidget />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login/>} />
        <Route path="/*" element={<ProtectedRoute><AppLayout/></ProtectedRoute>} />
      </Routes>
      <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
    </BrowserRouter>
  );
}
