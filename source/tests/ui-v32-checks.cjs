// v32 static checks: Muse-page tiered loading states (Fluent 2 Wait UX).
// The loading overlay is native WinForms (WebLoadingOverlay.cs), driven by
// WebView2 NavigationStarting/NavigationCompleted with a NavigationId
// correlation — there is no DOM to drive in jsdom, so this file is static
// only. The runnable timing check is the baseline C# test (WebLoadingTiers
// boundary walk, 8 checks; baseline 26 -> 34). Wall-clock behaviour
// (spinner at ~1s, progress at ~3s, failure + retry on the real machine)
// must be verified on the laptop, see REPORT.md §06.
// Run with TZ=Asia/Shanghai: node tests/ui-v32-checks.cjs
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const appSettings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const tiers = fs.readFileSync(__dirname + '/../app/WebLoadingTiers.cs', 'utf8');
const overlay = fs.readFileSync(__dirname + '/../app/WebLoadingOverlay.cs', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A. tier logic (WebLoadingTiers.cs, pure, no WinForms) ----------
check(tiers.includes('public const int SpinnerAfterMs = 1000;'), 'tier threshold: spinner after 1000ms');
check(tiers.includes('public const int ProgressAfterMs = 3000;'), 'tier threshold: progress after 3000ms');
check(tiers.includes('public const int WatchdogMs = 60000;'), 'tier threshold: watchdog 60s without a tracked completion');
check(tiers.includes('public enum Tier { Hidden, Spinner, Progress }'), 'three tiers: Hidden / Spinner / Progress');
check(tiers.includes('public static Tier TierFor(int elapsedMs)'), 'TierFor(elapsedMs) is the single tier decision point');
check(tiers.includes('if (elapsedMs < SpinnerAfterMs) return Tier.Hidden;'), 'under 1s -> Hidden (shows nothing)');
check(tiers.includes('if (elapsedMs < ProgressAfterMs) return Tier.Spinner;'), '1-3s -> Spinner');
check(!tiers.includes('System.Windows.Forms'), 'tier logic has no WinForms dependency (baseline-testable)');
check(!tiers.includes('167') && !tiers.includes('83'), 'tier thresholds are Wait UX numbers, not MotionTokens values');

// ---------- B. the overlay (WebLoadingOverlay.cs) ----------
check(overlay.includes('正在打开 Muse 对话，稍等一下'), 'progress copy is plain language (reassuring line)');
check(overlay.includes('Muse 对话暂时打不开'), 'error copy is plain language');
check(overlay.includes('_retry.Text = "重试";'), 'error state has a real Retry button');
const overlayCode = overlay.replace(/\/\/[^\n]*/g, ''); // comments may name muse.ai; UI strings may not
check(!overlayCode.includes('muse.ai') && !overlayCode.includes('http') && !overlayCode.includes('WebErrorStatus'), 'overlay UI never shows a URL, error code or WebView2 status (comment mentions excluded)');
check(overlay.includes('_tick.Interval = MotionTokens.ControlFasterMs;'), 'spinner tick is ControlFasterMs (83ms)');
check(overlay.includes('_spinAngle = (_spinAngle + 30) % 360;'), 'spinner rotates 30 degrees per 83ms tick');
check(overlay.includes('StartFade(255, MotionTokens.ControlFastMs);'), 'overlay fades in over ControlFastMs (167ms)');
check(overlay.includes('StartFade(0, MotionTokens.ControlFastExitMs);'), 'overlay fades out over ControlFastExitMs (125ms)');
check(count(overlay, /d = 24/g) === 2, 'spinner and error icon are both 24px (v30 large-icon size)');
check(overlay.includes('g.DrawArc(arc, rect, _spinAngle, 270);'), 'spinner is a 270-degree arc');
check(count(overlay, /2f\)/g) >= 2, 'spinner and error icon strokes are 2px (v30 stroke rule)');
check(overlay.includes('_progress.Style = ProgressBarStyle.Marquee;'), 'progress tier uses a marquee bar (indeterminate, no fake percent)');
check(overlay.includes('MarqueeAnimationSpeed = 30'), 'marquee speed set');
check(overlay.includes('_progress.Height = 8;'), 'progress bar is 8px tall');
check(overlay.includes('WebLoadingTiers.WatchdogMs'), 'overlay enforces the watchdog');
check(overlay.includes('WatchdogFired?.Invoke(this, EventArgs.Empty);'), 'watchdog raises an event for logging');
check(overlay.includes('ProgressBarStyle.Continuous') && overlay.includes('_progress.Value = 50;'), 'animations off: spinner tier becomes a static half bar (no rotation, no marquee)');
check(overlay.includes('if (!_animationsEnabled) { _alpha = target;'), 'animations off: no fade, alpha jumps');
for (const t of ['dark', 'midnight', 'light', 'pink', 'purple', 'ocean', 'forest', 'amber', 'obsidian']) check(overlay.includes('case "' + t + '":'), 'theme map covers ' + t);
check(overlay.includes('public event EventHandler RetryClicked;'), 'retry is an event (MainForm reloads)');
check(overlay.includes('BeginLoad()') && overlay.includes('if (_state == OverlayState.Loading) return;'), 'BeginLoad is idempotent while loading (slow redirects never reset the clock)');
check(overlay.includes('public void FinishLoad()') && overlay.includes('public void ShowError()') && overlay.includes('public void DismissError()'), 'overlay exposes FinishLoad / ShowError / DismissError');
check(overlay.includes('public void SetMusePageActive(bool active)'), 'overlay follows the muse page being active (leaving the page hides it, returning re-shows the current state)');
check(overlay.includes('_tick.Stop(); _fade.Stop();'), 'Dispose stops both timers');
check(!overlay.includes('ExecuteScript') && !overlay.includes('DefaultBackgroundColor'), 'overlay injects nothing and touches no WebView2 background API');
check(!shell.includes('WebLoading') && !shell.includes('正在打开 Muse 对话'), 'loading UI lives in native C#, not in shell.html');

