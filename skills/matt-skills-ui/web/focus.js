// Focus mode add-on for Matt Skills UI (Dan, 2026-11-19). Separate from app.js, like roomy.js.
// Three buttons at the right end of the top bar: Questions, Chart, Dashboard.
// Questions and Chart fill the screen and hide everything else. Dashboard is the page as it always was.
// The mode is one attribute on <html>: data-focus="questions" or data-focus="chart" (none = Dashboard).
// Ticket details over the chart are a second attribute: data-focus-details.
// focus.css does the hiding. This file only sets the attributes and keeps the buttons in place.

const MODES = ['questions', 'chart'];
const html = document.documentElement;
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch {} },
};
let count = 0;                                   // questions waiting; roomy.js keeps it up to date

// ---- the mode ----
function current() { return html.dataset.focus || ''; }

function setFocus(mode) {
  if (!MODES.includes(mode)) mode = '';
  if (mode) html.dataset.focus = mode; else delete html.dataset.focus;
  closeDetails();                                // details always start closed
  store.set('fx.mode', mode);                    // a reload keeps the mode
  if (mode === 'chart') openOnChart();           // every press of Chart lands on the Chart tab
  place();
}

function openDetails() { html.dataset.focusDetails = '1'; }
function closeDetails() { delete html.dataset.focusDetails; }

// Chart focus opens on the Chart tab.
// Step 1: if the Chart tab button is on the page, click it, same as Dan would.
// Step 2: if it is not (the middle box shows Setup, Triage, Artifacts or Glossary, which have no tabs),
//         press the board's own "1" shortcut, which app.js maps to the Chart view.
function openOnChart() {
  const tab = document.querySelector('.views [data-v="chart"]');
  if (tab) { if (!tab.classList.contains('on')) tab.click(); return; }
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
}

// ---- the buttons ----
function stripHTML() {
  const m = current();
  return `<button data-fx="questions" class="${m === 'questions' ? 'on' : ''}" title="Only the questions, full screen">Questions${count ? ` <b>${count}</b>` : ''}</button>`
    + `<button data-fx="chart" class="${m === 'chart' ? 'on' : ''}" title="Only the chart, full screen">Chart</button>`
    + `<button data-fx="" class="${m === '' ? 'on' : ''}" title="Everything (Esc)">Dashboard</button>`;
}

// The board rebuilds its whole page every few seconds, which throws our buttons away.
// place() puts them back: the strip at the end of the top bar, the close button into the details panel.
function place() {
  const mast = document.querySelector('.mast');
  if (mast) {
    let strip = document.getElementById('fx');
    if (!strip || strip.parentNode !== mast) {
      strip = Object.assign(document.createElement('div'), { id: 'fx', className: 'seg' });
      mast.appendChild(strip);
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

// ---- the question count ----
// roomy.js reports every change. When the last question goes away while Dan is in Questions focus
// (answered here or in the chat), he lands on Chart focus to see the progress.
function setCount(n) {
  if (n === count) return;
  const wasWaiting = count > 0;
  count = n;
  if (wasWaiting && n === 0 && current() === 'questions') return setFocus('chart');
  place();
}

// ---- clicks ----
document.addEventListener('click', ev => {
  const b = ev.target.closest('[data-fx]');
  if (b) return setFocus(b.dataset.fx);
  if (ev.target.closest('#fx-x')) return closeDetails();
  // In Chart focus, clicking a ticket opens its details over the right side.
  if (current() === 'chart' && ev.target.closest('.main [data-t]')) openDetails();
});

// Esc: close the details first, then back to Dashboard.
// Runs in the capture phase, before the board's own Esc handling, and leaves search, spawn,
// the theme picker and any text box alone.
addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || !current()) return;
  if (document.querySelector('.scrim, .dlg, .tpick') || ev.target.closest?.('input,textarea,select')) return;
  if (html.dataset.focusDetails) closeDetails(); else setFocus('');
}, true);

// roomy.js calls these.
window.msuFocus = { set: setFocus, get: current, count: setCount };

// Start in the mode from last time. ?focus=chart in the address (used by the test) wins once,
// then leaves the address so a later reload goes by what Dan last clicked.
const params = new URLSearchParams(location.search);
if (params.has('focus')) {
  setFocus(params.get('focus'));
  params.delete('focus');
  history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);
} else {
  setFocus(store.get('fx.mode') || '');
}
