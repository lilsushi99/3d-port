// Protected admin API. Every route below requireAuth (httpOnly session cookie + CSRF header).
const router = require('express').Router(), fs = require('fs'), path = require('path'), sanitizeHtml = require('sanitize-html');
const db = require('../db'), { login, loginLimiter, requireAuth, cookieOpts } = require('../auth');
const { upload, exists, validate, unlinkQuiet, health: storageHealth } = require('../upload');
const wrap = fn => (q, r, n) => fn(q, r).catch(n);
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
async function uniqueSlug(table, base, exceptId = 0) {
  let s = slugify(base), n = 1;
  while ((await db.query(`SELECT id FROM ${table} WHERE slug=? AND id<>?`, [s, exceptId]))[0].length) s = slugify(base) + '-' + (++n);
  return s;
}
const clean = html => sanitizeHtml(String(html || ''), { allowedTags: ['p', 'b', 'strong', 'i', 'em', 'u', 'a', 'br', 'ul', 'ol', 'li'], allowedAttributes: { a: ['href'] }, allowedSchemes: ['http', 'https', 'mailto', 'tel'], transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener' }) } });

router.post('/login', loginLimiter, wrap(login));
router.post('/logout', (_q, r) => r.clearCookie('adm', { ...cookieOpts, maxAge: undefined }).json({ ok: true }));
router.use(requireAuth);
router.use((q, res, next) => { if (q.method !== 'GET') res.on('finish', () => require('./public').invalidate()); next(); });
router.get('/me', (q, r) => r.json({ email: q.admin.email }));

// ---- simple resources (new items are ROWS, never new tables) ----
const R = {
  buttons:    { t: 'laptop_buttons',  cols: ['slug', 'label', 'hover_text', 'target', 'color', 'sort_order', 'is_active'], req: ['slug', 'label', 'target'], bool: ['is_active'] },
  socials:    { t: 'social_channels', cols: ['name', 'icon_key', 'url', 'icon_media_id', 'sort_order', 'is_active'], req: ['name', 'url'], bool: ['is_active'] },
  categories: { t: 'categories',      cols: ['name', 'slug', 'sort_order', 'is_active'], req: ['name'], bool: ['is_active'], slug: 'name' },
  countries:  { t: 'countries',       cols: ['iso_numeric', 'name', 'capital', 'client', 'note', 'marker_lat', 'marker_lng', 'sort_order', 'is_active'], req: ['iso_numeric', 'name'], bool: ['is_active'] },
  articles:   { t: 'articles',        cols: ['title', 'slug', 'excerpt', 'content', 'cover_media_id', 'category_id', 'author', 'status', 'published_at'], req: ['title'], slug: 'title' }
};
const pick = (cfg, b) => Object.fromEntries(cfg.cols.filter(c => b[c] !== undefined).map(c => [c, cfg.bool?.includes(c) ? (b[c] ? 1 : 0) : (b[c] === '' ? null : b[c])]));
for (const [name, cfg] of Object.entries(R)) {
  router.get('/' + name, wrap(async (_q, r) => r.json((await db.query(`SELECT * FROM ${cfg.t} ORDER BY ${cfg.cols.includes('sort_order') ? 'sort_order,' : ''}id`))[0])));
  router.post('/' + name, wrap(async (q, r) => {
    const o = pick(cfg, q.body);
    for (const c of cfg.req) if (o[c] === undefined || o[c] === null || String(o[c]).trim() === '') throw bad(`${c} is required`);
    if (cfg.slug) o.slug = await uniqueSlug(cfg.t, o.slug || o[cfg.slug]);
    if (cfg.t === 'articles' && o.status === 'published' && !o.published_at) o.published_at = new Date();
    if (cfg.cols.includes('sort_order') && o.sort_order === undefined) o.sort_order = (await db.query(`SELECT COALESCE(MAX(sort_order),-1)+1 n FROM ${cfg.t}`))[0][0].n;
    const [x] = await db.query(`INSERT INTO ${cfg.t} SET ?`, [o]);
    r.json((await db.query(`SELECT * FROM ${cfg.t} WHERE id=?`, [x.insertId]))[0][0]);
  }));
  router.put('/' + name + '/reorder', wrap(async (q, r) => { for (const [i, id] of (q.body.ids || []).entries()) await db.query(`UPDATE ${cfg.t} SET sort_order=? WHERE id=?`, [i, +id]); r.json({ ok: true }); }));
  router.put('/' + name + '/:id', wrap(async (q, r) => {
    const o = pick(cfg, q.body);
    for (const c of cfg.req) if (c in o && (o[c] === null || String(o[c]).trim() === '')) throw bad(`${c} is required`);
    if (o.slug) o.slug = await uniqueSlug(cfg.t, o.slug, +q.params.id);
    if (Object.keys(o).length) await db.query(`UPDATE ${cfg.t} SET ? WHERE id=?`, [o, +q.params.id]);
    r.json((await db.query(`SELECT * FROM ${cfg.t} WHERE id=?`, [+q.params.id]))[0][0]);
  }));
  router.delete('/' + name + '/:id', wrap(async (q, r) => { await db.query(`DELETE FROM ${cfg.t} WHERE id=?`, [+q.params.id]); r.json({ ok: true }); }));
}

// ---- projects: ONLY `title` is required ----
const PCOLS = ['client', 'category_id', 'year', 'role', 'summary', 'overview', 'content', 'cover_media_id', 'video_media_id', 'accent_a', 'accent_b', 'is_featured', 'is_published', 'sort_order'];
async function attach(rows) {
  const [g] = await db.query('SELECT * FROM project_media ORDER BY sort_order,id'), [m] = await db.query('SELECT * FROM project_metrics ORDER BY sort_order,id');
  return rows.map(p => ({ ...p, gallery: g.filter(x => x.project_id === p.id), metrics: m.filter(x => x.project_id === p.id) }));
}
router.get('/projects', wrap(async (_q, r) => r.json(await attach((await db.query('SELECT * FROM projects ORDER BY sort_order,id'))[0]))));
async function saveProject(q, r, id) {
  const b = q.body;
  if (!id && !String(b.title || '').trim()) throw bad('Project title is required');
  if (id && 'title' in b && !String(b.title).trim()) throw bad('Project title is required');
  const o = {};
  if ('title' in b) o.title = String(b.title).trim();
  for (const c of PCOLS) if (b[c] !== undefined) o[c] = ['is_featured', 'is_published'].includes(c) ? (b[c] ? 1 : 0) : (b[c] === '' ? null : b[c]);
  if (typeof o.content === 'string') o.content = clean(o.content);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    if (!id) {
      o.slug = await uniqueSlug('projects', b.slug || o.title);
      if (o.sort_order === undefined) o.sort_order = (await conn.query('SELECT COALESCE(MAX(sort_order),-1)+1 n FROM projects'))[0][0].n;
      id = (await conn.query('INSERT INTO projects SET ?', [o]))[0].insertId;
    } else if (Object.keys(o).length) await conn.query('UPDATE projects SET ? WHERE id=?', [o, id]);
    if (Array.isArray(b.gallery)) { await conn.query('DELETE FROM project_media WHERE project_id=?', [id]); for (const [i, g] of b.gallery.entries()) if (g.media_id) await conn.query('INSERT INTO project_media (project_id,media_id,caption,sort_order) VALUES (?,?,?,?)', [id, g.media_id, g.caption || null, i]); }
    if (Array.isArray(b.metrics)) { await conn.query('DELETE FROM project_metrics WHERE project_id=?', [id]); for (const [i, m] of b.metrics.entries()) if (m.value && m.label) await conn.query('INSERT INTO project_metrics (project_id,value,label,sort_order) VALUES (?,?,?,?)', [id, m.value, m.label, i]); }
    await conn.commit();
  } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }
  r.json((await attach((await db.query('SELECT * FROM projects WHERE id=?', [id]))[0]))[0]);
}
router.post('/projects', wrap((q, r) => saveProject(q, r, 0)));
router.put('/projects/reorder', wrap(async (q, r) => { for (const [i, id] of (q.body.ids || []).entries()) await db.query('UPDATE projects SET sort_order=? WHERE id=?', [i, +id]); r.json({ ok: true }); }));
router.put('/projects/:id', wrap((q, r) => saveProject(q, r, +q.params.id)));
router.delete('/projects/:id', wrap(async (q, r) => { await db.query('DELETE FROM projects WHERE id=?', [+q.params.id]); r.json({ ok: true }); }));

