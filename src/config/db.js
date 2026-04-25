const { Pool } = require('pg');
require('dotenv').config();

const normalizeConnectionString = (url) => {
  if (!url) return url;

  return url.replace(/sslmode=(require|prefer|verify-ca)/i, 'sslmode=verify-full');
};

const connectionString = normalizeConnectionString(process.env.DATABASE_URL);

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }, // required for Neon
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Verify connection on startup
pool.connect()
  .then(client => {
    console.log('✅  Connected to Neon PostgreSQL');
    client.release();
  })
  .catch(err => {
    console.error('❌  Neon DB connection failed:', err.message);
    process.exit(1);
  });

module.exports = pool;