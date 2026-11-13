// InfoBar test (v27): the disconnect/reconnect bar is driven by snapshot health
// transitions, keeps exactly one bar, updates it in place, and shows the success
// bar once after recovery — even when the disconnect bar was dismissed.
// Usage: node tests/infobar-test.cjs [path/to/app/shell.html]
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
function feed(window, health, animationsEnabled, evidence) {
  window.__msgFn({ data: { type: 'snapshot',
    settings: { theme: 'dark', sidebarSide: 'left', animationsEnabled: animationsEnabled !== false },
    operations: [], events: [], files: [],
    evidence: evidence || { service: '运行中', tcpEstablished: true },
    health } });
}
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
const barCount = doc => doc.querySelectorAll('.infobar').length;
const hostOpen = doc => doc.querySelector('#infobarHost')?.classList.contains('open') || false;
const barClass = doc => doc.querySelector('.infobar')?.className || '';
const barTitle = doc => doc.querySelector('.infobar-text b')?.textContent || '';

(async () => {
  // ---- 1. full lifecycle: ok -> bad -> tick -> morph -> retry -> dismiss -> ok ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    check(!hostOpen(document) && barCount(document) === 0, '1a healthy snapshot shows no bar');
    feed(window, { label: '通道正常', note: 'ok' });
    await sleep(20);
    check(!hostOpen(document) && barCount(document) === 0, '1b second healthy snapshot still shows no bar');
    feed(window, { label: '通道中断', reconnect: true, note: 'bad' });
    await sleep(20);
    check(hostOpen(document) && barCount(document) === 1, '1c disconnect shows exactly one bar');
    check(barClass(document).includes('error'), '1d 通道中断 is the error (red) level');
    check(barTitle(document) === '与云端的连接断开了', '1e error title is plain language');
    check(!!document.querySelector('#infobarInner [data-action="reconnect"]'), '1f retry button present (existing reconnect dispatch)');
    check(!!document.querySelector('#infobarInner [data-action="infobar-dismiss"]'), '1g dismiss button present');
    check(document.querySelector('#infobarElapsed')?.textContent === '0', '1h elapsed seconds start at 0');
    const retryNode = document.querySelector('#infobarInner [data-action="reconnect"]');
    await sleep(1100);
    feed(window, { label: '通道中断', reconnect: true, note: 'bad' });
    await sleep(20);
    check(barCount(document) === 1, '1i repeated bad snapshot does not stack a second bar');
    check(parseInt(document.querySelector('#infobarElapsed')?.textContent || '-1', 10) >= 1, '1j elapsed seconds tick up in place');
    check(document.querySelector('#infobarInner [data-action="reconnect"]') === retryNode, '1k tick does not re-create the retry button');
    feed(window, { label: '疑似假死', reconnect: true, note: 'stale' });
    await sleep(20);
    check(barCount(document) === 1, '1l label change keeps a single bar (no new bar)');
    check(barClass(document).includes('warn'), '1m 疑似假死 morphs the same bar to warning (yellow)');
    check(barTitle(document) === 'Muse 超过 90 秒没有动静', '1n warn title is plain language');
    check(document.querySelector('#infobarElapsed') !== null, '1o elapsed span survives the morph');
    check(document.querySelector('.infobar-text span')?.textContent.includes('已持续'), '1p warn elapsed wording is 已持续 (not 已断开)');
    check(click(window, '#infobarInner [data-action="reconnect"]'), '1q retry button clicked');
    await sleep(20);
    check(!!document.querySelector('.backdrop'), '1r retry opens the connection control modal (same entry as the connection page button)');
    check(click(window, '[data-action="close-modal"]'), '1s modal closed again');
    await sleep(30);
    check(click(window, '#infobarInner [data-action="infobar-dismiss"]'), '1t dismiss button clicked');
    await sleep(20);
    check(!hostOpen(document), '1u dismiss collapses the bar immediately');
    await sleep(250);
    check(barCount(document) === 0, '1v bar content cleared after the 125ms exit');
    feed(window, { label: '通道中断', reconnect: true, note: 'bad' });
    await sleep(20);
    check(!hostOpen(document) && barCount(document) === 0, '1w dismissed round does not pop the bar back on further bad snapshots');
    feed(window, { label: '通道正常', note: 'ok' });
    await sleep(20);
    check(hostOpen(document) && barCount(document) === 1, '1x recovery still shows the success bar once after a dismissed disconnect');
    check(barClass(document).includes('ok') && barTitle(document) === '已重新连接', '1y success bar is green with the reconnected title');
    check(!document.querySelector('#infobarInner [data-action="reconnect"]'), '1z success bar has no retry button');
    await sleep(4500);
    check(!hostOpen(document), '1aa success bar auto-dismisses after ~4s');
    check(errors.length === 0, '1ab no uncaught errors (was: ' + (errors[0] || 'none') + ')');
    window.close();
  }

  // ---- 2. a second round starts fresh after recovery ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, { label: '通道中断', reconnect: true, note: 'bad' });
    await sleep(20);
    check(hostOpen(document), '2a first disconnect shows the bar');
    feed(window, { label: '通道正常', note: 'ok' });
    await sleep(20);
    check(barClass(document).includes('ok'), '2b recovery shows the success bar');
    await sleep(4500);
    check(!hostOpen(document), '2c success bar auto-dismissed');
    feed(window, { label: '疑似假死', reconnect: true, note: 'stale' });
    await sleep(20);
    check(hostOpen(document) && barClass(document).includes('warn'), '2d a second disconnect round shows the warn bar again');
    check(document.querySelector('#infobarElapsed')?.textContent === '0', '2e elapsed seconds restart at 0 for the new round');
    check(errors.length === 0, '2f no uncaught errors (was: ' + (errors[0] || 'none') + ')');
    window.close();
  }

  // ---- 3. animations off: dismiss clears immediately, no 125ms wait ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, { label: '通道正常', note: 'ok' }, false);
    await sleep(20);
    check(document.body.classList.contains('no-anim'), '3a animationsEnabled=false adds body.no-anim');
    feed(window, { label: '通道中断', reconnect: true, note: 'bad' }, false);
    await sleep(20);
    check(hostOpen(document), '3b bar still appears with animations off');
    check(click(window, '#infobarInner [data-action="infobar-dismiss"]'), '3c dismiss clicked');
    check(document.querySelector('#infobarInner')?.innerHTML === '', '3d content cleared immediately with animations off (no 155ms wait)');
    check(!hostOpen(document), '3e host collapses immediately with animations off');
    check(errors.length === 0, '3f no uncaught errors (was: ' + (errors[0] || 'none') + ')');
    window.close();
  }

  // ---- 4. neutral labels never show a bar ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, { label: '状态待确认', note: 'probe failed' }, true, { error: 'probe failed' });
    await sleep(20);
    check(!hostOpen(document) && barCount(document) === 0, '4a 状态待确认 shows no bar (a failed probe is not a disconnect)');
    feed(window, { label: '本机通道正常，Muse 到达待确认', note: 'no heartbeat' });
    await sleep(20);
    check(!hostOpen(document) && barCount(document) === 0, '4b missing heartbeat alone shows no bar');
    check(errors.length === 0, '4c no uncaught errors (was: ' + (errors[0] || 'none') + ')');
    window.close();
  }

  // ---- 5. the bar survives page switches (it lives outside #main) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, { label: '通道中断', reconnect: true, note: 'bad' });
    await sleep(20);
    check(hostOpen(document), '5a bar shows on the muse page');
    check(click(window, '.side-link[data-page="connection"]'), '5b switched to the connection page');
    await sleep(20);
    check(hostOpen(document) && barCount(document) === 1, '5c bar survives the connection-page render (outside #main)');
    check(click(window, '.side-link[data-page="muse"]'), '5d switched back to muse');
    await sleep(20);
    check(hostOpen(document) && barCount(document) === 1, '5e bar survives the switch back');
    feed(window, { label: '通道正常', note: 'ok' });
    await sleep(20);
    check(barClass(document).includes('ok'), '5f recovery morphs the bar on the muse page');
    check(errors.length === 0, '5g no uncaught errors (was: ' + (errors[0] || 'none') + ')');
    window.close();
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail) process.exit(1);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
