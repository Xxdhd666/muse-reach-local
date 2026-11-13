// Row-height test (v29): list rows converge to ~70px.
// jsdom has NO layout engine: offsetHeight is 0 and cannot be measured here.
// What this test really proves, on the live DOM, is the computed padding /
// font sizes that determine the row height; the height itself is derived by
// arithmetic in tests/ui-v29-checks.cjs and must be eyeballed on the real
// machine. Usage: node tests/row-height-test.cjs [path/to/app/shell.html]
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

function makeDom() {
  const errors = [];
  const sent = [];
  const dom = new JSDOM(html, {
    url: 'https://muse.ai/', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
      .on('jsdomError', e => errors.push(e.detail && e.detail.stack || String(e))),
    beforeParse(window) {
      window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      window.chrome = { webview: { postMessage(m) { try { sent.push(JSON.parse(m)); } catch (_) { sent.push(m); } }, addEventListener(t, fn) { window.__msgFn = fn; } } };
    },
  });
  return { dom, errors, sent };
}
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
const SETTINGS = {
  theme: 'obsidian', sidebarSide: 'left', sidebarCollapsed: false,
  animationsEnabled: true, minimizeToTray: true, startWithWindows: false,
  hotkeyEnabled: true, webZoom: 1, recentChangesCollapsed: true,
  recentFilesCollapsed: false, museStartUrl: 'https://muse.ai/thread/pin',
};
function feed(window, extra) {
  window.__msgFn({ data: { type: 'snapshot',
    settings: SETTINGS,
    operations: [{ id: 'op1', kind: 'exec', summary: '测试操作', result: 'success', ts: new Date().toISOString(), files: [], cmd: 'echo hi' }],
    events: [{ id: 'ev1', kind: 'info', summary: '程序事件', result: 'success', ts: new Date().toISOString(), category: 'program' }],
    files: [{ name: '报告.md', kind: 'file-create', state: '在', directory: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop', ts: new Date().toISOString(), path: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop\\报告.md' }],
    watch: [{ path: 'C:\\Users\\YOUR_WINDOWS_USER\\Desktop\\报告.md', change: 'modified', ts: new Date().toISOString() }],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false }, ...extra } });
}
function cs(window, el, prop) { return window.getComputedStyle(el).getPropertyValue(prop); }

