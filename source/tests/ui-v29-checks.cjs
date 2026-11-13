// v29 static checks for the Fluent 4px baseline grid (run with TZ=Asia/Shanghai):
// ONE change: every spacing value in the app converges to the 4px baseline grid
// — only 0/4/8/12/16/24 (logical px). List rows converge to ~70px. The v28
// Settings card spacing (12px) is untouched. No layout structure, colors,
// corner radii (v24's 4/8 scale), motion (v21 MotionTokens), icons, or user
// settings change. Exactly two justified exceptions remain, both 40px and both
// derived alignments — see the checks below. Nothing is injected into muse.ai.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const appSettings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }
function count(re) { return (shell.match(re) || []).length; }

// --- the grid proof: every padding/margin/gap value in the file ---
// shell.html has SIX <style> blocks (main + v11-layout + v12-layout +
// v13-polish + v27-infobar + reach-focus-fix); the audit scans the whole
// file line by line, exactly like the pre-edit audit did. Negative values
// count by magnitude (a -8px top margin is an 8px step, on-grid).
const GRID = new Set([0, 4, 8, 12, 16, 24]);
let declCount = 0; const offGrid = []; const fortySites = [];
shell.split('\n').forEach((line) => {
  for (const m of line.matchAll(/(padding|margin|gap|row-gap|column-gap)(?:-(top|right|bottom|left))?\s*:\s*([^;{}]+)/g)) {
    declCount++;
    const prop = m[0].split(':')[0].trim();
    const val = m[3].trim();
    const before = line.slice(0, m.index);
    const li = before.lastIndexOf('{');
    const sel = li >= 0 ? before.slice(0, li).split(/[};]/).pop().trim().slice(0, 60) : '(?)';
    for (const num of val.match(/(-?\d+(?:\.\d+)?)px/g) || []) {
      const v = Math.abs(parseFloat(num));
      if (!GRID.has(v)) {
        if (v === 40) fortySites.push(sel + ' :: ' + prop + ': ' + val);
        else offGrid.push(sel + ' :: ' + prop + ': ' + val);
      }
    }
  }
});
check(declCount === 224, '224 spacing declarations audited across all 6 <style> blocks (222 + 2 on-grid ones v31 added: .skel gap:12px, .empty .secondary margin-top:8px)');
check(offGrid.length === 0, 'no spacing value outside {0,4,8,12,16,24} except the 40px exceptions' + (offGrid.length ? ' — ' + offGrid.join(' | ') : ''));
check(fortySites.length === 5, 'exactly 5 off-grid sites, all 40px: ' + fortySites.join(' ; '));
check(fortySites.filter(s => s.startsWith('.tool ::') || s.startsWith('.task ::') || s.startsWith('.demo-tip ::')).length === 3, 'exception A: .tool / .task / .demo-tip left 40px (avatar 27px + message gap 12px = 39px, 1px tolerance)');
check(fortySites.filter(s => s.startsWith('.task-steps ::')).length === 2, 'exception B: .task-steps left 40px in two places (header pad 16 + icon 16 + gap 8 = 40px exactly)');

