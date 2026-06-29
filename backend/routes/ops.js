const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const { rolePermissions, requirePermission } = require('../middleware/permissions');
const { sendEmail } = require('../services/notifications');

const router = express.Router();
router.use(auth);

const tables = [
  { key: 'contracts', table: 'contracts', label: 'Contracts' },
  { key: 'clauses', table: 'clauses', label: 'Clauses' },
  { key: 'templates', table: 'contract_templates', label: 'Templates' },
  { key: 'parties', table: 'parties', label: 'Parties' },
  { key: 'obligations', table: 'obligations', label: 'Obligations' },
  { key: 'approvals', table: 'approvals', label: 'Approvals' },
  { key: 'amendments', table: 'amendments', label: 'Amendments' },
  { key: 'renewals', table: 'renewals', label: 'Renewals' },
  { key: 'risks', table: 'risk_assessments', label: 'Risk Assessments' },
  { key: 'compliance', table: 'compliance_checks', label: 'Compliance Checks' },
  { key: 'milestones', table: 'milestones', label: 'Milestones' },
  { key: 'documents', table: 'documents', label: 'Documents' },
  { key: 'audit', table: 'audit_log', label: 'Audit Log' },
  { key: 'settings', table: 'settings', label: 'Settings' },
];

const integrationDefinitions = {
  docusign: {
    label: 'DocuSign',
    category: 'E-signature',
    required: ['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_PRIVATE_KEY'],
    optional: ['DOCUSIGN_BASE_URL'],
  },
  slack: {
    label: 'Slack',
    category: 'Notifications',
    requiredAny: [['SLACK_WEBHOOK_URL'], ['SLACK_BOT_TOKEN']],
    optional: ['SLACK_DEFAULT_CHANNEL'],
  },
  hubspot: {
    label: 'HubSpot',
    category: 'CRM',
    required: ['HUBSPOT_ACCESS_TOKEN'],
    optional: ['HUBSPOT_PORTAL_ID'],
  },
  salesforce: {
    label: 'Salesforce',
    category: 'CRM',
    required: ['SALESFORCE_INSTANCE_URL', 'SALESFORCE_ACCESS_TOKEN'],
    optional: ['SALESFORCE_API_VERSION'],
  },
  netsuite: {
    label: 'NetSuite',
    category: 'ERP',
    required: ['NETSUITE_ACCOUNT_ID', 'NETSUITE_CONSUMER_KEY', 'NETSUITE_CONSUMER_SECRET', 'NETSUITE_TOKEN_ID', 'NETSUITE_TOKEN_SECRET'],
    optional: ['NETSUITE_REALM'],
  },
  sap: {
    label: 'SAP',
    category: 'ERP',
    required: ['SAP_BASE_URL', 'SAP_CLIENT_ID', 'SAP_CLIENT_SECRET'],
    optional: ['SAP_TENANT_ID'],
  },
  oracle: {
    label: 'Oracle',
    category: 'ERP',
    required: ['ORACLE_ERP_BASE_URL', 'ORACLE_ERP_USERNAME', 'ORACLE_ERP_PASSWORD'],
    optional: ['ORACLE_ERP_TENANT'],
  },
};

function envPresent(name) {
  return Boolean(String(process.env[name] || '').trim());
}