(async () => {
  // ---- 1. execution-log rows (opRow + programRow share .log-main) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    check(click(window, '[data-page="records"]'), 'go to records page');
    const rows = document.querySelectorAll('.log-main');
    check(rows.length === 2, '2 log rows rendered (1 op + 1 program event), got ' + rows.length);
    const r = rows[0];
    check(cs(window, r, 'padding-top') === '8px' && cs(window, r, 'padding-bottom') === '8px', 'log row vertical padding is 8px (was 15px)');
    check(cs(window, r, 'padding-left') === '16px' && cs(window, r, 'padding-right') === '16px', 'log row horizontal padding is 16px (was 17px)');
    check(cs(window, r, 'column-gap') === '12px' || cs(window, r, 'gap') === '12px', 'log row gap is 12px (was 13px)');
    const desc = r.querySelector('.log-desc');
    check(cs(window, desc, 'margin-top') === '0px' && cs(window, desc, 'margin-bottom') === '0px', 'log desc margin is 0 (was 4px 0)');
    check(cs(window, desc, 'font-size') === '11px', 'log desc is 11px');
    const name = r.querySelector('.log-name .log-summary');
    check(cs(window, name, 'font-size') === '11.5px', 'op/program name span is 11.5px (v30: .log-summary sets it, was 13px inherited)');
    const time = r.querySelector('.log-time');
    check(cs(window, time, 'font-size') === '10px', 'log time is 10px');
    const tag = r.querySelector('.tag');
    check(cs(window, tag, 'padding-top') === '0px' && cs(window, tag, 'padding-bottom') === '0px', 'tag vertical padding is 0 (was 2px) — tag cannot stretch the row');
    check(cs(window, tag, 'padding-left') === '8px' && cs(window, tag, 'padding-right') === '8px', 'tag horizontal padding is 8px (was 7px)');
    const tagIcon = r.querySelector('.tag svg');
    check(tagIcon !== null && cs(window, tagIcon, 'width') === '16px' && cs(window, tagIcon, 'height') === '16px', 'tag icon is 16px (v30; tag height still set by its 10px text, row unchanged)');
    const glyph = r.querySelector('.log-glyph');
    check(cs(window, glyph, 'height') === '28px', 'glyph stays 28px, fits inside the ~70px row');
    check(errors.length === 0, 'no page errors on records render: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 2. work-files rows + recent-changes rows (same .log-main) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    check(click(window, '[data-page="files"]'), 'go to files page');
    const rows = document.querySelectorAll('.log-main');
    check(rows.length >= 2, 'files + recent-changes rows rendered, got ' + rows.length);
    const r = rows[0];
    check(cs(window, r, 'padding-top') === '8px' && cs(window, r, 'padding-bottom') === '8px', 'file row vertical padding is 8px');
    check(cs(window, r, 'padding-left') === '16px', 'file row horizontal padding is 16px');
    const fileName = r.querySelector('.log-name b');
    check(fileName !== null && cs(window, fileName, 'font-size') === '11.5px', 'file row name <b> is 11.5px (now equal to op/program span — the 2.5px row-height spread is closed)');
    check(errors.length === 0, 'no page errors on files render: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 3. connection state rows ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    check(click(window, '[data-page="connection"]'), 'go to connection page');
    const rows = document.querySelectorAll('.state-row');
    check(rows.length === 3, '3 state rows rendered, got ' + rows.length);
    const r = rows[0];
    check(cs(window, r, 'padding-top') === '16px' && cs(window, r, 'padding-bottom') === '16px', 'state row vertical padding is 16px (was 13px)');
    check(cs(window, r, 'padding-left') === '0px' && cs(window, r, 'padding-right') === '0px', 'state row horizontal padding stays 0');
    check(cs(window, r, 'column-gap') === '12px' || cs(window, r, 'gap') === '12px', 'state row gap stays 12px');
    const b = r.querySelector('.state-body b');
    check(cs(window, b, 'font-size') === '12px', 'state row title is 12px');
    const span = r.querySelector('.state-body span');
    check(cs(window, span, 'font-size') === '11px', 'state row note is 11px');
    check(errors.length === 0, 'no page errors on connection render: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 4. page gutters + 570px narrow-window rules (CSS only: jsdom has no layout) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, {});
    click(window, '[data-page="records"]');
    const col = document.querySelector('.page-column');
    check(cs(window, col, 'padding-top') === '24px' && cs(window, col, 'padding-bottom') === '24px', 'page column padding is 24px 0 24px (was 45px 0 70px)');
    // Narrow window: jsdom cannot lay out at 570px, so assert the rules that
    // keep the page from breaking there instead of a fake measurement.
    check(html.includes('.set-card{display:flex;flex-wrap:wrap;'), 'settings cards wrap at narrow widths');
    check(html.includes('.set-card-text{flex:1;min-width:0}'), 'settings card text can shrink (min-width:0)');
    check(html.includes('.swatches{display:flex;flex-wrap:wrap;gap:8px}'), 'swatch row wraps at narrow widths');
    check(html.includes('@media(max-width:560px){.topbar{padding:0 12px}'), '560px breakpoint topbar padding is 12px (on-grid)');
    check(html.includes('.page-column{width:calc(100% - 32px)}'), '800px breakpoint page gutter is 32px per side (was 35px)');
    check(html.includes('.chat-column,.compose-column{width:calc(100% - 32px)}'), '800px breakpoint chat/composer gutter is 32px per side (already on-grid in v28, untouched; 1050px was 52px, now 48px)');
    check(errors.length === 0, 'no page errors: ' + errors.join(' | ').slice(0, 200));
  }

  console.log(fail === 0 ? 'ROW-HEIGHT TESTS PASSED (' + pass + ' checks)' : 'ROW-HEIGHT TESTS FAILED: ' + fail + ' failed, ' + pass + ' passed');
  process.exit(fail === 0 ? 0 : 1);
})();
