(() => {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
async function api(m, p, b, form) {
  const o = { method: m, headers: { 'X-Admin': '1' }, credentials: 'same-origin' };
  if (form) o.body = form; else if (b !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(b); }
  const r = await fetch('/api/admin' + p, o), j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || 'Request failed'), { status: r.status });
  return j;
}
function toast(t, bad) { const d = document.createElement('div'); d.className = 'msg' + (bad ? ' bad' : ''); d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), Math.min(20000, Math.max(2600, t.length * 70))); }
// ---------- uploads: validate -> XHR with progress -> clear errors ----------
const MB = 1048576;
let LIM = { image: 100, video: 100, svg: 10 };                  // MB; replaced by the server's real values (GET /storage) in boot()
const EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm' };
const ALLOWED = new Set([...Object.values(EXT), 'image/vnd.microsoft.icon']);
const mimeOf = f => { const t = (f.type || '').toLowerCase(); return ALLOWED.has(t) ? t : EXT[(f.name.split('.').pop() || '').toLowerCase()] || t; };
const fmtMB = n => (n / MB).toFixed(n >= 10 * MB ? 0 : 1) + ' MB';
function checkFile(f) {                                          // runs BEFORE any byte is sent
  const t = mimeOf(f), svg = t === 'image/svg+xml', vid = t.startsWith('video/');
  if (!ALLOWED.has(t)) return `“${f.name}” is not a supported type. Use JPG, PNG, GIF, WebP, SVG, ICO, MP4 or WebM.`;
  if (!f.size) return `“${f.name}” is empty (0 bytes).`;
  const cap = svg ? LIM.svg : vid ? LIM.video : LIM.image;
  if (f.size > cap * MB) return `“${f.name}” is ${fmtMB(f.size)}, over the ${cap} MB limit for ${svg ? 'SVG files' : vid ? 'videos' : 'images'}. Compress it or pick a smaller file.`;
  return null;
}
function xhrUpload(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(), fail = (message, status = 0) => reject(Object.assign(new Error(message), { status }));
    x.open('POST', '/api/admin' + path); x.setRequestHeader('X-Admin', '1'); x.withCredentials = true; x.timeout = 0;
    x.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded, e.total);
    x.upload.onload = () => onProgress(file.size, file.size, true);
    const lost = `Upload of “${file.name}” was interrupted: the connection dropped before it finished. Check your internet connection and try again.` +
      (file.size > 20 * MB ? ' If big files always fail like this, the hosting proxy may be cutting off large or slow uploads (it can answer 413 and close the connection early).' : '');
    x.onerror = () => fail(lost); x.onabort = () => fail(lost); x.ontimeout = () => fail(lost);
    x.onload = () => {
      let j = null; try { j = JSON.parse(x.responseText); } catch {}
      if (x.status >= 200 && x.status < 300 && j) return resolve(j);
      if (x.status === 401) return fail('Not signed in', 401);
      if (!j) return fail(`The hosting server rejected the upload of “${file.name}” (HTTP ${x.status}${x.status === 413 ? ', Request Entity Too Large' : ''}) before it reached the app. PHP limits (upload_max_filesize, post_max_size) do not apply because this is a Node app, but Hostinger's web proxy in front of it can have its own request-size or time limit. Try a smaller file, or ask Hostinger support to raise it.`, x.status);
      fail(j.error || `Upload failed (HTTP ${x.status})`, x.status);
    };
    const fd = new FormData(); fd.append('file', file.slice(0, file.size, mimeOf(file)), file.name); x.send(fd);   // slice() sets the type without copying the file into memory
  });
}
async function uploadFiles(files, pathFor) {
  files = [...files]; const done = [], ui = document.createElement('div'); ui.className = 'upl'; ui.setAttribute('role', 'status');
  ui.innerHTML = '<b></b><div class="bar"><i></i></div><small></small>'; document.body.append(ui);
  const [t, bar, sm] = [$('b', ui), $('i', ui), $('small', ui)];
  try {
    for (const [i, f] of files.entries()) {
      const bad = checkFile(f); if (bad) { toast(bad, true); continue; }
      t.textContent = `Uploading ${files.length > 1 ? `${i + 1}/${files.length}: ` : ''}${f.name}`; bar.style.width = '0'; sm.textContent = '0%';
      try {
        const j = await xhrUpload(pathFor(f), f, (l, n, fin) => { const p = Math.round(l / n * 100); bar.style.width = p + '%'; sm.textContent = fin ? 'Upload complete, checking the file…' : `${p}%  (${fmtMB(l)} of ${fmtMB(n)})`; });
        if (j.warning) toast(j.warning, true);
        done.push(j);
      } catch (e) { if (e.status === 401) throw e; toast(e.message, true); }
    }
  } finally { ui.remove(); }
  return done;
}

const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { if (e.status === 401) return login(); toast(e.message, true); } };
let MEDIA = [], CATS = [], MAPN = null;
const mget = id => MEDIA.find(m => m.id == id);
const NAV = [['MAIN', [['dashboard', 'Dashboard'], ['homepage', 'Homepage'], ['about', 'About']]], ['CONTENT', [['work', 'Selected Work'], ['articles', 'Articles'], ['footprint', 'Global Footprint'], ['media', 'Media']]], ['SETTINGS', [['preloader', 'Preloader'], ['settings', 'Settings']]]];
const TITLES = { dashboard: 'Dashboard', homepage: 'Homepage', about: 'About', work: 'Selected Work', articles: 'Articles', footprint: 'Global Footprint', media: 'Media', settings: 'Settings', preloader: 'Preloader' };

