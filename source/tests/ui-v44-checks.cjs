// v44: the ui-v29 test item '222 spacing declarations' stopped at 222 on
// every shell since v31 and was always recorded as "pre-existing, unrelated".
// Verdict: test bug (b), not a product bug. v31 added exactly two spacing
// declarations, both deliberate and both on-grid: `.skel{gap:12px}` (the
// loading-skeleton container for the four data pages) and
// `.empty .secondary{margin-top:8px}` (the action button inside the new
// empty states). Per-version shell census with ui-v29's own algorithm:
// v28:222 (off-grid everywhere, pre-v29) v29:222 v30:222 v31:224 v32-v43:224;
// off-grid count 0 and the five 40px exceptions unchanged the whole way.
// The v31 REPORT itself already counted it: "间距 224 条全在 4px 网格
// （222＋新增 2 条 on-grid：骨架 gap:12px、空态按钮 margin-top:8px）"
// (§177-178), and ui-v31 already pins 224. The ui-v29 pin just never
// followed. Two more pins hid behind the count failure: the .log-summary
// no-font-size pin (v30 deliberately set .log-summary to 11.5px — the
// v29 REPORT's own §01.3 said the next round would do exactly that — so
// op/program rows are now 69.63px like file rows, the 2.5px spread is
// closed) and the 49-radius pin (the same v31 .skel-row that v43 fixed
// in ui-v24). This version updates the count and those pins to their
// current forms (updated, never deleted — the v39/v41/v42/v43 precedent)
// and leaves ui-v29's version pin alone: old version files stop at their
// version assertions by design. No product code changed except the
// version bump. Whether the skeleton rows and empty states really look
// right on the real machine can only be judged there — see REPORT §06.
// jsdom proves the shell half (unchanged shell still loads, settings page
// renders, zero page errors).
// Run with TZ=Asia/Shanghai: node tests/ui-v44-checks.cjs
// jsdom is a scratch-only dep; resolve it from the known scratch installs
// (/tmp/v34-jsdom first, then /tmp/v26-jsdom, /tmp/v25-jsdom)
// or a plain require('jsdom').
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const prog = fs.readFileSync(__dirname + '/../app/Program.cs', 'utf8');
const appSettings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const strip = fs.readFileSync(__dirname + '/../app/CaptionStrip.cs', 'utf8');
const stripMath = fs.readFileSync(__dirname + '/../app/CaptionStripMath.cs', 'utf8');
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
let hit = '';
try { hit = fs.readFileSync(__dirname + '/../app/CaptionHitTest.cs', 'utf8'); } catch (_) { /* absent on pre-v38 baselines: every v38 check fails, which is the negative control */ }
const csproj = fs.readFileSync(__dirname + '/../baseline-tests/ConsoleTests.csproj', 'utf8');
let n = 0; let fail = 0;
function check(v, name) { if (!v) { fail++; console.log('FAIL ' + name); } else { console.log('PASS ' + name); n++; } }
function count(s, re) { return (s.match(re) || []).length; }

