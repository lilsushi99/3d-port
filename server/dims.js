// Reads an image's real pixel size from its header (no dependencies, never decodes pixels). Used so the public gallery can reserve the
// right space (width/height attributes) before an image loads. Results are cached per file+size+mtime. No database change.
const fs = require('fs');
const cache = new Map();
const num = v => { const m = /^\s*([0-9]*\.?[0-9]+)\s*(px)?\s*$/i.exec(v || ''); return m ? parseFloat(m[1]) : NaN; };
const png = b => (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null);
const gif = b => (b.length >= 10 && b.toString('latin1', 0, 3) === 'GIF' ? { w: b.readUInt16LE(6), h: b.readUInt16LE(8) } : null);
function webp(b) {
  if (b.length < 30 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return null;
  const t = b.toString('latin1', 12, 16);
  if (t === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >>> 14) & 0x3fff) }; }
  if (t === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}
function exifOrientation(b, o) {
  try {
    const le = b.toString('latin1', o, o + 2) === 'II', u16 = p => (le ? b.readUInt16LE(p) : b.readUInt16BE(p)), u32 = p => (le ? b.readUInt32LE(p) : b.readUInt32BE(p));
    const ifd = o + u32(o + 4), n = u16(ifd);
    for (let k = 0; k < n; k++) { const e = ifd + 2 + k * 12; if (u16(e) === 0x0112) return u16(e + 8); }
  } catch {}
  return 1;
}
function jpeg(b) {   // browsers apply EXIF orientation, so orientations 5-8 swap width and height
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2, orient = 1, dim = null;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (m === 0xe1 && b.toString('latin1', i + 4, i + 8) === 'Exif') orient = exifOrientation(b, i + 10);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { dim = { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }; break; }
    if (m === 0xda) break;
    i += 2 + len;
  }
  return dim && (orient >= 5 && orient <= 8 ? { w: dim.h, h: dim.w } : dim);
}
function svg(b) {   // width/height if given in px, otherwise the viewBox
  const m = /<svg\b[^>]*>/i.exec(b.toString('utf8')); if (!m) return null;
  const g = n => { const r = new RegExp('\\s' + n + '\\s*=\\s*["\']([^"\']*)["\']', 'i').exec(m[0]); return r && r[1]; };
  let w = num(g('width')), h = num(g('height')); const vb = (g('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (!(w > 0 && h > 0)) { if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) { w = vb[2]; h = vb[3]; } else return null; }
  return { w, h };
}
function imageSize(file, mime) {
  let fd;
  try {
    fd = fs.openSync(file, 'r'); const st = fs.fstatSync(fd), key = `${file}:${st.size}:${st.mtimeMs}`;
    if (cache.has(key)) return cache.get(key);
    const svgFile = mime === 'image/svg+xml', b = Buffer.alloc(Math.min(st.size, svgFile ? 65536 : 262144)); fs.readSync(fd, b, 0, b.length, 0);
    const r = svgFile ? svg(b) : png(b) || jpeg(b) || webp(b) || gif(b) || null;
    const out = r && r.w > 0 && r.h > 0 ? { w: Math.round(r.w), h: Math.round(r.h) } : null;
    if (cache.size > 2000) cache.clear(); cache.set(key, out); return out;
  } catch { return null; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}
module.exports = { imageSize };
