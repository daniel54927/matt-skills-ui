// Focus mode check (Dan's fork, 2026-11-19). Run from the repo root: node test/focus.check.mjs
// Starts a throwaway board on the test fixture (never Dan's real boards), loads it in headless Chrome
// in each mode, and reads the page the browser built. Last line is PASS focus mode or FAIL focus mode.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DRIVER = '.claude/skills/run-matt-skills-ui/driver.mjs';
let failed = 0;
const ok = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed++; };

// Which browser: MSU_CHROME if set, else Playwright's headless shell if it can actually start,
// else Windows Chrome through WSL (the workbench distro lacks the shell's system libraries).
const WIN_CHROME = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
let picked;
function chrome() {
  if (picked !== undefined) return picked;
  if (process.env.MSU_CHROME) return (picked = process.env.MSU_CHROME);
  const cache = path.join(os.homedir(), '.cache/ms-playwright');
  for (const d of existsSync(cache) ? readdirSync(cache).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse() : [])
    for (const sub of readdirSync(path.join(cache, d))) {
      const b = path.join(cache, d, sub, 'chrome-headless-shell');
      if (existsSync(b) && spawnSync(b, ['--version'], { timeout: 10000 }).status === 0) return (picked = b);
    }
  return (picked = existsSync(WIN_CHROME) ? WIN_CHROME : null);
}
// A fresh, empty browser profile every load, so nothing is remembered between modes.
function profile() {
  if (!chrome().endsWith('.exe')) return mkdtempSync(path.join(os.tmpdir(), 'msu-focus-'));
  const winTemp = spawnSync('cmd.exe', ['/c', 'echo', '%TEMP%'], { encoding: 'utf8', cwd: '/mnt/c' }).stdout.trim();
  const linux = mkdtempSync(path.join(spawnSync('wslpath', [winTemp], { encoding: 'utf8' }).stdout.trim(), 'msu-focus-'));
  return spawnSync('wslpath', ['-w', linux], { encoding: 'utf8' }).stdout.trim();
}
// The page as the browser left it after its scripts ran.
function dom(url) {
  const head = chrome().endsWith('.exe') ? ['--headless=new'] : [];
  const r = spawnSync(chrome(), [...head, '--disable-gpu', `--user-data-dir=${profile()}`, '--window-size=1440,900', '--timeout=8000', '--dump-dom', url], { encoding: 'utf8', timeout: 60000, cwd: '/mnt/c' });
  return r.stdout || '';
}
const htmlTag = page => (page.match(/<html[^>]*>/) || [''])[0];

// 1. Hassan's files are untouched: every change lives in Dan's add-on files.
const diff = spawnSync('git', ['diff', '--quiet', 'main', '--', 'skills/matt-skills-ui/web/app.js', 'skills/matt-skills-ui/web/style.css']);
ok('app.js and style.css are the same as main', diff.status === 0);

// 2. A throwaway board on the fixture.
ok('headless Chrome found', !!chrome());
const up = spawnSync('node', [DRIVER, 'up'], { encoding: 'utf8' }).stdout || '';
const base = (up.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+/) || [])[0];
ok('fixture board started', !!base);
try {
  if (base && chrome()) {
    const q = dom(base + '&focus=questions');
    ok('Questions focus: page is in questions mode', htmlTag(q).includes('data-focus="questions"'));
    ok('Questions focus: strip has Questions, Chart, Dashboard', ['questions', 'chart', ''].every(m => q.includes(`data-fx="${m}"`)));
    ok('Questions focus: Questions button is lit', /data-fx="questions" class="on"/.test(q));
    ok('Questions focus: questions view is on the page', q.includes('id="rmy"') && q.includes('Questions for you'));
    ok('Questions focus: built-in reader, voice and speed are gone', !q.includes('Built-in reader') && !q.includes('data-a="voice"') && !q.includes('data-a="rate"'));
    ok('Questions focus: side tab and resize edges are gone', !q.includes('rmy-tab') && !q.includes('rmy-edge') && !q.includes('rmy-corner'));

    const c = dom(base + '&focus=chart');
    ok('Chart focus: page is in chart mode', htmlTag(c).includes('data-focus="chart"'));
    ok('Chart focus: Chart button is lit', /data-fx="chart" class="on"/.test(c));
    ok('Chart focus: opens on the Chart tab', /class="on" data-v="chart"/.test(c));
    ok('Chart focus: details close button is in place', c.includes('id="fx-x"'));

    const d = dom(base + '&focus=');
    ok('Dashboard: no focus mode', !htmlTag(d).includes('data-focus'));
    ok('Dashboard: Dashboard button is lit', /data-fx="" class="on"/.test(d));
  }
} finally {
  spawnSync('node', [DRIVER, 'down'], { encoding: 'utf8' });
}
console.log(failed ? `FAIL focus mode (${failed} failed)` : 'PASS focus mode');
process.exit(failed ? 1 : 0);
