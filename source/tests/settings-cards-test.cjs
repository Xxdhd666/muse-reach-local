// Settings-cards test (v28): the Settings page is one Win11-style card per
// setting — 14px title + 12px description, control on the right; theme is
// visual swatches; the four settings that used to live only on the sidebar /
// files page get cards too. Every card echoes the snapshot value and sends
// the same setting key C# already handles.
// Usage: node tests/settings-cards-test.cjs [path/to/app/shell.html]
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
function feed(window, settings) {
  window.__msgFn({ data: { type: 'snapshot',
    settings,
    operations: [], events: [], files: [],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false } } });
}
const SETTINGS = {
  theme: 'obsidian', sidebarSide: 'left', sidebarCollapsed: false,
  animationsEnabled: true, minimizeToTray: true, startWithWindows: false,
  hotkeyEnabled: true, webZoom: 1, recentChangesCollapsed: true,
  recentFilesCollapsed: false, museStartUrl: 'https://muse.ai/thread/pin',
};
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
function goSettings(window) {
  return click(window, '[data-page="settings"]');
}
const sentHas = (sent, key, value) => sent.some(m => m.type === 'setting' && m.key === key && m.value === value);

(async () => {
  // ---- 1. card inventory + echo of the snapshot values ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    check(goSettings(window), 'go to settings page');
    const cards = document.querySelectorAll('.set-card');
    check(cards.length === 10, '10 set-cards (one per setting), got ' + cards.length);
    check(document.querySelectorAll('.set-card').length + document.querySelectorAll('.card.panel-pad').length === 11, '10 set-cards + the save-start action card = 11 cards on the page');
    const titles = [...document.querySelectorAll('.set-card-text b')].map(b => b.textContent);
    check(JSON.stringify(titles) === JSON.stringify(['界面主题', '侧栏位置', '收起侧栏', '关闭或最小化时收进托盘', '登录 Windows 后打开 Reach', '全局热键', '界面动效', '网页缩放', '最近变化默认收起', '最近文件默认收起']), 'card titles in order: ' + titles.join(' / '));
    check(document.querySelector('.set-card-text small')?.textContent.includes('点一下色板就换'), 'theme card has a plain-language description');
    check([...document.querySelectorAll('.set-card-text small')].some(s => s.textContent.includes('全局热键 Ctrl+Alt+Space（随时呼出）')), 'hotkey description names the global hotkey verbatim');
    const toggles = [...document.querySelectorAll('.set-card .toggle')];
    check(toggles.length === 7, '7 toggle cards');
    const toggleState = k => document.querySelector(`.toggle[data-key="${k}"]`)?.classList.contains('on');
    check(toggleState('sidebarCollapsed') === false, 'sidebarCollapsed echoes false');
    check(toggleState('minimizeToTray') === true, 'minimizeToTray echoes true');
    check(toggleState('startWithWindows') === false, 'startWithWindows echoes false');
    check(toggleState('hotkeyEnabled') === true, 'hotkeyEnabled echoes true');
    check(toggleState('animationsEnabled') === true, 'animationsEnabled echoes true');
    check(toggleState('recentChangesCollapsed') === true, 'recentChangesCollapsed echoes true');
    check(toggleState('recentFilesCollapsed') === false, 'recentFilesCollapsed echoes false');
    check(document.querySelector('#webZoom')?.value === '1', 'webZoom select echoes 100%');
    check(document.querySelector('[data-action="save-start"]') !== null, 'save-start action card present');
    check(errors.length === 0, 'no page errors on render: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 2. theme swatches: 9, selected marked by shape AND color ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    const swatches = [...document.querySelectorAll('.swatch')];
    check(swatches.length === 9, '9 theme swatches');
    check(JSON.stringify(swatches.map(s => s.dataset.value)) === JSON.stringify(['dark', 'midnight', 'light', 'pink', 'purple', 'ocean', 'forest', 'amber', 'obsidian']), 'swatch values match SetTheme');
    const selected = swatches.filter(s => s.getAttribute('aria-pressed') === 'true');
    check(selected.length === 1 && selected[0].dataset.value === 'obsidian', 'exactly one swatch selected: obsidian');
    check(selected[0].querySelector('.swatch-check') !== null, 'selected swatch carries the check badge (shape marker)');
    check(swatches.filter(s => s.getAttribute('aria-pressed') === 'false').every(s => !s.querySelector('.swatch-check')), 'unselected swatches carry no check badge');
    check(swatches.every(s => s.getAttribute('aria-label') && s.getAttribute('aria-label').startsWith('主题：')), 'every swatch names its theme for screen readers / hover');
    check(errors.length === 0, 'no page errors on swatch render');
  }

  // ---- 3. every card sends the same key C# already handles ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    sent.length = 0;
    check(click(window, '.swatch[data-value="ocean"]'), 'click ocean swatch');
    check(sentHas(sent, 'theme', 'ocean'), 'swatch sends setting theme=ocean');
    check(click(window, '[data-action="side"][data-value="right"]'), 'click sidebar-side right');
    check(sentHas(sent, 'sidebarSide', 'right'), 'side control sends setting sidebarSide=right');
    check(click(window, '.toggle[data-key="recentChangesCollapsed"]'), 'click recent-changes toggle');
    check(sentHas(sent, 'recentChangesCollapsed', false), 'toggle sends recentChangesCollapsed=false');
    check(click(window, '.toggle[data-key="hotkeyEnabled"]'), 'click hotkey toggle');
    check(sentHas(sent, 'hotkeyEnabled', false), 'toggle sends hotkeyEnabled=false');
    check(click(window, '.toggle[data-key="sidebarCollapsed"]'), 'click sidebar-collapse toggle');
    check(sentHas(sent, 'sidebarCollapsed', true), 'toggle sends sidebarCollapsed=true');
    const zoom = document.querySelector('#webZoom');
    zoom.value = '1.1';
    zoom.dispatchEvent(new window.Event('change', { bubbles: true }));
    check(sentHas(sent, 'webZoom', 1.1), 'zoom select sends webZoom=1.1');
    check(errors.length === 0, 'no page errors on card interaction: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 4. echo round-trip: a new snapshot re-renders the new values ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    feed(window, { ...SETTINGS, theme: 'ocean', sidebarSide: 'right', recentFilesCollapsed: true });
    const selected = [...document.querySelectorAll('.swatch')].filter(s => s.getAttribute('aria-pressed') === 'true');
    check(selected.length === 1 && selected[0].dataset.value === 'ocean', 'after snapshot, ocean swatch is selected');
    check(document.querySelector('.toggle[data-key="recentFilesCollapsed"]')?.classList.contains('on') === true, 'after snapshot, recent-files toggle echoes true');
    check(document.querySelector('[data-action="side"][data-value="right"]')?.classList.contains('selected') === true, 'after snapshot, sidebar-side right is selected');
    check(errors.length === 0, 'no page errors on re-render');
  }

  // ---- 5. narrow-width safety is structural (jsdom has no layout) ----
  {
    const css = html;
    check(css.includes('.set-card{display:flex;flex-wrap:wrap;'), 'card row wraps instead of clipping');
    check(css.includes('.swatches{display:flex;flex-wrap:wrap;'), 'swatch row wraps to the available width');
    check(css.includes('.set-card-stack{flex-direction:column;'), 'theme card stacks text over swatches');
    check(css.includes('.set-card-text{flex:1;min-width:0}'), 'card text can shrink and wrap');
    check(css.includes('.set-card-text small{') && css.includes('overflow-wrap:anywhere'), 'card description wraps anywhere');
  }

  console.log(`\nTOTAL pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
