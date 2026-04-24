require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/ai', require('./routes/ai'));
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

const PORT = process.env.BACKEND_PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
