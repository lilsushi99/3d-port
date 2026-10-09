// Applies migrations/*.sql in order and records them, so the database can be rebuilt identically anywhere.
const fs = require('fs'), path = require('path');
const db = require('./db');
(async () => {
  await db.query('CREATE TABLE IF NOT EXISTS migrations (name VARCHAR(190) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
  const done = new Set((await db.query('SELECT name FROM migrations'))[0].map(r => r.name));
  const dir = path.join(__dirname, '..', 'migrations');
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8'), first = /CREATE TABLE\s+`?(\w+)`?/i.exec(sql);
    if (first && (await db.query('SHOW TABLES LIKE ?', [first[1]]))[0].length) { await db.query('INSERT IGNORE INTO migrations (name) VALUES (?)', [f]); console.log('already applied manually, recorded', f); continue; }
    const conn = await db.getConnection();
    try {
      for (const stmt of fs.readFileSync(path.join(dir, f), 'utf8').split(/;\s*\n/).map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) await conn.query(stmt);
      await conn.query('INSERT INTO migrations (name) VALUES (?)', [f]);
      console.log('applied', f);
    } finally { conn.release(); }
  }
  console.log('migrations up to date'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
