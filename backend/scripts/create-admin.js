// One-time administrator creation. Run manually: npm run create-admin
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
(async () => {
  const u = process.env.ADMIN_INITIAL_USERNAME, p = process.env.ADMIN_INITIAL_PASSWORD;
  if (!u || !p || p.length < 12) { console.error('Set ADMIN_INITIAL_USERNAME and an ADMIN_INITIAL_PASSWORD of at least 12 characters.'); process.exit(1); }
  const exists = await pool.query('SELECT 1 FROM admins WHERE username=$1', [u]);
  if (exists.rowCount) { console.error('That administrator already exists. Nothing changed.'); process.exit(1); }
  await pool.query('INSERT INTO admins (username, password_hash) VALUES ($1,$2)', [u, await bcrypt.hash(p, 12)]);
  console.log(`Administrator "${u}" created. Now remove ADMIN_INITIAL_PASSWORD from your environment.`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
