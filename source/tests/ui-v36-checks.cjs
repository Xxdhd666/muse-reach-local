// v36 header: follow the OS "reduce animations" setting (Windows Settings ->
// Accessibility -> Visual effects -> Animation effects). The effective
// animations switch is user AND OS: either off makes every animation instant,
// exactly like animationsEnabled=false; the OS switch turning back on restores
// animations per the in-app switch, and the user's stored setting is never
// rewritten by the OS value. Read order: WinRT UISettings.AnimationsEnabled
// (official API for the toggle) -> SPI_GETANIMATION (old minimize/maximize
// parameter, different semantics) -> fail-open true (in-app switch only).
// Run with TZ=Asia/Shanghai: node tests/ui-v36-checks.cjs
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v34-jsdom first, then /tmp/v26-jsdom, /tmp/v25-jsdom)
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
const os = fs.readFileSync(__dirname + '/../app/OsAnimations.cs', 'utf8');
// strip // comments for the two checks below: they are about the code, and the
// doc comments (correctly) name the WinRT type and the user setting.
const osCode = os.replace(/\/\/.*$/gm, '');
const osWinRt = fs.readFileSync(__dirname + '/../app/OsAnimationsWinRt.cs', 'utf8');
const csproj = fs.readFileSync(__dirname + '/../baseline-tests/ConsoleTests.csproj', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A. OsAnimations logic (pure, no WinForms, no WinRT) ----------
check(os.includes('public static bool Effective(bool userEnabled, bool osEnabled) => userEnabled && osEnabled;'), 'OsAnimations.Effective is user AND OS (either off kills all animations)');
check(os.includes('public static (bool value, string source) ReadWithSource(Func<bool?> winRtReader) {'), 'v40: ReadWithSource takes the WinRT reader as an injectable func (testable, no hard WinRT dependency) — Read moved here so the path is known');
check(count(os, /if \(v\.HasValue\) return \(v\.Value, /g) === 2, 'v40: ReadWithSource tries WinRT first, then SPI (two HasValue returns in order, each tagged with its source)');
check(os.includes('return (true, "fail-open");'), 'v40: ReadWithSource fails open to true when nothing is readable (in-app switch only, never pretends to have read the OS value)');
check(os.includes('internal const uint SPI_GETANIMATION = 0x0002;'), 'SPI fallback uses SPI_GETANIMATION (0x0002)');
check(os.includes('private static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref ANIMATIONINFO pvParam, uint fWinIni);'), 'SPI fallback is a plain user32 P/Invoke (no package needed)');
check(os.includes('internal static bool? ReadSpi() {'), 'ReadSpi returns bool? (null when unreadable, never throws)');
check(os.includes('catch { return null; }'), 'ReadSpi swallows P/Invoke failure and returns null');
check(!os.includes('System.Windows.Forms'), 'OsAnimations has no WinForms dependency (baseline-testable)');
check(!osCode.includes('Windows.UI') && !osCode.includes('UISettings'), 'OsAnimations has no WinRT reference (the WinRT reader lives in its own file)');
check(!osCode.includes('AppSettings') && !osCode.includes('animationsEnabled ='), 'OsAnimations never writes the user setting (read-only: it cannot rewrite animationsEnabled)');

// ---------- B. OsAnimationsWinRt: the official API, app-only ----------
check(osWinRt.includes('using Windows.UI.ViewManagement;'), 'WinRT reader uses Windows.UI.ViewManagement');
check(osWinRt.includes('new UISettings()') && osWinRt.includes('.AnimationsEnabled'), 'WinRT reader reads UISettings.AnimationsEnabled (the official API for the Animation effects toggle)');
check(osWinRt.includes('_settings ??= new UISettings();'), 'UISettings is created once and reused (one COM activation, not one per poll)');
check(osWinRt.includes('catch { _failed = true; return null; }'), 'WinRT failure latches and returns null (falls through to SPI, never throws)');
check(osWinRt.includes('internal static bool? Read()'), 'WinRT reader returns bool? (null means unreadable)');
check(!csproj.includes('OsAnimationsWinRt'), 'baseline-tests does not compile OsAnimationsWinRt.cs (net8.0 has no WinRT projection)');
check(csproj.includes('OsAnimations.cs'), 'baseline-tests compiles OsAnimations.cs (pure logic is really tested)');

// ---------- C. MainForm wiring: effective value everywhere, OS value never saved ----------
check(main.includes('private bool _osAnimationsEnabled = true;'), 'MainForm holds the OS switch, default true (fail-open: unreadable means in-app switch only)');
check(main.includes('private bool EffectiveAnimations => _settings.animationsEnabled && _osAnimationsEnabled;'), 'EffectiveAnimations is user AND OS, the single effective value');
check(main.includes('private void RefreshOsAnimations(){'), 'RefreshOsAnimations exists (re-read + apply on change only)');
check(main.includes('var r = OsAnimations.ReadWithSource(OsAnimationsWinRt.Read); next = r.value; source = r.source;'), 'v40: Refresh reads through ReadWithSource with the WinRT reader (path known for the log)');
check(main.includes('if (next == _osAnimationsEnabled) return;'), 'Refresh is idempotent (unchanged value applies nothing, no message spam)');
check(main.includes('PostToShell(new { type = "os-anim", enabled = _osAnimationsEnabled });'), 'a changed OS value is pushed to the shell immediately as an os-anim message');
check(main.includes('RefreshOsAnimations(); // v36：启动时即读一次系统开关'), 'constructor reads the OS switch at startup (first frame already follows the effective value)');
check(main.includes('RefreshOsAnimations(); // v36：每轮询重读一次系统开关'), 'PollAsync re-reads the OS switch every round (1s fallback for a missed broadcast)');
check(main.includes('const int WM_SETTINGCHANGE = 0x001A;'), 'WM_SETTINGCHANGE is watched (0x001A)');
check(main.includes('if (m.Msg == WM_SETTINGCHANGE) RefreshOsAnimations();'), 'WM_SETTINGCHANGE re-reads immediately (user toggles in system Settings -> next animation follows the new value)');
check(main.includes('_captionStrip.AnimationsEnabled = EffectiveAnimations;'), 'caption strip follows the effective value (not just the user switch)');
check(main.includes('_loadingOverlay.AnimationsEnabled=EffectiveAnimations;'), 'loading overlay follows the effective value (not just the user switch)');
check(main.includes('if(EffectiveAnimations){_animKind=kind;'), 'anim-start gate uses the effective value (OS off blocks the flip glide too)');
check(main.includes('if(key=="animationsEnabled")_captionStrip.AnimationsEnabled=EffectiveAnimations;'), 'setting handler re-syncs the caption strip with the effective value after a user toggle');
check(main.includes('osAnimationsEnabled=_osAnimationsEnabled,currentWebUrl='), 'snapshot carries osAnimationsEnabled (shell reload re-syncs from it)');
check(count(main, /_settings\.animationsEnabled\s*=/g) === 0, 'MainForm never assigns _settings.animationsEnabled (the OS value cannot rewrite the user setting)');
check(!appSettings.includes('osAnimationsEnabled'), 'AppSettings has no OS field (settings.json can never persist the OS value)');
check(main.includes('Text = "Muse Reach v36"'), 'window title is v36');
check(main.includes('Text="Muse Reach v36"'), 'tray text is v36');
check(!main.includes('Muse Reach v35'), 'no v35 version string left in MainForm');
check(proj.includes('<Version>0.36.0</Version>'), 'project version is 0.36.0');
check(!proj.includes('0.35.0'), 'no 0.35.0 left in the project file');
check(proj.includes('<TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>'), 'TFM is net8.0-windows10.0.19041.0 (Windows SDK projection for the WinRT API)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');

// ---------- D. shell.html: animOff() is the single effective check ----------
check(shell.includes('function animOff(){return state.data.settings?.animationsEnabled===false||state.data.osAnimationsEnabled===false;}'), 'animOff() is the single effective check (user off OR OS off)');
check(shell.includes("document.body.classList.toggle('no-anim',animOff());"), 'nav() toggles no-anim from animOff() (all CSS transitions/animations die together, skeleton shimmer included)');
check(shell.includes('if(animOff()){bounds();return;}'), 'animBegin() early-returns on animOff() (no anim-start message when the OS switch is off)');
check(shell.includes("else if(d.type==='os-anim'){state.data.osAnimationsEnabled=!!d.enabled;nav();}"), 'os-anim message stores the OS value and re-runs nav() (runtime change applies without a new snapshot)');
check(shell.includes("toggle('animationsEnabled','界面动效','侧栏、页面与主题切换使用动画；关闭后全部立即切换')"), 'settings toggle still renders from the user setting (the card shows the stored value, not the effective one)');
check(!shell.includes("key:'osAnimationsEnabled'") && !shell.includes('key:"osAnimationsEnabled"'), 'osAnimationsEnabled is never sent back as a setting (the shell cannot write the OS value into settings.json)');
check(shell.includes("if(d.settings.animationsEnabled===undefined)d.settings.animationsEnabled=true;"), 'snapshot default for the user switch is still true (fail-open on the user side too)');
check(!shell.includes('Muse Reach v36') && !shell.includes('Muse Reach v35'), 'shell.html carries no version string');


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

// ---------- E4. v35 pins: hidden notifications (unchanged by v36) ----------
check(hidden.includes('internal Decision Next(bool windowVisible, HealthKind kind)'), 'v35 HiddenNotify.Next(windowVisible, kind) untouched');
check(count(main, /ShowBalloonTip\(/g) === 3, 'v35 still exactly 3 ShowBalloonTip calls (connection events only)');
check(main.includes('_tray.BalloonTipClicked+=(s,e)=>{ShowReach();PostToShell(new{type="navigate",page="connection"});};'), 'v35 notification click still restores + navigates to the connection page');
check(!main.includes('MessageBox.Show'), 'v35 still no self-made popup anywhere');
check(!main.includes('ToastNotificationManager') && !main.includes('using Windows.UI') && !main.includes('ToastContentBuilder'), 'v35 still no Toast API (the WinRT use is UISettings only, in its own file)');
check(main.includes('NotifyHidden(health); // v35'), 'v35 PollAsync still evaluates the notification decision on every health snapshot');
check(shell.includes("title:'与云端的连接断开了'") && shell.includes("title:'Muse 超过 90 秒没有动静'") && shell.includes("title:'已重新连接'"), 'v27 InfoBar copy unchanged (notification titles match it word for word)');

// ---------- F. jsdom DOM checks: the effective switch (user AND OS) ----------
// The OS switch itself is C#-side (WinRT UISettings / SPI); jsdom proves the
// JS half: the shell's no-anim state follows user AND OS, runtime os-anim
// messages flip it without a new snapshot, the settings toggle still shows
// the user's stored value, and no setting message is ever sent for the OS
// value (the user setting is never rewritten).
let JSDOM, VirtualConsole;
for (const p of ['/tmp/v34-jsdom/node_modules/jsdom', '/tmp/v26-jsdom/node_modules/jsdom', '/tmp/v25-jsdom/node_modules/jsdom', 'jsdom']) {
  try { ({ JSDOM, VirtualConsole } = require(p)); break; } catch (_) { /* try next */ }
}
if (!JSDOM) { console.error('jsdom not found in /tmp/v34-jsdom, /tmp/v26-jsdom or /tmp/v25-jsdom'); process.exit(2); }
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
function feed(window, settings, osAnim) {
  const d = { type: 'snapshot',
    settings,
    operations: [], events: [], files: [], watch: [],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false } };
  if (osAnim !== undefined) d.osAnimationsEnabled = osAnim;
  window.__msgFn({ data: d });
}
const noAnim = document => document.body.classList.contains('no-anim');
const animStarts = sent => sent.filter(m => m && m.type === 'anim-start').length;
const animSettingSends = sent => sent.filter(m => m && m.type === 'setting' && m.key === 'animationsEnabled').length;

(async () => {
  // ---- 1. OS off + user on: no-anim (the OS switch wins) ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS, false);
    check(noAnim(document), 'OS off + user on: body has no-anim (OS switch wins)');
    check(errors.length === 0, 'no page errors with OS off: ' + errors.join(' | ').slice(0, 200));
    void sent;
  }

  // ---- 2. OS on + user on: animations live ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS, true);
    check(!noAnim(document), 'OS on + user on: body has no no-anim');
    check(errors.length === 0, 'no page errors with both on: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 3. OS on + user off: no-anim (the in-app switch still governs) ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { ...SETTINGS, animationsEnabled: false }, true);
    check(noAnim(document), 'OS on + user off: body has no-anim (in-app switch governs)');
    check(errors.length === 0, 'no page errors with user off: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 4. OS value never arrived (undefined): fail-open, animations live ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS); // no osAnimationsEnabled field at all
    check(!noAnim(document), 'OS value missing (undefined): no no-anim (fail-open, in-app switch only)');
    check(errors.length === 0, 'no page errors with missing OS value: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 5. runtime change via os-anim message, no new snapshot ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS, true);
    check(!noAnim(document), 'runtime change: starts animated (OS on)');
    window.__msgFn({ data: { type: 'os-anim', enabled: false } });
    check(noAnim(document), 'runtime change: os-anim false adds no-anim without a new snapshot');
    window.__msgFn({ data: { type: 'os-anim', enabled: true } });
    check(!noAnim(document), 'runtime change: os-anim true removes no-anim again (restores per the in-app switch)');
    check(animSettingSends(sent) === 0, 'os-anim messages never send a setting for animationsEnabled (user setting untouched)');
    check(errors.length === 0, 'no page errors on os-anim flips: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 6. settings toggle still shows the USER value while the OS switch is off ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS, false);
    window.__msgFn({ data: { type: 'navigate', page: 'settings' } });
    const t = document.querySelector('[data-key="animationsEnabled"]');
    check(t !== null, 'settings page renders the animationsEnabled toggle');
    check(t.getAttribute('aria-checked') === 'true', 'toggle shows ON while the OS switch is off (it shows the stored user value, not the effective one)');
    check(noAnim(document), 'body still has no-anim on the settings page (effective value governs the visuals)');
    check(errors.length === 0, 'no page errors on the settings page with OS off: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 7. animBegin gate: collapse click sends anim-start only when animations are live ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS, false);
    document.querySelector('[data-action="collapse"]').click();
    check(animStarts(sent) === 0, 'OS off: collapse click sends no anim-start (animBegin early-returns)');
    check(errors.length === 0, 'no page errors on collapse click with OS off: ' + errors.join(' | ').slice(0, 200));
  }
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS, true);
    document.querySelector('[data-action="collapse"]').click();
    check(animStarts(sent) === 1, 'OS on: collapse click sends exactly one anim-start');
    check(errors.length === 0, 'no page errors on collapse click with OS on: ' + errors.join(' | ').slice(0, 200));
  }

  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  // n counts passes only (see check() above), so the total is n + fail.
  console.log(`DOM TOTAL ${n}/${n + fail} passed`);
  if (fail) { console.log('FAILURES: see above'); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
