const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

async function ensureSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(255) UNIQUE NOT NULL,
      value TEXT,
      category VARCHAR(100) DEFAULT 'general',
      description TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

router.get('/', auth, async (_req, res) => {
  try {
    await ensureSettingsTable();
    const r = await pool.query('SELECT * FROM settings ORDER BY category, key');
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    await ensureSettingsTable();
    const r = await pool.query('SELECT * FROM settings WHERE id = $1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Setting not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    await ensureSettingsTable();
    const { key, value, category, description } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    const r = await pool.query(
      `INSERT INTO settings (key, value, category, description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT (key) DO UPDATE SET
         value = EXCLUDED.value,
         category = EXCLUDED.category,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING *`,
      [key, value || '', category || 'general', description || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    await ensureSettingsTable();
    const { key, value, category, description } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });
    const r = await pool.query(
      `UPDATE settings
          SET key=$1, value=$2, category=$3, description=$4, updated_at=NOW()
        WHERE id=$5
        RETURNING *`,
      [key, value || '', category || 'general', description || null, req.params.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Setting not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureSettingsTable();
    const r = await pool.query('DELETE FROM settings WHERE id = $1 RETURNING id', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Setting not found' });
    res.json({ message: 'Setting deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
