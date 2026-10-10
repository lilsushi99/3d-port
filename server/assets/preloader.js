// Binary -> letters preloader. Canvas-only, ~16 glyphs per frame (cheap on mobile). Reads window.__PRE = {d: ms, t: text}.
// Reveals only when the app calls window.__ready() (hero built, fonts ready) AND the animation has finished; if the app is ready
// early the remaining animation is fast-forwarded (<=350ms) so nobody waits on a timer. A hard cap guarantees it never sticks.
(function () {
  var P = window.__PRE, root = document.documentElement, el = document.getElementById('pre'), cv = document.getElementById('prec');
  if (!P || !el || !cv) return;
  var reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;
  var D = Math.max(800, Math.min(3500, +P.d || 2000)), text = String(P.t || '').slice(0, 40), n = text.length;
  var ctx = cv.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), H = 160, fs = 40, pos = [], total = 0, x0 = 0, ink = '#15140f', mut = '#6b6860';
  var ffAt = 0, vtFF = 0, ready = false, done = false, skip = false, t0 = performance.now(), last = t0, vt = reduce ? D : 0, HARD = 9000, raf = 0;
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var idx = [], rs = [], digit = [], dtm = [], i;
  for (i = 0; i < n; i++) { if (text[i] !== ' ') idx.push(i); digit[i] = rnd() < .5 ? '0' : '1'; dtm[i] = 0; }
  idx.forEach(function (ci, k) { rs[ci] = .24 + .58 * (k / Math.max(1, idx.length - 1)) + (rnd() - .5) * .07; });
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  function layout() {
    var w = innerWidth, cs = getComputedStyle(root);
    ink = (cs.getPropertyValue('--ink') || ink).trim() || ink; mut = (cs.getPropertyValue('--mut') || mut).trim() || mut;
    H = Math.round(clamp(w * .4, 120, 220)); cv.width = Math.round(w * dpr); cv.height = Math.round(H * dpr); cv.style.height = H + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '700 100px Outfit,system-ui,sans-serif'; var tw = ctx.measureText(text).width || 1;
    fs = Math.min(110, 100 * (w * .84) / tw); ctx.font = '700 ' + fs + 'px Outfit,system-ui,sans-serif';
    total = ctx.measureText(text).width; x0 = (w - total) / 2; pos = [];
    for (var j = 0; j < n; j++) pos[j] = { x: x0 + ctx.measureText(text.slice(0, j)).width + ctx.measureText(text[j]).width / 2 };
  }
  function draw() {
    ctx.clearRect(0, 0, innerWidth, H); ctx.font = '700 ' + fs + 'px Outfit,system-ui,sans-serif'; ctx.textAlign = 'center';
    var cy = H / 2 + fs * .34;
    for (var k = 0; k < n; k++) {
      var c = text[k]; if (c === ' ') continue;
      var p = pos[k], r = rs[k] * D, m = clamp((vt - r) / (D * .09), 0, 1), a0 = clamp(vt / (D * .15) - k * .012, 0, 1) * .55;
      if (m < 1) {
        if (vt - dtm[k] > 70 + (k % 3) * 25) { digit[k] = Math.random() < .5 ? '0' : '1'; dtm[k] = vt; }
        ctx.globalAlpha = a0 * (1 - m); ctx.fillStyle = mut; ctx.fillText(digit[k], p.x, cy);
      }
      if (m > 0) { ctx.globalAlpha = m; ctx.fillStyle = ink; ctx.save(); ctx.translate(p.x, cy); var s = .82 + .18 * m; ctx.scale(s, s); ctx.fillText(c, 0, -(1 - m) * fs * .12); ctx.restore(); }
    }
    ctx.globalAlpha = .3; ctx.fillStyle = ink; ctx.fillRect(x0, cy + fs * .32, total * clamp(vt / D, 0, 1), 2);
    if (vt >= D && !ready) { ctx.globalAlpha = .35 + .35 * Math.sin(performance.now() / 220); ctx.fillRect(x0 + total / 2 - 14, cy + fs * .5, 28, 3); }
    ctx.globalAlpha = 1;
  }
  function finish() {
    if (done) return; done = true; el.classList.add('out'); root.classList.remove('loading'); root.classList.add('ready');
    setTimeout(function () { cancelAnimationFrame(raf); if (el.parentNode) el.parentNode.removeChild(el); }, 650);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame); var dt = Math.min(60, now - last); last = now;
    if (now - t0 > HARD) { finish(); return; }
    vt += dt;
    // App ready (or visitor tapped): catch the animation up to its end in a fixed 350ms instead of waiting out the timer.
    if ((ready || skip) && vt < D) { if (!ffAt) { ffAt = now; vtFF = vt; } vt = Math.max(vt, vtFF + (D - vtFF) * clamp((now - ffAt) / 350, 0, 1)); }
    draw();
    if (vt >= D && ready) finish();
  }
  window.__ready = function (force) { if (force) { finish(); return; } ready = true; };
  el.addEventListener('pointerdown', function () { skip = true; });
  layout(); addEventListener('resize', layout);
  if (document.fonts && document.fonts.load) document.fonts.load('700 40px Outfit').then(layout, function () {});
  raf = requestAnimationFrame(frame);
})();