// ---------- A0. v44 ui-v29 fix: spacing count 222 -> 224 + two pins behind it ----------
// Verdict (b) test bug. Evidence chain, in full in REPORT §02:
// (1) Reproduction: ui-v29 passed 0 checks on pristine v43, stopping at
// line 43: `check(declCount === 222, '222 spacing declarations audited
// across all 6 <style> blocks (same count as the v28 audit)')`. The shell
// really has 224.
// (2) v29 origin: the v29 audit counted 222 declarations across the six
// <style> blocks (167 changed onto the grid, 55 already on-grid; exactly
// two justified exceptions, both 40px derived alignments, 5 sites). The
// pin was right through v30 (v30's own file pins 222 too).
// (3) v31 supersession (deliberate, not drift): v31 added the data-page
// four states — `skel()`: 4 shimmer rows of 70px inside a card, plus an
// empty state with a real action button on every data page. Two new
// spacing declarations came with it, both on-grid: `.skel{display:grid;
// gap:12px}` (the skeleton container stacks its 4 rows with a 12px gap)
// and `.empty .secondary{margin-top:8px}` (the action button sits 8px
// below the empty-state text). Nothing was removed. Per-version census
// with ui-v29's own line-by-line algorithm: v29:222 v30:222 v31:224
// v32-v43:224; off-grid 0, fortySites 5 throughout. The v31 REPORT
// already counted it (§177-178: "间距 224 条全在 4px 网格（222＋新增
// 2 条 on-grid：骨架 gap:12px、空态按钮 margin-top:8px，40px 例外仍
// 5 处）"), and ui-v31-checks.cjs:95-96,116 already pins 224
// ("v29 had 222 declarations; v31 adds exactly 2 on-grid ones").
// (4) The two pins hiding behind the count failure:
//   - `.log-summary` no-font-size: v30 deliberately set
//     `.log-summary{...;font-size:11.5px}` (the v29 REPORT's own §01.3
//     said "下一单把 `.log-summary` 定 11.5px 统一，v30 已做"), so
//     op/program names are 11.5px like file rows and the 2.5px spread
//     is closed; the derivation in ui-v29 is updated to the v30 form
//     (logRowOp 69.63px, tolerance 0.05 — mirroring ui-v30:84-87).
//     The v31 REPORT already recorded it: "v29 停在 `.log-summary`
//     旧断言（v30 已 supersede）".
//   - 49 plain 8px radii: the same v31 `.skel-row` that v43 fixed in
//     ui-v24 (50 = 49 + 1 skeleton row). ui-v29 carries the identical
//     stale pin; it is updated to the same current value.
//   Both are updated in the same edit (directly related: same file,
//   same deliberate later-version changes, same class of stale pin) —
//   otherwise ui-v29 would still stop one check later, twice over.
// (5) No product code changed in v44 except the version bump: both new
// declarations were already correct and on-grid; only the test pinned
// superseded values.
const v29 = fs.readFileSync(__dirname + '/ui-v29-checks.cjs', 'utf8');
const v29Code = v29.replace(/\/\/.*$/gm, '');
check(v29.includes("check(declCount === 224, '224 spacing declarations audited across all 6 <style> blocks (222 + 2 on-grid ones v31 added: .skel gap:12px, .empty .secondary margin-top:8px)');"), 'ui-v29 count check now pins 224 with the v31 attribution');
check(!v29.includes('declCount === 222'), 'ui-v29 no longer pins the retired 222 count');
check(v29.includes('const logRowOp = 11.5 * 1.65 + 11 * 1.65 + 10 * 1.65 + 16;'), 'ui-v29 row derivation now uses the v30 11.5px name size');
check(!v29.includes('const logRowOp = 13 * 1.65'), 'ui-v29 derivation no longer uses the retired 13px name size');
check(v29.includes("check(Math.abs(logRowOp - 69.6) < 0.05, 'execution-log row height now ' + logRowOp.toFixed(2) + 'px, equal to work-file rows (was 72.1px, 2.5px spread closed by v30)');"), 'ui-v29 op-row height check now pins 69.63px like file rows (v30 form)');
check(v29.includes("check(shell.includes('.log-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;font-size:11.5px}'), '.log-summary sets font-size 11.5px (v30 superseded the v29 no-font-size form; op/program rows now 69.63px like file rows)');"), 'ui-v29 .log-summary pin now uses the v30 11.5px form');
check(!v29.includes('sets no font-size'), 'ui-v29 no longer pins the retired no-font-size form');
check(v29.includes("check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii (49 + v31 skeleton row .skel-row, v43 established)');"), 'ui-v29 radius pin now uses 50 (v43 established)');
check(!v29Code.includes('border-radius:8px[;}]/g) === 49'), 'ui-v29 no longer pins the retired 49 radius count');
check(v29.includes("check(main.includes('Text = \"Muse Reach v29\"'), 'window title is v29');"), 'ui-v29 version pin deliberately left (old files stop at version assertions by design)');
check(shell.includes('.skel{display:grid;gap:12px}'), 'product: skeleton container still gap 12px (unchanged by v44)');
check(shell.includes('.empty .secondary{margin-top:8px}'), 'product: empty-state action button still margin-top 8px (unchanged by v44)');
check(count(shell, /border-radius:8px[;}]/g) === 50, 'product: shell still has exactly 50 plain 8px radii (unchanged by v44)');
check(count(shell, /border-radius:4px[;}]/g) === 7, 'product: shell still has exactly 7 plain 4px radii (unchanged by v44)');

