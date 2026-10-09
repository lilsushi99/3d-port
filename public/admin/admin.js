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
function toast(t, bad) { const d = document.createElement('div'); d.className = 'msg' + (bad ? ' bad' : ''); d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2600); }
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { if (e.status === 401) return login(); toast(e.message, true); } };
let MEDIA = [], CATS = [], MAPN = null;
const mget = id => MEDIA.find(m => m.id == id);
const NAV = [['MAIN', [['dashboard', 'Dashboard'], ['homepage', 'Homepage'], ['about', 'About']]], ['CONTENT', [['work', 'Selected Work'], ['articles', 'Articles'], ['footprint', 'Global Footprint'], ['media', 'Media']]], ['SETTINGS', [['settings', 'Settings']]]];
const TITLES = { dashboard: 'Dashboard', homepage: 'Homepage', about: 'About', work: 'Selected Work', articles: 'Articles', footprint: 'Global Footprint', media: 'Media', settings: 'Settings' };

function login(msg) {
  $('#app').innerHTML = `<div class="login"><form class="card" id="lf"><h2>Portfolio admin</h2><p>${esc(msg || 'Sign in to manage your content.')}</p><div class="row"><label>Email<input name="email" type="email" required autofocus></label></div><div class="row"><label>Password<input name="password" type="password" required></label></div><button class="btn pri" style="width:100%">Sign in</button></form></div>`;
  $('#lf').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); try { await api('POST', '/login', f); boot(); } catch (er) { login(er.message); } };
}
async function boot() {
  try { await api('GET', '/me'); } catch { return login(); }
  [MEDIA, CATS] = await Promise.all([api('GET', '/media'), api('GET', '/categories')]);
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
const RTE = (l, k, v) => `<label>${l}<div class="tb"><button type="button" class="btn sm" data-c="bold"><b>B</b></button><button type="button" class="btn sm" data-c="italic"><i>I</i></button><button type="button" class="btn sm" data-c="underline"><u>U</u></button><button type="button" class="btn sm" data-c="createLink">Link</button><button type="button" class="btn sm" data-c="removeFormat">Clear</button></div><div class="rte" contenteditable data-rte="${k}">${v || ''}</div></label>`;
const PICK = (l, k, id, kind = 'image') => { const m = mget(id); return `<label>${l}<div class="pick" data-pick="${k}" data-kind="${kind}" data-id="${id || ''}">${m ? (m.kind === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`) : '<span class="tag">none</span>'}<button type="button" class="btn sm" data-a="choose">Choose</button><button type="button" class="btn sm" data-a="clear">Remove</button></div></label>`; };
function bindForm(root) {
  $$('[data-c]', root).forEach(b => b.onclick = () => { const c = b.dataset.c; if (c === 'createLink') { const u = prompt('Link URL (https://…)'); if (u) document.execCommand(c, false, u); } else document.execCommand(c); });
  $$('[data-pick]', root).forEach(p => p.onclick = guard(async e => {
    const a = e.target.dataset.a; if (!a) return;
    if (a === 'clear') p.dataset.id = ''; else { const m = await pickMedia(p.dataset.kind); if (!m) return; p.dataset.id = m.id; }
    const m = mget(p.dataset.id); $$('img,video,.tag', p).forEach(x => x.remove());
    p.insertAdjacentHTML('afterbegin', m ? (m.kind === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`) : '<span class="tag">none</span>');
  }));
}
const collect = root => { const o = {}; $$('[data-s]', root).forEach(i => o[i.dataset.s] = i.type === 'checkbox' ? (i.checked ? 1 : 0) : i.value); $$('[data-rte]', root).forEach(i => o[i.dataset.rte] = i.innerHTML); $$('[data-pick]', root).forEach(i => o[i.dataset.pick] = i.dataset.id); return o; };
const saveSettings = guard(async root => { await api('PUT', '/settings', collect(root)); toast('Saved'); });

