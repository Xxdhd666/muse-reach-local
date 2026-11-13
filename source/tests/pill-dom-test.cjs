// v25 DOM test for the sliding selection pill (needs jsdom — NOT a repo dep):
//   cd /tmp/v25-jsdom && npm install jsdom   (once, scratch dir only)
//   node tests/pill-dom-test.cjs              (from the source root)
// jsdom does no layout (all offset* are 0), so the harness installs a small
// fake layout on HTMLElement.prototype BEFORE the shell script runs:
//   expanded : sidebar padding-top 20, brand 59px, items 36px, gap 3px, left 12, width 226
//   collapsed: sidebar padding-top 18, brand 58px, items 48px, gap 3px, left 0,  width 48
// The numbers mirror the CSS (lines 13, 269); the test proves moveSelBar()
// tracks the ACTIVE item (not a fixed one) across switches/collapse/flip,
// that rapid clicks end on the last target, and that the no-anim path is taken
// when animationsEnabled=false. Pixel geometry itself (does 36px match the
// real 150% DPI render) can only be checked on the real machine — see REPORT §06.
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/tmp/v25-jsdom/node_modules/jsdom');

const shellPath = fs.existsSync(path.join(process.cwd(), 'app/shell.html'))
  ? path.join(process.cwd(), 'app/shell.html')
  : '/home/hatch/workspace/laptop-bridge/reach-app/build-v25/source/app/shell.html';
const html = fs.readFileSync(shellPath, 'utf8');
let n = 0, failures = [];
function check(v, name) {
  n++;
  if (v) console.log('PASS ' + name);
  else { console.log('FAIL ' + name); failures.push(name); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const dom = new JSDOM(html, {
  url: 'https://muse.ai/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: new (require('/tmp/v25-jsdom/node_modules/jsdom').VirtualConsole)().on('jsdomError', e => {
    console.log('JSDOM ERROR: ' + (e.detail && e.detail.stack || e.message || e));
    failures.push('jsdomError: ' + (e.message || e));
  }),
  beforeParse(window) {
    // jsdom has no ResizeObserver; the shell constructs one at load.
    window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
    // jsdom has no matchMedia either; the shell reads prefers-reduced-motion.
    window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
    // Capture the snapshot listener the shell registers on chrome.webview,
    // so the test can feed it C# snapshots.
    window.chrome = { webview: {
      postMessage() {},
      addEventListener(type, fn) { window.__msgFn = fn; },
    } };
    // Fake layout for side-links (see header). Everything else stays 0.
    const proto = window.HTMLElement.prototype;
    const geo = el => {
      if (!el.classList || !el.classList.contains('side-link')) return null;
      const sec = el.closest('.side-section');
      if (!sec) return null; // foot controls (collapse/flip) are not page items
      const collapsed = el.ownerDocument.body.classList.contains('sidebar-collapsed');
      const itemH = collapsed ? 48 : 36;
      const links = Array.from(sec.querySelectorAll('.side-link'));
      const idx = links.indexOf(el);
      return {
        top: (collapsed ? 18 + 58 : 20 + 59) + idx * (itemH + 3),
        left: collapsed ? 0 : 12,
        width: collapsed ? 48 : 226,
        height: itemH,
      };
    };
    for (const [prop, key] of [['offsetTop', 'top'], ['offsetLeft', 'left'], ['offsetWidth', 'width'], ['offsetHeight', 'height']]) {
      Object.defineProperty(proto, prop, { get() { const g = geo(this); return g ? g[key] : 0; }, configurable: true });
    }
  },
});

