// Media storage. Files live on disk in UPLOAD_DIR; MySQL stores only the file name (media.path).
// UPLOAD_DIR MUST be a directory that survives deployments (see README "Persistent media").
require('dotenv').config();
const multer = require('multer'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const { sanitizeSvg, embeddedBitmaps, BITMAP_WARNING } = require('./svg'), { webpName } = require('./optimize');
const APP_DIR = path.resolve(__dirname, '..'), LEGACY_DIR = path.join(APP_DIR, 'uploads');
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || LEGACY_DIR);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const rel = path.relative(APP_DIR, UPLOAD_DIR);
const insideApp = !rel.startsWith('..') && !path.isAbsolute(rel);      // true => a redeploy can erase every upload
const OK = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'video/mp4': '.mp4', 'video/webm': '.webm' };
const MB = 1024 * 1024;
// 100 MB per image/video. SVG is capped lower because the whole file is read into memory to be sanitised. Uploads themselves stream to disk (multer.diskStorage).
const LIMIT = { image: 100 * MB, video: 100 * MB, svg: 10 * MB };
const kindOf = m => (m.startsWith('video/') ? 'video' : 'image');
const exists = name => !!name && fs.existsSync(path.join(UPLOAD_DIR, path.basename(name)));
const state = { status: 'unknown', adopted: 0 };

const upload = multer({
  storage: multer.diskStorage({ destination: UPLOAD_DIR, filename: (q, f, cb) => { const n = crypto.randomBytes(12).toString('hex') + OK[f.mimetype]; q._partial = n; cb(null, n); } }),
  fileFilter: (_q, f, cb) => OK[f.mimetype] ? cb(null, true) : cb(Object.assign(new Error('Unsupported file type'), { status: 400 })),
  limits: { fileSize: Math.max(LIMIT.image, LIMIT.video) }
});

// Use this instead of upload.single('file'): if the client disconnects mid-upload, multer leaves the half-written file behind. Remove it.
const single = (req, res, next) => {
  req.on('close', () => { if (!req.complete && req._partial) setTimeout(() => unlinkQuiet(req._partial), 300); });
  upload.single('file')(req, res, next);
};

// Never trust the client-declared type: check the real bytes, per-kind size, and reject scripted SVGs.
function sniff(file) {
  const fd = fs.openSync(file.path, 'r'), b = Buffer.alloc(32); fs.readSync(fd, b, 0, 32, 0); fs.closeSync(fd);
  const h = b.toString('hex'), m = file.mimetype;
  if (m === 'image/jpeg') return h.startsWith('ffd8ff');
  if (m === 'image/png') return h.startsWith('89504e470d0a1a0a');
  if (m === 'image/gif') return b.toString('latin1', 0, 4) === 'GIF8';
  if (m === 'image/webp') return b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP';
  if (m === 'image/x-icon' || m === 'image/vnd.microsoft.icon') return h.startsWith('00000100') || h.startsWith('89504e47');
  if (m === 'video/mp4') return b.toString('latin1', 4, 8) === 'ftyp';
  if (m === 'video/webm') return h.startsWith('1a45dfa3');
  return false;
}
function validate(file) {
  const svg = file.mimetype === 'image/svg+xml', k = kindOf(file.mimetype), cap = svg ? LIMIT.svg : LIMIT[k];
  if (file.size > cap) return { status: 413, message: `${svg ? 'SVG' : k} too large (max ${cap / MB} MB)` };
  if (svg) {   // sanitise, then REWRITE the file on disk with the cleaned markup (never rasterised; rendered with <img>)
    try {
      const clean = sanitizeSvg(fs.readFileSync(file.path)); fs.writeFileSync(file.path + '.tmp', clean); fs.renameSync(file.path + '.tmp', file.path);
      file.size = Buffer.byteLength(clean); const nb = embeddedBitmaps(clean); if (nb) file.warn = BITMAP_WARNING(nb); return null;
    } catch (e) { try { fs.unlinkSync(file.path + '.tmp'); } catch {} return { status: 400, message: 'This SVG was rejected: ' + (e.status ? e.message : 'it could not be parsed') }; }
  }
  if (!sniff(file)) return { status: 400, message: 'File content does not match its type' };
  return null;
}
// Removing a file also removes its optional WebP derivative (<name>.webp beside it).
const unlinkQuiet = name => { for (const n of [name, webpName(name)]) { try { if (n) fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(n))); } catch {} } };

// If UPLOAD_DIR was moved out of the project, copy (never move/overwrite) any legacy ./uploads files across.
function adoptLegacy() {
  if (UPLOAD_DIR === LEGACY_DIR || !fs.existsSync(LEGACY_DIR)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(LEGACY_DIR)) {
    if (f.startsWith('.')) continue;
    try { fs.copyFileSync(path.join(LEGACY_DIR, f), path.join(UPLOAD_DIR, f), fs.constants.COPYFILE_EXCL); n++; } catch {}
  }
  return n;
}

// Wipe detector: a random id is stored BOTH in a marker file inside UPLOAD_DIR and in MySQL.
// If the database remembers an id but the directory no longer has the marker, the directory was erased/replaced
// (the classic "redeploy deleted my uploads" failure) and we say so loudly instead of failing silently.
async function initStorage(db) {
  state.adopted = adoptLegacy();
  const MARK = path.join(UPLOAD_DIR, '.storage-id');
  let disk = null; try { disk = fs.readFileSync(MARK, 'utf8').trim(); } catch {}
  const [[row]] = await db.query("SELECT value FROM settings WHERE `key`='system.storage_id'");
  const dbid = row && row.value;
  const set = (k, v) => db.query('INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)', [k, v]);
  const id = () => crypto.randomBytes(8).toString('hex');
  if (disk && dbid && disk === dbid) state.status = 'ok';
  else if (!disk && !dbid) { const n = id(); fs.writeFileSync(MARK, n); await set('system.storage_id', n); state.status = 'new'; }
  else if (disk && !dbid) { await set('system.storage_id', disk); state.status = 'ok'; }
  else {
    const n = id(); fs.writeFileSync(MARK, n); await set('system.storage_id', n); await set('system.storage_reset_at', new Date().toISOString());
    state.status = disk ? 'mismatch' : 'reset';
    console.error(`STORAGE ${state.status.toUpperCase()}: the upload directory no longer matches the database. Uploaded files were erased or replaced (a redeploy?). Re-upload via Admin → Media → Replace file.`);
  }
  console.log(`Uploads directory: ${insideApp ? 'INSIDE the deployed project folder (will be erased by redeploys!)' : 'outside the project folder (persistent)'}; status=${state.status}`);
  if (insideApp && process.env.NODE_ENV === 'production') console.error('WARNING: set UPLOAD_DIR to a persistent directory outside the project (see README).');
}
async function health(db) {
  const [rows] = await db.query('SELECT path FROM media'), [[rs]] = await db.query("SELECT value FROM settings WHERE `key`='system.storage_reset_at'");
  let writable = true; try { fs.accessSync(UPLOAD_DIR, fs.constants.W_OK); } catch { writable = false; }
  return { writable, insideDeployDir: insideApp, status: state.status, resetAt: (rs && rs.value) || null, adoptedLegacyFiles: state.adopted,
    filesOnDisk: fs.readdirSync(UPLOAD_DIR).filter(f => !f.startsWith('.')).length, mediaRows: rows.length, missing: rows.filter(r => !exists(r.path)).length };
}
module.exports = { upload, single, LIMIT, MB, UPLOAD_DIR, insideApp, kindOf, exists, validate, unlinkQuiet, initStorage, health };
