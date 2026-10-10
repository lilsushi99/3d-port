// Public, read-only content API. Database -> this API -> the website. Nothing here writes.
const router = require('express').Router(), db = require('../db'), { exists } = require('../upload');
const wrap = fn => (q, r, n) => fn(q, r).catch(n);
const group = (rows, key) => rows.reduce((m, r) => ((m[r[key]] ||= []).push(r), m), {});

async function build() {
  const [media] = await db.query('SELECT id,path,kind,alt FROM media');
  // Media whose file is gone from disk is treated as "not set", so the site falls back gracefully instead of 404-ing.
  const mm = new Map(media.filter(m => exists(m.path)).map(m => [m.id, { id: m.id, url: '/uploads/' + m.path, kind: m.kind, alt: m.alt || '' }]));
  const U = id => (id && mm.get(+id)) || null;
  const [sr] = await db.query('SELECT `key`,`value` FROM settings');
  const settings = Object.fromEntries(sr.filter(r => !r.key.startsWith('system.')).map(r => [r.key, r.value]));
  const [buttons] = await db.query('SELECT slug,label,hover_text,target,color FROM laptop_buttons WHERE is_active=1 ORDER BY sort_order,id');
  const [socials] = await db.query('SELECT id,name,icon_key,url,icon_media_id FROM social_channels WHERE is_active=1 ORDER BY sort_order,id');
  const [categories] = await db.query('SELECT id,name,slug FROM categories WHERE is_active=1 ORDER BY sort_order,id');
  const [prj] = await db.query(`SELECT p.*, c.name category_name FROM projects p LEFT JOIN categories c ON c.id=p.category_id AND c.is_active=1 WHERE p.is_published=1 ORDER BY p.sort_order,p.id`);
  const [gal] = await db.query('SELECT project_id,media_id,caption FROM project_media ORDER BY sort_order,id');
  const [met] = await db.query('SELECT project_id,value,label FROM project_metrics ORDER BY sort_order,id');
  const G = group(gal, 'project_id'), M = group(met, 'project_id');
  const projects = prj.map(p => ({
    id: p.id, slug: p.slug, title: p.title, client: p.client, category: p.category_name, category_id: p.category_id, year: p.year, role: p.role,
    summary: p.summary, overview: p.overview, content: p.content, featured: !!p.is_featured,
    colors: p.accent_a && p.accent_b ? [p.accent_a, p.accent_b] : null,
    cover: U(p.cover_media_id), video: U(p.video_media_id),
    gallery: (G[p.id] || []).map(g => ({ ...U(g.media_id), caption: g.caption })).filter(g => g.url),
    metrics: (M[p.id] || []).map(m => ({ value: m.value, label: m.label }))
  }));
  const [countries] = await db.query('SELECT iso_numeric iso,name,capital,client,note,marker_lat lat,marker_lng lng FROM countries WHERE is_active=1 ORDER BY sort_order,id');
  settings.about_image = U(settings['about.image_media_id']);
  settings.screen_video = U(settings['hero.screen_video_media_id']);
  settings.nav_image = U(settings['hero.nav_image_media_id']);
  settings.favicon = U(settings['site.favicon_media_id']);
  return { settings, buttons, socials: socials.map(s => ({ ...s, icon: U(s.icon_media_id) })), categories, projects, countries, stats: { countries: countries.length } };
}
// Cache: the database is hit at most once per 30s under load, and immediately again after any admin edit.
let cache = null, at = 0, inflight = null;
async function load() {
  if (cache && Date.now() - at < 30000) return cache;
  inflight ||= build().then(obj => { cache = { obj, json: JSON.stringify(obj) }; at = Date.now(); return cache; }).finally(() => { inflight = null; });
  return inflight;
}
router.get('/content', wrap(async (_q, res) => { res.set('Cache-Control', 'no-cache').type('json').send((await load()).json); }));
router.get('/health', (_q, res) => res.json({ ok: true }));
router.get('/articles', wrap(async (_q, res) => {
  const [rows] = await db.query(`SELECT a.id,a.title,a.slug,a.excerpt,a.content,a.author,a.published_at,m.path cover,c.name category FROM articles a LEFT JOIN media m ON m.id=a.cover_media_id LEFT JOIN categories c ON c.id=a.category_id WHERE a.status='published' ORDER BY a.published_at DESC,a.id DESC`);
  res.json(rows.map(r => ({ ...r, cover: r.cover && exists(r.cover) ? '/uploads/' + r.cover : null })));
}));
router.invalidate = () => { cache = null; };
router.payload = load;
module.exports = router;
