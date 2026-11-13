// v28 static checks for the Win11-style Settings page (run with TZ=Asia/Shanghai):
// ONE change: the Settings page is rebuilt as one card per setting — 14px title
// + 12px plain-language description on the left, the control on the right,
// 12px gaps on the 4px grid; theme becomes visual swatches (click to switch,
// selected swatch marked by shape AND color); the four settings that used to
// live only on the sidebar / files page (sidebar side, sidebar collapse,
// recent-changes collapsed, recent-files collapsed) get cards too. Every
// setting keeps its key and behavior; C# changes are version strings only.
// v46: five pins in this file stopped at superseded values and are updated
// here (updated, never deleted — the v39/v41/v42/v43/v44/v45 precedent).
// Verdict (b) test bug, not a product bug. v29's 4px-grid convergence
// deliberately changed three settings-card values (v29 REPORT audit table
// L118-120: .set-card gap 20px -> 24px, padding 16px 18px -> 16px 16px,
// .set-card-text small margin-top 3px -> 4px); the description font size
// itself never moved — still 12px on all 10 set-cards (the 11th card, the
// save-start panel, uses .panel-desc at 11.5px, unchanged since v28).
// The 8px-radius count pin (49) is the same v31 .skel-row that v43 fixed
// in ui-v24 (50 = 49 + 1 skeleton row), and the collapsed-rail padding
// pin (18px 0 12px) is the same v29 change (18 -> 16px) that ui-v22
// already followed. The version pins ('Muse Reach v28', 0.28.0) are
// deliberately left: old version files stop at their version assertions
// by design.
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