(async () => {
  const { window } = dom;
  const { document } = window;
  await sleep(50); // let the initial render() + timers settle
  const $ = s => document.querySelector(s);
  const pill = () => document.querySelector('#sidebar .sel-pill');
  const active = () => document.querySelector('#sidebar .side-link.active');
  const click = el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

  // --- 0. initial state -------------------------------------------------
  check(!!pill(), 'pill element exists after initial render');
  check(pill().parentNode.id === 'sidebar', 'pill is a direct child of #sidebar');
  check(pill() === document.querySelector('#sidebar').firstChild, 'pill is the first child of #sidebar (paints below the links)');
  check(pill().style.display === '', 'pill is visible on first paint');
  check(pill().style.transition === '', 'first placement leaves no inline transition override');
  check(active().dataset.page === 'muse', 'initial active page is muse');
  check(pill().style.top === '79px', 'pill top equals the muse item geometry (20+59)');
  check(pill().style.left === '12px' && pill().style.width === '226px' && pill().style.height === '36px', 'pill rect equals the muse item rect (expanded)');

  // --- 1. six pages in order: the pill follows the active item ---------
  const pages = ['muse', 'files', 'records', 'connection', 'security', 'settings'];
  for (const p of pages) {
    const btn = document.querySelector(`.side-link[data-page="${p}"]`);
    click(btn);
    await sleep(10);
    const gTop = (20 + 59) + pages.indexOf(p) * (36 + 3);
    check(active().dataset.page === p, `after click, active is ${p}`);
    check(pill().style.top === gTop + 'px', `pill top tracks ${p} (${gTop}px)`);
    check(pill().style.height === '36px', `pill height is 36px on ${p}`);
  }

  // --- 2. rapid clicks: last target wins, no stale position ------------
  click(document.querySelector('.side-link[data-page="muse"]'));
  click(document.querySelector('.side-link[data-page="files"]'));
  click(document.querySelector('.side-link[data-page="records"]'));
  await sleep(10);
  check(active().dataset.page === 'records', 'rapid clicks end on records');
  check(pill().style.top === (20 + 59 + 2 * 39) + 'px', 'pill ends on the records item, not an intermediate one');
  check(document.querySelectorAll('#sidebar .side-link.active').length === 1, 'exactly one active link after rapid clicks');
  await sleep(300); // the 250ms re-sync must not move it away
  check(pill().style.top === (20 + 59 + 2 * 39) + 'px', '250ms re-sync keeps the pill on records');

  // --- 3. collapsed 48px rail -------------------------------------------
  click(document.querySelector('.collapse-control'));
  await sleep(10);
  check(document.body.classList.contains('sidebar-collapsed'), 'collapse control collapses the sidebar');
  check(pill().style.height === '48px', 'pill height becomes 48px on the collapsed rail');
  check(pill().style.left === '0px' && pill().style.width === '48px', 'pill spans the 48px rail');
  await sleep(300); // re-sync after the 250ms collapse transition
  check(pill().style.top === (18 + 58 + 2 * 51) + 'px', 'pill top re-syncs to the collapsed records geometry');
  // switch page while collapsed
  click(document.querySelector('.side-link[data-page="settings"]'));
  await sleep(10);
  check(pill().style.top === (18 + 58 + 5 * 51) + 'px', 'pill slides on the collapsed rail (settings)');
  // expand again
  click(document.querySelector('.collapse-control'));
  await sleep(300);
  check(!document.body.classList.contains('sidebar-collapsed'), 'expand restores the sidebar');
  check(pill().style.top === (20 + 59 + 5 * 39) + 'px' && pill().style.height === '36px', 'pill returns to the expanded settings geometry');

  // --- 4. side swap keeps the selection ---------------------------------
  click(document.querySelector('.flip-control'));
  await sleep(10);
  check(document.body.classList.contains('side-right'), 'flip moves the sidebar right');
  check(active().dataset.page === 'settings', 'flip keeps the selected page');
  check(pill().style.top === (20 + 59 + 5 * 39) + 'px', 'flip keeps the pill on settings');
  click(document.querySelector('.flip-control'));
  await sleep(10);
  check(!document.body.classList.contains('side-right'), 'flip back moves the sidebar left');

  // --- 5. animationsEnabled=false: no-anim class, pill still tracks -----
  window.__msgFn({ data: {
    type: 'snapshot',
    settings: { theme: 'dark', sidebarSide: 'left', animationsEnabled: false },
    operations: [], events: [], files: [], evidence: {}, health: { label: 'ok', note: '' },
  } });
  await sleep(10);
  check(document.body.classList.contains('no-anim'), 'snapshot with animationsEnabled=false adds body.no-anim');
  click(document.querySelector('.side-link[data-page="muse"]'));
  await sleep(10);
  check(active().dataset.page === 'muse', 'page switch still works with animations off');
  check(pill().style.top === '79px', 'pill still repositions with animations off (jump, transition killed by the no-anim CSS rule)');
  // animations back on
  window.__msgFn({ data: {
    type: 'snapshot',
    settings: { theme: 'dark', sidebarSide: 'left', animationsEnabled: true },
    operations: [], events: [], files: [], evidence: {}, health: { label: 'ok', note: '' },
  } });
  await sleep(10);
  check(!document.body.classList.contains('no-anim'), 'snapshot with animationsEnabled=true removes body.no-anim');

  // --- 6. no active item hides the pill (defensive) ----------------------
  // (not reachable through the UI — every page has a link — but the guard
  // must not throw if a snapshot ever rebuilds with no active link)
  document.querySelectorAll('#sidebar .side-link.active').forEach(el => el.classList.remove('active'));
  // force a nav() rebuild by toggling collapse twice via clicks
  click(document.querySelector('.collapse-control'));
  await sleep(300);
  // nav() rebuilds from state.page, so the active class comes back; the pill
  // must simply not throw and must be back on the current page.
  check(!!pill(), 'pill survives a collapse toggle with a transiently missing active class');
  check(active().dataset.page === 'muse', 'active class is restored by the nav() rebuild');
  check(pill().style.display === '', 'pill is visible again once an active item exists');

  window.close();
  console.log(`\n${n - failures.length}/${n} passed`);
  if (failures.length) { console.log('FAILURES:', failures.join(', ')); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