// ---------- A0r. v40 pins: animation-setting read-path logging (unchanged by v44) ----------
// v36 left one hole: which read path was actually taken (WinRT / SPI /
// fail-open) was never logged — if the OS switch is off and Reach still
// animates, that line is the first thing to read. v40 logs it at startup
// (path + OS value + in-app value + effective value) and again only when
// the value or the path changes; steady state writes nothing.
const animLog = fs.readFileSync(__dirname + '/../app/OsAnimLog.cs', 'utf8');
check(animLog.includes('internal sealed class OsAnimLog'), 'OsAnimLog exists and is a sealed class (pure logic)');
check(!animLog.includes('System.Windows.Forms') && !animLog.includes('Windows.UI'), 'OsAnimLog has no WinForms/WinRT dependency (baseline-testable)');
check(animLog.includes('public string Next(string source, bool osValue, bool userEnabled)'), 'OsAnimLog.Next(source, osValue, userEnabled) signature');
check(animLog.includes('return "动画设置：读取路径=" + source + "，系统开关=" + onOff + "，应用内开关=" + (userEnabled ? "开" : "关") + "，生效动效=" + eff;'), 'startup line has all four fields (path, OS value, in-app value, effective)');
check(animLog.includes('if (!first && !sourceChanged && !valueChanged) return null;'), 'steady state writes nothing (no per-second log spam)');
check(animLog.includes('if (sourceChanged) line += "读取路径=" + source + "，";'), 'change line carries the path only when it changed');
check(animLog.includes('string line = "动画设置变化：";'), 'change lines start with 动画设置变化：');
check(!animLog.includes('UserName') && !animLog.includes('MachineName') && !animLog.includes('AppDir') && !animLog.includes('GetFolderPath'), 'log lines carry no personal info (no username, path, or machine name)');
check(os.includes('public static (bool value, string source) ReadWithSource(Func<bool?> winRtReader)'), 'OsAnimations.ReadWithSource exists (value + source)');
check(os.includes('return (v.Value, "WinRT");'), 'WinRT read success reports source WinRT');
check(os.includes('return (v.Value, "SPI");'), 'SPI fallback success reports source SPI');
check(os.includes('return (true, "fail-open");'), 'both unreadable reports source fail-open with value true');
check(os.includes('public static bool Read(Func<bool?> winRtReader) => ReadWithSource(winRtReader).value;'), 'Read is a thin shell over ReadWithSource (one decision point, no drift)');
check(main.includes('private readonly OsAnimLog _osAnimLog = new OsAnimLog();'), 'MainForm owns one OsAnimLog instance');
check(main.includes('OsAnimations.ReadWithSource(OsAnimationsWinRt.Read)'), 'RefreshOsAnimations reads through ReadWithSource (path known)');
check(!main.includes('OsAnimations.Read(OsAnimationsWinRt.Read)'), 'the old path-blind Read call is gone from MainForm');
check(main.includes('string logLine = _osAnimLog.Next(source, next, _settings.animationsEnabled);'), 'every re-read goes through the log decision');
check(main.includes('if (logLine != null) LocalOps.AppendLog("app", logLine);'), 'log lines go to reach.log with category app');
check(csproj.includes('OsAnimLog.cs'), 'baseline-tests compiles OsAnimLog.cs (the log decision is really tested)');
check(count(main, /ReadWithSource\(/g) === 1, 'exactly 1 ReadWithSource call site (no second read path hiding elsewhere)');

// ---------- A. CaptionHitTest logic (pure, no WinForms) ----------
check(hit.includes('internal static class CaptionHitTest'), 'CaptionHitTest exists and is internal static');
check(!hit.includes('System.Windows.Forms'), 'CaptionHitTest has no WinForms dependency (baseline-testable)');
check(hit.includes('public static CaptionSegment SegmentAt(Point formClientPoint, Rectangle stripRectInForm, float scale)'), 'SegmentAt signature: form point + strip rect in form + scale');
check(hit.includes('if (!stripRectInForm.Contains(formClientPoint)) return CaptionSegment.None;'), 'SegmentAt returns None outside the strip rect');
check(hit.includes('return CaptionStripMath.HitTest(formClientPoint.X - stripRectInForm.Left, stripRectInForm.Width, scale);'), 'SegmentAt reuses CaptionStripMath.HitTest (the same function the pill uses)');
check(hit.includes('public static bool IsMaxSegment(float xInStrip, float stripWidth, float scale)'), 'IsMaxSegment signature');
check(hit.includes('=> CaptionStripMath.HitTest(xInStrip, stripWidth, scale) == CaptionSegment.Max;'), 'IsMaxSegment is exactly HitTest == Max');
// strip // comments for the check below: the doc comment (correctly) names
// HTMAXBUTTON as the thing the caller returns for the Max segment.
const hitCode = hit.replace(/\/\/.*$/gm, '');
check(!hitCode.includes('HTMAXBUTTON') && !hitCode.includes('WM_NCHITTEST'), 'CaptionHitTest knows no Win32 constants (pure geometry only)');
check(csproj.includes('CaptionHitTest.cs'), 'baseline-tests compiles CaptionHitTest.cs (pure logic is really tested)');
check(csproj.includes('CaptionStripMath.cs'), 'baseline-tests compiles CaptionStripMath.cs (the hit test depends on it)');

// ---------- B. version bumps ----------
check(main.includes('Text = "Muse Reach v44"'), 'window title is v44');
check(!main.includes('Muse Reach v43'), 'no v43 version string left in MainForm');
check(proj.includes('<Version>0.44.0</Version>'), 'project version is 0.44.0');
check(!proj.includes('0.43.0'), 'no 0.43.0 left in the project file');
check(proj.includes('<TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>'), 'TFM is still net8.0-windows10.0.19041.0 (WinRT files stay in the package)');
check(count(main, /ExecuteScriptAsync/g) === 2, 'ExecuteScriptAsync still exactly 2 (both in the self-test; no injection added)');

// ---------- B2. ui-v17 / ui-v18 assertion updates (the old pins are updated, not deleted) ----------
const v17b = fs.readFileSync(__dirname + '/ui-v17-checks.cjs', 'utf8');
const v18 = fs.readFileSync(__dirname + '/ui-v18-checks.cjs', 'utf8');
check(v17b.includes("public static float GlyphSpan(CaptionGlyph g, float scale) => 12f"), 'ui-v17 now pins the unified 12px span');
check(v17b.includes("public static float GlyphStroke(CaptionGlyph g, float scale) => 2f"), 'ui-v17 now pins the unified 2.0 stroke');
check(!v17b.includes('14f : 12f') && !v17b.includes('2.1f : 1.7f'), 'ui-v17 no longer pins the retired 14px/2.1/1.7 values');
check(v18.includes("public static float GlyphSpan(CaptionGlyph g, float scale) => 12f"), 'ui-v18 now pins the unified 12px span');
check(v18.includes("public static float GlyphStroke(CaptionGlyph g, float scale) => 2f"), 'ui-v18 now pins the unified 2.0 stroke');
check(!v18.includes('14f : 12f') && !v18.includes('2.1f : 1.7f'), 'ui-v18 no longer pins the retired 14px/2.1/1.7 values');
// v41: the five stale ui-v17 pins (deactivation bare reset, three FillSegment,
// `Color.White : Ink`) are updated to their current forms — see A0 above.
// The v17 file itself carries the per-check reasons; this section only
// confirms the update happened and nothing was deleted to make it pass.
check(v17b.includes("'window deactivation resets the strip'"), 'ui-v17 still asserts that deactivation resets the strip (same name, current wiring)');
check(!v17b.replace(/\/\/.*$/gm, '').includes('_captionStrip?.ResetVisualState()'), 'ui-v17 deactivation check no longer pins the deleted call site');
check(!v17b.replace(/\/\/.*$/gm, '').includes('FillSegment'), 'ui-v17 no longer pins the deleted FillSegment');
check(!v17b.replace(/\/\/.*$/gm, '').includes('Color.White : Ink'), 'ui-v17 no longer pins the retired `Color.White : Ink` ternary');
check(v18.includes("public static float GlyphSpan(CaptionGlyph g, float scale) => 12f"), 'ui-v18 now pins the unified 12px span');
check(v18.includes("public static float GlyphStroke(CaptionGlyph g, float scale) => 2f"), 'ui-v18 now pins the unified 2.0 stroke');
check(!v18.includes('14f : 12f') && !v18.includes('2.1f : 1.7f'), 'ui-v18 no longer pins the retired 14px/2.1/1.7 values');
// v42: the two stale ui-v18 sync pins (construction + live settings handler
// pinned `_settings.animationsEnabled`; v36 changed both to
// EffectiveAnimations) are updated to the v36 form — see A0 above. The v18
// file itself carries the per-check reason; this section only confirms the
// update happened and nothing was deleted to make it pass.
check(v18.includes("check(main.includes('_captionStrip.AnimationsEnabled = EffectiveAnimations;'), 'MainForm syncs the strip switch from settings');"), 'ui-v18 sync check now pins EffectiveAnimations (v42)');
check(v18.includes("check(main.includes('if(key==\"animationsEnabled\")_captionStrip.AnimationsEnabled=EffectiveAnimations;'), 'settings changes update the strip switch live');"), 'ui-v18 live-update check now pins EffectiveAnimations (v42)');
check(!v18.replace(/\/\/.*$/gm, '').includes('_captionStrip.AnimationsEnabled = _settings.animationsEnabled;'), 'ui-v18 no longer pins the retired raw-switch assignment');
check(!v18.replace(/\/\/.*$/gm, '').includes('AnimationsEnabled=_settings.animationsEnabled;'), 'ui-v18 no longer pins the retired raw-switch live update');
// v43: the ui-v24 count pin (49 plain 8px radii) and the ten v29 spacing
// pins hiding behind it are updated to their current forms — see A0 above.
// The v24 file itself carries the per-check reasons; this section only
// confirms the update happened and nothing was deleted to make it pass.
const v24b = fs.readFileSync(__dirname + '/ui-v24-checks.cjs', 'utf8');
check(v24b.includes("check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii');"), 'ui-v24 count now pins 50 (v43)');
check(v24b.includes("padding:12px 16px;border-radius:8px'), 'user bubble base is 8px'"), 'ui-v24 user-bubble pin now uses v29 padding (v43)');
check(v24b.includes("margin:-8px 0 24px 40px"), 'ui-v24 tool pin now uses v29 margin (v43)');
check(v24b.includes("margin:4px 0 24px 40px"), 'ui-v24 task pin now uses v29 margin (v43)');
check(!v24b.replace(/\/\/.*$/gm, '').includes('border-radius:8px[;}]/g) === 49'), 'ui-v24 no longer pins the retired 49 count (v43)');
// v44: the ui-v29 count pin (222 spacing declarations) and the two pins
// hiding behind it (.log-summary no-font-size, 49 plain 8px radii) are
// updated to their current forms — see A0 above. The v29 file itself
// carries the per-check reasons; this section only confirms the update
// happened and nothing was deleted to make it pass.
const v29b = fs.readFileSync(__dirname + '/ui-v29-checks.cjs', 'utf8');
check(v29b.includes('declCount === 224'), 'ui-v29 count now pins 224 (v44)');
check(v29b.includes('.log-summary sets font-size 11.5px'), 'ui-v29 .log-summary pin now uses the v30 11.5px form (v44)');
check(v29b.includes("check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii"), 'ui-v29 radius pin now uses 50 (v44)');
check(!v29b.includes('declCount === 222'), 'ui-v29 no longer pins the retired 222 count (v44)');
check(!v29b.includes('sets no font-size'), 'ui-v29 no longer pins the retired no-font-size form (v44)');
// ui-v14 / ui-v16 are already dead on the pristine v38 baseline (ENOENT reading
// the deleted TitleBarButton.cs at line 12, before any glyph check); their glyph
// assertions pin a deleted file/class, not the live CaptionStripMath, so they
// are left untouched — see REPORT §05.

// ---------- C. CaptionStrip non-client entry points; v17/v18/v23 handlers untouched ----------
check(strip.includes('public CaptionSegment Hover => _state.Hover;'), 'CaptionStrip exposes Hover (the strip state, for the window to read)');
check(strip.includes('public float DpiScale => _scale;'), 'CaptionStrip exposes DpiScale (the window needs it for hit testing)');
check(strip.includes('public void NcMove(float x) { if (!_windowActive) return;'), 'NcMove has the v23 inactive guard (no hover while inactive)');
check(strip.includes('public void NcDown(float x) { if (!_windowActive) return;'), 'NcDown has the v23 inactive guard (no press while inactive)');
check(strip.includes('public CaptionSegment NcUp(float x) { var fired = _state.Up(x, Width, _scale);'), 'NcUp has no inactive guard (matches MouseUp: a press started before deactivation must still release Capture)');
check(strip.includes('public void NcLeave() { if (_state.Hover == CaptionSegment.None && _state.Pressed == CaptionSegment.None) return;'), 'NcLeave is a no-op when nothing is hovered or pressed (no pointless redraw)');
check(strip.includes('if (_state.Down(x, Width, _scale) != CaptionSegment.None) Capture = true;'), 'NcDown captures the mouse only when a segment was actually pressed');
check(strip.includes('MouseMove += (s, e) => { if (!_windowActive) return; var before = _state.Hover; _state.Move(e.X, Width, _scale); if (_state.Hover != before) UpdateFade(); };'), 'v23 MouseMove handler verbatim (unchanged)');
check(strip.includes('MouseDown += (s, e) => { if (!_windowActive) return; if (e.Button == MouseButtons.Left) { _state.Down(e.X, Width, _scale); Capture = true; UpdateFade(); } };'), 'v23 MouseDown handler verbatim (unchanged)');
check(strip.includes('MouseUp += (s, e) => { var fired = _state.Up(e.X, Width, _scale); Capture = false; UpdateFade(); if (fired != CaptionSegment.None) SegmentClicked?.Invoke(fired); };'), 'v23 MouseUp handler verbatim (unchanged)');
check(strip.includes('DoubleClick += (s, e) => { if (!_windowActive) return; var seg = CaptionStripMath.HitTest(((MouseEventArgs)e).X, Width, _scale); if (seg != CaptionSegment.None) SegmentClicked?.Invoke(seg); };'), 'v23 DoubleClick handler verbatim (unchanged)');
check(strip.includes('public void SetWindowActive(bool active) {'), 'v23 SetWindowActive still present (inactive gray icons + snap-back on activation)');
check(strip.includes('CaptionStripMath.PillRect(i, segW, ClientSize.Height, _scale)'), 'v18 pill rectangle still drawn from CaptionStripMath.PillRect');
check(count(strip, /NcMove\(|NcDown\(|NcUp\(|NcLeave\(/g) === 4, 'exactly 4 Nc* method definitions in CaptionStrip (no extra entry points)');
check(count(strip, /_state\.Move\(|_state\.Down\(|_state\.Up\(|_state\.Leave\(/g) === 9, 'HoverState calls: 4 in the mouse handlers (Move/Down/Up/Leave) + 1 in SetWindowActive + 4 in the Nc* methods (no second state machine)');
check(strip.includes('MouseLeave += (s, e) => { _state.Leave(); UpdateFade(); };'), 'v23 MouseLeave handler verbatim (unchanged: it only fires for in-strip hover, which is why the NC path needs NcLeave)');

// ---------- D. MainForm WndProc: HTMAXBUTTON mapping, order, NC forwarding ----------
// strip // comments for two checks below: the doc comments (correctly) name
// SC_MAXIMIZE as the thing the code deliberately does NOT delegate to, and
// WS_SYSMENU as the thing CreateParams deliberately does NOT add.
const mainCode = main.replace(/\/\/.*$/gm, '');
// The NCHITTEST block: Max segment first, then the 6px edge conversion.
const ncBlock = main.slice(main.indexOf('const int WM_NCHITTEST'), main.indexOf('const int WM_NCMOUSEMOVE'));
check(ncBlock.includes('const int HTCLIENT = 1, HTMAXBUTTON = 9, HTLEFT = 10, HTRIGHT = 11, HTTOP = 12, HTTOPLEFT = 13, HTTOPRIGHT = 14, HTBOTTOM = 15, HTBOTTOMLEFT = 16, HTBOTTOMRIGHT = 17;'), 'hit-test constants: HTMAXBUTTON is 9 (Win32), the rest unchanged');
check(ncBlock.includes('if (m.Msg == WM_NCHITTEST)'), 'WM_NCHITTEST branch has no WindowState condition anymore (maximized must also return HTMAXBUTTON for the restore button)');
check(ncBlock.indexOf('m.Result = (IntPtr)HTMAXBUTTON') < ncBlock.indexOf('if (WindowState != FormWindowState.Maximized'), 'Max-segment check comes before the 6px edge conversion (buttons win over the top resize grip, like a native window)');
check(ncBlock.includes('var seg = CaptionHitTest.SegmentAt(p, StripRectInForm(), _captionStrip.DpiScale);'), 'hit test goes through CaptionHitTest.SegmentAt with the strip rect in form coords');
check(ncBlock.includes('if (seg == CaptionSegment.Max) { m.Result = (IntPtr)HTMAXBUTTON; return; }'), 'maximize segment returns HTMAXBUTTON');
check(ncBlock.includes('if (_captionStrip.Hover == CaptionSegment.Max) _captionStrip.NcLeave();'), 'hover is cleared when the mouse leaves the Max segment (nobody else can clear it)');
check(ncBlock.includes('if (WindowState != FormWindowState.Maximized && (int)m.Result == HTCLIENT)'), 'edge conversion still skipped while maximized (unchanged)');
check(ncBlock.includes('m.Result = (IntPtr)(t && l ? HTTOPLEFT : t && r ? HTTOPRIGHT : b && l ? HTBOTTOMLEFT : b && r ? HTBOTTOMRIGHT : l ? HTLEFT : r ? HTRIGHT : t ? HTTOP : b ? HTBOTTOM : HTCLIENT);'), '6px edge conversion verbatim (unchanged)');
check(!ncBlock.replace(/\/\/.*$/gm, '').includes('HTCAPTION'), 'no HTCAPTION anywhere in the hit-test code (title-bar blank stays HTCLIENT; dragging is DragWindow, not HTCAPTION)');
check(main.includes('protected override CreateParams CreateParams'), 'CreateParams is overridden (window style declaration)');
check(main.includes('cp.Style |= 0x00010000 | 0x00020000; // WS_MAXIMIZEBOX | WS_MINIMIZEBOX'), 'CreateParams adds WS_MAXIMIZEBOX | WS_MINIMIZEBOX (declares the window maximizable so the shell can offer snap)');
check(!mainCode.includes('WS_SYSMENU'), 'no WS_SYSMENU added (no visible system menu)');
check(main.includes('const int WM_NCMOUSEMOVE = 0x00A0, WM_NCMOUSELEAVE = 0x02A2;'), 'non-client mouse constants: WM_NCMOUSEMOVE 0xA0, WM_NCMOUSELEAVE 0x2A2');
check(main.includes('const int WM_NCLBUTTONDOWN = 0x00A7, WM_NCLBUTTONUP = 0x00A8, WM_NCLBUTTONDBLCLK = 0x00A9;'), 'non-client click constants: WM_NCLBUTTONDOWN 0xA7, UP 0xA8, DBLCLK 0xA9');
check(main.includes('[DllImport("user32.dll")] private static extern bool TrackMouseEvent(ref TRACKMOUSEEVENT lpEventTrack);'), 'TrackMouseEvent is imported (WM_NCMOUSELEAVE is not sent unless requested)');
check(main.includes('dwFlags = 0x00000002 | 0x00000010'), 'mouse-leave tracking requests TME_LEAVE | TME_NONCLIENT');
check(main.includes('if (TryMaxPoint(m, out float x)) _captionStrip.NcMove(x);'), 'NCMOUSEMOVE feeds the hover back into the strip (NcMove)');
check(main.includes('_captionStrip.NcLeave();'), 'NCMOUSELEAVE / leaving the segment clears the strip hover (NcLeave)');
check(main.includes('if (TryMaxPoint(m, out float x)) { _captionStrip.NcDown(x); return; }'), 'NCLBUTTONDOWN/DBLCLK feeds the press back (NcDown) and does not call base (no DefWindowProc SC_MAXIMIZE fighting the strip state machine)');
check(main.includes('var fired = _captionStrip.NcUp(x);'), 'NCLBUTTONUP safety net reuses NcUp');
check(main.includes('if (fired == CaptionSegment.Max) { _captionStrip.ResetVisualState(); ToggleMaximize(); }'), 'the safety net dispatches exactly like SegmentClicked (ResetVisualState + ToggleMaximize)');
check(main.includes('private Rectangle StripRectInForm()'), 'StripRectInForm helper exists (strip rect in form coords, shared by hit test and NC forwarding)');
check(main.includes('return RectangleToClient(_captionStrip.RectangleToScreen(_captionStrip.ClientRectangle));'), 'strip rect is converted via RectangleToScreen/RectangleToClient (no hand-computed Padding/Dock math)');
check(main.includes('private bool TryMaxPoint(Message m, out float xInStrip)'), 'TryMaxPoint helper exists (screen coords -> strip x, only when really on Max)');
check(main.includes('private void ArmNcMouseLeave()'), 'ArmNcMouseLeave helper exists (registers TME_LEAVE|TME_NONCLIENT once per hover)');
check(count(main, /_captionStrip\.Nc(Move|Down|Up|Leave)\(/g) === 6, 'exactly 6 Nc* call sites in MainForm (NcMove 1, NcDown 1, NcUp 1, NcLeave 3: hit-test clear + NCMOUSEMOVE + NCMOUSELEAVE)');
check(main.includes('_captionStrip.SegmentClicked += seg => {'), 'SegmentClicked wiring untouched (the in-strip click path still exists for Min/Close)');
check(main.includes('else if (seg == CaptionSegment.Max) ToggleMaximize();'), 'in-strip Max click still goes through ToggleMaximize');
check(main.includes('_titleBar.MouseDown += DragWindow;'), 'title-bar blank dragging still goes through DragWindow (HTCLIENT, not HTCAPTION)');
check(!mainCode.includes('SC_MAXIMIZE') && !mainCode.includes('WM_SYSCOMMAND'), 'no SC_MAXIMIZE / WM_SYSCOMMAND in the code (clicks are fully owned, not delegated to DefWindowProc)');
const shellHash = crypto.createHash('sha256').update(shell).digest('hex');
check(shellHash === '7cce5150b8a6f9cce8c48c2fb02042e9743a53c08e80c397f75fba9aae65f860', 'shell.html is byte-identical to v41 (SHA256 7cce5150…e65f860): this version changes no web UI');
check(!shell.includes('Snap') && !shell.includes('HTMAXBUTTON'), 'shell.html knows nothing about Snap Layouts (C#-side only)');

// ---------- E0. v37 pins: tray tooltip (unchanged by v38) ----------
check(tooltip.includes('internal const string WithHotkey = "Muse Reach \u2014 Ctrl+Alt+Space \u968f\u65f6\u547c\u51fa";'), 'v37 TrayTooltip.WithHotkey copy verbatim');
check(tooltip.includes('internal const string WithoutHotkey = "Muse Reach";'), 'v37 TrayTooltip.WithoutHotkey verbatim');
check(tooltip.includes('internal static string For(bool hotkeyEnabled) => hotkeyEnabled ? WithHotkey : WithoutHotkey;'), 'v37 TrayTooltip.For unchanged');
check(main.includes('_tray=new NotifyIcon{Text=TrayTooltip.For(_settings.hotkeyEnabled),Icon=icon,Visible=true};'), 'v37 InitTray still sets the tooltip from TrayTooltip.For');
check(count(main, /TrayTooltip\.For\(/g) === 2, 'v37 exactly 2 TrayTooltip.For call sites (InitTray + ApplyHotkey)');
check(main.includes('if(_tray!=null)_tray.Text=TrayTooltip.For(_settings.hotkeyEnabled);'), 'v37 ApplyHotkey still refreshes the tooltip');

// ---------- E1. regression audits: v21/v24/v25/v26/v27/v28/v29/v30/v31/v32 pinned ----------
// (Copied verbatim from ui-v41-checks.cjs; v42 must not move any of these.)
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

// ---------- E2. v33 pins: narrow-window auto-collapse (unchanged by v38) ----------
check(auto.includes('public const int CollapseBelowWidth = 1008;'), 'v33 collapse threshold is still 1008 logical px');
check(auto.includes('public const int RestoreAboveWidth = 1024;'), 'v33 restore threshold is still 1024 logical px (16px hysteresis)');
check(auto.includes('public static bool Next(bool autoCollapsed, int logicalWidth)'), 'v33 Next(autoCollapsed, logicalWidth) untouched');
check(main.includes('private bool _autoCollapsed;'), 'v33 _autoCollapsed field untouched');
check(main.includes('Resize += (s, e) => UpdateAutoCollapse();'), 'v33 Resize re-evaluates auto-collapse');
check(main.includes('PostToShell(new{type="auto-collapse",collapsed=_autoCollapsed});'), 'v33 auto-collapse message untouched');
check(shell.includes('function setAutoCollapsed(v){'), 'v33 setAutoCollapsed untouched');
check(shell.includes("else if(d.type==='auto-collapse')setAutoCollapsed(!!d.collapsed);"), 'v33 auto-collapse message branch untouched');
check(!shell.includes("key:'autoCollapsed'") && !shell.includes('key:"autoCollapsed"'), 'v33 autoCollapsed is still never sent as a setting');

// ---------- E3. v34 pins: tray behaviour (unchanged by v38) ----------
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

// ---------- E4. v35 pins: hidden notifications (unchanged by v38) ----------
check(hidden.includes('internal Decision Next(bool windowVisible, HealthKind kind)'), 'v35 HiddenNotify.Next(windowVisible, kind) untouched');
check(count(main, /ShowBalloonTip\(/g) === 3, 'v35 still exactly 3 ShowBalloonTip calls (connection events only)');
check(main.includes('_tray.BalloonTipClicked+=(s,e)=>{ShowReach();PostToShell(new{type="navigate",page="connection"});};'), 'v35 notification click still restores + navigates to the connection page');
check(!main.includes('MessageBox.Show'), 'v35 still no self-made popup anywhere');
check(!main.includes('ToastNotificationManager') && !main.includes('using Windows.UI') && !main.includes('ToastContentBuilder'), 'v35 still no Toast API (the WinRT use is UISettings only, in its own file)');
check(main.includes('NotifyHidden(health); // v35'), 'v35 PollAsync still evaluates the notification decision on every health snapshot');
check(shell.includes("title:'与云端的连接断开了'") && shell.includes("title:'Muse 超过 90 秒没有动静'") && shell.includes("title:'已重新连接'"), 'v27 InfoBar copy unchanged (notification titles match it word for word)');

// ---------- E5. v36 pins: OS reduce-animations follow (unchanged by v38) ----------
check(os.includes('public static bool Effective(bool userEnabled, bool osEnabled) => userEnabled && osEnabled;'), 'v36 OsAnimations.Effective is still user AND OS');
check(osWinRt.includes('new UISettings()') && osWinRt.includes('.AnimationsEnabled'), 'v36 WinRT reader still reads UISettings.AnimationsEnabled');
check(main.includes('private bool EffectiveAnimations => _settings.animationsEnabled && _osAnimationsEnabled;'), 'v36 EffectiveAnimations still the single effective value');
check(main.includes('private void RefreshOsAnimations(){'), 'v36 RefreshOsAnimations untouched');
check(main.includes('const int WM_SETTINGCHANGE = 0x001A;'), 'v36 WM_SETTINGCHANGE still watched');
check(main.includes('PostToShell(new { type = "os-anim", enabled = _osAnimationsEnabled });'), 'v36 os-anim message untouched');
check(shell.includes('function animOff(){return state.data.settings?.animationsEnabled===false||state.data.osAnimationsEnabled===false;}'), 'v36 animOff() untouched');

// ---------- E6. v39 pins: title-bar glyphs unified 12px / 2.0 (unchanged by v42) ----------
// (Moved verbatim from ui-v39-checks.cjs A0; v44 touches no glyph.)
// The v16 per-glyph tuning is retired: minus no longer compensates with extra
// length (14px) and extra weight (2.1). One stroke system, one icon language.
check(stripMath.includes('public static float GlyphSpan(CaptionGlyph g, float scale) => 12f'), 'all glyph spans are 12px (single constant, no per-glyph ternary)');
check(stripMath.includes('public static float GlyphStroke(CaptionGlyph g, float scale) => 2f'), 'all glyph strokes are 2.0 (single constant, no per-glyph ternary)');
check(!stripMath.includes('14f'), 'no 14px span left in CaptionStripMath');
check(!stripMath.includes('2.1f') && !stripMath.includes('1.7f'), 'no 2.1/1.7 stroke left in CaptionStripMath');
check(stripMath.includes('public static CaptionGlyph GlyphFor(CaptionSegment s) => s == CaptionSegment.Min ? CaptionGlyph.Minus : s == CaptionSegment.Max ? CaptionGlyph.Square : CaptionGlyph.Close;'), 'GlyphFor mapping unchanged (Min->Minus, Max->Square, Close->X)');
check(strip.includes('float cx = (i + 0.5f) * segW, cy = ClientSize.Height / 2f;'), 'each glyph still centered in its own segment (centering untouched)');
check(strip.includes('float r = 1.5f * _scale;'), 'square corner radius still 1.5x scale (a corner radius, not a stroke — untouched)');
check(strip.includes('float span = CaptionStripMath.GlyphSpan(glyph, _scale);'), 'glyph span still read from CaptionStripMath.GlyphSpan');
check(strip.includes('float w = CaptionStripMath.GlyphStroke(glyph, _scale);'), 'glyph stroke still read from CaptionStripMath.GlyphStroke');
// The only 1.7f left in app/ is StatusPill's own check/X glyphs (a different
// control, not a title-bar glyph — out of scope, see REPORT §05).
const appFiles = ['CaptionStrip.cs','CaptionStripMath.cs','CaptionHitTest.cs','MainForm.cs','TrayRestore.cs','TrayTooltip.cs','HiddenNotify.cs','OsAnimations.cs','SidebarAutoCollapse.cs','WebLoadingOverlay.cs','WebLoadingTiers.cs','WindowGeometryMath.cs','MotionTokens.cs'];
let app17 = 0, app21 = 0;
for (const f of appFiles) { const t = fs.readFileSync(__dirname + '/../app/' + f, 'utf8'); app17 += count(t, /1\.7f/g); app21 += count(t, /2\.1f/g); }
check(app17 === 0 && app21 === 0, 'no 1.7f / 2.1f anywhere in app/ except StatusPill.cs (got ' + app17 + 'x1.7f, ' + app21 + 'x2.1f in the listed files)');
check(fs.readFileSync(__dirname + '/../app/StatusPill.cs', 'utf8').includes('1.7f'), 'StatusPill still has its own 1.7f pens (different control, deliberately untouched)');


// ---------- F. jsdom DOM smoke: the unchanged shell still loads clean ----------
// shell.html is byte-identical to v42, so the full DOM behaviour is identical
// by construction; this smoke only proves the packaged file still loads and
// the settings page renders with zero page errors (a broken embed would
// show up here before it ever reached the laptop).
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

(async () => {
  {
    const { dom, errors } = makeDom();
    const { window } = dom; const { document } = window;
    feed(window, SETTINGS);
    goSettings(window);
    const t = document.querySelector('[data-key="hotkeyEnabled"]');
    check(t !== null, 'settings page renders the hotkeyEnabled toggle (shell still loads)');
    check(t.getAttribute('aria-checked') === 'true', 'toggle shows ON when hotkeyEnabled is true');
    check(document.querySelectorAll('.set-card').length === 10 && document.querySelectorAll('.set-card').length + document.querySelectorAll('.card.panel-pad').length === 11, 'settings page still renders 10 set-cards + the save-start action card = 11 cards');
    check(errors.length === 0, 'no page errors on load + settings page: ' + errors.join(' | ').slice(0, 200));
  }

  for (const d of doms) d.window.close(); // stop jsdom's visual timers so node exits
  // n counts passes only (see check() above), so the total is n + fail.
  console.log(`DOM TOTAL ${n}/${n + fail} passed`);
  if (fail) { console.log('FAILURES: see above'); process.exit(1); }
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
