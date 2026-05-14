const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/settings — get user notification preferences
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    let r = await pool.query('SELECT * FROM settings WHERE user_id = $1', [userId]);
    if (r.rows.length === 0) {
      // Auto-create default settings for user
      r = await pool.query(
        `INSERT INTO settings (user_id, email_notifications, renewal_alerts_days, obligation_alerts_days,
         milestone_alerts_days, approval_notifications, daily_digest, timezone, created_at, updated_at)
         VALUES ($1, true, 30, 7, 7, true, false, 'UTC', NOW(), NOW()) RETURNING *`,
        [userId]
      );
    }
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/settings — update user notification preferences
router.put('/', auth, async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const {
      email_notifications, renewal_alerts_days, obligation_alerts_days,
      milestone_alerts_days, approval_notifications, daily_digest, timezone
    } = req.body;

    const r = await pool.query(
      `INSERT INTO settings (user_id, email_notifications, renewal_alerts_days, obligation_alerts_days,
       milestone_alerts_days, approval_notifications, daily_digest, timezone, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         email_notifications = EXCLUDED.email_notifications,
         renewal_alerts_days = EXCLUDED.renewal_alerts_days,
         obligation_alerts_days = EXCLUDED.obligation_alerts_days,
         milestone_alerts_days = EXCLUDED.milestone_alerts_days,
         approval_notifications = EXCLUDED.approval_notifications,
         daily_digest = EXCLUDED.daily_digest,
         timezone = EXCLUDED.timezone,
         updated_at = NOW()
       RETURNING *`,
      [userId, email_notifications ?? true, renewal_alerts_days ?? 30, obligation_alerts_days ?? 7,
       milestone_alerts_days ?? 7, approval_notifications ?? true, daily_digest ?? false, timezone || 'UTC']
    );
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
