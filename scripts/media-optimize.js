// npm run media:optimize [-- --force] [-- --dry]
// Creates the optional WebP derivative (<name>.webp beside the original) for EXISTING JPEG/PNG uploads. Originals are never changed.
// Same rules as new uploads: skip >30 MB or >50 MP, skip SVG/GIF/animated, keep only if >=15% smaller. One image at a time.
require('dotenv').config();
const db = require('../server/db'), { UPLOAD_DIR, exists } = require('../server/upload'), opt = require('../server/optimize'), path = require('path');
const force = process.argv.includes('--force'), dry = process.argv.includes('--dry');
(async () => {
  if (!opt.available()) { console.log('sharp is not installed/loadable on this server, so nothing can be optimised (the site is unaffected). Try: npm install sharp'); process.exit(0); }
  const [rows] = await db.query("SELECT id,path,original_name FROM media WHERE kind='image' ORDER BY id");
  const t = { created: 0, skipped: 0, error: 0, saved: 0 };
  for (const m of rows) {
    const w = opt.webpName(m.path); if (!w || !exists(m.path)) continue;
    if (exists(w) && !force) { console.log(`have     #${m.id} ${m.original_name || m.path}`); continue; }
    if (dry) { console.log(`would do #${m.id} ${m.original_name || m.path}`); continue; }
    const r = await opt.optimizeFile(UPLOAD_DIR, m.path);
    if (r.status === 'created') { t.created++; t.saved += r.original - r.webp; console.log(`created  #${m.id} ${m.original_name || m.path}  ${(r.original / 1048576).toFixed(2)} MB -> ${(r.webp / 1048576).toFixed(2)} MB`); }
    else { t[r.status === 'error' ? 'error' : 'skipped']++; console.log(`${r.status.padEnd(8)} #${m.id} ${m.original_name || m.path}  (${r.reason})`); }
  }
  console.log(`done: ${t.created} created, ${t.skipped} skipped, ${t.error} errors, ${(t.saved / 1048576).toFixed(1)} MB saved`); process.exit(t.error ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
