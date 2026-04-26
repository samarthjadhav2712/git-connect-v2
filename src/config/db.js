
require('dotenv').config();
const { Pool } = require('pg');
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




module.exports = pool;