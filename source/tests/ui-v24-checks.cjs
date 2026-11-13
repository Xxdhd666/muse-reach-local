// v24 static checks for shell.html corner radii (run with TZ=Asia/Shanghai):
// ONE change: every corner radius converges to the Fluent 2 two-token scale —
// 8px (cards, panels, content-area outer corners) and 4px (controls, buttons,
// inputs, small elements). The old 12/16/18/9/10/6/2px values are gone; the
// content area (.workspace) gains border-radius:8px 0 0 0 (WinUI NavigationView
// convention: only the outer top-left corner rounds, the rest stay square
// against the sidebar and the window edges). The title-bar pill stays 6px
// (v18, separate from the 4/8 scale), the DWM window corners stay system 8px
// (DWMWCP_ROUND), MotionTokens and all user settings are untouched.
// NOT radius tokens and deliberately kept: border-radius:50% (circular dots
// and the toggle knob) and 9999px (pill shapes: status chip, toggle track,
// progress track, scrollbar thumb). A pill or a circle cannot be expressed as
// 4px/8px without changing the shape; Fluent uses the same fully-rounded
// idiom. Numeric px radii after this change are only 4px and 8px.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const strip = fs.readFileSync(__dirname + '/../app/CaptionStrip.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/CaptionStripMath.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }
function count(re) { return (shell.match(re) || []).length; }

// --- no old numeric radii remain anywhere in the shell ---
check(!shell.includes('border-radius:12px'), 'no 12px radius left');
check(!shell.includes('border-radius:16px'), 'no 16px radius left');
check(!shell.includes('border-radius:18px'), 'no 18px radius left');
check(!shell.includes('border-radius:9px'), 'no 9px radius left');
check(!shell.includes('border-radius:10px'), 'no 10px radius left');
check(!shell.includes('border-radius:6px'), 'no 6px radius left');
check(!shell.includes('border-radius:2px'), 'no 2px radius left');
check(!shell.includes('border-radius:14px'), 'no 14px radius left');
check(!shell.includes('--r:12px'), 'the --r token is no longer 12px');
check(!/border-radius:(12|14|16|18|9|10|6|2)px/.test(shell), 'no other stray numeric radius');
check(!/border-(top|bottom)-(left|right)-radius/.test(shell), 'no longhand radius property smuggled in');

// --- numeric radii are only 4px / 8px (plus the two 4-value shorthands) ---
check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii'); // [;}] so the two 4-value shorthands (8 8 4 8, 8 0 0 0) are not double-counted; v25: +1 is the .sel-pill rect; v27: +1 is the .infobar-ico tile; v28: +2 are the .set-card and .swatch tiles; v31: +1 is the .skel-row skeleton row (v31 REPORT §178-179 already counted "50x8px (49 + 1 skeleton row)"; the pin was never updated)
check(count(/border-radius:4px[;}]/g) === 7, '7 plain 4px radii'); // v25: +1 is the .sel-pill:before bar; v28: +1 is the .swatch-check chip
check(shell.includes('border-radius:8px 8px 4px 8px'), 'user bubble tail keeps its 4px corner, others 8px');
check(shell.includes('border-radius:8px 0 0 0'), 'workspace content corner is 8,0,0,0');
check(count(/border-radius:8px 0 0 0/g) === 1, 'the 8,0,0,0 corner appears exactly once');
check(shell.includes('--r:8px'), '--r token is 8px');
check(shell.includes('.codeblock{margin:12px 0;border:1px solid var(--border);border-radius:var(--r);'), 'codeblock still uses the --r token');