function login(msg) {
  $('#app').innerHTML = `<div class="login"><form class="card" id="lf"><h2>Portfolio admin</h2><p>${esc(msg || 'Sign in to manage your content.')}</p><div class="row"><label>Email<input name="email" type="email" required autofocus></label></div><div class="row"><label>Password<input name="password" type="password" required></label></div><button class="btn pri" style="width:100%">Sign in</button></form></div>`;
  $('#lf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { await api('POST', '/login', f); boot(); } catch (er) { login(er.message); } };
}
async function boot() {
  try { await api('GET', '/me'); } catch { return login(); }
  let st; [MEDIA, CATS, st] = await Promise.all([api('GET', '/media'), api('GET', '/categories'), api('GET', '/storage').catch(() => null)]);
  if (st && st.limits) LIM = { image: st.limits.imageMB, video: st.limits.videoMB, svg: st.limits.svgMB };
  const v = (location.hash.slice(1)) || 'dashboard';
  $('#app').innerHTML = `<div class="shell"><aside><div class="brand"><i>◐</i>Portfolio CMS</div>${NAV.map(([g, it]) => `<small>${g}</small>` + it.map(([k, l]) => `<a data-v="${k}" class="${k === v ? 'on' : ''}" href="#${k}">${l}</a>`).join('')).join('')}<div class="sp"></div><div class="side-bot"><a href="/" target="_blank">View site ↗</a><a id="th">Dark mode</a><a id="lo">Sign out</a></div></aside><main><div class="top"><h1>${TITLES[v] || ''}</h1></div><div id="v"></div></main></div>`;
  $('#th').onclick = () => { document.documentElement.dataset.t = document.documentElement.dataset.t === 'dark' ? '' : 'dark'; };
  $('#lo').onclick = async () => { await api('POST', '/logout', {}); login('Signed out.'); };
  await guard(VIEWS[v] || VIEWS.dashboard)($('#v'));
}
window.addEventListener('hashchange', () => { if ($('.shell')) boot(); });

// ---------- shared form helpers ----------
const F = (l, k, v, t = 'text', a = '') => `<label>${l}<input data-s="${k}" type="${t}" value="${esc(v)}" ${a}></label>`;
const TA = (l, k, v) => `<label>${l}<textarea data-s="${k}">${esc(v)}</textarea></label>`;
const RTE = (l, k, v) => `<div class="fld"><span class="lbl" id="l-${k}">${l}</span><div class="tb" role="toolbar" aria-label="Formatting"><button type="button" class="btn sm" data-c="bold"><b>B</b></button><button type="button" class="btn sm" data-c="italic"><i>I</i></button><button type="button" class="btn sm" data-c="underline"><u>U</u></button><button type="button" class="btn sm" data-c="createLink">Link</button><button type="button" class="btn sm" data-c="removeFormat">Clear</button></div><div class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-labelledby="l-${k}" tabindex="0" data-rte="${k}">${v || ''}</div></div>`;
const PICK = (l, k, id, kind = 'image') => { const m = mget(id); return `<div class="fld"><span class="lbl">${l}</span><div class="pick" data-pick="${k}" data-kind="${kind}" data-id="${id || ''}">${m ? (m.missing ? '<span class="tag">file missing</span>' : m.kind === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`) : '<span class="tag">none</span>'}<button type="button" class="btn sm" data-a="choose">Choose</button><button type="button" class="btn sm" data-a="clear">Remove</button></div></div>`; };
function bindForm(root) {
  // Toolbar buttons must never take focus or the selection away from the editor.
  $$('.tb button', root).forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));
  $$('[data-c]', root).forEach(b => b.onclick = () => {
    const c = b.dataset.c, ed = b.closest('.fld').querySelector('.rte'); ed.focus();
    if (c === 'createLink') { const sel = getSelection(), saved = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null, u = prompt('Link URL (https://…)'); ed.focus(); if (saved) { sel.removeAllRanges(); sel.addRange(saved); } if (u) document.execCommand(c, false, u); }
    else document.execCommand(c);
  });
  $$('[data-pics]', root).forEach(el => {
    drawPics(el);
    el.onclick = guard(async e => {
      const a = e.target.dataset.a; if (!a) return;
      const ids = (el.dataset.ids || '').split(',').filter(Boolean), f = e.target.closest('figure'), i = f ? ids.indexOf(f.dataset.id) : -1;
      if (a === 'px' && i >= 0) ids.splice(i, 1);
      if (a === 'pl' && i > 0) [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
      if (a === 'pr' && i >= 0 && i < ids.length - 1) [ids[i + 1], ids[i]] = [ids[i], ids[i + 1]];
      if (a === 'padd') { const xs = await pickMedia('image', { multi: true, max: PICS_MAX - ids.length }); if (!xs) return; for (const x of xs) if (!ids.includes(String(x.id)) && ids.length < PICS_MAX) ids.push(String(x.id)); }
      el.dataset.ids = ids.join(','); drawPics(el);
    });
  });
  $$('[data-pick]', root).forEach(p => p.onclick = guard(async e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'clear') p.dataset.id = ''; else { const m = await pickMedia(p.dataset.kind); if (!m) return; p.dataset.id = m.id; }
    const m = mget(p.dataset.id); $$('img,video,.tag', p).forEach(x => x.remove());
    p.insertAdjacentHTML('afterbegin', m ? (m.kind === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`) : '<span class="tag">none</span>');
  }));
}
const collect = root => { const o = {}; $$('[data-s]', root).forEach(i => o[i.dataset.s] = i.type === 'checkbox' ? (i.checked ? 1 : 0) : i.value); $$('[data-rte]', root).forEach(i => o[i.dataset.rte] = i.innerHTML); $$('[data-pick]', root).forEach(i => o[i.dataset.pick] = i.dataset.id); $$('[data-pics]', root).forEach(i => o[i.dataset.pics] = i.dataset.ids); return o; };
const saveSettings = guard(async root => { await api('PUT', '/settings', collect(root)); toast('Saved'); });

