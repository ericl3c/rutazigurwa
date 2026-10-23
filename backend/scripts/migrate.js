require('dotenv').config();
const fs = require('fs'), path = require('path');
const pool = require('../src/db');
(async () => {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())');
  const dir = path.join(__dirname, '../migrations');
  for (const f of fs.readdirSync(dir).filter((x) => /^\d+_.*\.sql$/.test(x) && !x.endsWith('.down.sql')).sort()) {
    if ((await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [f])).rowCount) continue;
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [f]);
    console.log('applied', f);
  }
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