// --- 12px cards/panels -> 8px (spot checks on the full list) ---
check(shell.includes('.mark{height:34px;width:34px;display:grid;place-items:center;border:1px solid rgba(126,224,201,.21);border-radius:8px'), 'brand mark tile is 8px');
check(shell.includes('.notice{position:absolute;right:27px;top:58px;z-index:16;width:320px;background:var(--layer);border:1px solid var(--border);border-radius:8px'), 'notice panel is 8px');
check(shell.includes('.user-bubble{background:var(--layer2);border:1px solid var(--border);padding:12px 16px;border-radius:8px'), 'user bubble base is 8px'); // v29: padding 10px 15px -> 12px 16px (spacing converged to the 4px grid; radius still 8px)
check(shell.includes('.tool{margin:-8px 0 24px 40px;background:var(--layer);border:1px solid var(--border);border-radius:8px'), 'tool card is 8px'); // v29: margin -7px 0 25px -> -8px 0 24px (4px grid; radius still 8px)
check(shell.includes('.task{margin:4px 0 24px 40px;background:var(--layer);border:1px solid var(--border);border-radius:8px'), 'task card is 8px'); // v29: margin 2px 0 32px -> 4px 0 24px (4px grid; radius still 8px)
check(shell.includes('.idea{min-height:56px;text-align:left;display:flex;align-items:center;gap:12px;color:var(--sub);border-radius:8px'), 'idea card is 8px'); // v29: gap 10px -> 12px (4px grid; radius still 8px)
check(shell.includes('.card{border:1px solid var(--border);background:var(--layer);border-radius:8px'), 'card is 8px');
check(shell.includes('.filters{display:flex;gap:4px;padding:4px;border-radius:8px'), 'filters shell is 8px'); // v29: gap 5px -> 4px (4px grid; radius still 8px)
check(shell.includes('.banner{display:flex;align-items:center;gap:8px;padding:12px 12px;border-radius:8px'), 'banner is 8px'); // v29: padding 10px 12px -> 12px 12px (4px grid; radius still 8px)
check(shell.includes('.warning-note{border:1px solid var(--border);border-radius:8px'), 'warning note is 8px');
check(shell.includes('.dialog-symbol{display:grid;place-items:center;width:40px;height:40px;border-radius:8px'), 'dialog symbol tile is 8px');
check(shell.includes('.toast{white-space:nowrap;color:var(--text);background:var(--layer2);border:1px solid var(--border);box-shadow:var(--shadow);border-radius:8px'), 'toast is 8px');

// --- 16/18px large surfaces -> 8px ---
check(shell.includes('.welcome .mark{height:54px;width:54px;border-radius:8px'), 'welcome brand tile is 8px');
check(shell.includes('.composer{border:1px solid #3b4048;background:var(--layer);border-radius:8px'), 'composer base is 8px');
check(shell.includes('.composer{border-radius:8px}'), 'composer override is 8px');
check(shell.includes('.dialog{width:min(460px,100%);max-height:95vh;overflow:auto;border-radius:8px'), 'dialog is 8px');

// --- 9/10px near-misses -> 8px ---
check(shell.includes('.message .round-x{font-family:var(--mono);font-size:12px;border-radius:8px}'), 'avatar tile override is 8px');
check(shell.includes('.log-glyph{border-radius:8px}'), 'log glyph override is 8px');
check(shell.includes('.state-layer{width:32px;height:32px;border-radius:8px'), 'state layer tile is 8px');
check(shell.includes('.send{width:34px;height:34px;border-radius:8px}'), 'send button override is 8px');
check(shell.includes('.idea-ico{width:36px;height:36px;flex:0 0 36px;border-radius:8px'), 'idea icon tile is 8px');

// --- 6px small controls + 2px marker -> 4px ---
check(shell.includes('.msg-copy{margin-left:auto;opacity:0;border:0;background:transparent;color:var(--dim);width:24px;height:24px;border-radius:4px'), 'copy button is 4px');
check(shell.includes('.code-head button{display:flex;align-items:center;gap:4px;border:0;background:transparent;color:var(--dim);font-size:11px;padding:4px 8px;border-radius:4px}'), 'code copy button is 4px'); // v29: gap 5px -> 4px (4px grid; radius still 4px)
check(shell.includes('.sel-pill:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:4px'), 'sliding pill bar is 4px (clamped to 1.5px by its 3px width, visually unchanged)'); // v25: the live marker moved from .side-link.active:before to .sel-pill:before; script updated, product intent unchanged

// --- nested radius rule: 8px shell, 4px inner controls (8 - 4 padding = 4) ---
check(shell.includes('.filters{border-radius:8px}'), 'filters override is 8px');
check(shell.includes('.filters>.filter{border-radius:4px}'), 'filter inside the shell is 4px');
check(shell.includes('.filter{border:0;background:transparent;color:var(--sub);font-size:11px;padding:8px 12px;border-radius:4px'), 'filter base is 4px'); // v29: padding 6px 11px -> 8px 12px (4px grid; radius still 4px)
check(shell.includes('/* Keep the 8px outer tab shell and its 4px inner controls parallel:'), 'nested-radius comment updated to 8/4');
check(!shell.includes('12px outer tab shell'), 'old 12px nested-radius comment is gone');

