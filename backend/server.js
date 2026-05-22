require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pool = require('./db');
const { generalRateLimiter } = require('./middleware/rateLimiter');
const { sendExpiryNotifications } = require('./services/notifications');
const app = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // disabled to allow ReactMarkdown / inline assets
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Env-driven CORS configuration
const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// General rate limiting
app.use('/api', generalRateLimiter);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));

app.use('/api/ai', require('./routes/agenticNegotiate'));

app.use('/api/ai', require('./routes/renewalPredict'));

app.use('/api/ai', require('./routes/regulatoryImpact'));

app.use('/api/ai', require('./routes/portfolioAnalytics'));

app.use('/api/ai', require('./routes/variantGenerate'));
app.use('/api/ai', require('./routes/aiNew'));   // new AI endpoints
app.use('/api/ai', require('./routes/aiCustom'));  // 8 custom non-CRUD AI features
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/clauses', require('./routes/clauses'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/parties', require('./routes/parties'));
app.use('/api/obligations', require('./routes/obligations'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/amendments', require('./routes/amendments'));
app.use('/api/renewals', require('./routes/renewals'));
app.use('/api/risks', require('./routes/risks'));
app.use('/api/compliance', require('./routes/compliance'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/discovery-agents', require('./routes/discoveryAgents'));
app.use('/api/settings', require('./routes/settings'));

// Dashboard stats
app.use('/api/dashboard', require('./middleware/auth'), async (req, res) => {
  try {
    const tables = [
      { key: 'contracts', table: 'contracts' },
      { key: 'clauses', table: 'clauses' },
      { key: 'templates', table: 'contract_templates' },
      { key: 'parties', table: 'parties' },
      { key: 'obligations', table: 'obligations' },
      { key: 'approvals', table: 'approvals' },
      { key: 'amendments', table: 'amendments' },
      { key: 'renewals', table: 'renewals' },
      { key: 'risks', table: 'risk_assessments' },
      { key: 'compliance', table: 'compliance_checks' },
      { key: 'milestones', table: 'milestones' },
      { key: 'documents', table: 'documents' },
      { key: 'audit', table: 'audit_log' },
    ];
    const stats = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*) FROM ${t.table}`);
      stats[t.key] = parseInt(r.rows[0].count);
    }
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/notifications/send-expiry — manually trigger expiry notifications
app.post('/api/notifications/send-expiry', require('./middleware/auth'), async (req, res) => {
  try {
    const result = await sendExpiryNotifications();
    res.json({ message: 'Expiry notifications processed', ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.BACKEND_PORT || 3001;
// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-amendments-lacks-analyze-amendment-impact', require('./routes/gap_amendments_lacks_analyze_amendment_impact'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-renewals-lacks-predict-renewal-success-or-predict-renewal-te', require('./routes/gap_renewals_lacks_predict_renewal_success_or_predict_renewal_te'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-approvals-lacks-predict-approval-likelihood', require('./routes/gap_approvals_lacks_predict_approval_likelihood'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-parties-lacks-counterparty-risk-scoring', require('./routes/gap_parties_lacks_counterparty_risk_scoring'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-limited-third-party-integrations-no-docusign-slack-hubspot-o', require('./routes/gap_limited_third_party_integrations_no_docusign_slack_hubspot_o'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-automated-renewal-reminder-or-auto-escalation-workflow', require('./routes/gap_no_automated_renewal_reminder_or_auto_escalation_workflow'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-analytics-dashboard-contract-spend-risk-heatmap-cycle-tim', require('./routes/gap_no_analytics_dashboard_contract_spend_risk_heatmap_cycle_tim'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-variant-playbook-management-alternative-template-sequence', require('./routes/gap_no_variant_playbook_management_alternative_template_sequence'));

// // === Batch 02 Gaps & Frontend Mounts ===
app.use('/api/gap-no-webhooks', require('./routes/gap_no_webhooks'));

// === Custom Views — 4 endpoints (mounted BEFORE 404 / listen) ===
app.use('/api/custom-views', require('./routes/customViews'));
app.use('/api/obligation-evidence-room', require('./routes/obligationEvidenceRoom'));

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);

  // Schedule expiry notifications — run once on startup, then every 24 hours
  const NOTIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
  setTimeout(() => {
    sendExpiryNotifications().catch(err => console.error('Notification scan failed:', err.message));
    setInterval(() => {
      sendExpiryNotifications().catch(err => console.error('Notification scan failed:', err.message));
    }, NOTIFICATION_INTERVAL_MS);
  }, 5000); // Wait 5s for server to settle before first scan
});
