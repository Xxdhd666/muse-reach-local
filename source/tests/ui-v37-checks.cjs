// v37 header: the hotkey is visible in the tray hover tooltip (design ref 19).
// TrayTooltip.For(true)  = 'Muse Reach \u2014 Ctrl+Alt+Space \u968f\u65f6\u547c\u51fa';
// TrayTooltip.For(false) = 'Muse Reach' (no hotkey, no 'disabled' suffix).
// The tooltip is refreshed by ApplyHotkey(), which the setting handler calls
// after every save, so toggling the switch updates it immediately with no
// restart. NotifyIcon.Text limit is 127 chars on .NET 6+ (Microsoft Learn);
// the copy is 31 chars, far inside. The hover itself is WinForms behaviour
// and cannot be seen on this VM; jsdom proves the shell half (the toggle
// renders and sends the setting), the C# half is pinned statically.
// Run with TZ=Asia/Shanghai: node tests/ui-v37-checks.cjs
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
let tooltip = '';
try { tooltip = fs.readFileSync(__dirname + '/../app/TrayTooltip.cs', 'utf8'); } catch (_) { /* absent on pre-v37 baselines: every v37 check fails, which is the negative control */ }
const csproj = fs.readFileSync(__dirname + '/../baseline-tests/ConsoleTests.csproj', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A. TrayTooltip logic (pure, no WinForms) ----------
check(tooltip.includes('internal const string WithHotkey = "Muse Reach \u2014 Ctrl+Alt+Space \u968f\u65f6\u547c\u51fa";'), 'TrayTooltip.WithHotkey is exactly the specified copy (em dash, no extra words)');
check(tooltip.includes('internal const string WithoutHotkey = "Muse Reach";'), 'TrayTooltip.WithoutHotkey is exactly "Muse Reach"');
check(tooltip.includes('internal static string For(bool hotkeyEnabled) => hotkeyEnabled ? WithHotkey : WithoutHotkey;'), 'TrayTooltip.For picks the copy by the switch, nothing else');
check(!tooltip.includes('System.Windows.Forms'), 'TrayTooltip has no WinForms dependency (baseline-testable)');
check(!tooltip.includes('hotkeyEnabled =') && !tooltip.includes('hotkeyEnabled='), 'TrayTooltip never writes the user setting (read-only: it cannot rewrite hotkeyEnabled)');
check(csproj.includes('TrayTooltip.cs'), 'baseline-tests compiles TrayTooltip.cs (pure logic is really tested)');

// ---------- B. version bumps (window title only; the tray text is now the tooltip) ----------
check(main.includes('Text = "Muse Reach v37"'), 'window title is v37');
check(!main.includes('Muse Reach v36'), 'no v36 version string left in MainForm');
check(proj.includes('<Version>0.37.0</Version>'), 'project version is 0.37.0');
check(!proj.includes('0.36.0'), 'no 0.36.0 left in the project file');
check(proj.includes('<TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>'), 'TFM is still net8.0-windows10.0.19041.0 (WinRT files stay in the package)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');

// ---------- C. MainForm tray wiring: tooltip from TrayTooltip, refreshed on every toggle ----------
check(main.includes('_tray=new NotifyIcon{Text=TrayTooltip.For(_settings.hotkeyEnabled),Icon=icon,Visible=true};'), 'InitTray sets the tooltip from TrayTooltip.For (no version-stamped text anymore)');
check(!main.includes('Text="Muse Reach v37"'), 'the tray text is not version-stamped (the version lives only in the window title)');
check(main.includes('if(_tray!=null)_tray.Text=TrayTooltip.For(_settings.hotkeyEnabled);'), 'ApplyHotkey refreshes the tooltip from the current switch value');
check(main.includes('ApplyHotkey();LocalOps.AppendLog("settings",'), 'the setting handler calls ApplyHotkey after every save (a toggle updates the tooltip immediately, no restart)');
check(main.includes('await InitAsync();ApplyHotkey();'), 'startup applies the hotkey (and the tooltip) after init');
check(count(main, /TrayTooltip\.For\(/g) === 2, 'exactly 2 TrayTooltip.For call sites (InitTray + ApplyHotkey, nowhere else)');
check(count(main, /_tray\.Text\s*=/g) === 1, 'the tooltip is re-assigned in exactly 1 place (ApplyHotkey); InitTray sets it once via the object initializer, pinned above');
check(main.includes('private void ApplyHotkey(){UnregisterHotKey(Handle,8001);'), 'ApplyHotkey still (re)registers the hotkey first (behaviour unchanged, tooltip refresh is appended)');
check(!main.includes('Text="Muse Reach v36"'), 'no v36 tray text left');

// ---------- D. shell.html: hotkey card copy untouched, tooltip copy lives only in C# ----------
check(shell.includes("toggle('hotkeyEnabled','全局热键','全局热键 Ctrl+Alt+Space（随时呼出），快速回到 Muse。')"), 'v28 hotkey card copy verbatim (unchanged)');
check(!shell.includes('Muse Reach \u2014 Ctrl+Alt+Space'), 'the tooltip copy is not duplicated in shell.html (single source of truth is TrayTooltip.cs)');
check(!shell.includes('TrayTooltip'), 'shell.html knows nothing about the tooltip (C#-side only)');

// ---------- E1. regression audits: v21/v24/v25/v26/v27/v28/v29/v30/v31/v32 pinned ----------
// (Copied verbatim from ui-v36-checks.cjs; v37 must not move any of these.)
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

// ---------- E2. v33 pins: narrow-window auto-collapse (unchanged by v37) ----------
check(auto.includes('public const int CollapseBelowWidth = 1008;'), 'v33 collapse threshold is still 1008 logical px');
check(auto.includes('public const int RestoreAboveWidth = 1024;'), 'v33 restore threshold is still 1024 logical px (16px hysteresis)');
check(auto.includes('public static bool Next(bool autoCollapsed, int logicalWidth)'), 'v33 Next(autoCollapsed, logicalWidth) untouched');
check(main.includes('private bool _autoCollapsed;'), 'v33 _autoCollapsed field untouched');
check(main.includes('Resize += (s, e) => UpdateAutoCollapse();'), 'v33 Resize re-evaluates auto-collapse');
check(main.includes('PostToShell(new{type="auto-collapse",collapsed=_autoCollapsed});'), 'v33 auto-collapse message untouched');
check(shell.includes('function setAutoCollapsed(v){'), 'v33 setAutoCollapsed untouched');
check(shell.includes("else if(d.type==='auto-collapse')setAutoCollapsed(!!d.collapsed);"), 'v33 auto-collapse message branch untouched');
check(!shell.includes("key:'autoCollapsed'") && !shell.includes('key:"autoCollapsed"'), 'v33 autoCollapsed is still never sent as a setting');

// ---------- E3. v34 pins: tray behaviour (unchanged by v37) ----------
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

// ---------- E4. v35 pins: hidden notifications (unchanged by v37) ----------
check(hidden.includes('internal Decision Next(bool windowVisible, HealthKind kind)'), 'v35 HiddenNotify.Next(windowVisible, kind) untouched');
check(count(main, /ShowBalloonTip\(/g) === 3, 'v35 still exactly 3 ShowBalloonTip calls (connection events only)');
check(main.includes('_tray.BalloonTipClicked+=(s,e)=>{ShowReach();PostToShell(new{type="navigate",page="connection"});};'), 'v35 notification click still restores + navigates to the connection page');
check(!main.includes('MessageBox.Show'), 'v35 still no self-made popup anywhere');
check(!main.includes('ToastNotificationManager') && !main.includes('using Windows.UI') && !main.includes('ToastContentBuilder'), 'v35 still no Toast API (the WinRT use is UISettings only, in its own file)');
check(main.includes('NotifyHidden(health); // v35'), 'v35 PollAsync still evaluates the notification decision on every health snapshot');
check(shell.includes("title:'与云端的连接断开了'") && shell.includes("title:'Muse 超过 90 秒没有动静'") && shell.includes("title:'已重新连接'"), 'v27 InfoBar copy unchanged (notification titles match it word for word)');

// ---------- E5. v36 pins: OS reduce-animations follow (unchanged by v37) ----------
check(os.includes('public static bool Effective(bool userEnabled, bool osEnabled) => userEnabled && osEnabled;'), 'v36 OsAnimations.Effective is still user AND OS');
check(osWinRt.includes('new UISettings()') && osWinRt.includes('.AnimationsEnabled'), 'v36 WinRT reader still reads UISettings.AnimationsEnabled');
check(main.includes('private bool EffectiveAnimations => _settings.animationsEnabled && _osAnimationsEnabled;'), 'v36 EffectiveAnimations still the single effective value');
check(main.includes('private void RefreshOsAnimations(){'), 'v36 RefreshOsAnimations untouched');
check(main.includes('const int WM_SETTINGCHANGE = 0x001A;'), 'v36 WM_SETTINGCHANGE still watched');
check(main.includes('PostToShell(new { type = "os-anim", enabled = _osAnimationsEnabled });'), 'v36 os-anim message untouched');
check(shell.includes('function animOff(){return state.data.settings?.animationsEnabled===false||state.data.osAnimationsEnabled===false;}'), 'v36 animOff() untouched');

// ---------- F. jsdom DOM checks: the hotkey toggle renders and sends the setting ----------
// The tooltip itself is C#-side (NotifyIcon.Text, WinForms) and cannot be
// hovered on this VM; jsdom proves the shell half that drives it: the
// hotkey toggle on the settings page renders from the stored value, and
// clicking it sends exactly one {type:'setting',key:'hotkeyEnabled',value}
// message, which is what MainForm's setting handler answers with ApplyHotkey()
// (and the tooltip refresh). No restart is involved anywhere in this chain.
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
function feed(window, settings) {
  const d = { type: 'snapshot',
    settings,
    operations: [], events: [], files: [], watch: [],
    evidence: { service: '运行中', tcpEstablished: true },
    health: { label: '通道正常', reconnect: false } };
  window.__msgFn({ data: d });
}
function goSettings(window) { window.__msgFn({ data: { type: 'navigate', page: 'settings' } }); }
const hotkeySends = sent => sent.filter(m => m && m.type === 'setting' && m.key === 'hotkeyEnabled');

(async () => {
  // ---- 1. toggle renders ON when the stored value is true ----
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    const t = document.querySelector('[data-key="hotkeyEnabled"]');
    check(t !== null, 'settings page renders the hotkeyEnabled toggle');
    check(t.getAttribute('aria-checked') === 'true', 'toggle shows ON when hotkeyEnabled is true');
    check(t.closest('.set-card').querySelector('.set-card-text small').textContent.includes('全局热键 Ctrl+Alt+Space（随时呼出）'), 'hotkey card description is the v28 verbatim copy in the live DOM');
    check(errors.length === 0, 'no page errors on the settings page: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 2. clicking the toggle sends exactly one setting message, value false ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    sent.length = 0;
    document.querySelector('[data-key="hotkeyEnabled"]').click();
    check(hotkeySends(sent).length === 1, 'click sends exactly one hotkeyEnabled setting message');
    check(hotkeySends(sent)[0] && hotkeySends(sent)[0].value === false, 'click sends hotkeyEnabled=false (switch off)');
    check(errors.length === 0, 'no page errors on hotkey toggle click: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 3. toggle renders OFF when fed false; clicking sends value true (round trip) ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, { ...SETTINGS, hotkeyEnabled: false });
    goSettings(window);
    const t = document.querySelector('[data-key="hotkeyEnabled"]');
    check(t !== null && t.getAttribute('aria-checked') === 'false', 'toggle shows OFF when hotkeyEnabled is false');
    sent.length = 0;
    t.click();
    check(hotkeySends(sent).length === 1 && hotkeySends(sent)[0].value === true, 'click sends hotkeyEnabled=true (switch back on)');
    check(errors.length === 0, 'no page errors on hotkey toggle round trip: ' + errors.join(' | ').slice(0, 200));
  }

  // ---- 4. a neighbouring toggle still works (the toggle handler is not broken) ----
  {
    const { dom, errors, sent } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    sent.length = 0;
    document.querySelector('[data-key="minimizeToTray"]').click();
    const m = sent.filter(x => x && x.type === 'setting' && x.key === 'minimizeToTray');
    check(m.length === 1 && m[0].value === false, 'minimizeToTray toggle still sends its own setting (handler intact)');
    check(hotkeySends(sent).length === 0, 'clicking another toggle sends no hotkeyEnabled message');
    check(errors.length === 0, 'no page errors on neighbouring toggle: ' + errors.join(' | ').slice(0, 200));
  }

  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  // n counts passes only (see check() above), so the total is n + fail.
  console.log(`DOM TOTAL ${n}/${n + fail} passed`);
  if (fail) { console.log('FAILURES: see above'); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
