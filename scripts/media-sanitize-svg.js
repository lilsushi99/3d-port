// npm run media:sanitize-svg            -> dry run: reports which EXISTING SVG uploads would change
// npm run media:sanitize-svg -- --write -> rewrites them with the sanitised markup (a backup copy <file>.svg.bak is kept beside each)
// SVGs uploaded before the sanitiser existed were only regex-checked. New uploads are always sanitised.
require('dotenv').config();
const fs = require('fs'), path = require('path'), db = require('../server/db'), { UPLOAD_DIR } = require('../server/upload'), { sanitizeSvg } = require('../server/svg');
const write = process.argv.includes('--write');
(async () => {
  const [rows] = await db.query("SELECT id,path,original_name FROM media WHERE mime='image/svg+xml' ORDER BY id"); let changed = 0, failed = 0;
  for (const m of rows) {
    const f = path.join(UPLOAD_DIR, path.basename(m.path)); if (!fs.existsSync(f)) continue;
    try {
      const before = fs.readFileSync(f), after = sanitizeSvg(before);
      if (after === before.toString('utf8')) { console.log(`clean    #${m.id} ${m.original_name}`); continue; }
      changed++; console.log(`${write ? 'rewrote ' : 'would change'} #${m.id} ${m.original_name}`);
      if (write) { fs.copyFileSync(f, f + '.bak'); fs.writeFileSync(f + '.tmp', after); fs.renameSync(f + '.tmp', f); await db.query('UPDATE media SET size_bytes=? WHERE id=?', [Buffer.byteLength(after), m.id]); }
    } catch (e) { failed++; console.log(`REJECTED #${m.id} ${m.original_name}: ${e.message} (file left untouched)`); }
  }
  console.log(`${rows.length} SVG file(s): ${changed} ${write ? 'rewritten' : 'would change'}, ${failed} rejected.${!write && changed ? ' Re-run with -- --write to apply.' : ''}`); process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
