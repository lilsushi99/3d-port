const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const { imageSize } = require('../server/dims');
let sharp = null; try { sharp = require('sharp'); } catch {}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dims-')), put = (n, b) => { const f = path.join(tmp, n); fs.writeFileSync(f, b); return f; };
const raw = (w, h) => Buffer.alloc(w * h * 3, 120);

test('PNG and GIF headers (hand-built, no sharp needed)', () => {
  const p = Buffer.alloc(33); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(p); p.write('IHDR', 12, 'latin1'); p.writeUInt32BE(321, 16); p.writeUInt32BE(123, 20);
  assert.deepEqual(imageSize(put('a.png', p), 'image/png'), { w: 321, h: 123 });
  const g = Buffer.alloc(13); g.write('GIF89a', 0, 'latin1'); g.writeUInt16LE(77, 6); g.writeUInt16LE(55, 8);
  assert.deepEqual(imageSize(put('a.gif', g), 'image/gif'), { w: 77, h: 55 });
});
test('SVG: width/height in px, viewBox fallback, % ignored, garbage rejected', () => {
  assert.deepEqual(imageSize(put('a.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="80" viewBox="0 0 1 1"/>'), 'image/svg+xml'), { w: 120, h: 80 });
  assert.deepEqual(imageSize(put('b.svg', '<svg viewBox="0 0 400 300"/>'), 'image/svg+xml'), { w: 400, h: 300 });
  assert.deepEqual(imageSize(put('c.svg', '<svg width="100%" height="100%" viewBox="0 0 16 9"/>'), 'image/svg+xml'), { w: 16, h: 9 });
  assert.deepEqual(imageSize(put('d.svg', '<svg stroke-width="5" viewBox="0 0 10 20"/>'), 'image/svg+xml'), { w: 10, h: 20 });   // stroke-width is not width
  assert.equal(imageSize(put('e.svg', 'nope'), 'image/svg+xml'), null);
  assert.equal(imageSize(path.join(tmp, 'missing.png'), 'image/png'), null);
});
test('JPEG / WebP / PNG written by sharp, including EXIF orientation (browsers rotate, so w/h swap)', { skip: !sharp && 'sharp not installed' }, async () => {
  const base = () => sharp(raw(300, 100), { raw: { width: 300, height: 100, channels: 3 } });
  assert.deepEqual(imageSize(put('s.jpg', await base().jpeg().toBuffer()), 'image/jpeg'), { w: 300, h: 100 });
  assert.deepEqual(imageSize(put('s.png', await base().png().toBuffer()), 'image/png'), { w: 300, h: 100 });
  assert.deepEqual(imageSize(put('s.webp', await base().webp().toBuffer()), 'image/webp'), { w: 300, h: 100 });
  assert.deepEqual(imageSize(put('s2.webp', await base().webp({ lossless: true }).toBuffer()), 'image/webp'), { w: 300, h: 100 });
  assert.deepEqual(imageSize(put('rot.jpg', await base().withMetadata({ orientation: 6 }).jpeg().toBuffer()), 'image/jpeg'), { w: 100, h: 300 });
  const padded = Buffer.concat([await base().jpeg().toBuffer(), Buffer.alloc(3e6)]);   // padded files (as used for big-file tests) still parse
  assert.deepEqual(imageSize(put('pad.jpg', padded), 'image/jpeg'), { w: 300, h: 100 });
});
