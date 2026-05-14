const pool = require('../db');

let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

// Create transporter (graceful skip if not configured)
function createTransporter() {
  if (!nodemailer) return null;
  if (!process.env.SMTP_HOST && !process.env.SENDGRID_API_KEY) return null;
  try {
    if (process.env.SENDGRID_API_KEY) {
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: { user: 'apikey', pass: process.env.SENDGRID_API_KEY }
      });
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } catch (e) {
    console.warn('Email transporter creation failed:', e.message);
    return null;
  }
}

async function sendEmail(to, subject, html) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Notifications] Email skipped (no SMTP config): TO=${to} SUBJECT=${subject}`);
    return false;
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@contractai.com',
      to,
      subject,
      html
    });
    return true;
  } catch (e) {
    console.warn('[Notifications] Failed to send email:', e.message);
    return false;
  }
}

// Scan renewals and obligations due in next 30 days and send notifications
async function sendExpiryNotifications() {
  const windowDays = 30;
  const sent = { renewals: 0, obligations: 0, errors: [] };

  try {
    // Find renewals due within 30 days
    const renewalsRes = await pool.query(
      `SELECT r.*, c.title as contract_title, c.contract_number, u.email as user_email, u.name as user_name
       FROM renewals r
       LEFT JOIN contracts c ON r.contract_id = c.id
       LEFT JOIN users u ON c.user_id = u.id
       WHERE r.renewal_date BETWEEN NOW() AND NOW() + INTERVAL '${windowDays} days'
       AND r.status NOT IN ('completed', 'cancelled')
       AND (r.last_notified_at IS NULL OR r.last_notified_at < NOW() - INTERVAL '24 hours')`,
      []
    );

    for (const renewal of renewalsRes.rows) {
      try {
        const daysUntil = Math.ceil((new Date(renewal.renewal_date) - new Date()) / (1000 * 60 * 60 * 24));
        const email = renewal.user_email || process.env.ADMIN_EMAIL;
        if (!email) continue;

        const html = `
          <h2>Contract Renewal Alert</h2>
          <p>Dear ${renewal.user_name || 'Team'},</p>
          <p>The following contract renewal is due in <strong>${daysUntil} day(s)</strong>:</p>
          <table border="1" cellpadding="8" style="border-collapse:collapse;">
            <tr><td><strong>Contract</strong></td><td>${renewal.contract_title || 'N/A'} (${renewal.contract_number || 'N/A'})</td></tr>
            <tr><td><strong>Renewal Date</strong></td><td>${new Date(renewal.renewal_date).toLocaleDateString()}</td></tr>
            <tr><td><strong>Auto-Renew</strong></td><td>${renewal.auto_renew ? 'Yes' : 'No'}</td></tr>
            ${renewal.renewal_terms ? `<tr><td><strong>Terms</strong></td><td>${renewal.renewal_terms}</td></tr>` : ''}
          </table>
          <p>Please review and take appropriate action.</p>
          <p>— AI Contract Lifecycle Manager</p>
        `;

        await sendEmail(email, `[Contract Alert] Renewal due in ${daysUntil} days: ${renewal.contract_title || 'Contract'}`, html);

        // Update last_notified_at (graceful — column may not exist)
        try {
          await pool.query('UPDATE renewals SET last_notified_at=NOW() WHERE id=$1', [renewal.id]);
        } catch (e) { /* column may not exist yet */ }

        sent.renewals++;
      } catch (e) {
        sent.errors.push({ type: 'renewal', id: renewal.id, error: e.message });
      }
    }

    // Find obligations due within 30 days
    const obligationsRes = await pool.query(
      `SELECT o.*, c.title as contract_title, c.contract_number, u.email as user_email, u.name as user_name
       FROM obligations o
       LEFT JOIN contracts c ON o.contract_id = c.id
       LEFT JOIN users u ON c.user_id = u.id
       WHERE o.due_date BETWEEN NOW() AND NOW() + INTERVAL '${windowDays} days'
       AND o.status NOT IN ('completed', 'cancelled')
       AND (o.last_notified_at IS NULL OR o.last_notified_at < NOW() - INTERVAL '24 hours')`,
      []
    );

    for (const obligation of obligationsRes.rows) {
      try {
        const daysUntil = Math.ceil((new Date(obligation.due_date) - new Date()) / (1000 * 60 * 60 * 24));
        const email = obligation.user_email || process.env.ADMIN_EMAIL;
        if (!email) continue;

        const html = `
          <h2>Obligation Due Alert</h2>
          <p>Dear ${obligation.user_name || 'Team'},</p>
          <p>The following contract obligation is due in <strong>${daysUntil} day(s)</strong>:</p>
          <table border="1" cellpadding="8" style="border-collapse:collapse;">
            <tr><td><strong>Contract</strong></td><td>${obligation.contract_title || 'N/A'}</td></tr>
            <tr><td><strong>Obligation</strong></td><td>${obligation.title}</td></tr>
            <tr><td><strong>Responsible Party</strong></td><td>${obligation.responsible_party || 'N/A'}</td></tr>
            <tr><td><strong>Due Date</strong></td><td>${new Date(obligation.due_date).toLocaleDateString()}</td></tr>
            ${obligation.penalty ? `<tr><td><strong>Penalty</strong></td><td>${obligation.penalty}</td></tr>` : ''}
          </table>
          ${obligation.description ? `<p><strong>Details:</strong> ${obligation.description}</p>` : ''}
          <p>Please ensure this obligation is fulfilled on time to avoid penalties.</p>
          <p>— AI Contract Lifecycle Manager</p>
        `;

        await sendEmail(email, `[Contract Alert] Obligation due in ${daysUntil} days: ${obligation.title}`, html);

        try {
          await pool.query('UPDATE obligations SET last_notified_at=NOW() WHERE id=$1', [obligation.id]);
        } catch (e) { /* column may not exist yet */ }

        sent.obligations++;
      } catch (e) {
        sent.errors.push({ type: 'obligation', id: obligation.id, error: e.message });
      }
    }
  } catch (err) {
    sent.errors.push({ type: 'general', error: err.message });
    console.error('[Notifications] Scan error:', err.message);
  }

  console.log(`[Notifications] Sent: ${sent.renewals} renewal alerts, ${sent.obligations} obligation alerts${sent.errors.length ? `, ${sent.errors.length} errors` : ''}`);
  return sent;
}

module.exports = { sendExpiryNotifications, sendEmail };