// ---- settings (key/value) ----
const KEY = /^(site|hero|work|about|footprint|preloader)\.[a-z_]+$/;
const BOOLS = new Set(['hero.mobile_scroll', 'preloader.enabled', 'footprint.show_count']);
const MEDIA_KEYS = new Set(['site.favicon_media_id', 'hero.nav_image_media_id', 'about.image_media_id', 'hero.screen_video_media_id']);
async function normalize(k, v) {
  if (k.endsWith('_html')) return clean(v);
  if (BOOLS.has(k)) return (v === 1 || v === '1' || v === true || v === 'true' || v === 'on') ? '1' : '0';
  if (k === 'preloader.duration') { const n = parseInt(v, 10); return String(Number.isFinite(n) ? Math.min(3500, Math.max(800, n)) : 2000); }   // 0.8s .. 3.5s
  if (k === 'preloader.text') return String(v ?? '').replace(/<[^>]*>/g, '').trim().slice(0, 40);
  if (MEDIA_KEYS.has(k)) {
    const s = String(v ?? '').trim(); if (s === '') return '';
    if (!/^\d+$/.test(s)) throw bad(`${k} must be a media id`);
    const [[m]] = await db.query('SELECT kind FROM media WHERE id=?', [+s]); if (!m) throw bad('Selected media does not exist');
    if (k === 'hero.screen_video_media_id' ? m.kind !== 'video' : m.kind !== 'image') throw bad(k === 'hero.screen_video_media_id' ? 'The laptop screen needs a video' : 'This field needs an image');
    return s;
  }
  return String(v ?? '');
}
router.get('/settings', wrap(async (_q, r) => r.json(Object.fromEntries((await db.query("SELECT `key`,`value` FROM settings WHERE `key` NOT LIKE 'system.%'"))[0].map(x => [x.key, x.value])))));
router.put('/settings', wrap(async (q, r) => {
  const rows = [];
  for (const [k, v] of Object.entries(q.body || {})) { if (!KEY.test(k)) throw bad('Unknown setting ' + k); rows.push([k, await normalize(k, v)]); }   // validate everything before writing anything
  for (const [k, v] of rows) await db.query('INSERT INTO settings (`key`,`value`) VALUES (?,?) ON DUPLICATE KEY UPDATE `value`=VALUES(`value`)', [k, v]);
  r.json({ ok: true });
}));

