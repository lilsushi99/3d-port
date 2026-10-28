// SVG sanitiser. SVG is XML, so it is case-sensitive (viewBox, linearGradient, clipPath, feGaussianBlur ...):
// the parser must NOT lowercase tag or attribute names. SVGs are never rasterised; they are rendered with <img>.
const sanitizeHtml = require('sanitize-html');

class SvgError extends Error { constructor(m) { super(m); this.status = 400; } }

const TAGS = ['svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'textPath', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'clipPath', 'mask', 'marker', 'image', 'style', 'filter',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap',
  'feDistantLight', 'feDropShadow', 'feFlood', 'feFuncA', 'feFuncB', 'feFuncG', 'feFuncR', 'feGaussianBlur', 'feImage', 'feMerge',
  'feMergeNode', 'feMorphology', 'feOffset', 'fePointLight', 'feSpecularLighting', 'feSpotLight', 'feTile', 'feTurbulence',
  'animateTransform', 'animateMotion', 'mpath'];            // animate/set are dropped: they can rewrite href to javascript:
const DROP_WITH_TEXT = ['script', 'foreignObject', 'iframe', 'object', 'embed', 'audio', 'video', 'canvas', 'metadata', 'set', 'animate', 'a', 'html', 'body', 'head'];

// Browsers ignore tabs/newlines/control chars inside URLs, so normalise before judging.
const norm = v => String(v).replace(/[\u0000-\u0020\u007f-\u009f\u00ad\u200b-\u200f\u2028\u2029\ufeff]/g, '');
const DATA_OK = /^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]*$/i;
const FRAG_OK = /^#[^\s"'()<>\\]+$/;
const urlOk = u => { const n = norm(u); return FRAG_OK.test(n) || DATA_OK.test(n); };
const BAD = /javascript:|vbscript:|livescript:|expression\(|-moz-binding|behavior\s*:|@import/i;

// CSS: drop @import / @font-face / @namespace, neutralise every url() that is not a #fragment or a raster data: URI.
function cleanCss(css) {
  let s = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (m, h) => { const c = parseInt(h, 16); return c >= 0x21 && c <= 0x7e && ![0x22, 0x27, 0x5c].includes(c) ? String.fromCharCode(c) : m; });   // \69mport -> import
  s = s.replace(/@(import|namespace|charset)\b[^;{}]*;?/gi, '').replace(/@font-face\s*\{[^}]*\}/gi, '');
  s = s.replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (m, q, u) => urlOk(u) ? `url(${q}${norm(u)}${q})` : 'none');
  return s.replace(/expression\([^)]*\)|-moz-binding\s*:[^;}]*|behavior\s*:[^;}]*/gi, '').replace(/javascript:|vbscript:|livescript:/gi, '');
}

function cleanAttrs(tag, a) {
  const out = {};
  for (const [name, raw] of Object.entries(a)) {
    const value = String(raw);
    if (/^on/i.test(name)) continue;                                              // event handlers (any case)
    if (name === 'href' || name === 'xlink:href') { if (urlOk(value)) out[name] = norm(value); continue; }
    if (name === 'src') continue;
    if (name === 'xmlns') { out.xmlns = 'http://www.w3.org/2000/svg'; continue; }
    if (name === 'xmlns:xlink') { out[name] = 'http://www.w3.org/1999/xlink'; continue; }
    if (name.startsWith('xmlns:')) continue;                                      // inkscape:, sodipodi:, ev: ...
    if (name.includes(':') && !/^(xlink|xml):/.test(name)) continue;              // foreign-namespace attributes
    if (!/^[A-Za-z_][\w:.-]*$/.test(name)) continue;
    if (name === 'style') { const c = cleanCss(value).trim(); if (c) out.style = c; continue; }
    const n = norm(value);
    if (BAD.test(n) || /^data:(?!image\/(png|jpe?g|gif|webp);base64,)/i.test(n)) continue;
    if (/url\(/i.test(value)) { let ok = true; value.replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (m, q, u) => { if (!urlOk(u)) ok = false; return m; }); if (!ok) continue; }
    out[name] = value;
  }
  return out;
}
const num = v => { const m = /^\s*([0-9]*\.?[0-9]+)\s*(px|pt|pc|mm|cm|in)?\s*$/i.exec(v || ''); return m ? parseFloat(m[1]) : NaN; };

