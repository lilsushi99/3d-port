require('dotenv').config();
const express = require('express'), path = require('path'), compression = require('compression'), rateLimit = require('express-rate-limit'), cookieParser = require('cookie-parser');
const db = require('./db'), storage = require('./upload'), { renderPage, notFoundHtml, errorHtml, robots, sitemap } = require('./render');
let listening = false;
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
process.on('uncaughtException', e => { console.error('uncaughtException', e); if (!listening) process.exit(1); });   // fail loudly if the app cannot even start
const app = express(), PUB = path.join(__dirname, '..', 'public'), PLUG = path.join(PUB, 'plug');
app.set('trust proxy', 1);                       // behind the host's proxy
app.disable('x-powered-by');
app.use((_q, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' }); next(); });
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

// Uploaded media: random file names => cache forever. Locked-down headers so an uploaded SVG can never run script on our origin.
app.use('/uploads', (_q, res, next) => { res.set({ 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox", 'Cross-Origin-Resource-Policy': 'same-origin' }); next(); },
  express.static(storage.UPLOAD_DIR, { maxAge: '365d', immutable: true, dotfiles: 'ignore', fallthrough: false }));

app.use('/api', rateLimit({ windowMs: 60 * 1000, max: +process.env.RATE_LIMIT_MAX || 600, standardHeaders: true, legacyHeaders: false, skip: q => q.path.startsWith('/admin') }));
app.use('/api', require('./routes/public'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api', (_q, r) => r.status(404).json({ error: 'Not found' }));

// Real, crawlable routes. Lowercase + no trailing slash are canonical.
app.use((q, r, n) => { if (/^\/(about|playground)\/?$/i.test(q.path) && (/[A-Z]/.test(q.path) || q.path.endsWith('/'))) return r.redirect(301, q.path.toLowerCase().replace(/\/$/, '')); n(); });
const send = route => (q, r, n) => renderPage(q, r, route).catch(n);
app.get('/', send('/')); app.get('/about', send('/about')); app.get('/playground', send('/playground'));
app.get('/robots.txt', robots); app.get('/sitemap.xml', sitemap);
app.get('/favicon.ico', async (_q, r, n) => { try { const f = (await require('./routes/public').payload()).obj.settings.favicon; r.redirect(302, f ? f.url : '/favicon.svg'); } catch (e) { n(e); } });

// Admin dashboard lives ONLY at /plug. (/admin intentionally does not exist and falls through to a real 404.)
app.use('/plug', (_q, res, next) => { res.set({ 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Cache-Control': 'no-store' }); next(); });
app.get(['/plug', '/plug/'], (_q, r) => r.sendFile(path.join(PLUG, 'index.html')));
app.use('/plug', express.static(PLUG, { index: false, redirect: false }));

app.use(express.static(PUB, { index: false, redirect: false, maxAge: '1h' }));
app.use((_q, r) => r.status(404).type('html').send(notFoundHtml()));
app.use((err, q, res, _n) => {
  const s = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status || err.statusCode || 500; if (s >= 500) console.error(err);
  if (q.path.startsWith('/api')) return res.status(s).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 80 MB)' : s < 500 ? err.message : 'Server error' });
  res.status(s).type('html').send(s === 404 ? notFoundHtml() : errorHtml());
});
(async () => {
  try { await storage.initStorage(db); } catch (e) { console.error('Storage check skipped (database not reachable yet):', e.message); }
  const port = process.env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => { listening = true; console.log('Portfolio running on :' + port); });
})();
