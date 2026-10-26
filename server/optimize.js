// Optional WebP derivatives for JPEG/PNG uploads. `sharp` is an optionalDependency: if it cannot be installed or loaded
// (some shared hosts), everything below turns into a no-op and the site works exactly as before.
// The original is never touched. The derivative lives beside it as <name>.webp (no schema change) and is kept only
// if it is at least 15% smaller. Videos are deliberately NOT transcoded (see README).
const fs = require('fs'), path = require('path');
let sharp = null; try { sharp = require('sharp'); sharp.cache(false); sharp.concurrency(1); } catch { sharp = null; }
const MAX_BYTES = 30 * 1024 * 1024, MAX_PIXELS = 50e6, MIN_SAVING = 0.15;
const enabled = () => !!sharp && process.env.IMAGE_OPTIMIZE !== '0';
const webpName = name => (/\.(jpe?g|png)$/i.test(name || '') ? String(name).replace(/\.[^.]+$/, '') + '.webp' : null);

async function optimizeFile(dir, name) {
  const dst = webpName(name); if (!sharp) return { status: 'unavailable' };
  if (!dst) return { status: 'skipped', reason: 'type (only JPEG/PNG)' };
  const src = path.join(dir, path.basename(name)), out = path.join(dir, dst), tmp = out + '.tmp';
  let st; try { st = fs.statSync(src); } catch { return { status: 'skipped', reason: 'original missing' }; }
  if (st.size > MAX_BYTES) return { status: 'skipped', reason: 'over 30 MB' };
  try {
    const img = sharp(src, { limitInputPixels: MAX_PIXELS, sequentialRead: true }), meta = await img.metadata();
    if ((meta.pages || 1) > 1) return { status: 'skipped', reason: 'animated' };
    if (meta.width * meta.height > MAX_PIXELS) return { status: 'skipped', reason: 'over 50 MP' };
    const png = meta.format === 'png';
    await img.rotate().keepIccProfile().webp(png ? { lossless: true, effort: 4 } : { quality: 90, effort: 4 }).toFile(tmp);   // rotate() = auto-orient from EXIF
    const size = fs.statSync(tmp).size;
    if (size > st.size * (1 - MIN_SAVING)) { fs.unlinkSync(tmp); return { status: 'skipped', reason: 'not at least 15% smaller', original: st.size, webp: size }; }
    if (!fs.existsSync(src)) { fs.unlinkSync(tmp); return { status: 'skipped', reason: 'original deleted meanwhile' }; }   // upload deleted while we worked
    fs.renameSync(tmp, out); return { status: 'created', original: st.size, webp: size };
  } catch (e) { try { fs.unlinkSync(tmp); } catch {} return { status: 'error', reason: e.message }; }
}
// Concurrency 1: one image at a time, after the upload response has been sent.
const queue = []; let busy = false;
function enqueue(dir, name, done) {
  if (!enabled() || !webpName(name)) return;
  queue.push({ dir, name, done });
  if (busy) return; busy = true;
  setImmediate(async function next() {
    const j = queue.shift(); if (!j) { busy = false; return; }
    try { const r = await optimizeFile(j.dir, j.name); if (r.status === 'error') console.error('WebP optimise failed for', j.name, r.reason); if (r.status === 'created' && j.done) j.done(r); } catch (e) { console.error('WebP optimise', e.message); }
    setImmediate(next);
  });
}
module.exports = { enqueue, optimizeFile, webpName, enabled, available: () => !!sharp };