async function pickMedia(kind) {
  MEDIA = await api('GET', '/media');
  return new Promise(res => {
    const m = document.createElement('div'); m.className = 'modal';
    const draw = () => m.innerHTML = `<div><div class="top"><h2>Choose media</h2><span><input type="file" id="up" accept="image/*,video/mp4,video/webm" style="display:none"><button class="btn" id="upb">Upload new</button> <button class="btn" id="cx">Cancel</button></span></div><div class="grid">${MEDIA.filter(x => kind === 'any' || x.kind === kind).map(x => `<figure data-id="${x.id}">${x.kind === 'video' ? `<video src="${x.url}" muted></video>` : `<img src="${x.url}" alt="">`}<figcaption>${esc(x.original_name)}</figcaption></figure>`).join('') || '<p>No media yet. Upload some.</p>'}</div></div>`;
    draw(); document.body.append(m);
    m.onclick = guard(async e => {
      if (e.target === m || e.target.id === 'cx') { m.remove(); res(null); }
      const f = e.target.closest('figure'); if (f) { m.remove(); res(mget(f.dataset.id)); }
      if (e.target.id === 'upb') $('#up', m).click();
    });
    m.addEventListener('change', guard(async e => { if (e.target.id !== 'up') return; const fd = new FormData(); fd.append('file', e.target.files[0]); await api('POST', '/media', undefined, fd); MEDIA = await api('GET', '/media'); draw(); }));
  });
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
    const s = await api('GET', '/stats');
    root.innerHTML = `<div class="cards">${[['Projects', s.projects], ['Published', s.published], ['Categories', s.categories], ['Countries', s.countries], ['Media files', s.media]].map(([l, n]) => `<div class="card stat"><small>${l}</small><b>${n}</b></div>`).join('')}</div>` + card('Recently edited projects', 'Latest changes across Selected Work.', `<table><thead><tr><th>Title</th><th>Client</th><th>Status</th></tr></thead><tbody>${s.recent.map(r => `<tr><td>${esc(r.title)}</td><td>${esc(r.client)}</td><td><span class="tag ${r.is_published ? 'ok' : ''}">${r.is_published ? 'Published' : 'Draft'}</span></td></tr>`).join('')}</tbody></table>`);
  },
  async homepage(root) {
    const [s, btn, soc] = await Promise.all([api('GET', '/settings'), api('GET', '/buttons'), api('GET', '/socials')]);
    mount(root,
      card('Hero & Bio', 'Text shown beside the 3D laptop on desktop.', RTE('Homepage bio', 'hero.bio_html', s['hero.bio_html']) + `<div class="row c2" style="margin-top:12px">${F('Contact line', 'hero.reach_text', s['hero.reach_text'])}${F('Top-right button text', 'hero.cta_label', s['hero.cta_label'])}</div><div class="row c2">${F('Closing statement — bold lead (mobile & tablet only)', 'hero.closing_lead', s['hero.closing_lead'])}${F('Closing statement — faded continuation', 'hero.closing_rest', s['hero.closing_rest'])}</div><div class="row c2">${F('Top-right button destination', 'hero.cta_target', s['hero.cta_target'])}${F('Mouse click destination', 'hero.mouse_target', s['hero.mouse_target'])}</div><div class="row">${PICK('Laptop screen video (mp4/webm)', 'hero.screen_video_media_id', s['hero.screen_video_media_id'], 'video')}</div>${saveBtn}`) +
      card('Laptop buttons', 'The first three active buttons appear on the laptop. Destinations: #/about, #work, #globe, #/playground or a full URL.', editor('buttons', [{ k: 'slug', l: 'ID', ro: 1, w: 80 }, { k: 'label', l: 'Label', w: 100 }, { k: 'hover_text', l: 'Hover text', w: 150 }, { k: 'target', l: 'Destination', w: 120 }, { k: 'color', l: 'Colour', t: 'sel', o: ['cyan', 'mustard', 'red'] }, { k: 'is_active', l: 'Active', t: 'check' }], btn, { slug: '', label: '', hover_text: '', target: '', color: 'cyan', is_active: 1 })) +
      card('Social & contact channels', 'Shown as glass icons under the bio.', editor('socials', [{ k: 'name', l: 'Name' }, { k: 'icon_key', l: 'Icon', t: 'sel', o: ['linkedin', 'x', 'whatsapp', 'email', 'facebook', 'instagram', 'link'] }, { k: 'url', l: 'URL', w: 260 }, { k: 'is_active', l: 'Active', t: 'check' }], soc, { name: '', icon_key: 'link', url: '', is_active: 1 })), () => onSave(root));
  },
  async about(root) {
    const s = await api('GET', '/settings');
    mount(root, card('About page', 'Used by the Read About Me page. Independent of the homepage bio.', `<div class="row c2">${F('Name', 'about.name', s['about.name'])}${F('Role line', 'about.role', s['about.role'])}</div><div class="row">${PICK('Picture', 'about.image_media_id', s['about.image_media_id'])}</div>${RTE('About text', 'about.html', s['about.html'])}<p></p>${saveBtn}`), () => onSave(root));
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
    MEDIA = await api('GET', '/media');
    mount(root, card('Media library', 'Files are stored on the server disk; MySQL keeps only their paths.', `<p><input type="file" id="mu" accept="image/*,video/mp4,video/webm" multiple></p><div class="grid">${MEDIA.map(m => `<figure data-id="${m.id}">${m.kind === 'video' ? `<video src="${m.url}" muted></video>` : `<img src="${m.url}" alt="">`}<figcaption>${esc(m.original_name)}</figcaption></figure>`).join('')}</div>`), () => {
      $('#mu').onchange = guard(async e => { for (const f of e.target.files) { const fd = new FormData(); fd.append('file', f); await api('POST', '/media', undefined, fd); } toast('Uploaded'); boot(); });
      $('.grid', root).onclick = guard(async e => { const f = e.target.closest('figure'); if (!f) return; const m = mget(f.dataset.id), alt = prompt(`Alt text for ${m.original_name}\n(leave blank to keep; type DELETE to remove the file)`, m.alt || ''); if (alt === null) return; if (alt === 'DELETE') { await api('DELETE', '/media/' + m.id); } else await api('PUT', '/media/' + m.id, { alt }); boot(); });
    });
  },
  async settings(root) {
    const s = await api('GET', '/settings');
    mount(root, card('Site settings', 'Global content used across the whole portfolio.', `<div class="row c2">${F('Site name', 'site.name', s['site.name'])}${F('Owner name', 'site.owner', s['site.owner'])}</div><div class="row c2">${F('Copyright text', 'site.copyright', s['site.copyright'])}${F('Contact email', 'site.contact_email', s['site.contact_email'])}</div><div class="row">${F('Footer “made by” line', 'site.made_by', s['site.made_by'])}</div><div class="row"><label>Default theme<select data-s="site.default_theme">${['system', 'light', 'dark'].map(o => `<option ${s['site.default_theme'] === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div>${saveBtn}`), () => onSave(root));
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
  <div class="card"><h2>Gallery</h2><div class="grid" id="gl">${(p.gallery || []).map(g => gItem(g.media_id, g.caption)).join('')}</div><p></p><button class="btn sm" data-a="addg">Add media</button></div>
  <button class="btn pri" data-a="save">Save project</button>`);
  m.addEventListener('click', guard(async e => {
    const a = e.target.dataset.a;
    if (a === 'rm') e.target.closest('[data-m]').remove();
    if (a === 'addm') $('#mt', m).insertAdjacentHTML('beforeend', `<div class="row c3" data-m><input placeholder="Value"><input placeholder="Label"><button class="btn sm dng" data-a="rm">Remove</button></div>`);
    if (a === 'addg') { const x = await pickMedia('any'); if (x) $('#gl', m).insertAdjacentHTML('beforeend', gItem(x.id, '')); }
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
function articleForm(a) {
  const m = modal(`<div class="top"><h2>${a.id ? 'Edit' : 'New'} article</h2><button class="btn" data-a="close">Close</button></div><div class="card"><div class="row"><label>Title (required)<input data-s="title" value="${esc(a.title)}"></label></div><div class="row c3">${F('Slug', 'slug', a.slug)}${F('Author', 'author', a.author)}<label>Status<select data-s="status">${['draft', 'published'].map(o => `<option ${a.status === o ? 'selected' : ''}>${o}</option>`).join('')}</select></label></div><div class="row">${F('Excerpt', 'excerpt', a.excerpt)}${TA('Content', 'content', a.content)}${catSel(CATS, a.category_id)}${PICK('Cover image', 'cover_media_id', a.cover_media_id)}</div><button class="btn pri" data-a="save">Save article</button></div>`);
  m.addEventListener('click', guard(async e => { if (e.target.dataset.a !== 'save') return; const o = collect(m); if (!o.title.trim()) return toast('Title is required', true); await api(a.id ? 'PUT' : 'POST', '/articles' + (a.id ? '/' + a.id : ''), o); m.remove(); boot(); }));
}
boot();
})();
