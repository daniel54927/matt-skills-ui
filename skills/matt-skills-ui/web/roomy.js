// Roomy add-on for Matt Skills UI (Dan, 2026-11-09). Separate from app.js: reads /api/state, answers via /api/answer.
// 2026-11-19: the questions view now lives in Questions focus (focus.js). The side tab, the floating panel,
// the auto pop open, the resize edges and the built-in reader are gone.
const TOKEN = () => sessionStorage.getItem('msu.token') || new URLSearchParams(location.search).get('token') || '';
const api = async (p, body) => { const r = await fetch(p, { method: body ? 'POST' : 'GET', headers: { 'x-msu-token': TOKEN(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const HL = '&#x1F58D;', PLAY = '&#9654;';   // the highlighter and play glyphs, written as entities
let QS = [], drafts = {}, hold = 0;

// ---- taller dock: drag the grip on the dock's top edge (Dashboard only) ----
const root = document.documentElement;
if (ls.get('rmy.dockH')) root.style.setProperty('--dock-h', ls.get('rmy.dockH') + 'px');
const grip = Object.assign(document.createElement('div'), { id: 'rmy-grip', title: 'Drag to make the bottom area taller or shorter' });
document.body.appendChild(grip);
const placeGrip = () => { const d = document.querySelector('.dock'); if (!d || root.dataset.theme === 'D') { grip.style.display = 'none'; return; } const r = d.getBoundingClientRect(); grip.style.display = 'flex'; grip.style.top = (r.top - 6) + 'px'; grip.style.left = r.left + 'px'; grip.style.right = (innerWidth - r.right) + 'px'; };
setInterval(placeGrip, 400); addEventListener('resize', placeGrip);
grip.addEventListener('pointerdown', e => { e.preventDefault(); grip.setPointerCapture(e.pointerId);
  const mv = ev => { const h = Math.max(150, Math.min(innerHeight - 140, innerHeight - ev.clientY)); root.style.setProperty('--dock-h', h + 'px'); ls.set('rmy.dockH', h); placeGrip(); };
  grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', () => grip.removeEventListener('pointermove', mv), { once: true }); });

// ---- the questions view, shown full screen by Questions focus ----
const panel = Object.assign(document.createElement('section'), { id: 'rmy' });
document.body.append(panel);
const FS = [0.9, 1, 1.15, 1.3, 1.5, 1.75]; let fsi = Number(ls.get('rmy.fs', '2')); const setFs = () => { fsi = Math.max(0, Math.min(FS.length - 1, fsi)); panel.style.setProperty('--rmy-fs', FS[fsi]); ls.set('rmy.fs', fsi); }; setFs();

const plain = q => [q.q, q.rec ? 'Recommended: ' + q.rec : '', ...(q.opts || []).map(o => 'Option ' + o)].filter(Boolean).join('. ').replace(/\s+/g, ' ');
const split = t => esc(t).replace(/\. (?=[A-Z'"(])/g, '.\n').replace(/\? /g, '?\n');

function draw() {
  window.msuFocus?.count(QS.length);
  const keep = panel.querySelector('.rmy-scroll')?.scrollTop || 0, focus = document.activeElement?.dataset?.q;
  panel.innerHTML = `<div class="rmy-wrap">
    <header><h2>Questions for you <span class="rmy-n">${QS.length}</span></h2><div class="rmy-size"><button data-a="fs-" title="Smaller text">A&minus;</button><button data-a="fs+" title="Bigger text">A+</button></div></header>
    <div class="rmy-legend">A&minus;/A+ text size · ${HL} highlight, then press Alt+A for Speechify · 📋 copy · ✓ accept the recommendation · ✎ type your own answer below each question</div>
    <div class="rmy-scroll">${QS.length ? QS.map(q => `<section class="rmy-card">
      <div class="rmy-from">${esc(q.skill || 'question')} · ${esc(q.from)} is waiting${q.ref ? ' · ' + esc(q.ref) : ''}</div>
      <div class="rmy-tools"><button class="rmy-go" data-a="hl" data-q="${q.id}" title="Highlights the question and recommendation, then press your Speechify hotkey">${HL} Highlight for Speechify</button><button data-a="copy" data-q="${q.id}">📋 Copy</button></div>
      <div class="rmy-say" data-q="${q.id}"><p class="rmy-qq">${split(q.q)}</p>
      ${q.rec ? `<div class="rmy-rec"><b>RECOMMENDED</b>${esc(q.rec)}</div>` : ''}</div>
      <div class="rmy-opts">${q.rec ? `<button class="rmy-go" data-a="ans" data-q="${q.id}" data-v="__rec">✓ Accept the recommendation</button>` : ''}${(q.opts || []).map(o => `<button data-a="ans" data-q="${q.id}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      <textarea data-q="${q.id}" placeholder="✎ Or type your own answer here">${esc(drafts[q.id] || '')}</textarea>
      <div class="rmy-send"><button class="rmy-go" data-a="send" data-q="${q.id}">Send my answer ${PLAY}</button><span class="rmy-hint">Ctrl+Enter sends</span></div></section>`).join('') : '<p class="rmy-empty">✓ No one is waiting on you.</p>'}</div></div>`;
  panel.querySelector('.rmy-scroll').scrollTop = keep;
  if (focus) { const t = panel.querySelector(`textarea[data-q="${focus}"]`); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
}

// Send an answer. draw() reports the new count; focus.js moves to Chart after the last one.
const answer = (id, v) => api('/api/answer', { qid: id, answer: v }).then(() => {
  delete drafts[id];
  QS = QS.filter(q => q.id !== id);
  draw();
}, e => alert('Not sent: ' + e.message));
panel.addEventListener('input', e => { if (e.target.dataset.q) drafts[e.target.dataset.q] = e.target.value; });
panel.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.dataset.q) { const v = e.target.value.trim(); if (v) answer(e.target.dataset.q, v); } });
panel.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const q = QS.find(x => x.id === b.dataset.q);
  if (b.dataset.a === 'fs-' || b.dataset.a === 'fs+') { fsi += b.dataset.a === 'fs+' ? 1 : -1; return setFs(); }
  if (b.dataset.a === 'hl' && q) { const el = panel.querySelector(`.rmy-say[data-q="${q.id}"]`); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); hold = Date.now() + 60000; return; }
  if (b.dataset.a === 'copy' && q) { navigator.clipboard.writeText(plain(q)).then(() => { b.textContent = '✓ Copied'; setTimeout(draw, 1200); }); return; }
  if (b.dataset.a === 'ans' && q) return answer(q.id, b.dataset.v);
  if (b.dataset.a === 'send' && q) { const v = (drafts[q.id] || '').trim(); if (v) answer(q.id, v); } });

// ---- keep in step with the board; a new question only changes the count, it never moves you ----
const same = (a, b) => a.length === b.length && a.every((q, i) => q.id === b[i].id);
// The count on the Questions button always follows the board. The cards themselves hold still for
// a minute after a Highlight click, so Speechify keeps its selection.
async function poll() {
  try {
    const s = await api('/api/state');
    const n = s.questions || [];
    window.msuFocus?.count(n.length);
    const holding = Date.now() < hold && n.length >= QS.length;
    if (!same(n, QS) && !holding) { QS = n; draw(); }
  } catch {}
}
QS = window.__STATE__?.questions || [];
poll(); setInterval(poll, 2500); draw();
