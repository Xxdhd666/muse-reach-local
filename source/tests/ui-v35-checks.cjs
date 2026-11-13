// v35 static + DOM checks: connection events go to Windows system notifications
// (NotifyIcon BalloonTip) while the window is hidden in the tray; when the window
// is visible the v27 InfoBar is the only presentation. Only disconnect
// (channel interrupted, suspected stuck) and reconnect send a notification;
// the decision is a pure state machine (HiddenNotify.Next, runnable in the
// baseline C# test): one notification per round, never a repeat, never both
// InfoBar and notification for the same event. Clicking the notification
// restores the window and opens the Connection Status page.
// Run with TZ=Asia/Shanghai: node tests/ui-v35-checks.cjs
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v35-jsdom first, then /tmp/v34-jsdom, /tmp/v26-jsdom, /tmp/v25-jsdom)
// or a plain require('jsdom').
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
const hidden = fs.readFileSync(__dirname + '/../app/HiddenNotify.cs', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A. HiddenNotify logic (pure, no WinForms) ----------
check(hidden.includes('internal enum HealthKind { Neutral, Interrupted, SuspectedStuck, Healthy }'), 'HiddenNotify.HealthKind has Neutral / Interrupted / SuspectedStuck / Healthy');
check(hidden.includes('internal enum Decision { None, NotifyInterrupted, NotifySuspectedStuck, NotifyReconnect }'), 'HiddenNotify.Decision has None / NotifyInterrupted / NotifySuspectedStuck / NotifyReconnect');
check(hidden.includes('internal Decision Next(bool windowVisible, HealthKind kind)'), 'HiddenNotify.Next(windowVisible, kind) is the single notification decision point');
check(hidden.includes('case HealthKind.Neutral:') && hidden.includes('return Decision.None;'), 'neutral health (status pending) never notifies and never breaks a round');
check(hidden.includes('if (_last == Round.Bad) return Decision.None;'), 'same disconnect round never notifies twice, even when the level flips');
check(hidden.includes('return windowVisible ? Decision.None : Decision.NotifyReconnect;'), 'reconnect notifies only when the window is hidden (visible: InfoBar shows the green bar)');
check(hidden.includes('if (windowVisible) return Decision.None;'), 'disconnect never notifies while the window is visible (InfoBar only)');
check(hidden.includes('return kind == HealthKind.Interrupted ? Decision.NotifyInterrupted : Decision.NotifySuspectedStuck;'), 'hidden disconnect picks the copy by cause (interrupted vs suspected stuck)');
check(!hidden.includes('System.Windows.Forms'), 'HiddenNotify has no WinForms dependency (baseline-testable)');
check(!hidden.includes('ShowBalloonTip'), 'HiddenNotify decides only; it never shows anything itself');

// ---------- B. MainForm wiring: one NotifyHidden call per health snapshot ----------
check(main.includes('private readonly HiddenNotify _hiddenNotify = new HiddenNotify();'), 'MainForm holds one HiddenNotify state machine (not a fresh one per poll)');
check(main.includes('NotifyHidden(health); // v35'), 'PollAsync evaluates the notification decision on every health snapshot');
check(main.includes('bool windowVisible=Visible&&WindowState!=FormWindowState.Minimized;'), 'window counts as visible only when shown AND not minimized (minimized to taskbar counts as hidden)');
check(main.includes('var kind=health.reconnect?(health.label=="疑似假死"?HiddenNotify.HealthKind.SuspectedStuck:HiddenNotify.HealthKind.Interrupted):health.label=="通道正常"?HiddenNotify.HealthKind.Healthy:HiddenNotify.HealthKind.Neutral;'), 'health maps to a kind: reconnect+疑似假死 / reconnect+通道中断 / 通道正常 / everything else neutral');
check(count(main, /ShowBalloonTip\(/g) === 3, 'exactly 3 ShowBalloonTip calls (one per notification kind, no other event notifies)');
check(main.includes('_tray.ShowBalloonTip(5000,"与云端的连接断开了","点一下打开连接状态页。",ToolTipIcon.Warning);'), 'interrupted notification: title 与云端的连接断开了, Warning');
check(main.includes('_tray.ShowBalloonTip(5000,"Muse 超过 90 秒没有动静","可能只是暂时没动静，点一下打开连接状态页。",ToolTipIcon.Warning);'), 'suspected-stuck notification: softer title, Warning');
check(main.includes('_tray.ShowBalloonTip(5000,"已重新连接","与云端的连接已恢复，点一下打开连接状态页。",ToolTipIcon.Info);'), 'reconnect notification: title 已重新连接, Info');
check(count(main, /ToolTipIcon\.Warning/g) === 2 && count(main, /ToolTipIcon\.Info/g) === 1, 'two Warning (disconnects) and one Info (reconnect)');
check(main.includes('_tray.BalloonTipClicked+=(s,e)=>{ShowReach();PostToShell(new{type="navigate",page="connection"});};'), 'clicking the notification restores the window AND navigates to the connection page');
check(!main.includes('MessageBox.Show'), 'no self-made popup anywhere (notifications go through the system, never a MessageBox)');
check(!main.includes('ToastNotificationManager') && !main.includes('using Windows.UI') && !main.includes('ToastContentBuilder'), 'no Toast API used (deliberate: unpackaged Win32 needs AUMID + Start-menu shortcut, see REPORT §04)');
check(main.includes('Text = "Muse Reach v35"'), 'window title is v35');
check(main.includes('Text="Muse Reach v35"'), 'tray text is v35');
check(!main.includes('Muse Reach v34'), 'no v34 version string left in MainForm');
check(proj.includes('<Version>0.35.0</Version>'), 'project version is 0.35.0');
check(!proj.includes('0.34.0'), 'no 0.34.0 left in the project file');
check(!appSettings.includes('v35') && !appSettings.includes('v34'), 'AppSettings.cs carries no version string (settings untouched)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');

// ---------- C. Notification inventory: two events, three copy variants, nothing else ----------
const balloonLines = main.split('\n').filter(l => l.includes('ShowBalloonTip('));
check(balloonLines.length === 3, 'inventory: exactly 3 notification call sites');
check(balloonLines.every(l => !/0x[0-9a-fA-F]|https?:\/\/|WebErrorStatus|Exception|error code/i.test(l)), 'no error code, URL or technical term in any notification line');
check(count(main, /点一下打开连接状态页。/g) === 3, 'every notification tells the user what clicking does (3x 点一下打开连接状态页。)');
check(!main.includes('ShowBalloonTip(5000,"文件') && !main.includes('ShowBalloonTip(5000,"操作') && !main.includes('ShowBalloonTip(5000,"设置'), 'no notification for file changes, new records or settings (connection events only)');

// ---------- D. shell.html untouched by v35 (notifications are C#-side) ----------
check(!shell.includes('ShowBalloonTip') && !shell.includes('BalloonTip'), 'shell.html has no notification code (C# owns it)');
check(shell.includes("else if(d.type==='navigate')go(d.page);"), 'shell navigate handler is the click target (navigate -> go(page))');
check(shell.includes("title:'与云端的连接断开了'") && shell.includes("title:'Muse 超过 90 秒没有动静'") && shell.includes("title:'已重新连接'"), 'v27 InfoBar copy unchanged (notification titles match it word for word)');
check(!shell.includes('Muse Reach v35') && !shell.includes('Muse Reach v34'), 'shell.html carries no version string');

// ---------- E1. regression audits: v21/v24/v25/v26/v27/v28/v29/v30/v31/v32 pinned ----------
// (Copied verbatim from ui-v34-checks.cjs; v35 must not move any of these.)
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

// ---------- E2. v33 pins: narrow-window auto-collapse (unchanged by v35) ----------
check(auto.includes('public const int CollapseBelowWidth = 1008;'), 'v33 collapse threshold is still 1008 logical px');
check(auto.includes('public const int RestoreAboveWidth = 1024;'), 'v33 restore threshold is still 1024 logical px (16px hysteresis)');
check(auto.includes('public static bool Next(bool autoCollapsed, int logicalWidth)'), 'v33 Next(autoCollapsed, logicalWidth) untouched');
check(main.includes('private bool _autoCollapsed;'), 'v33 _autoCollapsed field untouched');
check(main.includes('Resize += (s, e) => UpdateAutoCollapse();'), 'v33 Resize re-evaluates auto-collapse');
check(main.includes('PostToShell(new{type="auto-collapse",collapsed=_autoCollapsed});'), 'v33 auto-collapse message untouched');
check(shell.includes('function setAutoCollapsed(v){'), 'v33 setAutoCollapsed untouched');
check(shell.includes("else if(d.type==='auto-collapse')setAutoCollapsed(!!d.collapsed);"), 'v33 auto-collapse message branch untouched');
check(!shell.includes("key:'autoCollapsed'") && !shell.includes('key:"autoCollapsed"'), 'v33 autoCollapsed is still never sent as a setting');

// ---------- E3. v34 pins: tray behaviour (unchanged by v35) ----------
check(main.includes('menu.Items.Add("打开",null,(s,e)=>ShowReach());menu.Items.Add("退出",null,(s,e)=>{_exit=true;Close();});'), 'v34 tray menu is still exactly two items: 打开 / 退出');
check(count(main, /menu\.Items\.Add\(/g) === 2, 'still exactly 2 menu.Items.Add calls in MainForm');
check(main.includes('_tray.DoubleClick+=(s,e)=>ShowReach();'), 'v34 tray double-click still restores via ShowReach');
check(main.includes('TrayRestore.Next(Visible,WindowState==FormWindowState.Minimized,GetForegroundWindow()==Handle)'), 'v34 ShowReach still decides through TrayRestore.Next');
check(main.includes('_tray.Visible=false;_tray.Dispose();'), 'v34 ghost-icon guard still hides the tray icon before dispose');
check(main.includes('RegisterWindowMessage("MuseReach.BringToFront")'), 'v34 bring-to-front registered message untouched');
check(main.includes('if(!first){MainForm.NotifyFirstInstance();return;}') || prog.includes('if(!first){MainForm.NotifyFirstInstance();return;}'), 'v34 second instance still notifies the first, then exits');
check(prog.includes('"Local\\\\MuseReach-v11"'), 'v34 mutex name still Local\\MuseReach-v11');
check(shell.includes("toggle('minimizeToTray','关闭或最小化时收进托盘','点 × 时收进托盘而不是退出，程序继续在后台运行；开关关掉后点 × 就是退出。')"), 'v34 minimizeToTray card copy untouched');
check(appSettings.includes('public bool minimizeToTray {get;set;}=true;'), 'minimizeToTray still defaults to true (never reset)');

console.log('STATIC TOTAL ' + n + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);

// ---------- F. jsdom DOM checks: the click target (navigate -> connection page) ----------
// The notification itself is C#-side (NotifyIcon); jsdom proves the JS half that
// BalloonTipClicked drives: a {type:'navigate',page:'connection'} message opens the
// Connection Status page, and the page renders with its health label.
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v35-jsdom/node_modules/jsdom', '/tmp/v34-jsdom/node_modules/jsdom', '/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v35-jsdom, /tmp/v34-jsdom, /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
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

(async () => {
  // ---- 1. a navigate message to 'connection' opens the Connection Status page ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    check(document.body.textContent.includes('连接状态'), 'connection page reachable from the sidebar');
    window.__msgFn({ data: { type: 'navigate', page: 'connection' } });
    check(document.querySelector('#healthLabel') !== null, 'navigate to connection renders the health label (the click target of the notification)');
    check(document.body.textContent.includes('通道正常'), 'connection page shows the healthy label after navigate');
    check(errors.length === 0, 'no page errors on navigate: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 2. navigate back to muse, then to connection again (repeat clicks work) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    window.__msgFn({ data: { type: 'navigate', page: 'connection' } });
    window.__msgFn({ data: { type: 'navigate', page: 'muse' } });
    window.__msgFn({ data: { type: 'navigate', page: 'connection' } });
    check(document.querySelector('#healthLabel') !== null, 'second navigate to connection still renders (repeat notification clicks work)');
    check(errors.length === 0, 'no page errors on repeated navigate: ' + errors.join(' | ').slice(0, 200));
  }

  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  console.log(`DOM TOTAL ${n - fail}/${n} passed`);
  if (fail) { console.log('FAILURES: see above'); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
