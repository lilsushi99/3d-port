const test = require('node:test'), assert = require('node:assert/strict');
const { sanitizeSvg, SvgError, embeddedBitmaps } = require('../server/svg');
let sharp = null; try { sharp = require('sharp'); } catch {}

const RICH = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="240" height="120" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:version="1.2">
<defs>
  <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="#ff5a36"/><stop offset="1" stop-color="#3366ff" stop-opacity="0.8"/></linearGradient>
  <radialGradient id="rg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
  <filter id="blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur in="SourceGraphic" stdDeviation="3"/></filter>
  <clipPath id="clip" clipPathUnits="userSpaceOnUse"><circle cx="60" cy="60" r="40"/></clipPath>
  <style>.card{fill:url(#grad);stroke:#222;stroke-width:2} text.t{font:700 20px sans-serif;fill:#111} .x>.y{opacity:.9}</style>
</defs>
<rect class="card" x="4" y="4" width="232" height="112" rx="12"/>
<g clip-path="url(#clip)"><rect x="20" y="20" width="80" height="80" fill="url(#rg)" filter="url(#blur)"/></g>
<text class="t" x="120" y="70" textLength="100" lengthAdjust="spacingAndGlyphs">Héllo &amp; SVG</text>
<use xlink:href="#clip" style="display:none"/>
</svg>`;

const out = svg => { try { return sanitizeSvg(svg); } catch (e) { assert.ok(e instanceof SvgError, 'only SvgError may be thrown: ' + e); return ''; } };
const NASTY = /<script|\son\w+\s*=|javascript:|vbscript:|foreignObject|@import|https?:\/\/(?!www\.w3\.org\/)|<iframe|<animate\b|<set\b|data:image\/svg/i;

test('fidelity: case-sensitive names, gradients, filters, clipPath, <style>, text survive', () => {
  const o = sanitizeSvg(RICH);
  for (const s of ['<linearGradient', 'gradientUnits="objectBoundingBox"', '<radialGradient', '<feGaussianBlur', 'stdDeviation="3"', '<clipPath', 'clipPathUnits="userSpaceOnUse"',
    'fill:url(#grad)', '.x>.y{opacity:.9}', 'textLength="100"', 'lengthAdjust="spacingAndGlyphs"', 'clip-path="url(#clip)"', 'filter="url(#blur)"', 'fill="url(#rg)"', 'Héllo &amp; SVG', 'xlink:href="#clip"', 'xmlns:xlink="http://www.w3.org/1999/xlink"'])
    assert.ok(o.includes(s), 'missing: ' + s + '\n' + o);
  assert.ok(!/inkscape/.test(o), 'foreign namespaces are dropped');
  assert.ok(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(o));
});
test('fidelity: raster comparison (librsvg) of original vs sanitised is pixel-identical', { skip: !sharp && 'sharp not installed' }, async () => {
  const px = async s => (await sharp(Buffer.from(s)).raw().toBuffer({ resolveWithObject: true }));
  const a = await px(RICH.replace(/<!DOCTYPE[^>]*>/, '').replace(/ xmlns:inkscape="[^"]*" inkscape:version="[^"]*"/, '')), b = await px(sanitizeSvg(RICH));
  assert.deepEqual([a.info.width, a.info.height], [b.info.width, b.info.height]);
  assert.ok(a.data.equals(b.data), 'rendered pixels differ');
});
test('adds xmlns when missing and viewBox from width/height when missing', () => {
  const o = sanitizeSvg('<svg width="300px" height="150"><rect width="1" height="1"/></svg>');
  assert.match(o, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/); assert.match(o, /viewBox="0 0 300 150"/);
  assert.match(sanitizeSvg('<svg viewBox="0 0 5 5" width="10" height="10"/>'), /viewBox="0 0 5 5"/);   // existing viewBox kept
  assert.ok(!/viewBox/.test(sanitizeSvg('<svg width="100%" height="100%"/>')));
});
test('keeps #fragment refs and raster data: URIs, drops everything else', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const o = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg"><image href="${png}"/><use href="#a"/><image href="data:image/svg+xml;base64,PHN2Zy8+"/><image href="data:text/html;base64,PHNjcmlwdD4="/></svg>`);
  assert.ok(o.includes(png) && o.includes('href="#a"')); assert.ok(!/svg\+xml;base64|text\/html/.test(o));
});

