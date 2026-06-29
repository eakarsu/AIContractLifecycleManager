const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { callOpenRouter, parseAIJson } = require('../services/aiHelper');

const router = express.Router();
router.use(auth);

const resources = [
  { key: 'contracts', label: 'Contracts', endpoint: '/api/contracts', path: '/contracts', aliases: ['contract', 'contracts', 'agreement', 'agreements'], title: 'title' },
  { key: 'clauses', label: 'Clauses', endpoint: '/api/clauses', path: '/clauses', aliases: ['clause', 'clauses'], title: 'title' },
  { key: 'templates', label: 'Templates', endpoint: '/api/templates', path: '/templates', aliases: ['template', 'templates'], title: 'name' },
  { key: 'parties', label: 'Parties', endpoint: '/api/parties', path: '/parties', aliases: ['party', 'parties', 'counterparty', 'counterparties'], title: 'name' },
  { key: 'obligations', label: 'Obligations', endpoint: '/api/obligations', path: '/obligations', aliases: ['obligation', 'obligations'], title: 'title' },
  { key: 'approvals', label: 'Approvals', endpoint: '/api/approvals', path: '/approvals', aliases: ['approval', 'approvals'], title: 'approver_name' },
  { key: 'amendments', label: 'Amendments', endpoint: '/api/amendments', path: '/amendments', aliases: ['amendment', 'amendments'], title: 'title' },
  { key: 'renewals', label: 'Renewals', endpoint: '/api/renewals', path: '/renewals', aliases: ['renewal', 'renewals'], title: 'contract_id' },
  { key: 'risks', label: 'Risk Assessments', endpoint: '/api/risks', path: '/risks', aliases: ['risk', 'risks', 'risk assessment', 'risk assessments'], title: 'title' },
  { key: 'compliance', label: 'Compliance', endpoint: '/api/compliance', path: '/compliance', aliases: ['compliance', 'compliance check', 'compliance checks'], title: 'title' },
  { key: 'milestones', label: 'Milestones', endpoint: '/api/milestones', path: '/milestones', aliases: ['milestone', 'milestones'], title: 'title' },
  { key: 'documents', label: 'Documents', endpoint: '/api/documents', path: '/documents', aliases: ['document', 'documents', 'file', 'files'], title: 'title' },
  { key: 'audit', label: 'Audit Log', endpoint: '/api/audit', path: '/audit', aliases: ['audit', 'audit log', 'audit logs'], title: 'action' },
  { key: 'settings', label: 'Settings', endpoint: '/api/settings', path: '/settings', aliases: ['setting', 'settings'], title: 'key' },
];