// ---- media (files live on disk in UPLOAD_DIR; MySQL keeps only the file name) ----
router.get('/storage', wrap(async (_q, r) => r.json(await storageHealth(db))));
router.get('/media', wrap(async (_q, r) => r.json((await db.query('SELECT * FROM media ORDER BY id DESC'))[0].map(m => ({ ...m, url: '/uploads/' + m.path, missing: !exists(m.path) })))));
router.post('/media', upload.single('file'), wrap(async (q, r) => {
  if (!q.file) throw bad('No file');
  const err = validate(q.file); if (err) { unlinkQuiet(q.file.filename); throw bad(err.message, err.status); }
  const kind = q.file.mimetype.startsWith('video') ? 'video' : 'image';
  const [x] = await db.query('INSERT INTO media (path,original_name,mime,kind,size_bytes,alt) VALUES (?,?,?,?,?,?)', [q.file.filename, q.file.originalname, q.file.mimetype, kind, q.file.size, q.body.alt || null]);
  r.json({ id: x.insertId, path: q.file.filename, url: '/uploads/' + q.file.filename, kind, original_name: q.file.originalname });
}));
// Repair tool: put a file back behind an EXISTING media id, so every reference to it (settings, projects, galleries) works again.
router.post('/media/:id/replace', upload.single('file'), wrap(async (q, r) => {
  if (!q.file) throw bad('No file');
  const [[m]] = await db.query('SELECT path FROM media WHERE id=?', [+q.params.id]);
  if (!m) { unlinkQuiet(q.file.filename); throw bad('Media not found', 404); }
  const err = validate(q.file); if (err) { unlinkQuiet(q.file.filename); throw bad(err.message, err.status); }
  const kind = q.file.mimetype.startsWith('video') ? 'video' : 'image';
  await db.query('UPDATE media SET path=?,original_name=?,mime=?,kind=?,size_bytes=? WHERE id=?', [q.file.filename, q.file.originalname, q.file.mimetype, kind, q.file.size, +q.params.id]);
  unlinkQuiet(m.path);
  r.json({ ok: true, url: '/uploads/' + q.file.filename, kind });
}));
router.put('/media/:id', wrap(async (q, r) => { await db.query('UPDATE media SET alt=? WHERE id=?', [q.body.alt || null, +q.params.id]); r.json({ ok: true }); }));
router.delete('/media/:id', wrap(async (q, r) => {
  const id = +q.params.id, [[m]] = await db.query('SELECT path FROM media WHERE id=?', [id]);
  if (m) {
    for (const k of MEDIA_KEYS) await db.query('UPDATE settings SET `value`=\'\' WHERE `key`=? AND `value`=?', [k, String(id)]);   // no dangling references
    await db.query('DELETE FROM media WHERE id=?', [id]); unlinkQuiet(m.path);
  }
  r.json({ ok: true });
}));

router.get('/stats', wrap(async (_q, r) => {
  const n = async (t, w = '1') => (await db.query(`SELECT COUNT(*) n FROM ${t} WHERE ${w}`))[0][0].n;
  r.json({ projects: await n('projects'), published: await n('projects', 'is_published=1'), categories: await n('categories', 'is_active=1'), countries: await n('countries', 'is_active=1'), media: await n('media'), articles: await n('articles'), recent: (await db.query('SELECT id,title,client,is_published,updated_at FROM projects ORDER BY updated_at DESC LIMIT 5'))[0] });
}));
module.exports = router;