const MALICIOUS = {
  'onload on root': '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>',
  'ONCLICK uppercase': '<svg xmlns="http://www.w3.org/2000/svg"><rect ONCLICK="alert(1)" onMouseOver="x()"/></svg>',
  'script element': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect/></svg>',
  'script in CDATA': '<svg xmlns="http://www.w3.org/2000/svg"><script><![CDATA[alert(1)]]></script></svg>',
  'entity javascript: (decimal)': '<svg xmlns="http://www.w3.org/2000/svg"><image href="&#106;avascript:alert(1)"/></svg>',
  'entity javascript: (hex+tab)': '<svg xmlns="http://www.w3.org/2000/svg"><use href="jav&#x61;&#x09;script:alert(1)"/></svg>',
  'xlink:href javascript:': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="  JaVaScRiPt:alert(1)"/></svg>',
  'external image': '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil.test/track.png" width="1" height="1"/></svg>',
  'external use': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.test/a.svg#x"/></svg>',
  'protocol-relative image': '<svg xmlns="http://www.w3.org/2000/svg"><image href="//evil.test/x.png"/></svg>',
  'external url() in attribute': '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil.test/x.svg#a)" filter="url(//evil.test/f.svg#f)"/></svg>',
  'external url() in style attr': '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:red;background:url(http://evil.test/x.png)"/></svg>',
  'CSS @import': '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("https://evil.test/a.css"); .a{fill:red}</style><rect class="a"/></svg>',
  'CSS @import (escaped)': '<svg xmlns="http://www.w3.org/2000/svg"><style>@\\69mport "https://evil.test/a.css";</style></svg>',
  'CSS @import (in CDATA)': '<svg xmlns="http://www.w3.org/2000/svg"><style><![CDATA[@import url(//evil.test/a.css);]]></style></svg>',
  'CSS url() external + comment trick': '<svg xmlns="http://www.w3.org/2000/svg"><style>.a{fill:u/**/rl(x);background:url( "http://evil.test/p.png" )}</style></svg>',
  'CSS font-face remote': '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{font-family:x;src:url(https://evil.test/f.woff)}</style></svg>',
  'foreignObject with html+script': '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script><iframe src="https://evil.test"></iframe></div></foreignObject></svg>',
  'animate href to javascript:': '<svg xmlns="http://www.w3.org/2000/svg"><a><animate attributeName="href" values="javascript:alert(1)"/></a><set attributeName="onmouseover" to="alert(1)"/></svg>',
  'data:text/html href': '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="/></svg>',
  'data:image/svg+xml href (nested svg)': '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"/></svg>',
  'iframe/embed/object': '<svg xmlns="http://www.w3.org/2000/svg"><iframe src="javascript:alert(1)"/><embed src="x"/><object data="x"/></svg>',
  'junk before root': 'garbage<script>alert(1)</script><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'
};
for (const [name, svg] of Object.entries(MALICIOUS)) test('malicious neutralised: ' + name, () => {
  const o = out(svg);
  assert.ok(!NASTY.test(o), 'dangerous content survived:\n' + o);
  assert.ok(!/(^|[\s"'(])(\/\/)evil/.test(o) && !/evil\.test/.test(o), 'external reference survived:\n' + o);
});
test('rejected outright: entity declarations (XXE / billion laughs), non-SVG roots, empty files', () => {
  assert.throws(() => sanitizeSvg('<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg">&b;</svg>'), SvgError);
  assert.throws(() => sanitizeSvg('<html><body><script>alert(1)</script></body></html>'), SvgError);
  assert.throws(() => sanitizeSvg('<div><svg/></div>'), SvgError);
  assert.throws(() => sanitizeSvg(''), SvgError);
  assert.throws(() => sanitizeSvg('not xml at all'), SvgError);
});
test('output is idempotent (sanitising twice changes nothing)', () => { const o = sanitizeSvg(RICH); assert.equal(sanitizeSvg(o), o); });

test('viewBox-only SVG gets explicit width/height from the viewBox (no 300x150 default sizing); drawing is untouched', () => {
  const o = sanitizeSvg('<svg viewBox="0 0 400 300"><rect width="400" height="300" fill="red"/></svg>');
  assert.match(o, /width="400"/); assert.match(o, /height="300"/); assert.match(o, /viewBox="0 0 400 300"/);
  assert.match(sanitizeSvg('<svg viewBox="0 0 24 24" width="48"/>'), /width="48"/);    // an explicit width is respected
  assert.ok(!/ height=/.test(sanitizeSvg('<svg viewBox="0 0 24 24" width="48"/>')));
});
test('embedded bitmaps survive byte-for-byte and are detected (so the admin can warn that they are not vector)', () => {
  const b64 = Buffer.from('not really a png but opaque base64 payload'.repeat(20)).toString('base64');
  const o = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:image/png;base64,${b64}" width="10" height="10"/></svg>`);
  assert.ok(o.includes(b64), 'base64 payload must be unchanged'); assert.equal(embeddedBitmaps(o), 1);
  assert.equal(embeddedBitmaps(sanitizeSvg('<svg viewBox="0 0 1 1"><rect/></svg>')), 0);
});