const aiTools = [
  { key: 'draft-contract', label: 'Draft Contract', endpoint: '/api/ai/draft-contract', aliases: ['draft contract', 'generate contract'], payload: { contract_type: 'Service Agreement', parties: 'Acme Inc and TechCorp Solutions', key_terms: '12 month term, monthly fees, confidentiality, liability cap, termination rights', jurisdiction: 'Delaware' } },
  { key: 'review-contract', label: 'Review Contract', endpoint: '/api/ai/review-contract', aliases: ['review contract', 'contract review'], payload: { contract_text: 'Service agreement with 15 day payment terms, automatic renewal, broad data usage rights, and uncapped customer liability.', review_focus: 'comprehensive' } },
  { key: 'analyze-risk', label: 'Analyze Risk', endpoint: '/api/ai/analyze-risk', aliases: ['analyze risk', 'risk analysis'], payload: { contract_text: 'High value contract with automatic renewal, broad indemnity, and limited termination rights.', industry: 'SaaS', contract_value: '500000' } },
  { key: 'generate-clause', label: 'Generate Clause', endpoint: '/api/ai/generate-clause', aliases: ['generate clause', 'draft clause'], payload: { clause_type: 'liability', context: 'B2B SaaS agreement with data security exposure', jurisdiction: 'New York' } },
  { key: 'compare-contracts', label: 'Compare Contracts', endpoint: '/api/ai/compare-contracts', aliases: ['compare contracts', 'contract comparison'], payload: { contract_a: 'Liability capped at 12 months fees. Renewal notice 60 days.', contract_b: 'Customer liability uncapped. Renewal notice 15 days.' } },
  { key: 'check-compliance', label: 'Check Compliance', endpoint: '/api/ai/check-compliance', aliases: ['check compliance', 'compliance check'], payload: { contract_text: 'Vendor processes customer personal data with subprocessors and breach notice on commercially reasonable timing.', regulations: 'GDPR, CCPA', jurisdiction: 'United States' } },
  { key: 'negotiate', label: 'Negotiation Strategy', endpoint: '/api/ai/negotiate', aliases: ['negotiate', 'negotiation strategy'], payload: { original_terms: 'Uncapped liability, unilateral indemnity, immediate suspension for disputes.', desired_outcome: 'Balanced mutual terms', leverage_points: 'Customer is a strategic logo and annual value is high.' } },
  { key: 'summarize', label: 'Summarize Contract', endpoint: '/api/ai/summarize', aliases: ['summarize contract', 'contract summary'], payload: { contract_text: 'Distribution agreement with exclusivity, minimum purchase commitments, audit rights, rebates, and termination for missed targets.', audience: 'executive' } },
  { key: 'auto-redline', label: 'Auto-Redline', endpoint: '/api/ai/auto-redline', aliases: ['auto redline', 'redline'], payload: { contract_id: 1, version_a: 'Payment due in 30 days. Liability capped at 12 months fees.', version_b: 'Payment due in 15 days. Customer payment liability is uncapped.' } },
  { key: 'clause-library-search', label: 'Clause Library Search', endpoint: '/api/ai/clause-library/search', aliases: ['clause library', 'search clauses'], payload: { query: 'balanced data breach notice and cooperation clause', clause_type: 'data_protection', jurisdiction: 'Delaware', industry: 'SaaS' } },
  { key: 'amendment-impact', label: 'Amendment Impact', endpoint: '/api/ai/amendment-impact', aliases: ['amendment impact', 'analyze amendment'], payload: { contract_id: 1, amendment_text: 'Amendment changes renewal notice to 30 days and adds SOC 2 reporting obligations.' } },
  { key: 'renewal-generator', label: 'Renewal Generator', endpoint: '/api/ai/renewal-generator', aliases: ['renewal generator', 'generate renewal'], payload: { contract_id: 1, market_changes: 'Usage increased and vendor costs increased.', our_priorities: ['retain account', 'protect margin'] } },
  { key: 'compliance-drift', label: 'Compliance Drift', endpoint: '/api/ai/compliance-drift', aliases: ['compliance drift', 'drift detector'], payload: { contract_id: 1, regulations: 'GDPR, CCPA', regulation_changes: 'Deletion rights and subprocessors transparency require stronger language.' } },
  { key: 'party-intelligence', label: 'Party Intelligence', endpoint: '/api/ai/party-intelligence', aliases: ['party intelligence', 'counterparty intelligence'], payload: { party_id: 1 } },
];