// --- content area corner: only the outer top-left rounds ---
check(shell.includes('.workspace{min-width:0;flex:1;display:flex;flex-direction:column;background:var(--main);overflow:hidden;border-radius:8px 0 0 0}'), 'workspace has the 8,0,0,0 content corner');
check(shell.includes('/* v24: 内容区左上角 8,0,0,0'), 'workspace corner carries the v24 note');
check(!/\.workspace\{[^}]*border-radius:[^8]/.test(shell), 'no theme .workspace override sets a different radius');
check(shell.includes('.sidebar{position:relative;width:250px;flex:0 0 250px;display:flex;flex-direction:column;background:var(--side);border-right:1px solid var(--border2);padding:24px 12px 16px}'), 'sidebar itself keeps square corners (no radius added)'); // v25: position:relative added so the sidebar is the pill positioning context; still no radius; v29: padding 20px 12px 15px -> 24px 12px 16px (4px grid)

// --- circle/pill idiom kept deliberately (not radius tokens) ---
check(count(/border-radius:9999px/g) === 4, 'four pill shapes stay fully rounded (status, toggle, task track, scrollbar thumb)');
check(shell.includes('.status{display:inline-flex;align-items:center;gap:8px;border-radius:9999px'), 'status chip stays a pill'); // v29: gap 7px -> 8px (4px grid; pill shape unchanged)
check(shell.includes('.toggle{width:37px;height:21px;border-radius:9999px'), 'toggle track stays a pill');
check(shell.includes('.task-track{height:3px;background:var(--layer2);border-radius:9999px'), 'progress track stays a pill');
check(shell.includes('::-webkit-scrollbar-thumb{border-radius:9999px'), 'scrollbar thumb stays a pill');
check(count(/border-radius:50%/g) === 4, 'four circular dots stay circular (status dot, notify dot, toggle knob, typing dots)');
check(shell.includes('.status:before{content:"";height:6px;width:6px;border-radius:50%'), 'status dot stays circular');
check(shell.includes('.notify-dot{position:absolute;top:5px;right:6px;height:6px;width:6px;border-radius:50%'), 'notify dot stays circular');
check(shell.includes('.toggle:before{content:"";height:15px;width:15px;position:absolute;left:2px;top:2px;border-radius:50%'), 'toggle knob stays circular');
check(shell.includes('.typing i{display:block;height:5px;width:5px;background:var(--accent);border-radius:50%'), 'typing dots stay circular');

// --- 8px controls that were already right are untouched (spot checks) ---
check(shell.includes('.new-btn{height:39px;border-radius:8px'), 'new-chat button still 8px');
check(shell.includes('.history-item,.side-link{height:36px;border:1px solid transparent;border-radius:8px'), 'sidebar rows still 8px');
check(shell.includes('.icon-button{width:34px;height:34px;display:grid;place-items:center;border:0;border-radius:8px'), 'icon buttons still 8px');
check(shell.includes('.tag{border-radius:8px'), 'tags still 8px');
check(shell.includes('.search{border:1px solid var(--border);border-radius:8px'), 'search box still 8px');
check(shell.includes('.select{border:1px solid var(--border);border-radius:8px'), 'select still 8px');
check(shell.includes('.action-button{padding:8px 12px;display:inline-flex;align-items:center;gap:8px;border-radius:8px'), 'action button still 8px'); // v29: padding 9px 13px -> 8px 12px, gap 7px -> 8px (4px grid; radius still 8px)
check(shell.includes('.secondary{border:1px solid var(--border);border-radius:8px'), 'secondary button still 8px');
check(shell.includes('.primary{border:0;border-radius:8px'), 'primary button still 8px');

// --- untouched: pill, DWM corners, motion tokens, version bump, no new API ---
check(math.includes('PillRadiusLogical = 6f'), 'title-bar pill radius stays 6px (v18, outside the 4/8 scale)');
check(math.includes('PillInsetLogical = 4f'), 'pill inset stays 4 logical px');
check(main.includes('int pref = 2; // DWMWCP_ROUND'), 'window corners stay DWM system round (8px)');
check(tokens.includes('public const int ControlFasterMs = 83;'), 'ControlFaster is still 83ms');
check(tokens.includes('public const int ControlFasterExitMs = 62;'), 'ControlFaster exit is still 62ms');
check(main.includes('Text = "Muse Reach v24"'), 'window title is v24');
check(main.includes('Text="Muse Reach v24"'), 'tray text is v24');
check(!main.includes('Muse Reach v23'), 'no v23 version string left in MainForm');
check(proj.includes('<Version>0.24.0</Version>'), 'project version is 0.24.0');
check(!proj.includes('0.23.0'), 'no 0.23.0 left in the project file');
check(!strip.includes('AppWindow') && !main.includes('AppWindow'), 'no AppWindow.TitleBar API introduced');
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:18px 0 12px}'), 'v22 collapsed rail is untouched in the shell');

console.log('TOTAL ' + n);