// --- card inventory: 11 settings, no missing, no extra, no renamed keys ---
const render = shell.slice(shell.indexOf("else if(state.page==='settings')"), shell.indexOf("else if(state.page==='settings')") + 6000);
check(render.length > 3000, 'settings render block found');
const toggleKeys = [...render.matchAll(/toggle\('([a-zA-Z]+)'/g)].map(m => m[1]);
check(JSON.stringify(toggleKeys) === JSON.stringify(['sidebarCollapsed', 'minimizeToTray', 'startWithWindows', 'hotkeyEnabled', 'animationsEnabled', 'recentChangesCollapsed', 'recentFilesCollapsed']), '7 toggle cards, exact keys in order: ' + toggleKeys.join(','));
check(render.includes("data-action=\"theme\""), 'theme swatches send the setting action');
check(render.includes("data-action=\"side\""), 'sidebar-side segmented control sends the setting action');
check(render.includes("id=\"webZoom\""), 'web-zoom select kept');
check(render.includes("data-action=\"save-start\""), 'save-start action card kept');
check(render.includes("'界面主题'") && render.includes("'侧栏位置'") && render.includes("'收起侧栏'"), 'theme / sidebar-side / sidebar-collapse cards present');
check(render.includes("'最近变化默认收起'") && render.includes("'最近文件默认收起'"), 'recent-changes / recent-files collapse cards present');
check(render.includes('全局热键 Ctrl+Alt+Space（随时呼出）'), 'hotkey card description names the global hotkey verbatim');
check(!shell.includes('id="theme"'), 'old theme <select> is gone');
check(!shell.includes("ev.target.id==='theme'"), 'dead theme-select change branch is gone');
check(!shell.includes('setting-row'), 'old scattered setting-row markup and CSS are gone');

// --- theme swatches: 9 themes, colors from the real theme tokens ---
const themes = [...render.matchAll(/\['([a-z]+)','([^']+)','(#[0-9a-f]{6})','(#[0-9a-f]{6})'\]/g)];
check(themes.length === 9, '9 theme swatches');
check(JSON.stringify(themes.map(t => t[1])) === JSON.stringify(['dark', 'midnight', 'light', 'pink', 'purple', 'ocean', 'forest', 'amber', 'obsidian']), 'swatch keys match SetTheme exactly');
check(JSON.stringify(themes.map(t => t[2])) === JSON.stringify(['深色', '午夜蓝', '浅色', '渐变粉', '渐变紫', '深海蓝', '森绿', '琥珀橙', '曜石黑']), 'swatch names match the old select');
check(themes.find(t => t[1] === 'obsidian')[3] === '#0b0b0d' && themes.find(t => t[1] === 'obsidian')[4] === '#e8e8ec', 'obsidian swatch uses its real --bg/--accent');
check(themes.find(t => t[1] === 'ocean')[4] === '#5db4ff' && themes.find(t => t[1] === 'forest')[4] === '#5fd68a' && themes.find(t => t[1] === 'amber')[4] === '#ffb347', 'ocean/forest/amber swatches use their real accents');
check(render.includes("aria-pressed=\"'+(s.theme===v)+'\""), 'swatch pressed state echoes the current theme');
check(render.includes("icon('check')"), 'selected swatch carries a check glyph');
check(shell.includes('.swatch[aria-pressed="true"]{border:2px solid var(--accent)}'), 'selected swatch gets a 2px accent border (color marker)');
check(shell.includes('.swatch-check{position:absolute;top:-7px;right:-7px;width:16px;height:16px;display:grid;place-items:center;border-radius:4px;background:#111317;border:1px solid var(--accent);color:var(--accent)}'), 'selected swatch carries a check badge (shape marker, accent on dark)');

// --- card geometry: 14px title / 12px description, 12px gaps, narrow-safe ---
check(shell.includes('.set-card-text b{display:block;font-size:14px;font-weight:650}'), 'card title is 14px');
check(shell.includes('.set-card-text small{display:block;font-size:12px;color:var(--sub);margin-top:4px;line-height:1.7;overflow-wrap:anywhere}'), 'card description is 12px, wrapping');
check(shell.includes('.set-list{display:grid;gap:12px}'), 'card gap is 12px on the 4px grid');
check(shell.includes('.set-card{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:24px;min-width:0'), 'card row wraps instead of clipping at narrow widths');
check(shell.includes('.set-card-stack{flex-direction:column;align-items:flex-start;gap:12px}'), 'theme card stacks text over swatches');
check(shell.includes('.swatches{display:flex;flex-wrap:wrap;gap:8px}'), 'swatch row wraps to the available width');
check(shell.includes('.set-card{') && shell.includes('border-radius:8px;padding:16px 16px}'), 'cards are 8px (v24 scale)');
check(shell.includes('.section-label">外观</div>') || render.includes("section-label\">外观"), 'appearance section label present');
check(render.includes("section-label\">侧栏") && render.includes("section-label\">使用习惯"), 'sidebar / habits section labels present');

// --- wiring: same keys, same C# paths, no new settings keys ---
check(shell.includes("else if(a==='theme')send({type:'setting',key:'theme',value:b.dataset.value});"), 'swatch click sends the theme setting');
check(shell.includes("else if(a==='side')send({type:'setting',key:'sidebarSide',value:b.dataset.value});"), 'side click sends the sidebarSide setting');
check(main.includes('else if(key=="theme"){_settings.SetTheme(r.GetProperty("value").GetString());_loadingOverlay?.ApplyTheme(_settings.theme);}'), 'C# theme path untouched (v32 also applies the theme to the loading overlay)');
check(main.includes("else if(key==\"sidebarSide\")_settings.SetSidebarSide"), 'C# sidebarSide path untouched');
check(appSettings.includes('case "recentChangesCollapsed":recentChangesCollapsed=value;break;'), 'C# recentChangesCollapsed path untouched');
check(appSettings.includes('case "recentFilesCollapsed":recentFilesCollapsed=value;break;'), 'C# recentFilesCollapsed path untouched');
check(!/case "[a-zA-Z]+":/.test(appSettings.replace(/case "sidebarCollapsed"|case "minimizeToTray"|case "hotkeyEnabled"|case "animationsEnabled"|case "recentChangesCollapsed"|case "recentFilesCollapsed"|case "startWithWindows"/g, '')), 'no new boolean setting key added in C#');
check(shell.includes("document.addEventListener('change',ev=>{if(ev.target.id==='webZoom')"), 'webZoom change listener kept, theme branch removed');

// --- untouched: other pages, tokens, radii, pill, infobar, dialog, version ---
check(shell.includes('const MOTION={faster:83,fast:167,theme:200,normal:250,fastExit:125};'), 'JS MOTION const still mirrors the token table');
check(tokens.includes('public const int ControlFastMs = 167;'), 'ControlFast token still 167ms');
check(count(/border-radius:8px[;}]/g) === 50, '50 plain 8px radii (49 + v31 skeleton row .skel-row, v43 established)');
check(count(/border-radius:4px[;}]/g) === 7, '7 plain 4px radii (v28: +1 is .swatch-check chip)');
check(count(/border-radius:50%/g) === 4, 'still four circular dots, no new 50% radius');
check(!shell.includes('border-radius:12px') && !shell.includes('border-radius:16px') && !shell.includes('border-radius:2px'), 'no old numeric radius back');
check(shell.includes("}infobarSync();document.body.dataset.theme="), 'v27 infobar wiring untouched');
check(!main.includes('AppWindow'), 'no AppWindow.TitleBar API introduced');
check(main.includes('Text = "Muse Reach v28"'), 'window title is v28');
check(main.includes('Text="Muse Reach v28"'), 'tray text is v28');
check(!main.includes('Muse Reach v27'), 'no v27 version string left in MainForm');
check(proj.includes('<Version>0.28.0</Version>'), 'project version is 0.28.0');
check(!proj.includes('0.27.0'), 'no 0.27.0 left in the project file');
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:16px 0 12px}'), 'collapsed rail still 48px, padding 16px 0 12px since v29 (was 18px)');
check(shell.includes("selPill"), 'v25 selection pill untouched');
check(shell.includes('window.MOTION=MOTION;'), 'v26 MOTION sharing untouched');

console.log('TOTAL ' + n);