// --- spot checks: the headline new values ---
check(shell.includes('.log-main{display:flex;align-items:flex-start;gap:12px;width:100%;padding:8px 16px;'), 'log rows: padding 8px 16px, gap 12px');
check(shell.includes('.state-row{display:flex;align-items:center;gap:12px;padding:16px 0;border-top:1px solid var(--border2)}'), 'connection state rows: padding 16px 0');
check(shell.includes('.page-column{width:min(860px,calc(100% - 48px));margin:0 auto;padding:24px 0 24px}'), 'page gutters: 48px per side, padding 24px');
check(shell.includes('.chat-column{width:min(790px,calc(100% - 48px));margin:0 auto}'), 'chat column gutter: 48px per side');
check(shell.includes('.compose-column{max-width:790px;width:calc(100% - 48px);margin:0 auto}'), 'composer column gutter: 48px per side');
check(shell.includes('.topbar{height:66px;flex:0 0 66px;display:flex;align-items:center;padding:0 24px;gap:16px;'), 'topbar: padding 24px, gap 16px');
check(shell.includes('.sidebar{position:relative;width:250px;flex:0 0 250px;') && shell.includes('padding:24px 12px 16px}'), 'sidebar: width stays 250px, padding 24px 12px 16px');
check(shell.includes('.user-bubble{background:var(--layer2);border:1px solid var(--border);padding:12px 16px;'), 'user bubble: padding 12px 16px (was 10px 15px)');
check(shell.includes('.set-card-text small{display:block;font-size:12px;color:var(--sub);margin-top:4px;line-height:1.7;overflow-wrap:anywhere}'), 'settings card description: margin-top 4px (was 3px)');
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:16px 0 12px}'), 'collapsed rail: width stays 48px, padding 16px 0 12px');
check(shell.includes('.tag{border-radius:8px;font-size:10px;padding:0 8px;'), 'tag chip: vertical padding 0 so it cannot stretch a log row');
check(shell.includes('.log-desc{font-size:11px;color:var(--sub);margin:0}'), 'log desc margin 0 (was 4px 0)');
check(shell.includes('.tool{margin:-8px 0 24px 40px;') && shell.includes('padding:12px 16px}.tool-row'), 'tool card: margin -8px 0 24px 40px, padding 12px 16px');
check(shell.includes('.task{margin:4px 0 24px 40px;'), 'task card: margin 4px 0 24px 40px');
check(shell.includes('.task-steps{padding:0 16px 12px 40px}'), 'task steps: padding 0 16px 12px 40px');
check(shell.includes('.task-steps{padding-left:40px}'), 'task steps override: padding-left 40px (the second exception site)');
check(shell.includes('.set-card{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;min-width:0') && shell.includes('padding:16px 16px}'), 'v28 settings card: padding now 16px 16px, gap 24px (was 16px 18px / 20px)');
check(shell.includes('.filters{display:flex;gap:4px;padding:4px;'), 'filter pill group: gap 4px');
check(shell.includes('.filter{border:0;background:transparent;color:var(--sub);font-size:11px;padding:8px 12px;'), 'filter pill: padding 8px 12px');
check(shell.includes('.dialog{width:min(460px,100%);max-height:95vh;overflow:auto;border-radius:8px;background:var(--layer);border:1px solid var(--border);box-shadow:var(--shadow);padding:24px}'), 'dialog: padding 24px');
check(shell.includes('.infobar{display:flex;align-items:center;gap:12px;padding:12px 24px;'), 'infobar: padding 12px 24px, gap 12px');
check(shell.includes('@media(max-width:1050px){.infobar{padding:12px 24px}'), 'infobar at 1050px: padding 12px 24px');
check(shell.includes('@media(max-width:560px){.infobar{padding:12px 12px}'), 'infobar at 560px: padding 12px 12px');

// --- list-row heights, derived from the CSS values asserted above ---
// body font 13px / line-height 1.65 (inherited by every row line).
// v30 superseded the v29 two-size split: .log-summary now sets 11.5px, so
// op/program names are 11.5px like file rows (was 13px -> 21.45px line).
// log row (op/program): 18.975 + desc 18.15 + time 16.5 + vertical padding 16 = 69.625px.
// log row (file/watch): 18.975 + 18.15 + 16.5 + 16 = 69.625px.
// The 28px glyph and the 16.5px tag fit inside both stacks.
// state row: b 12px*1.65=19.8 + span 11px*1.65=18.15 + vertical padding 32px = 69.95px.
// Old heights (same derivation): op 94.1px / file 91.6px (30px padding + 8px desc
// margins), state 63.95px (26px padding).
const logRowOp = 11.5 * 1.65 + 11 * 1.65 + 10 * 1.65 + 16;
const logRowFile = 11.5 * 1.65 + 11 * 1.65 + 10 * 1.65 + 16;
const stateRow = 12 * 1.65 + 11 * 1.65 + 32;
check(Math.abs(logRowOp - 69.6) < 0.05, 'execution-log row height now ' + logRowOp.toFixed(2) + 'px, equal to work-file rows (was 72.1px, 2.5px spread closed by v30)');
check(Math.abs(logRowFile - 70) < 1, 'work-file row height ' + logRowFile.toFixed(2) + 'px ≈ 70px (was 91.6px)');
check(Math.abs(stateRow - 70) < 1, 'state row height ' + stateRow.toFixed(2) + 'px ≈ 70px (was 63.95px)');
check(shell.includes('.log-name b{font-size:11.5px;font-weight:660}') && shell.includes('.log-time{font-size:10px;'), 'row font sizes feeding the derivation are still 11.5px / 10px');
check(shell.includes('.log-summary{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer;font-size:11.5px}'), '.log-summary sets font-size 11.5px (v30 superseded the v29 no-font-size form; op/program rows now 69.63px like file rows)');
check(shell.includes('.state-body b{display:block;font-size:12px;font-weight:650}'), 'state row title still 12px');

