// v34 static + DOM checks: tray behaviour closed up (Win11 tray conventions).
// Tray right-click menu is exactly two items ("打开"/"退出"); double-click and
// repeat-launch restore/bring-to-front go through one pure decision
// (TrayRestore.Next, runnable in the baseline C# test); the x semantics are
// stated on the Settings card and switch with minimizeToTray; the tray icon is
// hidden before dispose so no ghost icon is left behind.
// Run with TZ=Asia/Shanghai: node tests/ui-v34-checks.cjs
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v26-jsdom first, then /tmp/v25-jsdom) or a plain require('jsdom').
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const prog = fs.readFileSync(__dirname + '/../app/Program.cs', 'utf8');
const appSettings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const tray = fs.readFileSync(__dirname + '/../app/TrayRestore.cs', 'utf8');
const auto = fs.readFileSync(__dirname + '/../app/SidebarAutoCollapse.cs', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A. TrayRestore logic (pure, no WinForms) ----------
check(tray.includes('internal enum Action { NoOp, ActivateOnly, RestoreAndActivate }'), 'TrayRestore.Action has exactly NoOp / ActivateOnly / RestoreAndActivate');
check(tray.includes('internal static Action Next(bool visible, bool minimized, bool isForeground)'), 'TrayRestore.Next(visible, minimized, isForeground) is the single restore decision point');
check(tray.includes('if (visible && !minimized && isForeground) return Action.NoOp;'), 'visible + normal + foreground is a no-op');
check(tray.includes('if (visible && !minimized) return Action.ActivateOnly;'), 'visible + normal + behind only activates (no resize)');
check(tray.includes('return Action.RestoreAndActivate;'), 'hidden or minimized restores then activates');
check(!tray.includes('System.Windows.Forms'), 'TrayRestore has no WinForms dependency (baseline-testable)');

// ---------- B. MainForm wiring: two-item menu, guarded restore, ghost guard ----------
check(main.includes('menu.Items.Add("打开",null,(s,e)=>ShowReach());menu.Items.Add("退出",null,(s,e)=>{_exit=true;Close();});'), 'tray right-click menu is exactly two items: 打开 / 退出');
check(!main.includes('menu.Items.Add("快速输入"'), 'no 快速输入 in the tray menu (still on the Ctrl+Alt+Space hotkey)');
check(!main.includes('menu.Items.Add("连接控制'), 'no 连接控制 in the tray menu (still on the connection/security pages)');
check(!main.includes('"打开 Reach"') && !main.includes('"退出 Reach'), 'no old tray menu labels left');
check(count(main, /menu\.Items\.Add\(/g) === 2, 'exactly 2 menu.Items.Add calls in MainForm');
check(main.includes('_tray.DoubleClick+=(s,e)=>ShowReach();'), 'tray double-click restores via ShowReach');
check(main.includes('TrayRestore.Next(Visible,WindowState==FormWindowState.Minimized,GetForegroundWindow()==Handle)'), 'ShowReach decides through TrayRestore.Next with the live window state');
check(main.includes('case TrayRestore.Action.NoOp:return;'), 'ShowReach no-ops when already in the foreground');
check(main.includes('case TrayRestore.Action.ActivateOnly:Activate();break;'), 'ShowReach only activates when visible and not minimized (maximized stays maximized)');
check(!main.includes('private void ShowReach(){Show();WindowState=FormWindowState.Normal;Activate();}'), 'old ShowReach is gone (it un-maximized a maximized window on every call)');
check(main.includes('if(WindowState==FormWindowState.Minimized)WindowState=FormWindowState.Normal;'), 'restore only un-minimizes; it never forces Normal on a maximized window');
check(main.includes('if(GetForegroundWindow()!=Handle){TopMost=true;TopMost=false;}'), 'cross-process wake falls back to a TopMost nudge only when Activate did not win the foreground');
check(main.includes('_tray.Visible=false;_tray.Dispose();'), 'tray icon is hidden before dispose (no ghost icon left in the tray)');
check(main.includes('if(m.Msg==(int)BringToFrontMessage){ShowReach();return;}'), 'WndProc handles the bring-to-front message by restoring');
check(main.includes('RegisterWindowMessage("MuseReach.BringToFront")'), 'bring-to-front message is a registered window message by name');
check(main.includes('PostMessage((IntPtr)0xffff, (int)BringToFrontMessage, IntPtr.Zero, IntPtr.Zero);'), 'second instance broadcasts to HWND_BROADCAST (0xffff)');
check(main.includes('Text = "Muse Reach v34"'), 'window title is v34');
check(main.includes('Text="Muse Reach v34"'), 'tray text is v34');
check(!main.includes('Muse Reach v33'), 'no v33 version string left in MainForm');
check(proj.includes('<Version>0.34.0</Version>'), 'project version is 0.34.0');
check(!proj.includes('0.33.0'), 'no 0.33.0 left in the project file');
check(!appSettings.includes('v34') && !appSettings.includes('v33'), 'AppSettings.cs carries no version string (settings untouched)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');

// ---------- C. Program.cs: single instance wakes the first instance ----------
check(prog.includes('"Local\\\\MuseReach-v11"'), 'mutex name is unchanged (Local\\MuseReach-v11): renaming would let v33 and v34 run side by side');
check(prog.includes('if(!first){MainForm.NotifyFirstInstance();return;}'), 'second instance notifies the first instance, then exits');
check(!prog.includes('if(!first)return;'), 'no silent second-instance exit left');
check(prog.includes('MainForm.NotifyFirstInstance'), 'Program calls the MainForm helper (no second copy of the broadcast)');

// ---------- D. Settings card: the x semantics are stated in plain words ----------
check(shell.includes("toggle('minimizeToTray','关闭或最小化时收进托盘','点 × 时收进托盘而不是退出，程序继续在后台运行；开关关掉后点 × 就是退出。')"), 'minimizeToTray card states both halves of the x semantics verbatim');
check(shell.includes('点 × 时收进托盘而不是退出'), 'card copy contains "点 × 时收进托盘而不是退出"');
check(shell.includes('开关关掉后点 × 就是退出'), 'card copy contains "开关关掉后点 × 就是退出"');
check(!shell.includes('需要退出时使用托盘菜单，电脑通道继续保留'), 'old minimizeToTray description is gone');
check(appSettings.includes('public bool minimizeToTray {get;set;}=true;'), 'minimizeToTray still defaults to true (never reset)');
check(count(shell, /toggle\('minimizeToTray'/g) === 1, 'exactly one minimizeToTray card');

// ---------- E1. regression audits: v21/v24/v25/v26/v27/v28/v29/v30/v31/v32 pinned ----------
// (Copied verbatim from ui-v33-checks.cjs; v34 must not move any of these.)
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

// ---------- E2. v33 pins: narrow-window auto-collapse (unchanged by v34) ----------
check(auto.includes('public const int CollapseBelowWidth = 1008;'), 'v33 collapse threshold is still 1008 logical px');
check(auto.includes('public const int RestoreAboveWidth = 1024;'), 'v33 restore threshold is still 1024 logical px (16px hysteresis)');
check(auto.includes('public static bool Next(bool autoCollapsed, int logicalWidth)'), 'v33 Next(autoCollapsed, logicalWidth) untouched');
check(main.includes('private bool _autoCollapsed;'), 'v33 _autoCollapsed field untouched');
check(main.includes('Resize += (s, e) => UpdateAutoCollapse();'), 'v33 Resize re-evaluates auto-collapse');
check(main.includes('PostToShell(new{type="auto-collapse",collapsed=_autoCollapsed});'), 'v33 auto-collapse message untouched');
check(shell.includes('function setAutoCollapsed(v){'), 'v33 setAutoCollapsed untouched');
check(shell.includes("else if(d.type==='auto-collapse')setAutoCollapsed(!!d.collapsed);"), 'v33 auto-collapse message branch untouched');
check(!shell.includes("key:'autoCollapsed'") && !shell.includes('key:"autoCollapsed"'), 'v33 autoCollapsed is still never sent as a setting');

console.log('STATIC TOTAL ' + n + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);

// ---------- F. jsdom DOM checks: the Settings card renders the new copy ----------
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v34-jsdom/node_modules/jsdom', '/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v34-jsdom or /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');

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
function feed(window, settings) {
  window.__msgFn({ data: { type: 'snapshot',
    settings,
    operations: [], events: [], files: [], watch: [],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false } } });
}
function click(window, selector) {
  const el = window.document.querySelector(selector);
  if (!el) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  return true;
}

(async () => {
  // ---- 1. the minimizeToTray card renders the new copy, toggle echoes true ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    check(click(window, '[data-page="settings"]'), 'go to settings page');
    const cards = document.querySelectorAll('.set-card');
    check(cards.length === 10, '10 set-cards (one per setting), got ' + cards.length);
    const titles = [...document.querySelectorAll('.set-card-text b')].map(b => b.textContent);
    check(titles.includes('关闭或最小化时收进托盘'), 'minimizeToTray card title unchanged');
    const descs = [...document.querySelectorAll('.set-card-text small')].map(s => s.textContent);
    const trayDesc = descs.find(d => d.includes('收进托盘而不是退出'));
    check(trayDesc === '点 × 时收进托盘而不是退出，程序继续在后台运行；开关关掉后点 × 就是退出。', 'card description is the new copy verbatim: ' + JSON.stringify(trayDesc));
    check(!descs.some(d => d.includes('需要退出时使用托盘菜单')), 'old description is gone from the rendered page');
    check(document.querySelector('.toggle[data-key="minimizeToTray"]')?.classList.contains('on'), 'minimizeToTray toggle echoes true (default kept)');
    check(errors.length === 0, 'no page errors on settings render: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 2. flipping the toggle sends minimizeToTray=false (the x-quits path) ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    click(window, '[data-page="settings"]');
    sent.length = 0;
    check(click(window, '.toggle[data-key="minimizeToTray"]'), 'click minimizeToTray toggle');
    check(sent.some(m => m.type === 'setting' && m.key === 'minimizeToTray' && m.value === false), 'toggle sends setting minimizeToTray=false (C# then lets x really quit)');
    check(sent.filter(m => m.type === 'setting').length === 1, 'flipping the toggle sends exactly one setting message');
    check(errors.length === 0, 'no page errors on toggle: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 3. snapshot with minimizeToTray=false echoes off (the other switch state) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { ...SETTINGS, minimizeToTray: false });
    click(window, '[data-page="settings"]');
    check(!document.querySelector('.toggle[data-key="minimizeToTray"]')?.classList.contains('on'), 'minimizeToTray=false echoes off');
    check(errors.length === 0, 'no page errors on false echo');
  }

  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  console.log(`DOM TOTAL ${n - fail}/${n} passed`);
  if (fail) { console.log('FAILURES: see above'); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