// ---------- C. MainForm wiring ----------
check(main.includes('_loadingOverlay=new WebLoadingOverlay();'), 'overlay is created in the MainForm ctor');
check(main.includes('_loadingOverlay?.Dispose();'), 'overlay is disposed on FormClosed');
check(main.includes('_web.CoreWebView2.NavigationStarting+=OnWebNavigationStarting;'), 'NavigationStarting is hooked on the web view');
check(main.includes('_web.CoreWebView2.NavigationCompleted+=OnWebNavigationCompleted;'), 'NavigationCompleted is hooked on the web view');
check(main.includes('_webNavId=e.NavigationId;'), 'starting navigation id is tracked');
check(main.includes('if(e.NavigationId!=_webNavId)return;'), 'completion is ignored unless its id matches the tracked navigation (subframes never surface an error)');
check(main.includes('_web.CoreWebView2?.Reload();'), 'retry really reloads the web view');
check(count(main, /_web\.Visible=_webLoaded/g) === 2, '_web stays hidden until the first successful load (SwitchWebAsync + PositionWeb)');
check(main.includes('Muse 网页首次加载完成'), 'first successful load is logged');
check(main.includes('首次加载完成前 _web 不可见'), 'the first-load gate is documented in code (white WebView2 background cannot be recoloured from WinForms)');
check(!main.includes('CoreWebView2.DefaultBackgroundColor') && !main.includes('.DefaultBackgroundColor='), 'no DefaultBackgroundColor in code (the API is on CoreWebView2Controller, which WinForms does not expose; verified by reflection on the vendored SDK; the name appears only in an explanatory comment)');
check(count(main, /SyncLoadingOverlayBounds\(\);/g) === 4, 'overlay bounds follow _webBounds (SwitchWebAsync + NavigationCompleted + PositionWeb x2)');
check(main.includes('_loadingOverlay?.ApplyTheme(_settings.theme);'), 'theme change re-themes the overlay');
check(main.includes('if(key=="animationsEnabled"&&_loadingOverlay!=null)_loadingOverlay.AnimationsEnabled=_settings.animationsEnabled;'), 'animations setting is forwarded to the overlay (as a separate statement: the v18/v19-pinned one-liner stays byte-identical)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');
check(main.includes('Text = "Muse Reach v32"'), 'window title is v32');
check(main.includes('Text="Muse Reach v32"'), 'tray text is v32');
check(!main.includes('Muse Reach v31'), 'no v31 version string left in MainForm');
check(proj.includes('<Version>0.32.0</Version>'), 'project version is 0.32.0');
check(!proj.includes('0.31.0'), 'no 0.31.0 left in the project file');
check(!appSettings.includes('v32') && !appSettings.includes('v31'), 'AppSettings.cs carries no version string (settings untouched)');

// ---------- D. regression audits: shell.html is byte-untouched by v32 ----------
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

console.log('STATIC TOTAL ' + n + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