// --- v28 settings spacing is untouched at 12px ---
check(shell.includes('.set-list{display:grid;gap:12px}'), 'settings card list gap still 12px');
check(shell.includes('.set-card-stack{flex-direction:column;align-items:flex-start;gap:12px}'), 'theme card stack gap still 12px');
check(shell.includes('.swatches{display:flex;flex-wrap:wrap;gap:8px}'), 'swatch row gap still 8px');
const render = shell.slice(shell.indexOf("else if(state.page==='settings')"), shell.indexOf("else if(state.page==='settings')") + 6000);
const toggleKeys = [...render.matchAll(/toggle\('([a-zA-Z]+)'/g)].map(m => m[1]);
check(JSON.stringify(toggleKeys) === JSON.stringify(['sidebarCollapsed', 'minimizeToTray', 'startWithWindows', 'hotkeyEnabled', 'animationsEnabled', 'recentChangesCollapsed', 'recentFilesCollapsed']), '7 toggle cards, exact keys in order (no setting added, removed, or renamed)');
check(!appSettings.includes('v29') && !/public\s+\w+\s+\w+\s*{\s*get/.test(appSettings.replace(/theme|sidebarCollapsed|sidebarSide|animationsEnabled|recentChangesCollapsed|recentFilesCollapsed|startWithWindows|minimizeToTray|hotkeyEnabled|webZoom|museStartUrl|windowBounds|windowMaximized/g, '')), 'AppSettings.cs carries no new setting key');

// --- nothing else moved: radii (v24), motion (v21), title bar, widths ---
check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii (49 + v31 skeleton row .skel-row, v43 established)');
check(count(/border-radius:4px[;}]/g) === 7, '7 plain 4px radii (v24 scale untouched)');
check(!shell.includes('border-radius:12px') && !shell.includes('border-radius:16px') && !shell.includes('border-radius:6px'), 'no old numeric radius back');
check(tokens.includes('public const int ControlFasterMs = 83;') && tokens.includes('public const int ControlFastMs = 167;') && tokens.includes('public const int ControlNormalMs = 250;'), 'MotionTokens 83/167/250 untouched');
check(tokens.includes('public const int ControlFasterExitMs = 62;') && tokens.includes('public const int ControlFastExitMs = 125;') && tokens.includes('public const int ControlNormalExitMs = 188;'), 'MotionTokens exit 62/125/188 untouched');
check(main.includes('_titleLabel.Margin = new Padding(12, 10, 10, 0);'), 'title-bar label margin frozen (12,10,10,0)');
check(main.includes('_status.Margin = new Padding(0, 5, 0, 0);'), 'title-bar status margin frozen (0,5,0,0)');
check(main.includes('Padding = new Padding(8);') && main.includes('new Padding(8); };'), 'MainForm window padding 6 -> 8 (initial + resize handler)');
check(!main.includes('new Padding(6)'), 'no Padding(6) left in MainForm');
check(shell.includes('width:250px;flex:0 0 250px') && shell.includes('width:48px;flex-basis:48px'), 'sidebar widths 250px / 48px unchanged');
check(shell.includes("selPill"), 'v25 selection pill untouched');
check(shell.includes('window.MOTION=MOTION;'), 'v26 MOTION sharing untouched');
check(shell.includes('infobarSync();'), 'v27 infobar wiring untouched');

// --- no injection into muse.ai pages ---
check(count(/muse\.ai/g) === 1, 'muse.ai appears exactly once in shell.html');
check(shell.includes("'https://muse.ai/'"), 'the single muse.ai occurrence is the settings-page evidence default URL');
check(!shell.includes('muse.ai/script') && !shell.includes('src="https://muse.ai') && !shell.includes("src='https://muse.ai"), 'no script loaded from muse.ai');
check(!shell.includes('document.createElement(\'script\')') && !shell.includes('document.createElement("script")'), 'no script element created at runtime');

// --- version strings ---
check(main.includes('Text = "Muse Reach v29"'), 'window title is v29');
check(main.includes('Text="Muse Reach v29"'), 'tray text is v29');
check(!main.includes('Muse Reach v28'), 'no v28 version string left in MainForm');
check(proj.includes('<Version>0.29.0</Version>'), 'project version is 0.29.0');
check(!proj.includes('0.28.0'), 'no 0.28.0 left in the project file');

console.log('TOTAL ' + n);
