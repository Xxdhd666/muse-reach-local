// v33 static + DOM checks: narrow-window auto-collapse (Fluent NavigationView
// Auto mode). C# measures the window's logical width and posts an edge-triggered
// auto-collapse message; the shell only renders it. Auto-collapse never writes
// settings.json; a manual expand while narrow is a session-only override
// (narrowOverride) that clears when the window widens or auto-collapse changes.
// The runnable threshold/hysteresis check is the baseline C# test
// (SidebarAutoCollapse boundary walk; baseline 34 -> 46). Wall-clock behaviour
// (real drag-resize on the laptop, stopwatch-free visual check) must be verified
// on the real machine, see REPORT.md §06.
// Run with TZ=Asia/Shanghai: node tests/ui-v33-checks.cjs
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v26-jsdom first, then /tmp/v25-jsdom) or a plain require('jsdom').
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const appSettings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const auto = fs.readFileSync(__dirname + '/../app/SidebarAutoCollapse.cs', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A. auto-collapse logic (SidebarAutoCollapse.cs, pure, no WinForms) ----------
check(auto.includes('public const int CollapseBelowWidth = 1008;'), 'collapse threshold is 1008 logical px');
check(auto.includes('public const int RestoreAboveWidth = 1024;'), 'restore threshold is 1024 logical px (16px hysteresis)');
check(auto.includes('public static bool Next(bool autoCollapsed, int logicalWidth)'), 'Next(autoCollapsed, logicalWidth) is the single auto-collapse decision point');
check(auto.includes('if (autoCollapsed) return logicalWidth <= RestoreAboveWidth;'), 'collapsed: restore only above 1024 (inside the band it stays collapsed)');
check(auto.includes('return logicalWidth < CollapseBelowWidth;'), 'expanded: collapse below 1008');
check(!auto.includes('System.Windows.Forms'), 'auto-collapse logic has no WinForms dependency (baseline-testable)');
check(!auto.includes('167') && !auto.includes('83') && !auto.includes('250'), 'thresholds are layout numbers, not MotionTokens values');

// ---------- B. MainForm wiring: C# measures, posts on change only ----------
check(main.includes('private bool _autoCollapsed;'), '_autoCollapsed field exists (memory only, never saved)');
check(main.includes('Resize += (s, e) => UpdateAutoCollapse();'), 'Resize re-evaluates auto-collapse');
check(main.includes('private void UpdateAutoCollapse(bool force=false){'), 'UpdateAutoCollapse(force) exists');
check(main.includes('if(WindowState==FormWindowState.Minimized)return;'), 'minimized window is not measured (size untrustworthy while minimized)');
check(main.includes('bool next=SidebarAutoCollapse.Next(_autoCollapsed,ClientSize.Width);'), 'width is ClientSize.Width (logical px, same unit as the v20 clamp)');
check(main.includes('if(!force&&next==_autoCollapsed)return;'), 'no message when the state did not change (one message per threshold crossing while dragging)');
check(main.includes('PostToShell(new{type="auto-collapse",collapsed=_autoCollapsed});'), 'state change posts an auto-collapse message to the shell');
check(main.includes('if(type=="ready"){UpdateAutoCollapse(true);await PollAsync();await SwitchWebAsync(true);return;}'), 'ready forces one auto-collapse sync (shell initial state after reload)');
check(main.includes('autoCollapsed=_autoCollapsed,'), 'snapshot carries autoCollapsed (shell re-syncs on every poll)');
check(main.includes('Text = "Muse Reach v33"'), 'window title is v33');
check(main.includes('Text="Muse Reach v33"'), 'tray text is v33');
check(!main.includes('Muse Reach v32'), 'no v32 version string left in MainForm');
check(proj.includes('<Version>0.33.0</Version>'), 'project version is 0.33.0');
check(!proj.includes('0.32.0'), 'no 0.32.0 left in the project file');
check(!appSettings.includes('v33') && !appSettings.includes('v32'), 'AppSettings.cs carries no version string (settings untouched)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');

// ---------- C. shell wiring: render only, never persist auto state ----------
check(shell.includes('let autoCollapsed=false;'), 'autoCollapsed declared false (session only)');
check(shell.includes('let narrowOverride=false;'), 'narrowOverride declared false (session only)');
check(shell.includes('function effectiveCollapsed(){return (state.data.settings?.sidebarCollapsed===true||autoCollapsed)&&!narrowOverride;}'), 'effectiveCollapsed: manual OR auto, override wins');
check(count(shell, /effectiveCollapsed\(\)/g) === 7, 'effectiveCollapsed is called in exactly 7 places (nav class + nav title + nav aria-label + toggleCollapse x2 + page click + definition)');
check(shell.includes("document.body.classList.toggle('sidebar-collapsed',effectiveCollapsed());"), 'nav() renders the effective collapsed state, not the raw setting');
check(count(shell, /effectiveCollapsed\(\)\?'展开侧栏':'收起侧栏'/g) === 2, 'collapse control title + aria-label follow the effective state');
check(shell.includes('function setAutoCollapsed(v){'), 'setAutoCollapsed(v) exists');
check(shell.includes('if(v===autoCollapsed)return;'), 'setAutoCollapsed is a no-op when unchanged (repeat messages never re-animate)');
check(shell.includes('autoCollapsed=v;narrowOverride=false;'), 'a real auto-collapse change clears the manual override');
check(shell.includes("animBegin('collapse',MOTION.normal);nav();\n}\n// v22:"), 'setAutoCollapsed animates (collapse token) and re-renders');
check(shell.includes('if(effectiveCollapsed()&&autoCollapsed)narrowOverride=true;'), 'toggleCollapse while auto-collapsed: temporary expand (override, no settings write)');
check(shell.includes("else if(effectiveCollapsed()){s.sidebarCollapsed=false;send({type:'setting',key:'sidebarCollapsed',value:false});}"), 'toggleCollapse while manually collapsed: clears the manual setting and persists');
check(shell.includes('else if(narrowOverride)narrowOverride=false;'), 'toggleCollapse while override-expanded: clears the override (back to auto-collapsed)');
check(shell.includes("else{s.sidebarCollapsed=true;send({type:'setting',key:'sidebarCollapsed',value:true});}"), 'toggleCollapse while manually expanded: sets the manual setting and persists');
check(shell.includes("if(a==='page'){const p=b.dataset.page;if(p===state.page){if(effectiveCollapsed())toggleCollapse();}else go(p);}"), 'current-page click toggles on the effective collapsed state (v22 behaviour in auto-collapse too)');
check(shell.includes("if(k==='sidebarCollapsed'&&autoCollapsed){narrowOverride=!v;nav();}"), 'settings toggle while narrow takes effect immediately (off = temporary expand, on = clear override)');
check(shell.includes("if(typeof d.autoCollapsed==='boolean')setAutoCollapsed(d.autoCollapsed);"), 'snapshot re-syncs autoCollapsed (shell reload recovery)');
check(shell.includes("else if(d.type==='auto-collapse')setAutoCollapsed(!!d.collapsed);"), 'auto-collapse message branch applies the C# state');
check(!shell.includes("key:'autoCollapsed'") && !shell.includes('key:"autoCollapsed"'), 'autoCollapsed is never sent as a setting (auto state is never persisted)');
check(count(shell, /key:'sidebarCollapsed'/g) === 2, 'sidebarCollapsed is persisted from exactly 2 places (toggleCollapse manual branches); the generic toggle handler uses the key variable');
check(count(shell, /sidebarCollapsed=(true|false);/g) === 2, 'the manual setting is assigned in exactly 2 places (toggleCollapse expand/collapse branches); the generic toggle handler only sends the key');

// ---------- D. regression audits: v21/v24/v25/v26/v27/v28/v29/v30/v31/v32 pinned ----------
// Icons: 35 sizing declarations, 28x16 / 2x20 / 2x24, 3 off-tier exceptions.
const sizing = [];
for (const m of shell.matchAll(/([^\n{}]*?)\bsvg\s*\{([^}]*)\}/g)) {
  const body = m[2];
  const w = body.match(/width\s*:\s*([\d.]+)px/);
  const h = body.match(/height\s*:\s*([\d.]+)px/);
  if (w || h) sizing.push({ sel: m[1].trim().slice(-70), w: w ? parseFloat(w[1]) : null, h: h ? parseFloat(h[1]) : null });
}
check(sizing.length === 35, '35 svg sizing declarations audited (got ' + sizing.length + ')');
const tier = s => s.w === 16 ? '16' : s.w === 20 ? '20' : s.w === 24 ? '24' : 'off';
const byTier = { '16': 0, '20': 0, '24': 0, off: [] };
for (const s of sizing) { if (tier(s) === 'off') byTier.off.push(s); else byTier[tier(s)]++; }
check(byTier['16'] === 28 && byTier['20'] === 2 && byTier['24'] === 2 && byTier.off.length === 3, 'icons still 28x16 / 2x20 / 2x24 with 3 off-tier exceptions');
check(count(shell, /stroke-width="1\.7"/g) === 0, 'no stroke-width 1.7 left in shell.html');
check(count(shell, /stroke-width="2"/g) === 2, 'stroke-width 2 appears exactly twice');
check(shell.includes('.log-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;font-size:11.5px}'), '.log-summary still 11.5px');
check(count(shell, /font-size:11\.5px/g) === 20, 'font-size 11.5px appears 20 times (unchanged)');
const GRID = new Set([0, 4, 8, 12, 16, 24]);
let declCount = 0; const offGrid = []; const fortySites = [];
shell.split('\n').forEach((line) => {
  for (const m of line.matchAll(/(padding|margin|gap|row-gap|column-gap)(?:-(top|right|bottom|left))?\s*:\s*([^;{}]+)/g)) {
    declCount++;
    const val = m[3].trim();
    for (const num of val.match(/(-?\d+(?:\.\d+)?)px/g) || []) {
      const v = Math.abs(parseFloat(num));
      if (!GRID.has(v)) {
        if (v === 40) fortySites.push(val);
        else offGrid.push(val);
      }
    }
  }
});
check(declCount === 224, '224 spacing declarations on the 4px grid, got ' + declCount);
check(offGrid.length === 0, 'no spacing value outside {0,4,8,12,16,24} except the 40px exceptions');
check(fortySites.length === 5, 'exactly 5 off-grid spacing sites, all 40px (v29 exceptions untouched)');
check(count(shell, /border-radius:8px[;}]/g) === 50, '50 plain 8px radii (v24 scale otherwise untouched)');
check(count(shell, /border-radius:4px[;}]/g) === 7, '7 plain 4px radii (v24 scale untouched)');
check(!shell.includes('border-radius:12px') && !shell.includes('border-radius:16px') && !shell.includes('border-radius:6px'), 'no old numeric radius back');
check(tokens.includes('public const int ControlFasterMs = 83;') && tokens.includes('public const int ControlFastMs = 167;') && tokens.includes('public const int ControlNormalMs = 250;'), 'MotionTokens 83/167/250 untouched');
check(tokens.includes('public const int ControlFasterExitMs = 62;') && tokens.includes('public const int ControlFastExitMs = 125;') && tokens.includes('public const int ControlNormalExitMs = 188;'), 'MotionTokens exit 62/125/188 untouched');
check(shell.includes('selPill'), 'v25 selection pill untouched');
check(shell.includes('window.MOTION=MOTION;'), 'v26 MOTION sharing untouched');
check(shell.includes('infobarSync();'), 'v27 infobar wiring untouched');
check(shell.includes('.swatch{position:relative;width:44px;height:32px;'), 'v28 theme swatches stay 44x32');
check(shell.includes('width:250px;flex:0 0 250px') && shell.includes('width:48px;flex-basis:48px'), 'sidebar widths 250px / 48px unchanged');
check(shell.includes('let dataLoaded=false;') && count(shell, /!dataLoaded/g) === 4, 'v31 dataLoaded latch + 4 loading guards untouched');
check(count(shell, /stateError\(/g) === 3, 'v31 stateError: 2 calls + definition, untouched');
check(count(shell, /skel-row shimmer/g) === 4, 'v31 skeleton still 4 shimmer rows');
check(count(shell, /muse\.ai/g) === 1, 'muse.ai appears exactly once in shell.html');
check(!shell.includes('muse.ai/script') && !shell.includes('src="https://muse.ai') && !shell.includes("src='https://muse.ai"), 'no script loaded from muse.ai');
check(!shell.includes("document.createElement('script')") && !shell.includes('document.createElement("script")'), 'no script element created at runtime');
// v32: tiered loading states (native WinForms overlay; no DOM here, pin the wiring).
const tiers = fs.readFileSync(__dirname + '/../app/WebLoadingTiers.cs', 'utf8');
const overlay = fs.readFileSync(__dirname + '/../app/WebLoadingOverlay.cs', 'utf8');
check(tiers.includes('public const int SpinnerAfterMs = 1000;') && tiers.includes('public const int ProgressAfterMs = 3000;') && tiers.includes('public const int WatchdogMs = 60000;'), 'v32 tier thresholds 1000/3000/60000 untouched');
check(overlay.includes('正在打开 Muse 对话，稍等一下') && overlay.includes('Muse 对话暂时打不开'), 'v32 loading/error copy untouched');
check(main.includes('_web.CoreWebView2.NavigationStarting+=OnWebNavigationStarting;') && main.includes('_web.CoreWebView2.NavigationCompleted+=OnWebNavigationCompleted;'), 'v32 navigation hooks untouched');
check(main.includes('Muse 网页首次加载完成'), 'v32 first-load log line untouched');

console.log('STATIC TOTAL ' + n + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);

// ---------- E. jsdom DOM checks: auto-collapse, really rendered ----------
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const doms = [];
function makeDom() {
  const errors = []; const sent = [];
  const dom = new JSDOM(html, {
    url: 'https://muse.ai/', runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: new VirtualConsole()
      .on('jsdomError', e => errors.push(e.detail && e.detail.stack || String(e))),
    beforeParse(window) {
      window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
      window.matchMedia = q => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      window.chrome = { webview: { postMessage(m) { try { sent.push(JSON.parse(m)); } catch (_) { sent.push(m); } }, addEventListener(t, fn) { window.__msgFn = fn; } } };
      // Fake layout for side-links (copied from pill-dom-test.cjs): jsdom does
      // no layout, so offset* is stubbed from the CSS geometry. Expanded:
      // sidebar padding-top 20, brand 59px, items 36px, gap 3px, left 12,
      // width 226. Collapsed: padding-top 18, brand 58px, items 48px,
      // gap 3px, left 0, width 48.
      const proto = window.HTMLElement.prototype;
      const geo = el => {
        if (!el.classList || !el.classList.contains('side-link')) return null;
        const sec = el.closest('.side-section');
        if (!sec) return null;
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
  doms.push(dom);
  return { dom, errors, sent };
}
const SETTINGS = {
  theme: 'obsidian', sidebarSide: 'left', sidebarCollapsed: false,
  animationsEnabled: true, minimizeToTray: true, startWithWindows: false,
  hotkeyEnabled: true, webZoom: 1, recentChangesCollapsed: true,
  recentFilesCollapsed: false, museStartUrl: 'https://muse.ai/thread/pin',
};
function feed(window, extra) {
  window.__msgFn({ data: { type: 'snapshot',
    settings: { ...SETTINGS, ...(extra && extra.settings ? extra.settings : {}) },
    operations: [], events: [], files: [], watch: [],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false },
    ...(extra && extra.autoCollapsed !== undefined ? { autoCollapsed: extra.autoCollapsed } : {}),
  } });
}
function autoMsg(window, collapsed) { window.__msgFn({ data: { type: 'auto-collapse', collapsed } }); }
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}
const settingSends = (sent, key) => sent.filter(m => m && m.type === 'setting' && (!key || m.key === key));
const animStarts = sent => sent.filter(m => m && m.type === 'anim-start');

(async () => {
  // ---- 1. wide start: expanded, pill on the muse item --------------------
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, {});
    await sleep(20);
    check(!document.body.classList.contains('sidebar-collapsed'), 'wide start: sidebar expanded');
    check(document.querySelector('#sidebar .sel-pill').style.height === '36px', 'wide start: pill is 36px tall on the expanded rail');
    check(errors.length === 0, 'wide start: zero page errors');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'wide start: no sidebarCollapsed setting sent');
    sent.length = 0;

    // ---- 2. auto-collapse message: rail, pill, no settings write ---------
    autoMsg(window, true);
    await sleep(400); // animBegin timer is 250+80ms; let anim-end land first
    check(document.body.classList.contains('sidebar-collapsed'), 'auto-collapse: body gets sidebar-collapsed');
    check(document.querySelector('#sidebar .sel-pill').style.height === '48px', 'auto-collapse: pill becomes 48px on the collapsed rail');
    check(document.querySelector('#sidebar .sel-pill').style.left === '0px' && document.querySelector('#sidebar .sel-pill').style.width === '48px', 'auto-collapse: pill spans the 48px rail');
    check(document.querySelector('.collapse-control').getAttribute('title') === '展开侧栏', 'auto-collapse: collapse control now offers to expand');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'auto-collapse: no sidebarCollapsed setting sent (manual preference untouched)');
    check(animStarts(sent).length === 1, 'auto-collapse: exactly one anim-start (edge-triggered)');

    // ---- 3. repeat message: idempotent, no second animation --------------
    sent.length = 0;
    autoMsg(window, true);
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'repeat auto-collapse: still collapsed');
    check(animStarts(sent).length === 0, 'repeat auto-collapse: no second anim-start');

    // ---- 4. widen: restore ------------------------------------------------
    sent.length = 0;
    autoMsg(window, false);
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'widen: sidebar expands again');
    check(document.querySelector('#sidebar .sel-pill').style.height === '36px', 'widen: pill back to 36px');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'widen: no sidebarCollapsed setting sent');
  }

  // ---- 5. click current page while auto-collapsed = temporary expand -----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, {});
    await sleep(20);
    autoMsg(window, true);
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'setup: auto-collapsed before the click');
    sent.length = 0;
    click(window, '.side-link[data-page="muse"]'); // current page, collapsed rail
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'click current page while auto-collapsed: sidebar expands (v22 behaviour)');
    check(document.querySelector('#sidebar .sel-pill').style.top === '79px', 'click current page while auto-collapsed: pill follows to the expanded muse item');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'click current page while auto-collapsed: no sidebarCollapsed setting sent (override, not a preference)');
    check(errors.length === 0, 'click current page while auto-collapsed: zero page errors');
    // snapshot re-sync with autoCollapsed=true must NOT clear the override
    sent.length = 0;
    feed(window, { autoCollapsed: true });
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'snapshot re-sync while overridden: sidebar stays expanded');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'snapshot re-sync while overridden: still no setting sent');
    // clicking the collapse control clears the override (back to auto-collapsed)
    sent.length = 0;
    click(window, '.collapse-control');
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'collapse control while override-expanded: back to auto-collapsed');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'collapse control while override-expanded: no setting sent');
    // a fresh auto-collapse after widening clears the override for good
    autoMsg(window, false);
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'widen after override: expanded (manual setting was false all along)');
    autoMsg(window, true);
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 're-narrow after widening: auto-collapses again (override was cleared)');
  }

  // ---- 6. manual collapsed survives widening ------------------------------
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, { settings: { sidebarCollapsed: true } });
    await sleep(20);
    check(document.body.classList.contains('sidebar-collapsed'), 'manual collapsed: sidebar collapsed from the setting');
    autoMsg(window, true);
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'manual collapsed + narrow: still collapsed');
    autoMsg(window, false);
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'manual collapsed + widen: STILL collapsed (manual preference preserved)');
    check(settingSends(sent, 'sidebarCollapsed').length === 0, 'manual collapsed round trip: auto messages never wrote the setting');
    // manual expand via the collapse control persists
    sent.length = 0;
    click(window, '.collapse-control');
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'manual collapsed + collapse control: expands');
    check(settingSends(sent, 'sidebarCollapsed').length === 1 && settingSends(sent, 'sidebarCollapsed')[0].value === false, 'manual expand persists sidebarCollapsed=false');
    check(errors.length === 0, 'manual collapsed round trip: zero page errors');
  }

  // ---- 7. manual toggle while wide still persists --------------------------
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, {});
    await sleep(20);
    sent.length = 0;
    click(window, '.collapse-control');
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'wide collapse control: collapses');
    check(settingSends(sent, 'sidebarCollapsed').length === 1 && settingSends(sent, 'sidebarCollapsed')[0].value === true, 'wide collapse persists sidebarCollapsed=true');
    sent.length = 0;
    click(window, '.collapse-control');
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'wide collapse control again: expands');
    check(settingSends(sent, 'sidebarCollapsed').length === 1 && settingSends(sent, 'sidebarCollapsed')[0].value === false, 'wide expand persists sidebarCollapsed=false');
    check(errors.length === 0, 'wide manual toggle: zero page errors');
  }

  // ---- 8. settings toggle while narrow takes effect immediately ------------
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, {});
    await sleep(20);
    autoMsg(window, true);
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'setup: auto-collapsed on the settings page test');
    click(window, '.side-link[data-page="settings"]');
    await sleep(20);
    const tgl = document.querySelector('.toggle[data-key="sidebarCollapsed"]');
    check(!!tgl && !tgl.classList.contains('on'), 'settings toggle shows OFF while auto-collapsed (manual setting is false)');
    sent.length = 0;
    click(window, '.toggle[data-key="sidebarCollapsed"]'); // turn the manual setting ON
    await sleep(400);
    check(document.body.classList.contains('sidebar-collapsed'), 'settings toggle ON while narrow: sidebar stays collapsed');
    check(settingSends(sent, 'sidebarCollapsed').length === 1 && settingSends(sent, 'sidebarCollapsed')[0].value === true, 'settings toggle ON persists sidebarCollapsed=true');
    // feed back the saved setting (what C# would snapshot next), then turn it OFF
    feed(window, { settings: { sidebarCollapsed: true } });
    await sleep(20);
    sent.length = 0;
    click(window, '.toggle[data-key="sidebarCollapsed"]'); // turn the manual setting OFF
    await sleep(400);
    check(!document.body.classList.contains('sidebar-collapsed'), 'settings toggle OFF while narrow: sidebar expands immediately (override)');
    check(settingSends(sent, 'sidebarCollapsed').length === 1 && settingSends(sent, 'sidebarCollapsed')[0].value === false, 'settings toggle OFF persists sidebarCollapsed=false');
    check(errors.length === 0, 'settings toggle while narrow: zero page errors');
  }

  // ---- 9. flip keeps the auto-collapsed rail -------------------------------
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    await sleep(50);
    feed(window, {});
    await sleep(20);
    autoMsg(window, true);
    await sleep(400);
    click(window, '.flip-control');
    await sleep(20);
    check(document.body.classList.contains('side-right'), 'flip while auto-collapsed: sidebar moves right');
    check(document.body.classList.contains('sidebar-collapsed'), 'flip while auto-collapsed: stays collapsed');
    check(document.querySelector('#sidebar .sel-pill').style.height === '48px', 'flip while auto-collapsed: pill stays on the 48px rail');
    check(errors.length === 0, 'flip while auto-collapsed: zero page errors');
  }

  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  console.log(`DOM TOTAL ${n - fail}/${n} passed`);
  if (fail) { console.log('FAILURES: see above'); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
