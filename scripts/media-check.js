// npm run media:check  -> lists every media row and whether its file exists in UPLOAD_DIR (read-only; changes nothing).
require('dotenv').config();
const db = require('../server/db'), { exists, UPLOAD_DIR, insideApp } = require('../server/upload'), fs = require('fs');
(async () => {
  const [rows] = await db.query('SELECT id,path,kind,original_name FROM media ORDER BY id');
  const known = new Set(rows.map(r => r.path)), orphans = fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.') && !known.has(f));
  const missing = rows.filter(r => !exists(r.path));
  console.log(`Upload dir is ${insideApp ? 'INSIDE the project (redeploys can erase it!)' : 'outside the project (persistent)'}`);
  console.log(`${rows.length} media rows, ${rows.length - missing.length} files present, ${missing.length} MISSING, ${orphans.length} files on disk with no DB row`);
  missing.forEach(m => console.log(`  MISSING  id=${m.id}  ${m.kind}  ${m.original_name || m.path}   -> re-upload via Admin > Media > Replace file`));
  process.exit(missing.length ? 2 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