async function pickMedia(kind, opt = {}) {
  // Single mode (default): click one item, get it back. Multi mode ({multi:true,max}): click to select several (or upload several at once), then "Add".
  const multi = !!opt.multi, max = opt.max || 99, sel = [];
  MEDIA = await api('GET', '/media');
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal';
    const lab = () => `Add ${sel.length ? sel.length + ' ' : ''}selected`;
    const draw = () => m.innerHTML = `<div><div class="top"><h2>${multi ? 'Choose media — select several' : 'Choose media'}</h2><span><input type="file" id="up" multiple accept="image/*,video/mp4,video/webm" style="display:none"><button class="btn" id="upb">Upload new (several allowed)</button> ${multi ? `<button class="btn pri" id="addsel"${sel.length ? '' : ' disabled'}>${lab()}</button> ` : ''}<button class="btn" id="cx">Cancel</button></span></div>${multi ? `<p class="limit">Click items to select them (up to ${max}), or upload several files at once; uploads are selected automatically.</p>` : ''}<div class="grid">${MEDIA.filter(x => !x.missing && (kind === 'any' || x.kind === kind)).map(x => `<figure data-id="${x.id}"${sel.includes(String(x.id)) ? ' class="sel"' : ''}>${x.kind === 'video' ? `<video src="${x.url}" muted></video>` : `<img src="${x.url}" alt="">`}<figcaption>${esc(x.original_name)}</figcaption></figure>`).join('') || '<p>No media yet. Upload some.</p>'}</div></div>`;
    draw(); document.body.append(m);
    const done = v => { m.remove(); res(v); };
    m.onclick = guard(async e => {
      if (e.target === m || e.target.id === 'cx') return done(null);
      if (e.target.id === 'upb') return $('#up', m).click();
      if (e.target.id === 'addsel') return done(sel.map(mget).filter(Boolean));
      const f = e.target.closest('figure'); if (!f) return;
      if (!multi) return done(mget(f.dataset.id));
      const id = f.dataset.id, k = sel.indexOf(id);
      if (k >= 0) sel.splice(k, 1); else if (sel.length >= max) return toast(`You can select at most ${max} here`, true); else sel.push(id);
      f.classList.toggle('sel', k < 0); const b = $('#addsel', m); b.disabled = !sel.length; b.textContent = lab();
    });
    m.addEventListener('change', guard(async e => {
      if (e.target.id !== 'up') return;
      const r = await uploadFiles(e.target.files, () => '/media'); e.target.value = ''; if (!r.length) return;
      MEDIA = await api('GET', '/media');
      if (multi) for (const x of r) { if (sel.length >= max) { toast(`Only the first ${max} were selected`, true); break; } sel.push(String(x.id)); }
      draw();
    }));
  });
}

// ---------- profile pictures (up to 10, in display order) ----------
const PICS_MAX = 10;
const PICS = (l, k, ids) => `<div class="fld"><span class="lbl">${l}</span><div class="pics" data-pics="${k}" data-ids="${esc(ids || '')}"></div></div>`;
function drawPics(el) {
  const ids = (el.dataset.ids || '').split(',').filter(id => id && mget(id)); el.dataset.ids = ids.join(',');
  el.innerHTML = `<div class="grid">${ids.map((id, i) => `<figure data-id="${id}" style="cursor:default"><img src="${mget(id).url}" alt=""><figcaption><button type="button" class="btn sm" data-a="pl" aria-label="Move earlier"${i ? '' : ' disabled'}>←</button><button type="button" class="btn sm" data-a="pr" aria-label="Move later"${i < ids.length - 1 ? '' : ' disabled'}>→</button><button type="button" class="btn sm dng" data-a="px">Remove</button></figcaption></figure>`).join('') || '<p class="limit">No pictures yet: the default avatar is shown.</p>'}</div><p class="limit">${ids.length}/${PICS_MAX} pictures. With two or more they rotate about every 10 seconds on the About page (hover on desktop, tap on touch, switches to the next one).</p><button type="button" class="btn sm" data-a="padd"${ids.length >= PICS_MAX ? ' disabled' : ''}>Add pictures (select or upload several)</button>`;
}

