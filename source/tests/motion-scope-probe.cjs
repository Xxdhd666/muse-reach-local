// Diagnostic probe (NOT a regression test): open the connection dialog and
// close it, watching for uncaught errors. Usage:
//   node tests/motion-scope-probe.cjs [path/to/app/shell.html]
// Found 2026-11-13 during v25 verification: closing ANY dialog throws
// "ReferenceError: MOTION is not defined" from the second script block
// (reach-visual-polish), because MOTION is a const inside the FIRST script's
// IIFE and the ghost-exit code in the second block references it. Pre-existing
// in v24 (same error on the pristine v24 shell). User-visible effect: the
// dialog's 125ms exit ghost layer never appears (dialog closes instantly
// instead of fading); the dialog itself still closes correctly. Out of scope
// for v25 — reported, not fixed.
'use strict';
const fs = require('fs');
// jsdom is a scratch-only dep; v26: resolve it from the known scratch installs
// (/tmp/v26-jsdom first, then /tmp/v25-jsdom) instead of one hardcoded path.
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
const shellPath = process.argv[2] || (__dirname + '/../app/shell.html');
const html = fs.readFileSync(shellPath, 'utf8');
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
(async () => {
  const { window } = dom; const { document } = window;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(50);
  window.__msgFn({ data: { type: 'snapshot',
    settings: { theme: 'dark', sidebarSide: 'left', animationsEnabled: true },
    operations: [], events: [], files: [], evidence: { service: '运行中', tcpEstablished: true }, health: { label: 'ok', note: '' } } });
  await sleep(20);
  document.querySelector('.side-link[data-page="connection"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  const ctrl = document.querySelector('[data-action="control"]');
  console.log('control button present:', !!ctrl);
  if (ctrl) ctrl.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  console.log('backdrop present after open:', !!document.querySelector('.backdrop'));
  const close = document.querySelector('[data-action="close-modal"]');
  if (close) close.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(100);
  console.log('errors after dialog close:', errors.length ? errors : 'none');
  window.close();
})();
