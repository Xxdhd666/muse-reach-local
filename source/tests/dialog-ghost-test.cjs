// Dialog exit-ghost test (v26): closing a dialog must not throw, and the 125ms
// exit ghost must appear and then be removed. Usage:
//   node tests/dialog-ghost-test.cjs [path/to/app/shell.html]
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v26-jsdom first, then /tmp/v25-jsdom) or a plain require('jsdom').
'use strict';
const fs = require('fs');
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
const shellPath = process.argv[2] || (__dirname + '/../app/shell.html');
const html = fs.readFileSync(shellPath, 'utf8');

let pass = 0, fail = 0;
function check(cond, name) {
  if (cond) { pass++; console.log('ok   - ' + name); }
  else { fail++; console.log('FAIL - ' + name); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

function makeDom() {
  const errors = [];
  const dom = new JSDOM(html, {
    url: 'https://muse.ai/', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
      .on('jsdomError', e => errors.push(e.detail && e.detail.stack || String(e))),
    beforeParse(window) {
      window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      window.chrome = { webview: { postMessage() {}, addEventListener(t, fn) { window.__msgFn = fn; } } };
    },
  });
  return { dom, errors };
}
function feedSnapshot(window, animationsEnabled) {
  window.__msgFn({ data: { type: 'snapshot',
    settings: { theme: 'dark', sidebarSide: 'left', animationsEnabled },
    operations: [], events: [], files: [], evidence: { service: '运行中', tcpEstablished: true }, health: { label: 'ok', note: '' } } });
}
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
async function openConnectionDialog(window) {
  click(window, '.side-link[data-page="connection"]');
  await sleep(20);
  return click(window, '[data-action="control"]');
}
async function closeDialog(window) {
  const ok = click(window, '[data-action="close-modal"]');
  await sleep(30); // let the MutationObserver callback run
  return ok;
}
const ghostCount = doc => doc.querySelectorAll('.backdrop.visual-leaving').length;

(async () => {
  // ---- 1. connection dialog: no error, ghost appears, then removed ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feedSnapshot(window, true);
    await sleep(20);
    check(typeof window.MOTION === 'object' && window.MOTION.fastExit === 125 && window.MOTION.fast === 167,
      '1a window.MOTION is the shared token table (fastExit 125, fast 167)');
    check(await openConnectionDialog(window), '1b connection dialog opens');
    await sleep(20);
    check(!!document.querySelector('.backdrop'), '1c backdrop present while open');
    check(await closeDialog(window), '1d close button clicked');
    check(!document.querySelector('#modalRoot .backdrop'), '1e live backdrop removed on close');
    const g = document.querySelector('.backdrop.visual-leaving');
    check(!!g, '1f exit ghost appears after close');
    check(g && g.getAttribute('aria-hidden') === 'true' && g.inert === true && !g.hasAttribute('data-action'),
      '1g ghost is inert, aria-hidden, no data-action');
    await sleep(250);
    check(ghostCount(document) === 0, '1h ghost removed after 250ms (155ms timer)');
    check(errors.length === 0, '1i no uncaught errors (was: ' + (errors[0] || 'none') + ')');
    window.close();
  }
  // ---- 2. result dialog: same behaviour ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feedSnapshot(window, true);
    await sleep(20);
    window.__msgFn({ data: { type: 'connection-result', text: '已断开', summary: '摘要行', evidence: '证据行' } });
    await sleep(20);
    check(!!document.querySelector('.backdrop'), '2a result dialog opens');
    check(await closeDialog(window), '2b result dialog closes');
    check(ghostCount(document) === 1, '2c exit ghost appears for result dialog');
    await sleep(250);
    check(ghostCount(document) === 0, '2d ghost removed after 250ms');
    check(errors.length === 0, '2e no uncaught errors');
    window.close();
  }
  // ---- 3. rapid open/close twice: no leftover ghost, no errors ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feedSnapshot(window, true);
    await sleep(20);
    for (let i = 0; i < 2; i++) {
      await openConnectionDialog(window);
      await sleep(20);
      await closeDialog(window);
    }
    await sleep(300);
    check(ghostCount(document) === 0, '3a no leftover ghost after rapid open/close x2');
    check(!document.querySelector('#modalRoot .backdrop'), '3b no live backdrop left');
    check(errors.length === 0, '3c no uncaught errors');
    window.close();
  }
  // ---- 4. animationsEnabled=false: no ghost at all, dialog still closes ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feedSnapshot(window, false);
    await sleep(20);
    check(document.body.classList.contains('no-anim'), '4a body.no-anim set when animations off');
    await openConnectionDialog(window);
    await sleep(20);
    check(await closeDialog(window), '4b dialog closes with animations off');
    check(ghostCount(document) === 0, '4c no ghost created when animations off');
    await sleep(250);
    check(ghostCount(document) === 0, '4d still no ghost after 250ms');
    check(!document.querySelector('#modalRoot .backdrop'), '4e dialog gone');
    check(errors.length === 0, '4f no uncaught errors');
    window.close();
  }
  // ---- 5. Escape closes with ghost too ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feedSnapshot(window, true);
    await sleep(20);
    await openConnectionDialog(window);
    await sleep(20);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(30);
    check(ghostCount(document) === 1, '5a Escape close also creates exit ghost');
    await sleep(250);
    check(ghostCount(document) === 0, '5b ghost removed after 250ms');
    check(errors.length === 0, '5c no uncaught errors');
    window.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
