// Focus mode add-on for Matt Skills UI (Dan, 2026-11-19). Separate from app.js, like roomy.js.
// Three buttons in the top bar: Questions, Chart, Dashboard.
// Questions and Chart fill the screen and hide everything else. Dashboard is the page as it always was.
// The mode is one attribute on <html>: data-focus="questions" or data-focus="chart" (none = Dashboard).
// focus.css does the hiding. This file only sets the attribute and keeps the buttons in place.

const MODES = ['questions', 'chart'];
const html = document.documentElement;
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} },
};
let count = (window.__STATE__?.questions || []).length;

// ---- the mode ----
function current() { return html.dataset.focus || ''; }

function setFocus(mode) {
  if (!MODES.includes(mode)) mode = '';
  const was = current();
  if (mode) html.dataset.focus = mode; else delete html.dataset.focus;
  delete html.dataset.fdet;                       // details overlay always starts closed
  store.set('fx.mode', mode);                     // a reload keeps the mode
  if (mode === 'chart' && was !== 'chart') openOnChart();
  place();
}

// Chart focus opens on the Chart tab. The board already maps the "1" key to Chart, so press it.
function openOnChart() {
  const on = document.querySelector('.views button.on')?.dataset.v;
  if (on !== 'chart') document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
}

// ---- the buttons ----
function stripHTML() {
  const m = current();
  return `<button data-fx="questions" class="${m === 'questions' ? 'on' : ''}" title="Only the questions, full screen">Questions${count ? ` <b>${count}</b>` : ''}</button>`
    + `<button data-fx="chart" class="${m === 'chart' ? 'on' : ''}" title="Only the chart, full screen">Chart</button>`
    + `<button data-fx="" class="${m === '' ? 'on' : ''}" title="Everything (Esc)">Dashboard</button>`;
}

// The board rebuilds its whole page every few seconds, which throws our buttons away.
// place() puts them back: the strip goes into the top bar, the close button into the details panel.
function place() {
  const mast = document.querySelector('.mast');
  if (mast) {
    let strip = document.getElementById('fx');
    if (!strip || strip.parentNode !== mast) {
      strip = Object.assign(document.createElement('div'), { id: 'fx', className: 'seg' });
      mast.insertBefore(strip, mast.querySelector('.seek'));
    }
    strip.innerHTML = stripHTML();
    html.style.setProperty('--fx-top', Math.round(mast.getBoundingClientRect().bottom) + 'px');
  }
  const notes = document.querySelector('.notes');
  if (notes && !notes.querySelector('#fx-x')) {
    notes.insertAdjacentHTML('afterbegin', '<button id="fx-x" class="btn" title="Close details (Esc)">✕ Close</button>');
  }
}

new MutationObserver(place).observe(document.getElementById('root'), { childList: true });
addEventListener('resize', place);

// ---- clicks ----
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-fx]');
  if (b) return setFocus(b.dataset.fx);
  if (ev.target.closest('#fx-x')) { delete html.dataset.fdet; return; }
  // In Chart focus, clicking a ticket slides its details in over the right side.
  if (current() === 'chart' && ev.target.closest('.main [data-t]')) html.dataset.fdet = '1';
});

// Esc: close the details first, then back to Dashboard.
// Runs in the capture phase, before the board's own Esc handling, and leaves search, spawn,
// the theme picker and any text box alone.
addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || !current()) return;
  if (document.querySelector('.scrim, .dlg, .tpick') || ev.target.closest?.('input,textarea,select')) return;
  if (html.dataset.fdet) delete html.dataset.fdet; else setFocus('');
}, true);

// roomy.js calls these: the question count, and the jump to Chart after the last answer.
window.msuFocus = {
  set: setFocus,
  get: current,
  count(n) { if (n !== count) { count = n; place(); } },
};

// Start in the mode from the address (?focus=chart), else the one from last time.
setFocus(new URLSearchParams(location.search).get('focus') ?? store.get('fx.mode') ?? '');