const pages = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', aliases: ['dashboard', 'home'] },
  { key: 'platform-ops', label: 'Platform Ops', path: '/platform-ops', aliases: ['platform ops', 'operations', 'ops', 'health', 'integrations', 'rbac', 'backup'] },
  { key: 'ai-custom', label: 'AI Custom Tools', path: '/ai-custom', aliases: ['ai custom', 'custom ai', 'custom tools'] },
  { key: 'ai-advanced', label: 'AI Advanced', path: '/ai-advanced', aliases: ['ai advanced', 'advanced ai'] },
  { key: 'ai-ediscovery', label: 'eDiscovery', path: '/ai-ediscovery', aliases: ['ediscovery', 'discovery'] },
  { key: 'custom-views', label: 'Contract Views', path: '/custom-views', aliases: ['contract views', 'views', 'analytics'] },
  ...resources,
];

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function match(items, message) {
  const text = normalize(message);
  return items
    .map((item) => {
      const aliases = [item.key, item.label, ...(item.aliases || [])].map(normalize);
      const found = aliases.filter((alias) => text.includes(alias)).sort((a, b) => b.length - a.length)[0];
      return { item, score: found?.length || 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.item;
}

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

async function callInternal(req, endpoint, options = {}) {
  const response = await fetch(`${baseUrl(req)}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: req.headers.authorization || '',
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `${endpoint} failed with ${response.status}`);
  return data;
}

function rowsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function inferId(message) {
  const text = normalize(message);
  return text.match(/\b(?:id|record|row|#)?\s*(\d+)\b/)?.[1];
}

function titleFromMessage(message, resource) {
  const escaped = [resource.key, resource.label, ...(resource.aliases || [])]
    .map((word) => String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  return String(message || '')
    .replace(new RegExp(`\\b(${escaped})\\b`, 'ig'), ' ')
    .replace(/\b(create|add|new|record|item|called|named|titled|for|with|please)\b/ig, ' ')
    .replace(/\s+/g, ' ')
    .trim() || `Chat-created ${resource.label}`;
}

function today(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function createPayload(resource, message) {
  const title = titleFromMessage(message, resource);
  const suffix = Date.now().toString().slice(-6);
  const priority = /urgent|critical/i.test(message) ? 'high' : /low/i.test(message) ? 'low' : 'medium';
  const defaults = {
    contracts: {
      title,
      contract_type: 'service_agreement',
      status: 'draft',
      party_a: 'Acme Inc',
      party_b: 'New Counterparty',
      value: /high value|enterprise/i.test(message) ? 250000 : 50000,
      currency: 'USD',
      start_date: today(),
      end_date: today(365),
      jurisdiction: 'Delaware, USA',
      description: `Created from system chat: ${message}`,
      risk_level: priority,
    },
    clauses: { title, clause_type: 'confidentiality', content: `Created from system chat: ${message}`, severity: 'standard', is_negotiable: true, contract_id: 1, status: 'active' },
    templates: { name: title, template_type: 'service_agreement', description: `Created from system chat: ${message}`, content: 'Template created from system chat.', jurisdiction: 'United States', industry: 'general', status: 'draft' },
    parties: { name: title, party_type: 'company', email: `party-${suffix}@example.com`, jurisdiction: 'United States', industry: 'general', status: 'active' },
    obligations: { contract_id: 1, title, description: `Created from system chat: ${message}`, obligated_party: 'Acme Inc', obligation_type: 'performance', due_date: today(30), frequency: 'one-time', status: 'pending', priority },
    approvals: { contract_id: 1, approver_name: title, approver_email: `approver-${suffix}@example.com`, approval_type: 'legal_review', status: 'pending', comments: `Created from system chat: ${message}`, priority: 'normal' },
    amendments: { contract_id: 1, title, description: `Created from system chat: ${message}`, amendment_type: 'modification', effective_date: today(), status: 'draft', requested_by: 'System Chat' },
    renewals: { contract_id: 1, renewal_type: 'manual', new_start_date: today(30), new_end_date: today(395), new_value: 50000, terms_changed: false, notice_date: today(7), status: 'pending', notes: `Created from system chat: ${message}` },
    risks: { contract_id: 1, title, overall_score: priority === 'high' ? 75 : 45, risk_level: priority, financial_risk: 50, legal_risk: 50, operational_risk: 50, compliance_risk: 50, assessor: 'System Chat', status: 'pending' },
    compliance: { contract_id: 1, title, regulation: 'General', compliance_score: 80, status: 'pending', checked_by: 'System Chat', next_review: today(90) },
    milestones: { contract_id: 1, title, description: `Created from system chat: ${message}`, milestone_type: 'deliverable', due_date: today(30), status: 'pending', payment_amount: 0, responsible_party: 'Acme Inc' },
    documents: { contract_id: 1, title, document_type: 'contract', file_name: `${title.replace(/[^a-z0-9]+/ig, '_').slice(0, 36)}.pdf`, file_size: '0KB', version: '1.0', uploaded_by: 'System Chat', status: 'draft' },
    audit: { contract_id: 1, action: title, entity_type: 'system_chat', entity_id: 1, performed_by: 'System Chat', details: { message } },
    settings: { key: `chat_${suffix}`, value: title, category: 'system_chat', description: `Created from system chat: ${message}` },
  };
  return defaults[resource.key] || { title };
}

function markdownRows(resource, rows) {
  if (!rows.length) return `No ${resource.label.toLowerCase()} records found.`;
  const shown = rows.slice(0, 8);
  return [
    `Loaded ${rows.length} ${resource.label.toLowerCase()} records.`,
    '',
    '| ID | Record | Status |',
    '|---:|---|---|',
    ...shown.map((row) => `| ${row.id ?? '-'} | ${String(row[resource.title] || row.title || row.name || row.key || row.action || `Record #${row.id}`).replace(/\|/g, '\\|')} | ${String(row.status || row.risk_level || row.category || '-').replace(/\|/g, '\\|')} |`),
  ].join('\n');
}

function humanizeKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function summarizeValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => {
      if (typeof item === 'string') return `- ${item}`;
      if (item && typeof item === 'object') {
        const title = item.title || item.finding || item.action || item.type || item.section || item.clause_type || 'Item';
        const detail = item.detail || item.description || item.explanation || item.rationale || item.recommended_action || '';
        return `- **${title}**${detail ? `: ${detail}` : ''}`;
      }
      return `- ${String(item)}`;
    }).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 6).map(([k, v]) => `- **${humanizeKey(k)}:** ${typeof v === 'object' ? JSON.stringify(v).slice(0, 180) : String(v)}`).join('\n');
  }
  return String(value);
}

function professionalResultMarkdown(result) {
  if (!result || typeof result !== 'object') return '';
  const lines = [];
  const summary = result.executive_summary || result.summary || result.overall_assessment || result.negotiation_strategy || result.recommended_strategy;
  if (summary) lines.push(`\n**Executive Summary**\n\n${summarizeValue(summary)}`);
  const preferred = [
    'key_findings',
    'changes',
    'matched_clauses',
    'ai_suggested_clauses',
    'recommended_actions',
    'next_actions',
    'risk_factors',
    'risk_indicators',
    'affected_obligations',
    'financial_impact',
    'proposed_terms',
    'drifts',
    'missing_clauses',
    'stats',
  ];
  for (const key of preferred) {
    if (result[key] === undefined || result[key] === null) continue;
    lines.push(`\n**${humanizeKey(key)}**\n\n${summarizeValue(result[key])}`);
  }
  const model = result.model ? `\n\n_Model: ${result.model}_` : '';
  return lines.slice(0, 7).join('\n') + model;
}

async function listResource(req, resource) {
  const payload = await callInternal(req, resource.endpoint);
  const rows = rowsFrom(payload);
  return {
    reply: markdownRows(resource, rows),
    action: `list_${resource.key}`,
    view: resource.path,
    data: { rows: rows.slice(0, 20), total: rows.length },
  };
}

async function createResource(req, resource, message) {
  const payload = createPayload(resource, message);
  const record = await callInternal(req, resource.endpoint, { method: 'POST', body: payload });
  return {
    reply: `Created ${resource.label} record #${record.id || 'new'}: **${record[resource.title] || record.title || record.name || record.key || payload.title || payload.name}**.`,
    action: `create_${resource.key}`,
    view: resource.path,
    data: { record },
  };
}

async function updateResource(req, resource, message) {
  const id = inferId(message);
  if (!id) return { reply: `Tell me which ${resource.label} record ID to update.`, action: 'needs_id', view: resource.path };
  const current = await callInternal(req, `${resource.endpoint}/${id}`);
  const patch = { ...current };
  if ('status' in patch) {
    if (/approve|approved/i.test(message)) patch.status = 'approved';
    else if (/reject|rejected/i.test(message)) patch.status = 'rejected';
    else if (/complete|completed|done/i.test(message)) patch.status = 'completed';
    else if (/active|activate/i.test(message)) patch.status = 'active';
    else if (/review/i.test(message)) patch.status = 'under_review';
    else if (/draft/i.test(message)) patch.status = 'draft';
    else if (/pending/i.test(message)) patch.status = 'pending';
  }
  if ('risk_level' in patch) {
    if (/critical/i.test(message)) patch.risk_level = 'critical';
    else if (/high/i.test(message)) patch.risk_level = 'high';
    else if (/medium/i.test(message)) patch.risk_level = 'medium';
    else if (/low/i.test(message)) patch.risk_level = 'low';
  }
  if ('priority' in patch) {
    if (/urgent|critical/i.test(message)) patch.priority = 'critical';
    else if (/high/i.test(message)) patch.priority = 'high';
    else if (/medium/i.test(message)) patch.priority = 'medium';
    else if (/low/i.test(message)) patch.priority = 'low';
  }
  const updated = await callInternal(req, `${resource.endpoint}/${id}`, { method: 'PUT', body: patch });
  return {
    reply: `Updated ${resource.label} record #${id}.`,
    action: `update_${resource.key}`,
    view: resource.path,
    data: { record: updated },
  };
}

async function deleteResource(req, resource, message) {
  const id = inferId(message);
  if (!id || !/\bdelete\b/i.test(message)) {
    return { reply: `Use explicit wording like "delete ${resource.label} 12".`, action: 'delete_needs_explicit_id', view: resource.path };
  }
  await callInternal(req, `${resource.endpoint}/${id}`, { method: 'DELETE' });
  return { reply: `Deleted ${resource.label} record #${id}.`, action: `delete_${resource.key}`, view: resource.path, data: { deleted_id: id } };
}

async function runAiTool(req, tool, message) {
  const payload = { ...tool.payload };
  const id = inferId(message);
  if (id && 'contract_id' in payload) payload.contract_id = id;
  if (id && 'party_id' in payload) payload.party_id = id;
  const result = await callInternal(req, tool.endpoint, { method: 'POST', body: payload });
  const report = professionalResultMarkdown(result);
  return {
    reply: `${tool.label} completed.${report ? `\n${report}` : ''}`,
    action: `run_${tool.key}`,
    view: tool.key.includes('redline') || tool.key.includes('clause-library') ? '/ai-custom' : '/dashboard',
    data: { result },
  };
}

async function sendNotifications(req) {
  const result = await callInternal(req, '/api/notifications/send-expiry', { method: 'POST', body: {} });
  return {
    reply: `Notification scan completed: ${result.renewals || 0} renewal alerts, ${result.obligations || 0} obligation alerts, ${(result.errors || []).length} errors.`,
    action: 'send_notifications',
    view: '/settings',
    data: result,
  };
}

function matchIntegration(message) {
  const text = normalize(message);
  const providers = [
    ['docusign', ['docusign', 'docu sign', 'signature', 'esign', 'e-sign']],
    ['slack', ['slack', 'message', 'notification']],
    ['hubspot', ['hubspot', 'crm']],
    ['salesforce', ['salesforce', 'sfDC', 'sfdc']],
    ['netsuite', ['netsuite', 'net suite', 'erp']],
    ['sap', ['sap']],
    ['oracle', ['oracle']],
  ];
  return providers.find(([, aliases]) => aliases.some((alias) => text.includes(normalize(alias))))?.[0];
}

async function runOps(req, message) {
  const text = normalize(message);
  if (/\b(test|send)\b/.test(text) && /\b(email|notification|notify)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/notifications/test', { method: 'POST', body: {} });
    return {
      reply: `Notification test **${result.status}** for **${result.to}**.`,
      action: 'ops_test_notification',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(job history|recent jobs|job runs|background jobs)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/jobs/history');
    return {
      reply: [
        `Loaded **${result.total || 0}** recent job runs.`,
        '',
        '| ID | Job | Status |',
        '|---:|---|---|',
        ...((result.data || []).slice(0, 8).map((job) => `| ${job.id} | ${job.job_key} | ${job.status} |`)),
      ].join('\n'),
      action: 'ops_job_history',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(job catalog|list jobs|available jobs)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/jobs');
    return {
      reply: [
        'Available operational jobs:',
        '',
        ...((result.jobs || []).map((job) => `- **${job.label}**: ${job.description}`)),
      ].join('\n'),
      action: 'ops_job_catalog',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(backup|export app|export data|download data)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/backup');
    const total = Object.values(result.record_sets || {}).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    return {
      reply: `Backup export prepared with **${total}** records across core modules.`,
      action: 'ops_backup',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(audit binder|binder)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/audit-binder');
    return {
      reply: `Audit binder prepared with **${result.sections?.length || 0}** sections and review steps.`,
      action: 'ops_audit_binder',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(audit export|export audit|audit log export)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/audit-export');
    return {
      reply: `Audit export prepared with **${result.total_records || 0}** records.`,
      action: 'ops_audit_export',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(rbac|role|roles|permission|permissions)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/rbac');
    return {
      reply: [
        'RBAC matrix loaded.',
        '',
        '| Role | Permissions |',
        '|---|---|',
        ...(result.roles || []).map((role) => `| ${role.role} | ${(role.permissions || []).join(', ')} |`),
      ].join('\n'),
      action: 'ops_rbac',
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(test|check|validate)\b/.test(text) && /\b(integration|docusign|slack|hubspot|salesforce|netsuite|sap|oracle|erp|crm)\b/.test(text)) {
    const provider = matchIntegration(message);
    if (!provider) return { reply: 'Tell me which integration to test: DocuSign, Slack, HubSpot, Salesforce, NetSuite, SAP, or Oracle.', action: 'ops_integration_needs_provider', view: '/platform-ops' };
    const result = await callInternal(req, `/api/ops/integrations/${provider}/test`, { method: 'POST', body: {} });
    return {
      reply: `**${result.label}** integration check: **${result.status}**.\n\n${result.next_action}`,
      action: `ops_test_${provider}`,
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(sync|synchronize)\b/.test(text) && /\b(docusign|slack|hubspot|salesforce|netsuite|sap|oracle|erp|crm)\b/.test(text)) {
    const provider = matchIntegration(message);
    if (!provider) return { reply: 'Tell me which integration to sync: DocuSign, HubSpot, Salesforce, NetSuite, SAP, or Oracle.', action: 'ops_sync_needs_provider', view: '/platform-ops' };
    const result = await callInternal(req, `/api/ops/integrations/${provider}/sync`, { method: 'POST', body: { direction: 'pull_and_push' } });
    return {
      reply: `**${result.label}** sync check **${result.status}**. Records considered: **${result.records_considered || 0}**.`,
      action: `ops_sync_${provider}`,
      view: '/platform-ops',
      data: result,
    };
  }
  if (/\b(push|send)\b/.test(text) && /\b(record|contract|document|party|approval|renewal)\b/.test(text) && /\b(docusign|hubspot|salesforce|netsuite|sap|oracle|erp|crm)\b/.test(text)) {
    const provider = matchIntegration(message);
    const resource = match(resources, message);
    const id = inferId(message);
    if (!provider || !resource || !id) return { reply: 'Use wording like "Push contract 3 to Salesforce".', action: 'ops_push_needs_provider_resource_id', view: '/platform-ops' };
    const result = await callInternal(req, `/api/ops/integrations/${provider}/push-record`, { method: 'POST', body: { resource: resource.key, id } });
    return {
      reply: `Prepared **${resource.label} #${id}** for **${result.label}**: **${result.status}**.`,
      action: `ops_push_${resource.key}_${provider}`,
      view: resource.path,
      data: result,
    };
  }
  if (/\b(run job|run readiness|readiness job|ops job|health job)\b/.test(text)) {
    const result = await callInternal(req, '/api/ops/jobs/run', { method: 'POST', body: { job: 'readiness-check' } });
    return {
      reply: `Readiness job **${result.status}** with **${(result.warnings || []).length}** warnings.`,
      action: 'ops_run_job',
      view: '/platform-ops',
      data: result,
    };
  }
  const result = await callInternal(req, '/api/ops/health');
  return {
    reply: [
      `Platform health is **${result.status}**.`,
      '',
      `Database: **${result.database?.status || 'unknown'}** (${result.database?.latency_ms || 0} ms)`,
      `Integrations configured: **${result.integrations?.configured || 0}/${result.integrations?.total || 0}**`,
      `OpenRouter configured: **${result.ai?.configured ? 'yes' : 'no'}**`,
      ...(result.missing_core_configuration?.length ? [`Missing core config: ${result.missing_core_configuration.join(', ')}`] : []),
    ].join('\n'),
    action: 'ops_health',
    view: '/platform-ops',
    data: result,
  };
}

async function documentIntelligence(req, message) {
  const id = inferId(message);
  if (!id) return { reply: 'Tell me which document ID to analyze, for example "analyze document 4".', action: 'document_intelligence_needs_id', view: '/documents' };
  const wantsAi = /\b(ai|review|clause|risk|audit)\b/i.test(message);
  const result = await callInternal(req, wantsAi ? `/api/documents/${id}/ai-review` : `/api/documents/${id}/intelligence`, wantsAi ? { method: 'POST', body: {} } : {});
  if (wantsAi) {
    const analysis = result.analysis || {};
    return {
      reply: [
        `AI document review completed for **${result.title}**.`,
        '',
        analysis.executive_summary ? `**Executive Summary**\n\n${summarizeValue(analysis.executive_summary)}` : '',
        analysis.key_findings ? `\n**Key Findings**\n\n${summarizeValue(analysis.key_findings)}` : '',
        analysis.recommended_actions ? `\n**Recommended Actions**\n\n${summarizeValue(analysis.recommended_actions)}` : '',
      ].filter(Boolean).join('\n'),
      action: 'document_ai_review',
      view: '/documents',
      data: result,
    };
  }
  return {
    reply: [
      `Document intelligence completed for **${result.title}**.`,
      '',
      `Readiness score: **${result.readiness?.score || 0}%**`,
      `Extraction status: **${result.extraction_status}**`,
      '',
      '**Recommendations**',
      ...((result.readiness?.recommendations || []).map((item) => `- ${item}`)),
    ].join('\n'),
    action: 'document_intelligence',
    view: '/documents',
    data: result,
  };
}

async function dashboardAnswer(req, message) {
  const [dashboard, contracts, parties] = await Promise.all([
    callInternal(req, '/api/dashboard'),
    pool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(value),0)::numeric AS value FROM contracts'),
    pool.query('SELECT COUNT(*)::int AS count FROM parties'),
  ]);
  const text = normalize(message);
  if (/value|amount|total contract/.test(text)) {
    return { reply: `Total contract value is **$${Number(contracts.rows[0].value || 0).toLocaleString()}** across **${contracts.rows[0].count}** contracts.`, action: 'answer_contract_value', view: '/dashboard', data: { dashboard } };
  }
  if (/how many|count|total/.test(text)) {
    return { reply: `Current counts: **${dashboard.contracts || 0}** contracts, **${dashboard.clauses || 0}** clauses, **${parties.rows[0].count}** parties, **${dashboard.obligations || 0}** obligations, **${dashboard.renewals || 0}** renewals, and **${dashboard.documents || 0}** documents.`, action: 'answer_counts', view: '/dashboard', data: { dashboard } };
  }
  const ai = await callOpenRouter(
    'You are an AI Contract Lifecycle Manager system copilot. Answer using the app context. Return concise markdown, not JSON.',
    `User question: ${message}\nCurrent dashboard context: ${JSON.stringify(dashboard)}\nContract aggregate: ${JSON.stringify(contracts.rows[0])}`,
    { temperature: 0.2, maxTokens: 1200 }
  );
  return { reply: ai.content, action: 'answer_question', view: '/dashboard', data: { dashboard, model: ai.model } };
}

router.get('/capabilities', (_req, res) => {
  res.json({
    resources: resources.map(({ key, label, path }) => ({ key, label, path })),
    ai_tools: aiTools.map(({ key, label }) => ({ key, label })),
    examples: [
      'List contracts',
      'Open renewals',
      'Create obligation for monthly report',
      'Mark approval 3 approved',
      'Set contract 7 high risk',
      'Delete document 12',
      'Run auto redline for contract 1',
      'Run clause library search',
      'Check platform health',
      'Test Salesforce integration',
      'Export backup',
      'Prepare audit binder',
      'Send test notification',
      'Sync Salesforce',
      'Push contract 3 to HubSpot',
      'Show job history',
      'Show RBAC permissions',
      'AI review document 3',
      'Send expiry notifications',
      'How many contracts do we have?',
      'What is total contract value?',
    ],
  });
});

router.post('/message', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  if (!message) return res.json({ reply: 'Ask me to list, open, create, update, delete, run AI tools, send notifications, or answer contract questions.' });
  try {
    const text = normalize(message);
    if (/\b(send|run|trigger)\b/.test(text) && /\b(expiry alert|renewal alert)\b/.test(text)) {
      return res.json(await sendNotifications(req));
    }

    if (/\b(platform|ops|operation|health|integration|docusign|slack|hubspot|salesforce|netsuite|sap|oracle|rbac|permission|backup|audit export|audit binder|binder|readiness job|job history|background jobs|test notification|email|sync|push)\b/i.test(message)) {
      return res.json(await runOps(req, message));
    }

    if (/\b(document|file)\b/i.test(message) && /\b(analy[sz]e|intelligence|extract|readiness|metadata)\b/i.test(message)) {
      return res.json(await documentIntelligence(req, message));
    }

    const tool = match(aiTools, message);
    if (tool && /\b(run|use|analy[sz]e|generate|draft|review|compare|search|check|summarize|redline)\b/i.test(message)) {
      return res.json(await runAiTool(req, tool, message));
    }

    if (/\b(how many|count|total|value|amount|question|what is|what are|summarize app|summary)\b/i.test(message)) {
      return res.json(await dashboardAnswer(req, message));
    }

    const page = match(pages, message);
    if (page && /\b(open|go to|navigate|show page|take me)\b/i.test(message)) {
      return res.json({ reply: `Opening ${page.label}.`, action: 'navigate', view: page.path });
    }

    const resource = match(resources, message);
    if (resource) {
      if (/\b(delete|remove)\b/i.test(message)) return res.json(await deleteResource(req, resource, message));
      if (/\b(create|add|new)\b/i.test(message)) return res.json(await createResource(req, resource, message));
      if (/\b(update|mark|set|approve|approved|reject|rejected|complete|activate|review|draft|pending)\b/i.test(message)) return res.json(await updateResource(req, resource, message));
      if (/\b(list|show|load|records|rows|table|what are)\b/i.test(message)) return res.json(await listResource(req, resource));
      return res.json({ reply: `Opening ${resource.label}.`, action: 'navigate', view: resource.path });
    }

    return res.json(await dashboardAnswer(req, message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