function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  const head = buf.toString('latin1', 0, 200), enc = /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.-]+)["']/i.exec(head);
  if (enc && !/^(utf-?8|us-ascii|ascii)$/i.test(enc[1])) { try { return new TextDecoder(enc[1]).decode(buf); } catch { throw new SvgError('Unsupported SVG text encoding'); } }
  return buf.toString('utf8');
}

function sanitizeSvg(input) {
  let src = Buffer.isBuffer(input) ? decode(input) : String(input);
  src = src.replace(/^\ufeff/, '');
  if (/<!ENTITY/i.test(src)) throw new SvgError('SVG files that declare XML entities are not accepted');
  let root = true;
  let out = sanitizeHtml(src, {
    allowedTags: TAGS, allowedAttributes: false, allowedSchemesAppliedToAttributes: [], nonTextTags: DROP_WITH_TEXT, allowVulnerableTags: true,
    parser: { xmlMode: true, lowerCaseTags: false, lowerCaseAttributeNames: false, decodeEntities: true },
    transformTags: {
      '*': (tagName, attribs) => {
        const a = cleanAttrs(tagName, attribs);
        if (root) {
          root = false;
          if (tagName !== 'svg') throw new SvgError('Not a valid SVG file');   // the very first element must be <svg>
          {
            a.xmlns = 'http://www.w3.org/2000/svg';
            if (!a.viewBox) { const w = num(a.width), h = num(a.height); if (w > 0 && h > 0) a.viewBox = `0 0 ${w} ${h}`; }
            // A viewBox with no width/height has no intrinsic size; some browsers (notably iOS Safari) then size/raster the <img> from a
            // 300x150 default and look soft. Give it explicit dimensions equal to the viewBox: purely metadata, the drawing is unchanged.
            if (a.viewBox && !(a.width || a.height)) { const v = a.viewBox.trim().split(/[\s,]+/).map(Number); if (v.length === 4 && v[2] > 0 && v[3] > 0) { a.width = String(v[2]); a.height = String(v[3]); } }
          }
        }
        return { tagName, attribs: a };
      }
    }
  }).trim();
  // sanitize-html hands <style> text through untouched (and skips textFilter for it), so clean it here. The parser already decoded
  // entities, so re-escape what XML requires.
  out = out.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g, (m, o, css, c) => o + cleanCss(css).replace(/&/g, '&amp;').replace(/</g, '&lt;') + c);
  if (!/^<svg[\s>]/.test(out) || !/<\/svg>$/.test(out)) throw new SvgError('Not a valid SVG file');
  const res = /^<svg\b[^>]*>/.exec(out)[0];
  if (/xlink:/.test(out) && !/xmlns:xlink=/.test(res)) return out.replace(/^<svg\b/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  return out;
}
// Embedded bitmaps (<image href="data:image/png...">) are not vector: they cannot get sharper than their own pixels.
const embeddedBitmaps = svg => (String(svg).match(/<image\b[^>]*\bhref="data:image\//gi) || []).length;
const BITMAP_WARNING = n => `This SVG embeds ${n} bitmap image${n > 1 ? 's' : ''} (PNG/JPEG data inside the file). Those parts are not true vector, so they can look soft on high-density phone screens or when zoomed. For crisp results, re-export it with shapes and text as paths and without embedded pictures.`;
module.exports = { sanitizeSvg, cleanCss, SvgError, embeddedBitmaps, BITMAP_WARNING };
