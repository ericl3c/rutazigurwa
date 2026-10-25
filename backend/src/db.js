require('dotenv').config();
const { Pool } = require('pg');
const sslOptions = process.env.DATABASE_SSL === 'true'
  ? { ssl: { rejectUnauthorized: true } }
  : process.env.DATABASE_SSL === 'false' ? { ssl: false } : {};
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...sslOptions,
  max: 10,
});
module.exports = pool;
