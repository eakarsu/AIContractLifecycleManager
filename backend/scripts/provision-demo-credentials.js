require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const bcrypt = require('bcryptjs');
const pool = require('../db');

function configuredCredentials() {
  const candidates = [
    ['DEMO_EMAIL', 'DEMO_PASSWORD'],
    ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD'],
    ['ADMIN_EMAIL', 'ADMIN_PASSWORD'],
    ['DEFAULT_EMAIL', 'DEFAULT_PASSWORD'],
  ];

  for (const [emailKey, passwordKey] of candidates) {
    const email = process.env[emailKey]?.trim().toLowerCase();
    const password = process.env[passwordKey];
    if (email && password) return { email, password };
  }
  return null;
}

async function provision() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to provision demo credentials in production.');
  }
  if ((process.env.ENABLE_DEMO_CREDENTIAL_AUTOFILL || 'true') !== 'true') {
    console.log('Demo credential provisioning is disabled.');
    return;
  }

  const credentials = configuredCredentials();
  if (!credentials) {
    throw new Error('No complete local demo credential pair is configured.');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) DEFAULT 'Admin',
      role VARCHAR(50) DEFAULT 'user',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  const passwordHash = await bcrypt.hash(credentials.password, 10);
  await pool.query(
    `INSERT INTO users (email, password, name, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET password = EXCLUDED.password,
           name = EXCLUDED.name,
           role = EXCLUDED.role,
           updated_at = NOW()`,
    [credentials.email, passwordHash, 'Demo Administrator', 'admin'],
  );
  console.log(`Provisioned local demo account for ${credentials.email}.`);
}

provision()
  .catch((error) => {
    console.error(`Demo credential provisioning failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