// ---------- generic inline list editor (rows, not tables, for every new item) ----------
function editor(res, cols, rows, blank) {
  const cell = (c, r) => { const v = r[c.k] ?? ''; return c.t === 'check' ? `<input type="checkbox" data-k="${c.k}" ${v ? 'checked' : ''}>` : c.t === 'sel' ? `<select data-k="${c.k}">${c.o.map(o => `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select>` : `<input data-k="${c.k}" value="${esc(v)}" ${c.ro && r.id ? 'readonly' : ''} ${c.w ? `style="min-width:${c.w}px"` : ''}>`; };
  const row = (r, isNew) => `<tr data-id="${r.id || ''}">${cols.map(c => `<td>${cell(c, r)}</td>`).join('')}<td class="acts">${isNew ? '<button class="btn sm pri" data-a="add">Add</button>' : '<button class="btn sm" data-a="up">↑</button><button class="btn sm" data-a="down">↓</button><button class="btn sm pri" data-a="save">Save</button><button class="btn sm dng" data-a="del">Delete</button>'}</td></tr>`;
  return `<div style="overflow:auto"><table data-res="${res}"><thead><tr>${cols.map(c => `<th>${c.l}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r => row(r)).join('')}${row(blank, true)}</tbody></table></div>`;
}
function bindEditor(root, reload) {
  $$('table[data-res]', root).forEach(t => t.addEventListener('click', guard(async e => {
    const a = e.target.dataset.a; if (!a) return; const tr = e.target.closest('tr'), res = t.dataset.res;
    const val = () => Object.fromEntries($$('[data-k]', tr).map(i => [i.dataset.k, i.type === 'checkbox' ? (i.checked ? 1 : 0) : i.value]));
    if (a === 'add') { await api('POST', '/' + res, val()); toast('Added'); return reload(); }
    if (a === 'save') { await api('PUT', `/${res}/${tr.dataset.id}`, val()); return toast('Saved'); }
    if (a === 'del') { if (!confirm('Delete this item?')) return; await api('DELETE', `/${res}/${tr.dataset.id}`); return reload(); }
    const sib = a === 'up' ? tr.previousElementSibling : tr.nextElementSibling; if (!sib || !sib.dataset.id) return;
    a === 'up' ? tr.after(sib) : sib.after(tr);
    await api('PUT', `/${res}/reorder`, { ids: $$('tbody tr[data-id]', t).map(r => r.dataset.id).filter(Boolean) }); toast('Order saved');
  })));
}
const card = (h, p, body) => `<div class="card"><h2>${h}</h2><p>${p || ''}</p>${body}</div>`;
const mount = (root, html, extra) => { root.innerHTML = html; bindForm(root); bindEditor(root, () => boot()); extra && extra(); };
const saveBtn = '<button class="btn pri" data-a="savesettings">Save changes</button>';
const onSave = root => $$('[data-a=savesettings]', root).forEach(b => b.onclick = () => saveSettings(b.closest('.card')));

// ---------- views ----------
const VIEWS = {
  async dashboard(root) {
    const [s, h] = await Promise.all([api('GET', '/stats'), api('GET', '/storage')]);
    root.innerHTML = (h.missing || h.insideDeployDir ? card('Storage needs attention', '', `<p>${h.insideDeployDir ? 'Uploads are stored inside the deployed project folder and can be erased by a redeploy. ' : ''}${h.missing ? h.missing + ' uploaded file(s) are missing from disk. ' : ''}Open <a href="#media">Media</a> for details.</p>`) : '') + `<div class="cards">${[['Projects', s.projects], ['Published', s.published], ['Categories', s.categories], ['Countries', s.countries], ['Media files', s.media]].map(([l, n]) => `<div class="card stat"><small>${l}</small><b>${n}</b></div>`).join('')}</div>` + card('Recently edited projects', 'Latest changes across Selected Work.', `<table><thead><tr><th>Title</th><th>Client</th><th>Status</th></tr></thead><tbody>${s.recent.map(r => `<tr><td>${esc(r.title)}</td><td>${esc(r.client)}</td><td><span class="tag ${r.is_published ? 'ok' : ''}">${r.is_published ? 'Published' : 'Draft'}</span></td></tr>`).join('')}</tbody></table>`);
  },
  async homepage(root) {
    const [s, btn, soc] = await Promise.all([api('GET', '/settings'), api('GET', '/buttons'), api('GET', '/socials')]);
    mount(root,
      card('Hero & Bio', 'Text shown beside the 3D laptop on desktop.', RTE('Homepage bio', 'hero.bio_html', s['hero.bio_html']) + `<div class="row c2" style="margin-top:12px">${F('Contact line', 'hero.reach_text', s['hero.reach_text'])}${F('Top-right button text', 'hero.cta_label', s['hero.cta_label'])}</div><div class="row c2">${F('Closing statement — bold lead (mobile & tablet only)', 'hero.closing_lead', s['hero.closing_lead'])}${F('Closing statement — faded continuation', 'hero.closing_rest', s['hero.closing_rest'])}</div><div class="row c2">${F('Top-right button destination', 'hero.cta_target', s['hero.cta_target'])}${F('Mouse click destination', 'hero.mouse_target', s['hero.mouse_target'])}</div><div class="row">${PICK('Laptop screen video (mp4/webm)', 'hero.screen_video_media_id', s['hero.screen_video_media_id'], 'video')}</div><div class="row c2">${PICK('Navigation image (optional circle beside “See my work”; leave empty for nothing)', 'hero.nav_image_media_id', s['hero.nav_image_media_id'])}<label>Mobile scrolling<span style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-s="hero.mobile_scroll" ${s['hero.mobile_scroll'] !== '0' ? 'checked' : ''}> Enabled — phones only. Off = the hero is a fixed entry screen and visitors use the buttons.</span></label></div>${saveBtn}`) +
      card('Laptop buttons', 'The first three active buttons appear on the laptop. Destinations: #/about, #work, #globe, #/playground or a full URL.', editor('buttons', [{ k: 'slug', l: 'ID', ro: 1, w: 80 }, { k: 'label', l: 'Label', w: 100 }, { k: 'hover_text', l: 'Hover text', w: 150 }, { k: 'target', l: 'Destination', w: 120 }, { k: 'color', l: 'Colour', t: 'sel', o: ['cyan', 'mustard', 'red'] }, { k: 'is_active', l: 'Active', t: 'check' }], btn, { slug: '', label: '', hover_text: '', target: '', color: 'cyan', is_active: 1 })) +
      card('Social & contact channels', 'Shown as glass icons under the bio.', editor('socials', [{ k: 'name', l: 'Name' }, { k: 'icon_key', l: 'Icon', t: 'sel', o: ['linkedin', 'x', 'whatsapp', 'email', 'facebook', 'instagram', 'link'] }, { k: 'url', l: 'URL', w: 260 }, { k: 'is_active', l: 'Active', t: 'check' }], soc, { name: '', icon_key: 'link', url: '', is_active: 1 })), () => onSave(root));
  },
  async about(root) {
    const s = await api('GET', '/settings');
    mount(root, card('About page', 'Used by the Read About Me page. Independent of the homepage bio.', `<div class="row c2">${F('Name', 'about.name', s['about.name'])}${F('Role line', 'about.role', s['about.role'])}</div><div class="row">${PICS('Profile pictures', 'about.image_media_ids', s['about.image_media_ids'] || s['about.image_media_id'])}</div>${RTE('About text', 'about.html', s['about.html'])}<p></p>${saveBtn}`), () => onSave(root));
  },
  async work(root) {
    const [s, cats, prj] = await Promise.all([api('GET', '/settings'), api('GET', '/categories'), api('GET', '/projects')]);
    mount(root, card('Section text', '', `<div class="row c2">${F('Section title', 'work.title', s['work.title'])}${F('“All” tab label', 'work.all_label', s['work.all_label'])}</div>${saveBtn}`) +
      card('Categories', 'New categories appear in Selected Work automatically.', editor('categories', [{ k: 'name', l: 'Name' }, { k: 'is_active', l: 'Active', t: 'check' }], cats, { name: '', is_active: 1 })) +
      card('Projects', 'Only the title is required.', `<p><button class="btn pri" id="np">New project</button></p><table><thead><tr><th>Title</th><th>Category</th><th>Year</th><th>Status</th><th></th></tr></thead><tbody id="pt">${prj.map(p => `<tr data-id="${p.id}"><td>${esc(p.title)}</td><td>${esc((cats.find(c => c.id == p.category_id) || {}).name)}</td><td>${esc(p.year)}</td><td><span class="tag ${p.is_published ? 'ok' : ''}">${p.is_published ? 'Published' : 'Draft'}</span></td><td class="acts"><button class="btn sm" data-a="up">↑</button><button class="btn sm" data-a="down">↓</button><button class="btn sm pri" data-a="edit">Edit</button><button class="btn sm dng" data-a="del">Delete</button></td></tr>`).join('')}</tbody></table>`),
      () => {
        onSave(root); $('#np').onclick = () => projectForm({ is_published: 1, gallery: [], metrics: [] }, cats);
        $('#pt').onclick = guard(async e => { const a = e.target.dataset.a; if (!a) return; const tr = e.target.closest('tr'), id = tr.dataset.id;
          if (a === 'edit') return projectForm(prj.find(p => p.id == id), cats);
          if (a === 'del') { if (confirm('Delete this project?')) { await api('DELETE', '/projects/' + id); boot(); } return; }
          const sib = a === 'up' ? tr.previousElementSibling : tr.nextElementSibling; if (!sib) return; a === 'up' ? tr.after(sib) : sib.after(tr);
          await api('PUT', '/projects/reorder', { ids: $$('#pt tr').map(r => r.dataset.id) }); toast('Order saved'); });
      });
  },
  async articles(root) {
    const a = await api('GET', '/articles');
    mount(root, card('Articles', 'Stored and ready for the future article experience (the public article layout comes later).', `<p><button class="btn pri" id="na">New article</button></p><table><thead><tr><th>Title</th><th>Status</th><th></th></tr></thead><tbody>${a.map(x => `<tr data-id="${x.id}"><td>${esc(x.title)}</td><td><span class="tag ${x.status === 'published' ? 'ok' : ''}">${x.status}</span></td><td class="acts"><button class="btn sm pri" data-a="edit">Edit</button><button class="btn sm dng" data-a="del">Delete</button></td></tr>`).join('')}</tbody></table>`), () => {
      $('#na').onclick = () => articleForm({ status: 'draft' });
      $('tbody', root).onclick = guard(async e => { const t = e.target.dataset.a, id = e.target.closest('tr')?.dataset.id; if (t === 'edit') articleForm(a.find(x => x.id == id)); if (t === 'del' && confirm('Delete this article?')) { await api('DELETE', '/articles/' + id); boot(); } });
    });
  },
  async footprint(root) {
    const [s, list] = await Promise.all([api('GET', '/settings'), api('GET', '/countries')]);
    MAPN ||= (await (await fetch('/map-data.json')).json()).p;
    const opts = Object.entries(MAPN).sort((a, b) => a[1][0].localeCompare(b[1][0]));
    const ed = editor('countries', [{ k: 'iso_numeric', l: 'Country', ro: 1, w: 60 }, { k: 'name', l: 'Name', w: 130 }, { k: 'capital', l: 'Capital', w: 120 }, { k: 'client', l: 'Client / company', w: 150 }, { k: 'note', l: 'Note', w: 130 }, { k: 'marker_lat', l: 'Lat', w: 70 }, { k: 'marker_lng', l: 'Lng', w: 70 }, { k: 'is_active', l: 'Active', t: 'check' }], list, { iso_numeric: '', name: '', capital: '', client: '', note: '', marker_lat: '', marker_lng: '', is_active: 1 });
    mount(root, card('Section text', `${list.filter(c => c.is_active).length} active countries. The count is calculated from the rows below, never typed in.`, `<div class="row c2">${F('Title', 'footprint.title', s['footprint.title'])}${F('Contact label', 'footprint.contact_label', s['footprint.contact_label'])}</div><div class="row">${TA('Supporting text', 'footprint.text', s['footprint.text'])}</div><div class="row"><label><span>Show “N countries” under the text</span><input type="checkbox" data-s="footprint.show_count" ${s['footprint.show_count'] === '1' ? 'checked' : ''}></label></div>${saveBtn}`) +
      card('Countries', 'Pick a country in the last row, then click Add. Lat/Lng are optional marker overrides.', `<datalist id="isos">${opts.map(([id, v]) => `<option value="${id}">${esc(v[0])}</option>`).join('')}</datalist>` + ed), () => {
        $$('table[data-res=countries] tbody tr:last-child [data-k=iso_numeric]', root).forEach(i => { i.setAttribute('list', 'isos'); i.placeholder = 'ISO #'; i.addEventListener('change', () => { const v = MAPN[i.value], tr = i.closest('tr'); if (v) { $('[data-k=name]', tr).value = v[0]; $('[data-k=capital]', tr).value = v[1]; } }); });
        $$('[data-a=savesettings]', root).forEach(b => b.onclick = guard(async () => { const o = collect(b.closest('.card')); o['footprint.show_count'] = o['footprint.show_count'] ? '1' : '0'; await api('PUT', '/settings', o); toast('Saved'); }));
      });
  },
  async media(root) {
    [MEDIA] = await Promise.all([api('GET', '/media')]); const h = await api('GET', '/storage');
    const warn = [h.insideDeployDir && 'Uploads are saved inside the deployed project folder, so a redeploy can erase them. Set the UPLOAD_DIR environment variable to a persistent folder outside the project and redeploy.', !h.writable && 'The upload folder is not writable by the server.', h.missing && `${h.missing} file(s) are missing from disk${h.resetAt ? ' (storage was reset ' + new Date(h.resetAt).toLocaleString() + ')' : ''}. The site falls back gracefully; open each flagged item and use “Replace file” to restore it.`].filter(Boolean);
    mount(root, card('Storage health', 'Files live on the server disk; MySQL stores only their names.', `<div class="cards"><div class="card stat"><small>Files on disk</small><b>${h.filesOnDisk}</b></div><div class="card stat"><small>Media records</small><b>${h.mediaRows}</b></div><div class="card stat"><small>Missing files</small><b>${h.missing}</b></div><div class="card stat"><small>Location</small><b style="font-size:16px">${h.insideDeployDir ? 'Inside project ⚠' : 'Persistent ✓'}</b></div></div>${warn.map(w => `<p><span class="tag" style="background:#fde8e6;color:#b3261e">Attention</span> ${esc(w)}</p>`).join('') || '<p><span class="tag ok">Healthy</span></p>'}`) +
      card('Media library', 'Click an item to edit alt text, replace the file, or delete it.', `<p class="limit"><b>Upload limit: ${LIM.image} MB per image or video</b> (SVG: ${LIM.svg} MB, because SVGs are cleaned in memory). Accepted: JPG, PNG, GIF, WebP, SVG, ICO, MP4, WebM. This is a Node app, so PHP limits (upload_max_filesize, post_max_size) do not apply, but Hostinger's proxy in front of it may have its own limit; if it rejects a file you will see “hosting rejected the upload”.${h.optimizer && h.optimizer.enabled ? ' JPEG/PNG uploads also get a smaller WebP copy made automatically in the background (the original is kept).' : ''}</p><p><input type="file" id="mu" accept="image/*,video/mp4,video/webm" multiple></p><div class="grid">${MEDIA.map(m => `<figure data-id="${m.id}">${m.missing ? '<div style="height:110px;display:grid;place-items:center;color:#b3261e;font-size:13px">file missing</div>' : m.kind === 'video' ? `<video src="${m.url}" muted preload="metadata"></video>` : `<img src="${m.url}" alt="" loading="lazy">`}<figcaption title="${m.faststart === false ? 'MP4 is not fast-start: see the file details' : ''}">${m.faststart === false ? '⚠ ' : ''}${esc(m.original_name)}</figcaption></figure>`).join('')}</div>`), () => {
      $('#mu').onchange = guard(async e => { const inp = e.target, r = await uploadFiles(inp.files, () => '/media'); inp.value = ''; if (r.length) toast(`Uploaded ${r.length} file${r.length > 1 ? 's' : ''}`); boot(); });
      $('.grid', root).onclick = e => { const f = e.target.closest('figure'); if (f) mediaModal(mget(f.dataset.id)); };
    });
  },
  async preloader(root) {
    const s = await api('GET', '/settings'), d = Math.min(3500, Math.max(800, parseInt(s['preloader.duration'], 10) || 2000));
    mount(root, card('Preloader', 'Binary digits morph into letters and assemble your name while the hero loads. The duration only sets the animation speed: the site is revealed as soon as it is ready, never held back by a timer.', `<div class="row"><label><span>Show the preloader</span><input type="checkbox" data-s="preloader.enabled" ${s['preloader.enabled'] !== '0' ? 'checked' : ''}></label></div><div class="row"><label>Animation duration: <b id="pd">${d} ms</b><input type="range" min="800" max="3500" step="100" data-s="preloader.duration" value="${d}"></label></div><div class="row">${F('Text that is assembled', 'preloader.text', s['preloader.text'])}</div>${saveBtn}`), () => { onSave(root); const r = $('[data-s="preloader.duration"]', root); r.oninput = () => { $('#pd', root).textContent = r.value + ' ms'; }; });
  },
  async settings(root) {
    const s = await api('GET', '/settings');
    mount(root, card('Site settings', 'Global content used across the whole portfolio.', `<div class="row c2">${F('Site name', 'site.name', s['site.name'])}${F('Owner name', 'site.owner', s['site.owner'])}</div><div class="row c2">${F('Copyright text', 'site.copyright', s['site.copyright'])}${F('Contact email', 'site.contact_email', s['site.contact_email'])}</div><div class="row">${PICK('Favicon (PNG, SVG or ICO, square, at least 64×64). Leave empty to use the default icon.', 'site.favicon_media_id', s['site.favicon_media_id'])}</div><div class="row">${F('Footer “made by” line', 'site.made_by', s['site.made_by'])}</div><div class="row"><label>Default theme<select data-s="site.default_theme">${['system', 'light', 'dark'].map(o => `<option ${s['site.default_theme'] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>${saveBtn}`), () => onSave(root));
  }
};

// ---------- modals: projects & articles ----------
function modal(html) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div>${html}</div>`; document.body.append(m); bindForm(m); m.onclick = e => { if (e.target === m || e.target.dataset.a === 'close') m.remove(); }; return m; }
const catSel = (cats, v) => `<label>Category<select data-s="category_id"><option value="">—</option>${cats.map(c => `<option value="${c.id}" ${c.id == v ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>`;
function projectForm(p, cats) {
  const m = modal(`<div class="top"><h2>${p.id ? 'Edit' : 'New'} project</h2><button class="btn" data-a="close">Close</button></div>
  <div class="card"><div class="row"><label>Title (required)<input data-s="title" value="${esc(p.title)}"></label></div>
  <div class="row c4">${F('Client', 'client', p.client)}${catSel(cats, p.category_id)}${F('Year', 'year', p.year)}${F('Role', 'role', p.role)}</div>
  <div class="row">${F('Short summary (card hover)', 'summary', p.summary)}${TA('Overview', 'overview', p.overview)}${RTE('Additional content', 'content', p.content)}</div>
  <div class="row c2">${PICK('Cover image', 'cover_media_id', p.cover_media_id)}${PICK('Project video', 'video_media_id', p.video_media_id, 'video')}</div>
  <div class="row c4">${F('Fallback colour A', 'accent_a', p.accent_a, 'text', 'placeholder="#1fb58f"')}${F('Fallback colour B', 'accent_b', p.accent_b, 'text', 'placeholder="#0b6e57"')}<label>Featured<input type="checkbox" data-s="is_featured" ${p.is_featured ? 'checked' : ''}></label><label>Published<input type="checkbox" data-s="is_published" ${p.is_published ? 'checked' : ''}></label></div></div>
  <div class="card"><h2>Metrics</h2><div id="mt">${(p.metrics || []).map(x => `<div class="row c3" data-m><input placeholder="Value" value="${esc(x.value)}"><input placeholder="Label" value="${esc(x.label)}"><button class="btn sm dng" data-a="rm">Remove</button></div>`).join('')}</div><button class="btn sm" data-a="addm">Add metric</button></div>
  <div class="card"><h2>Gallery</h2><div class="grid" id="gl">${(p.gallery || []).map(g => gItem(g.media_id, g.caption)).join('')}</div><p></p><button class="btn sm" data-a="addg">Add media (select or upload several)</button></div>
  <button class="btn pri" data-a="save">Save project</button>`);
  m.addEventListener('click', guard(async e => {
    const a = e.target.dataset.a;
    if (a === 'rm') e.target.closest('[data-m]').remove();
    if (a === 'addm') $('#mt', m).insertAdjacentHTML('beforeend', `<div class="row c3" data-m><input placeholder="Value"><input placeholder="Label"><button class="btn sm dng" data-a="rm">Remove</button></div>`);
    if (a === 'addg') { const xs = await pickMedia('any', { multi: true }); for (const x of xs || []) $('#gl', m).insertAdjacentHTML('beforeend', gItem(x.id, '')); }
    if (a === 'rmg') e.target.closest('figure').remove();
    if (a === 'save') {
      const o = collect(m); if (!String(o.title).trim()) return toast('Project title is required', true);
      o.gallery = $$('#gl figure', m).map(f => ({ media_id: f.dataset.id, caption: $('input', f).value }));
      o.metrics = $$('[data-m]', m).map(r => { const i = $$('input', r); return { value: i[0].value, label: i[1].value }; });
      await api(p.id ? 'PUT' : 'POST', '/projects' + (p.id ? '/' + p.id : ''), o); m.remove(); toast('Project saved'); boot();
    }
  }));
}
const gItem = (id, cap) => { const x = mget(id); return x ? `<figure data-id="${id}" style="cursor:default">${x.kind === 'video' ? `<video src="${x.url}" muted></video>` : `<img src="${x.url}" alt="">`}<figcaption><input placeholder="Caption" value="${esc(cap)}"><button class="btn sm dng" data-a="rmg">Remove</button></figcaption></figure>` : ''; };
function mediaModal(m) {
  const mo = modal(`<div class="top"><h2>${esc(m.original_name || m.path)}</h2><button class="btn" data-a="close">Close</button></div><div class="card">${m.missing ? '<p><span class="tag" style="background:#fde8e6;color:#b3261e">File missing on disk</span> Replace it to restore every place that uses this item.</p>' : m.kind === 'video' ? `<video src="${m.url}" controls muted style="max-width:100%;max-height:260px"></video>` : `<img src="${m.url}" alt="" style="max-width:100%;max-height:260px">`}${m.faststart === false ? '<p><span class="tag" style="background:#fff3d6;color:#8a5a00">Not fast-start</span> This MP4 stores its index (moov) after the video data (mdat), so browsers must download most of the file before it plays or seeks. It still works, but slowly for big files. Fix without re-encoding or quality loss: <code>ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4</code>, then use “Replace file”.</p>' : ''}${m.webp ? `<p><span class="tag ok">WebP copy</span> Visitors’ browsers get a ${fmtMB(m.webp_bytes || 0)} WebP instead of the ${fmtMB(m.size_bytes || 0)} original; the original is kept.</p>` : ''}<div class="row"><label>Alt text<input id="malt" value="${esc(m.alt)}"></label></div><p><input type="file" id="mrep" accept="image/*,video/mp4,video/webm" style="display:none"><button class="btn" data-a="alt">Save alt text</button> <button class="btn" data-a="rep">Replace file</button> <button class="btn dng" data-a="del">Delete</button></p></div>`);
  mo.addEventListener('click', guard(async e => {
    const a = e.target.dataset.a;
    if (a === 'alt') { await api('PUT', '/media/' + m.id, { alt: $('#malt', mo).value }); toast('Saved'); }
    if (a === 'rep') $('#mrep', mo).click();
    if (a === 'del' && confirm('Delete this file permanently? Places that use it will show nothing.')) { await api('DELETE', '/media/' + m.id); mo.remove(); boot(); }
  }));
  mo.addEventListener('change', guard(async e => { if (e.target.id !== 'mrep') return; const r = await uploadFiles(e.target.files, () => `/media/${m.id}/replace`); e.target.value = ''; if (!r.length) return; toast('File replaced'); mo.remove(); boot(); }));
}
function articleForm(a) {
  const m = modal(`<div class="top"><h2>${a.id ? 'Edit' : 'New'} article</h2><button class="btn" data-a="close">Close</button></div><div class="card"><div class="row"><label>Title (required)<input data-s="title" value="${esc(a.title)}"></label></div><div class="row c3">${F('Slug', 'slug', a.slug)}${F('Author', 'author', a.author)}<label>Status<select data-s="status">${['draft', 'published'].map(o => `<option ${a.status === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div><div class="row">${F('Excerpt', 'excerpt', a.excerpt)}${TA('Content', 'content', a.content)}${catSel(CATS, a.category_id)}${PICK('Cover image', 'cover_media_id', a.cover_media_id)}</div><button class="btn pri" data-a="save">Save article</button></div>`);
  m.addEventListener('click', guard(async e => { if (e.target.dataset.a !== 'save') return; const o = collect(m); if (!o.title.trim()) return toast('Title is required', true); await api(a.id ? 'PUT' : 'POST', '/articles' + (a.id ? '/' + a.id : ''), o); m.remove(); boot(); }));
}
boot();
})();
