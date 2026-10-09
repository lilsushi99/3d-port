// Usage: ADMIN_EMAIL=you@x.com ADMIN_PASSWORD='long password' npm run create-admin   (or answer the prompts)
require('dotenv').config();
const bcrypt = require('bcryptjs'), readline = require('readline'), db = require('../server/db');
const ask = q => new Promise(r => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, a => { rl.close(); r(a); }); });
(async () => {
  const email = process.env.ADMIN_EMAIL || await ask('Admin email: ');
  const pw = process.env.ADMIN_PASSWORD || await ask('Admin password (min 10 chars): ');
  if (!email || pw.length < 10) { console.error('Email required and password must be at least 10 characters.'); process.exit(1); }
  const hash = await bcrypt.hash(pw, 12);
  await db.query('INSERT INTO admin_users (email,password_hash) VALUES (?,?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash)', [email.toLowerCase(), hash]);
  console.log('Admin saved:', email); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
