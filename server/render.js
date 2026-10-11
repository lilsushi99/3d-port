// Server-side page shell: real routes (/, /about, /playground) get their own <title>, description, canonical URL and robots
// directive, the favicon, the preloader settings and the content JSON inlined (so the hero never waits on an API round-trip).
const fs = require('fs'), path = require('path');
const publicApi = require('./routes/public');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'views', 'index.html'), 'utf8');
const PRE_JS = fs.readFileSync(path.join(__dirname, 'assets', 'preloader.js'), 'utf8');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const text = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const jsonSafe = j => j.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const origin = q => (process.env.SITE_URL || `${q.protocol}://${q.get('host')}`).replace(/\/+$/, '');
const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

async function renderPage(req, res, route) {
  const { obj, json } = await publicApi.payload(), st = obj.settings, base = origin(req);
  const site = st['site.name'] || 'Portfolio', who = st['about.name'] || st['site.owner'] || site, role = st['about.role'] || '';
  const pages = {
    '/': { title: role ? `${site} — ${role}` : site, desc: cut(text(st['hero.bio_html']) || role, 160), robots: 'index,follow' },
    '/about': { title: `About — ${who}`, desc: cut(text(st['about.html']) || `About ${who}`, 160), robots: 'index,follow' },
    // The Playground has no content yet: keep it out of search results until it does (flip this when it is built).
    '/playground': { title: `Playground — ${site}`, desc: `Interface experiments and visual explorations by ${who}.`, robots: 'noindex,follow' }
  };
  const pg = pages[route], url = base + (route === '/' ? '/' : route);
  const fav = obj.settings.favicon, favHref = fav ? fav.url : '/favicon.svg';
  const favType = fav ? (MIME[path.extname(fav.url).toLowerCase()] || '') : 'image/svg+xml';
  const preOn = st['preloader.enabled'] !== '0';
  const dur = Math.min(3500, Math.max(800, parseInt(st['preloader.duration'], 10) || 2000));
  let head = `<title>${esc(pg.title)}</title><meta name="description" content="${esc(pg.desc)}"><meta name="robots" content="${pg.robots}"><link rel="canonical" href="${esc(url)}">` +
    `<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(site)}"><meta property="og:title" content="${esc(pg.title)}"><meta property="og:description" content="${esc(pg.desc)}"><meta property="og:url" content="${esc(url)}">` +
    (st.about_image ? `<meta property="og:image" content="${esc(base + st.about_image.url)}">` : '') +
    `<link rel="icon" href="${esc(favHref)}"${favType ? ` type="${favType}"` : ''}>` + (fav && /\.png$/i.test(fav.url) ? `<link rel="apple-touch-icon" href="${esc(fav.url)}">` : '') +
    `<script>document.documentElement.classList.add('loading');${preOn ? '' : "document.documentElement.classList.add('nopre');"}window.__ready=function(){var r=document.documentElement;r.classList.remove('loading');r.classList.add('ready')};setTimeout(function(){window.__ready(true)},9000)</script>` +
    `<style>html.loading #track,html.loading #work,html.loading #globe,html.loading footer,html.loading #detail{visibility:hidden}html.ready.nopre body{animation:pfade .3s ease}@keyframes pfade{from{opacity:0}}` +
    (preOn ? `#pre{position:fixed;inset:0;z-index:2147483000;background:var(--bg,#eeece7);display:flex;align-items:center;justify-content:center;transition:opacity .45s ease,visibility .45s;touch-action:none}#pre.out{opacity:0;visibility:hidden;pointer-events:none}#prec{width:100%;display:block}` : '') + `</style>`;
  const nos = route === '/about' ? `<noscript><article><h1>${esc(who)}</h1>${st['about.html'] || ''}</article></noscript>` : route === '/' ? `<noscript><h1>${esc(site)}</h1>${st['hero.bio_html'] || ''}</noscript>` : '';
  const body = `<script>window.__ROUTE=${JSON.stringify(route)};window.__CONTENT=${jsonSafe(json)};</script>` +
    (preOn ? `<div id="pre" aria-hidden="true"><canvas id="prec"></canvas></div><script>window.__PRE=${jsonSafe(JSON.stringify({ d: dur, t: String(st['preloader.text'] || '').slice(0, 40) }))};${PRE_JS}</script>` : '') + nos;
  res.set({ 'Cache-Control': 'no-cache', 'Content-Type': 'text/html; charset=utf-8' }).send(TEMPLATE.replace('<!--@HEAD-->', () => head).replace('<!--@BODY-->', () => body));
}
const page = (title, msg) => `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#eeece7;color:#15140f;text-align:center}h1{font-size:64px;margin:0}a{color:inherit}</style></head><body><div><h1>${title.split(' ')[0]}</h1><p>${msg}</p><p><a href="/">Back to the portfolio</a></p></div></body></html>`;
const notFoundHtml = () => page('404 Not Found', 'This page does not exist.');
const errorHtml = () => page('500 Error', 'Something went wrong. Please try again shortly.');
function robots(req, res) { res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${origin(req)}/sitemap.xml\n`); }
function sitemap(req, res) { const b = origin(req); res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>${b}/</loc></url>\n<url><loc>${b}/about</loc></url>\n</urlset>\n`); }
module.exports = { renderPage, notFoundHtml, errorHtml, robots, sitemap, origin };