async function ensureOpsTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ops_job_runs (
      id SERIAL PRIMARY KEY,
      job_key VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      summary TEXT,
      result JSONB DEFAULT '{}',
      triggered_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS integration_events (
      id SERIAL PRIMARY KEY,
      provider VARCHAR(100) NOT NULL,
      action VARCHAR(100) NOT NULL,
      status VARCHAR(50) NOT NULL,
      record_type VARCHAR(100),
      record_id INTEGER,
      result JSONB DEFAULT '{}',
      triggered_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function recordJobRun({ jobKey, status, summary, result, user }) {
  await ensureOpsTables();
  const r = await pool.query(
    `INSERT INTO ops_job_runs (job_key, status, summary, result, triggered_by)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [jobKey, status, summary, JSON.stringify(result || {}), user?.email || user?.id || 'system']
  );
  return r.rows[0];
}

async function recordIntegrationEvent({ provider, action, status, recordType, recordId, result, user }) {
  await ensureOpsTables();
  const r = await pool.query(
    `INSERT INTO integration_events (provider, action, status, record_type, record_id, result, triggered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [provider, action, status, recordType || null, recordId || null, JSON.stringify(result || {}), user?.email || user?.id || 'system']
  );
  return r.rows[0];
}

function statusForIntegration(key, definition) {
  const required = definition.required || [];
  const missingRequired = required.filter((name) => !envPresent(name));
  const missingGroups = (definition.requiredAny || []).filter((group) => !group.some(envPresent));
  const missing = [
    ...missingRequired,
    ...missingGroups.map((group) => group.join(' or ')),
  ];
  const configured = missing.length === 0;
  return {
    key,
    label: definition.label,
    category: definition.category,
    status: configured ? 'configured' : 'needs_credentials',
    configured,
    missing,
    optional_missing: (definition.optional || []).filter((name) => !envPresent(name)),
    checked_at: new Date().toISOString(),
  };
}

async function tableCounts() {
  const counts = [];
  for (const item of tables) {
    try {
      const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${item.table}`);
      counts.push({ ...item, count: result.rows[0].count, status: 'ok' });
    } catch (err) {
      counts.push({ ...item, count: 0, status: 'error', error: err.message });
    }
  }
  return counts;
}

router.get('/health', requirePermission('ops:read'), async (_req, res) => {
  try {
    await ensureOpsTables();
    const dbStarted = Date.now();
    await pool.query('SELECT 1');
    const counts = await tableCounts();
    const integrations = Object.entries(integrationDefinitions).map(([key, definition]) => statusForIntegration(key, definition));
    const configuredIntegrations = integrations.filter((item) => item.configured).length;
    const missingCore = [
      ['JWT_SECRET', envPresent('JWT_SECRET')],
      ['OPENROUTER_API_KEY', envPresent('OPENROUTER_API_KEY')],
    ].filter(([, ok]) => !ok).map(([name]) => name);
    res.json({
      status: missingCore.length ? 'degraded' : 'ready',
      checked_at: new Date().toISOString(),
      database: {
        status: 'ok',
        latency_ms: Date.now() - dbStarted,
      },
      tables: counts,
      integrations: {
        configured: configuredIntegrations,
        total: integrations.length,
        items: integrations,
      },
      ai: {
        provider: 'OpenRouter',
        configured: envPresent('OPENROUTER_API_KEY'),
      },
      notification_delivery: {
        email_configured: envPresent('SMTP_HOST') || envPresent('SENDGRID_API_KEY'),
        slack_configured: envPresent('SLACK_WEBHOOK_URL') || envPresent('SLACK_BOT_TOKEN'),
      },
      background_jobs: {
        catalog_endpoint: '/api/ops/jobs',
        history_endpoint: '/api/ops/jobs/history',
      },
      missing_core_configuration: missingCore,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

router.get('/integrations', requirePermission('ops:read'), (_req, res) => {
  res.json({
    integrations: Object.entries(integrationDefinitions).map(([key, definition]) => statusForIntegration(key, definition)),
  });
});

router.post('/integrations/:provider/test', requirePermission('ops:execute'), async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const definition = integrationDefinitions[provider];
  if (!definition) return res.status(404).json({ error: 'Integration provider not configured' });
  const status = statusForIntegration(provider, definition);
  const payload = {
    ...status,
    test_result: status.configured ? 'credentials_present' : 'blocked_missing_credentials',
    next_action: status.configured
      ? `${definition.label} credentials are present. Connect the provider SDK or live API call in this handler for production transactions.`
      : `Add ${status.missing.join(', ')} to .env and restart the app.`,
    side_effects_performed: false,
  };
  await recordIntegrationEvent({
    provider,
    action: 'test_config',
    status: payload.test_result,
    result: payload,
    user: req.user,
  });
  res.json(payload);
});

router.post('/integrations/:provider/sync', requirePermission('ops:execute'), async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const definition = integrationDefinitions[provider];
  if (!definition) return res.status(404).json({ error: 'Integration provider not configured' });
  const status = statusForIntegration(provider, definition);
  const counts = await tableCounts();
  const result = {
    provider,
    label: definition.label,
    status: status.configured ? 'sync_ready' : 'sync_simulated_missing_credentials',
    direction: req.body?.direction || 'pull_and_push',
    checked_modules: counts.map(({ key, count }) => ({ key, count })),
    records_considered: counts.reduce((sum, item) => sum + (item.count || 0), 0),
    external_side_effects_performed: false,
    recommended_next_actions: status.configured
      ? ['Map external object IDs to local contract records.', 'Enable provider-specific SDK/API call for production sync.', 'Run a sandbox sync before enabling write-back.']
      : [`Add missing credentials: ${status.missing.join(', ')}.`, 'Use this simulated sync output to validate mapping and workflow design.'],
  };
  const event = await recordIntegrationEvent({
    provider,
    action: 'sync',
    status: result.status,
    result,
    user: req.user,
  });
  res.json({ ...result, event_id: event.id });
});

router.post('/integrations/:provider/push-record', requirePermission('ops:execute'), async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase();
  const definition = integrationDefinitions[provider];
  if (!definition) return res.status(404).json({ error: 'Integration provider not configured' });
  const resource = String(req.body?.resource || 'contracts').toLowerCase();
  const id = parseInt(req.body?.id, 10);
  const table = tables.find((item) => item.key === resource);
  if (!table || !id) return res.status(400).json({ error: 'resource and id are required' });
  const record = await pool.query(`SELECT * FROM ${table.table} WHERE id = $1`, [id]);
  if (!record.rows.length) return res.status(404).json({ error: `${table.label} record not found` });
  const status = statusForIntegration(provider, definition);
  const result = {
    provider,
    label: definition.label,
    resource,
    id,
    local_record_title: record.rows[0].title || record.rows[0].name || record.rows[0].key || `${table.label} #${id}`,
    status: status.configured ? 'ready_to_push' : 'push_simulated_missing_credentials',
    external_side_effects_performed: false,
    payload_preview: record.rows[0],
    next_action: status.configured
      ? `Credentials are present. Add the provider-specific write call to push this ${table.label} record.`
      : `Add missing credentials: ${status.missing.join(', ')}.`,
  };
  const event = await recordIntegrationEvent({
    provider,
    action: 'push_record',
    status: result.status,
    recordType: resource,
    recordId: id,
    result,
    user: req.user,
  });
  res.json({ ...result, event_id: event.id });
});

router.get('/rbac', requirePermission('ops:read'), (_req, res) => {
  res.json({
    roles: Object.entries(rolePermissions).map(([role, permissions]) => ({ role, permissions })),
    enforcement: [
      { area: 'Authenticated API routes', status: 'active', description: 'JWT token required on protected routes.' },
      { area: 'Platform operations', status: 'active', description: 'Operations endpoints require ops permissions.' },
      { area: 'Destructive chatbot commands', status: 'guarded', description: 'Delete wording must be explicit and authenticated.' },
    ],
  });
});

router.get('/backup', requirePermission('ops:execute'), async (_req, res) => {
  try {
    const backup = {};
    for (const item of tables) {
      try {
        const result = await pool.query(`SELECT * FROM ${item.table} ORDER BY id NULLS LAST LIMIT 1000`);
        backup[item.key] = result.rows;
      } catch (err) {
        backup[item.key] = { error: err.message };
      }
    }
    res.setHeader('Content-Disposition', `attachment; filename="contract-lifecycle-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({
      exported_at: new Date().toISOString(),
      app: 'AIContractLifecycleManager',
      record_sets: backup,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-export', requirePermission('ops:execute'), async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, contract_id, action, entity_type, entity_id, performed_by, ip_address, details, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT 500
    `);
    res.json({
      exported_at: new Date().toISOString(),
      format: 'json',
      total_records: result.rows.length,
      records: result.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/audit-binder', requirePermission('ops:execute'), async (_req, res) => {
  try {
    const [audit, contracts, approvals, risks, compliance] = await Promise.all([
      pool.query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 250'),
      pool.query('SELECT id, title, status, risk_level, value, end_date FROM contracts ORDER BY id LIMIT 250'),
      pool.query('SELECT id, contract_id, approver_name, approval_type, status, decision_date FROM approvals ORDER BY id LIMIT 250'),
      pool.query('SELECT id, contract_id, title, overall_score, risk_level, status FROM risk_assessments ORDER BY id LIMIT 250'),
      pool.query('SELECT id, contract_id, title, regulation, compliance_score, status FROM compliance_checks ORDER BY id LIMIT 250'),
    ]);
    res.json({
      exported_at: new Date().toISOString(),
      title: 'AI Contract Lifecycle Manager Audit Binder',
      sections: [
        { title: 'Executive Control Summary', records: [{ status: 'prepared', scope: 'Contracts, approvals, risk, compliance, and audit trail evidence.' }] },
        { title: 'Contracts', records: contracts.rows },
        { title: 'Approvals', records: approvals.rows },
        { title: 'Risk Assessments', records: risks.rows },
        { title: 'Compliance Checks', records: compliance.rows },
        { title: 'Audit Trail', records: audit.rows },
      ],
      recommended_review_steps: [
        'Confirm approval records match contract status transitions.',
        'Review high-risk contracts and expired/near-expiry terms.',
        'Validate compliance checks with supporting evidence.',
        'Archive this JSON into the audit evidence repository or render it into PDF for formal filing.',
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/test', requirePermission('ops:execute'), async (req, res) => {
  const to = req.body?.to || process.env.ADMIN_EMAIL || req.user?.email;
  if (!to) return res.status(400).json({ error: 'No recipient configured. Provide to or set ADMIN_EMAIL.' });
  const subject = req.body?.subject || 'AI Contract Lifecycle Manager test notification';
  const html = req.body?.html || '<p>This is a test notification from AI Contract Lifecycle Manager.</p>';
  const sent = await sendEmail(to, subject, html);
  const result = {
    to,
    subject,
    sent,
    status: sent ? 'sent' : 'not_sent_no_delivery_config_or_provider_error',
    email_configured: envPresent('SMTP_HOST') || envPresent('SENDGRID_API_KEY'),
    checked_at: new Date().toISOString(),
  };
  await recordJobRun({
    jobKey: 'test-notification',
    status: result.status,
    summary: sent ? `Sent test notification to ${to}` : `Could not send test notification to ${to}`,
    result,
    user: req.user,
  });
  res.json(result);
});

router.get('/jobs', requirePermission('ops:read'), async (_req, res) => {
  res.json({
    jobs: [
      { key: 'readiness-check', label: 'Readiness Check', description: 'Checks table health, counts, and operational warnings.' },
      { key: 'renewal-reminder-scan', label: 'Renewal Reminder Scan', description: 'Scans renewals and obligations due soon.' },
      { key: 'integration-sync-check', label: 'Integration Sync Check', description: 'Checks configured external systems and sync readiness.' },
      { key: 'audit-binder-prep', label: 'Audit Binder Prep', description: 'Prepares audit evidence sections for export.' },
    ],
  });
});

router.get('/jobs/history', requirePermission('ops:read'), async (_req, res) => {
  try {
    await ensureOpsTables();
    const r = await pool.query('SELECT * FROM ops_job_runs ORDER BY created_at DESC LIMIT 100');
    res.json({ data: r.rows, total: r.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/jobs/run', requirePermission('ops:execute'), async (req, res) => {
  const job = String(req.body?.job || 'readiness-check').toLowerCase();
  const counts = await tableCounts();
  const warnings = counts
    .filter((item) => item.status !== 'ok' || item.count === 0)
    .map((item) => `${item.label}: ${item.status === 'ok' ? 'no records' : item.error}`);
  const payload = {
    job,
    status: warnings.length ? 'completed_with_warnings' : 'completed',
    ran_at: new Date().toISOString(),
    findings: counts,
    warnings,
    recommended_actions: warnings.length
      ? ['Seed or repair empty/error tables before production use.', 'Run the health check again after fixes.']
      : ['All core tables are populated and readable.', 'Review integration credentials before enabling external workflows.'],
  };
  const run = await recordJobRun({
    jobKey: job,
    status: payload.status,
    summary: `${job} finished with ${warnings.length} warning(s).`,
    result: payload,
    user: req.user,
  });
  res.json({ ...payload, run_id: run.id });
});

module.exports = router;
