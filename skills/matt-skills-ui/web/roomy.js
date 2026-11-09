// Roomy add-on for Matt Skills UI (Dan, 2026-11-09). Separate from app.js: reads /api/state, answers via /api/answer.
const TOKEN = () => sessionStorage.getItem('msu.token') || new URLSearchParams(location.search).get('token') || '';
const api = async (p, body) => { const r = await fetch(p, { method: body ? 'POST' : 'GET', headers: { 'x-msu-token': TOKEN(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.statusText); return j; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ls = { get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let QS = [], drafts = {}, speaking = null, hold = 0;

// ---- taller dock: drag the grip on the dock's top edge ----
const root = document.documentElement;
if (ls.get('rmy.dockH')) root.style.setProperty('--dock-h', ls.get('rmy.dockH') + 'px');
const grip = Object.assign(document.createElement('div'), { id: 'rmy-grip', title: 'Drag to make the bottom area taller or shorter' });
document.body.appendChild(grip);
const placeGrip = () => { const d = document.querySelector('.dock'); if (!d || root.dataset.theme === 'D') { grip.style.display = 'none'; return; } const r = d.getBoundingClientRect(); grip.style.display = 'flex'; grip.style.top = (r.top - 6) + 'px'; grip.style.left = r.left + 'px'; grip.style.right = (innerWidth - r.right) + 'px'; };
setInterval(placeGrip, 400); addEventListener('resize', placeGrip);
grip.addEventListener('pointerdown', e => { e.preventDefault(); grip.setPointerCapture(e.pointerId);
  const mv = ev => { const h = Math.max(150, Math.min(innerHeight - 140, innerHeight - ev.clientY)); root.style.setProperty('--dock-h', h + 'px'); ls.set('rmy.dockH', h); placeGrip(); };
  grip.addEventListener('pointermove', mv); grip.addEventListener('pointerup', () => grip.removeEventListener('pointermove', mv), { once: true }); });

// ---- big questions panel on the right ----
const tab = Object.assign(document.createElement('button'), { id: 'rmy-tab', title: 'Open questions in a big panel' });
const panel = Object.assign(document.createElement('aside'), { id: 'rmy' });
document.body.append(tab, panel);
for (const [k, v] of [['rmy.w', '--rmy-w'], ['rmy.h', '--rmy-h'], ['rmy.top', '--rmy-top']]) if (ls.get(k)) panel.style.setProperty(v, ls.get(k) + 'px');
const FS = [0.9, 1, 1.15, 1.3, 1.5, 1.75]; let fsi = Number(ls.get('rmy.fs', '2')); const setFs = () => { fsi = Math.max(0, Math.min(FS.length - 1, fsi)); panel.style.setProperty('--rmy-fs', FS[fsi]); ls.set('rmy.fs', fsi); }; setFs();
const box = () => panel.getBoundingClientRect();
const drag = (el, fn) => { el.onpointerdown = e => { e.preventDefault(); el.setPointerCapture(e.pointerId); const mv = ev => fn(ev); el.addEventListener('pointermove', mv); el.addEventListener('pointerup', () => el.removeEventListener('pointermove', mv), { once: true }); }; };
const setW = ev => { const w = Math.round(Math.max(340, Math.min(innerWidth - 20, innerWidth - ev.clientX))); panel.style.setProperty('--rmy-w', w + 'px'); ls.set('rmy.w', w); };
const setH = ev => { const h = Math.round(Math.max(240, Math.min(innerHeight - box().top, ev.clientY - box().top))); panel.style.setProperty('--rmy-h', h + 'px'); ls.set('rmy.h', h); };
const setTop = ev => { const b = box(), t = Math.round(Math.max(0, Math.min(b.bottom - 240, ev.clientY))); panel.style.setProperty('--rmy-top', t + 'px'); panel.style.setProperty('--rmy-h', (b.bottom - t) + 'px'); ls.set('rmy.top', t); ls.set('rmy.h', b.bottom - t); };
const setOpen = o => { panel.classList.toggle('open', o); tab.style.display = o ? 'none' : ''; ls.set('rmy.open', o ? '1' : ''); if (o) draw(); };
tab.onclick = () => setOpen(true);

const speak = (id, text) => { const s = speechSynthesis; if (speaking === id) { s.cancel(); speaking = null; return draw(); }
  s.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = Number(ls.get('rmy.rate', '0.95')); const vv = speechSynthesis.getVoices().find(v => v.name === ls.get('rmy.voice', '')); if (vv) u.voice = vv; u.onend = u.onerror = () => { speaking = null; draw(); }; speaking = id; s.speak(u); draw(); };
const spoken = q => [q.q, q.rec ? 'Recommended: ' + q.rec : '', ...(q.opts || []).map(o => 'Option ' + o)].filter(Boolean).join('. ').replace(/\s+/g, ' ');
const split = t => esc(t).replace(/\. (?=[A-Z'"(])/g, '.\n').replace(/\? /g, '?\n');

// best voices first: Microsoft Natural/Online (Edge), then Google, then the rest
const voiceOpts = () => { const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en')); const score = v => /Natural|Online/.test(v.name) ? 0 : /Google/.test(v.name) ? 1 : 2; vs.sort((a, b) => score(a) - score(b) || a.name.localeCompare(b.name));
  const cur = ls.get('rmy.voice', ''); return `<option value="">System default</option>` + vs.map(v => `<option ${v.name === cur ? 'selected' : ''} value="${esc(v.name)}">${score(v) === 0 ? '★ ' : ''}${esc(v.name)}</option>`).join(''); };
speechSynthesis.onvoiceschanged = () => draw();
function draw() {
  tab.innerHTML = QS.length ? `❓ Questions <b>${QS.length}</b>` : '❓ Questions';
  if (!panel.classList.contains('open')) return;
  const keep = panel.querySelector('.rmy-scroll')?.scrollTop || 0, focus = document.activeElement?.dataset?.q;
  panel.innerHTML = `<div class="rmy-edge" title="Drag ↔ to change width"></div><div class="rmy-ht" title="Drag ↕ to move the top edge"></div><div class="rmy-hb" title="Drag ↕ to change height"></div><div class="rmy-corner" title="Drag ⤡ to change width and height"></div>
    <header><h2>Questions for you <span class="rmy-n">${QS.length}</span></h2><div class="rmy-size"><button data-a="fs-" title="Smaller text">A−</button><button data-a="fs+" title="Bigger text">A+</button><button data-a="reset" title="Reset size and position">⟲</button></div><button data-a="close" title="Close (Esc)">✕</button></header>
    <div class="rmy-voice">🔊 <select data-a="voice" title="Voice for the built-in reader">${voiceOpts()}</select><select data-a="rate" title="Speed">${['0.75','0.85','0.95','1','1.15','1.3'].map(r => `<option ${ls.get('rmy.rate','0.95')===r?'selected':''}>${r}</option>`).join('')}</select>×</div>
    <div class="rmy-legend">Drag any edge or the ⤡ corner to resize · A−/A+ text size · ⟲ reset<br>🖍 highlight, then press Alt+A for Speechify · 🔊 built-in reader · 📋 copy · ✓ accept the recommendation · ✎ type your own answer below each question</div>
    <div class="rmy-scroll">${QS.length ? QS.map(q => `<section class="rmy-card">
      <div class="rmy-from">${esc(q.skill || 'question')} · ${esc(q.from)} is waiting${q.ref ? ' · ' + esc(q.ref) : ''}</div>
      <div class="rmy-tools"><button class="rmy-go" data-a="hl" data-q="${q.id}" title="Highlights the question and recommendation, then press your Speechify hotkey">🖍 Highlight for Speechify</button><button data-a="read" data-q="${q.id}">${speaking === q.id ? '■ Stop' : '🔊 Built-in reader'}</button><button data-a="copy" data-q="${q.id}">📋 Copy</button></div>
      <div class="rmy-say" data-q="${q.id}"><p class="rmy-qq">${split(q.q)}</p>
      ${q.rec ? `<div class="rmy-rec"><b>RECOMMENDED</b>${esc(q.rec)}</div>` : ''}</div>
      <div class="rmy-opts">${q.rec ? `<button class="rmy-go" data-a="ans" data-q="${q.id}" data-v="__rec">✓ Accept the recommendation</button>` : ''}${(q.opts || []).map(o => `<button data-a="ans" data-q="${q.id}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
      <textarea data-q="${q.id}" placeholder="✎ Or type your own answer here…">${esc(drafts[q.id] || '')}</textarea>
      <div class="rmy-send"><button class="rmy-go" data-a="send" data-q="${q.id}">Send my answer ▶</button><span class="rmy-hint">Ctrl+Enter sends</span></div></section>`).join('') : '<p class="rmy-empty">✓ No one is waiting on you.</p>'}</div>`;
  panel.querySelector('.rmy-scroll').scrollTop = keep;
  if (focus) { const t = panel.querySelector(`textarea[data-q="${focus}"]`); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }
  drag(panel.querySelector('.rmy-edge'), setW); drag(panel.querySelector('.rmy-hb'), setH); drag(panel.querySelector('.rmy-ht'), setTop);
  drag(panel.querySelector('.rmy-corner'), ev => { setW(ev); setH(ev); });
}

const answer = (id, v) => api('/api/answer', { qid: id, answer: v }).then(() => { delete drafts[id]; QS = QS.filter(q => q.id !== id); draw(); }, e => alert('Not sent: ' + e.message));
panel.addEventListener('change', e => { const a = e.target.dataset.a; if (a === 'voice') ls.set('rmy.voice', e.target.value); if (a === 'rate') ls.set('rmy.rate', e.target.value); });
panel.addEventListener('input', e => { if (e.target.dataset.q) drafts[e.target.dataset.q] = e.target.value; });
panel.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.target.dataset.q) { const v = e.target.value.trim(); if (v) answer(e.target.dataset.q, v); } });
addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) setOpen(false); });
panel.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const q = QS.find(x => x.id === b.dataset.q);
  if (b.dataset.a === 'close') return setOpen(false);
  if (b.dataset.a === 'fs-' || b.dataset.a === 'fs+') { fsi += b.dataset.a === 'fs+' ? 1 : -1; return setFs(); }
  if (b.dataset.a === 'reset') { for (const k of ['rmy.w', 'rmy.h', 'rmy.top']) ls.set(k, ''); for (const v of ['--rmy-w', '--rmy-h', '--rmy-top']) panel.style.removeProperty(v); fsi = 2; return setFs(); }
  if (b.dataset.a === 'hl' && q) { const el = panel.querySelector(`.rmy-say[data-q="${q.id}"]`); const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); hold = Date.now() + 60000; return; }
  if (b.dataset.a === 'read' && q) return speak(q.id, spoken(q));
  if (b.dataset.a === 'copy' && q) { navigator.clipboard.writeText(spoken(q)).then(() => { b.textContent = '✓ Copied'; setTimeout(draw, 1200); }); return; }
  if (b.dataset.a === 'ans' && q) return answer(q.id, b.dataset.v);
  if (b.dataset.a === 'send' && q) { const v = (drafts[q.id] || '').trim(); if (v) answer(q.id, v); } });

// ---- keep in step with the board ----
const same = (a, b) => a.length === b.length && a.every((q, i) => q.id === b[i].id);
async function poll() { try { const s = await api('/api/state'); const n = s.questions || []; if (!same(n, QS) && (Date.now() > hold || n.length < QS.length)) { QS = n; if (n.length && !panel.classList.contains('open') && ls.get('rmy.auto', '1') === '1') setOpen(true); draw(); } } catch {} }
if (ls.get('rmy.open') === '1') setOpen(true);
poll(); setInterval(poll, 2500); draw();
