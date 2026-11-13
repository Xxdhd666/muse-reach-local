// v22 static checks for C# sources + shell.html (run with TZ=Asia/Shanghai):
// ONE change: the collapsed sidebar becomes a standard 48px icon rail
// (VS Code activity-bar pattern, Microsoft Learn NavigationView): collapsed
// width 48 logical px (was 64), each item a 48x48 hit area with a 20px icon
// centered, brand shrinks to logo only, selected item marked with a 3px
// accent bar + light background, hover tooltips (name; no per-page shortcuts
// exist, so name only), no secondary groups to hide. Behavior: collapsed +
// current page icon toggles collapse/expand; expanded + current page does
// nothing (no reload, no white flash); flip moves only the sidebar.
// The v20 window clamp (MinWidth 570, expanded-state math), the v20
// AnimOverlay fixes, the v21 motion token table, corner radii, icon style
// and all user settings are untouched.
// v47: five stale pins updated to their current forms (verdict (b) test bug,
// not a product bug — evidence chain in REPORT §02). The file stopped at
// 0 passes because its FIRST check pinned the collapsed-rail literal with
// the v22 padding (18px 0 12px); v29's 4px-grid convergence deliberately
// changed it to 16px 0 12px (rail width still 48px). Four more pins hid
// behind it: the narrow-rail literal (same v29 change), the toggleCollapse
// one-liner (v33 rewrote it as a four-branch function for narrow-window
// auto-collapse), the page-click dispatch condition (v33: effectiveCollapsed()),
// and the caption-strip wiring (v36: EffectiveAnimations — the same fix
// v42 applied to ui-v18). None is deleted; each carries its reason, and
// two negative pins (old one-liner, old dispatch condition) plus a
// whole-body toggle navigation check are added so the file rejects the
// retired forms. The file's five regexes are untouched — all five still
// pass on v46 (the 'collapsed-rail regex' in the task brief is a misnomer:
// the first check is a literal string pin, not a regex). The version pins
// ('Muse Reach v22' etc.) are deliberately left: old files stop at their
// version assertions by design.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const overlay = fs.readFileSync(__dirname + '/../app/AnimOverlay.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const geom = fs.readFileSync(__dirname + '/../app/WindowGeometryMath.cs', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- collapsed rail: 48px wide, 48x48 items, 20px icons, logo-only brand ---
// v29 4px-grid convergence: rail padding 18px 0 12px -> 16px 0 12px (audit
// L199; REPORT §02). 18px is off-grid, 16px is on-grid; width stays 48px.
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:16px 0 12px}'), 'collapsed rail is 48px wide with zero horizontal padding (v29: padding 18px 0 12px -> 16px 0 12px)');
check(!shell.includes('.sidebar-collapsed .sidebar{width:64px'), 'old 64px collapsed width is gone');
check(shell.includes('.sidebar-collapsed .side-link{justify-content:center;padding:0;height:48px;width:48px}'), 'collapsed items are 48x48 hit areas');
check(shell.includes('.sidebar-collapsed .side-link svg{height:20px;width:20px}'), 'collapsed icons are 20px, centered');
check(shell.includes('.sidebar-collapsed .brand-text,.sidebar-collapsed .side-link span{display:none}'), 'collapsed brand is logo only, item labels hidden');
check(shell.includes('.mark{height:34px;width:34px'), 'brand logo mark stays 34px (fits the 48px rail)');
check(shell.includes('.sidebar-collapsed .collapse-control svg{transform:rotate(-90deg)}'), 'collapsed chevron direction kept');

// --- selected item: 3px accent bar + light background, same style for all six ---
check(shell.includes('.history-item.active:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:4px;background:var(--accent)}'), 'history-item marker is still a 3px accent bar'); // v25: the side-link bar moved to the shared sliding .sel-pill; script updated, product intent unchanged (see ui-v25)
check(!/\.side-link\.active:before\{[^}]*width:2px/.test(shell), 'old 2px selection bar is gone');
check(shell.includes('.history-item.active{background:var(--layer2);color:var(--text)}'), 'history-item keeps the light background'); // v25: the side-link background moved to the sliding .sel-pill (same layer2, same shape+color intent); script updated, product intent unchanged (see ui-v25)
check(shell.includes('.side-link.active{color:var(--text)}'), 'side-link active keeps the text colour (background now comes from the pill)');

// --- tooltips: name on every page button; no per-page shortcuts exist ---
check(shell.includes("const pages=[['muse','Muse','chat'],['files','工作文件','bookOpen'],['records','执行记录','listChecks'],['connection','连接状态','wifi'],['security','安全与权限','shield'],['settings','设置','settings']]"), 'six pages, name + icon each, no shortcut column');
check(shell.includes("title=\"'+t+'\""), 'page buttons carry a title tooltip with the page name');

// --- click behavior: collapsed current-page toggles, expanded current-page is a no-op ---
// v33 narrow-window auto-collapse rewrote toggleCollapse as a four-branch
// function (REPORT §02): auto-collapsed click = narrowOverride=true (temp
// expand, no settings write); manual-collapsed click = manual=false + save;
// override-expanded click = clear override; manual-expanded click =
// manual=true + save. Still ends animBegin('collapse',MOTION.normal);nav();
// and never navigates (whole-body check below).
check(shell.includes('function toggleCollapse(){\n  const s=state.data.settings;\n  if(effectiveCollapsed()&&autoCollapsed)narrowOverride=true;\n  else if(effectiveCollapsed()){s.sidebarCollapsed=false;send({type:\'setting\',key:\'sidebarCollapsed\',value:false});}\n  else if(narrowOverride)narrowOverride=false;\n  else{s.sidebarCollapsed=true;send({type:\'setting\',key:\'sidebarCollapsed\',value:true});}\n  animBegin(\'collapse\',MOTION.normal);nav();\n}'), 'toggleCollapse flips the setting, animates, re-renders the sidebar, persists (v33: four-branch form)');
check(!shell.includes('s.sidebarCollapsed=!s.sidebarCollapsed;animBegin(\'collapse\''), 'old v22 one-line toggle is gone (v33 four-branch form supersedes it)');
// v33 made toggleCollapse multi-line, so the `[^}]*` in the 'toggle path
// never navigates' regex below only spans to the first `}` of the body.
// Check the whole body for a navigation call here.
const toggleBody = shell.slice(shell.indexOf('function toggleCollapse(){'), shell.indexOf('\n}\n', shell.indexOf('function toggleCollapse(){')));
check(!toggleBody.includes('go('), 'toggle body contains no navigation call (whole multi-line body, v33)');
// v33: the dispatch condition is effectiveCollapsed() — manual OR auto
// collapsed, temp-expand wins (REPORT §02). v22 behaviour preserved and
// extended to the auto-collapsed state: collapsed click = temp expand.
check(shell.includes("if(a==='page'){const p=b.dataset.page;if(p===state.page){if(effectiveCollapsed())toggleCollapse();}else go(p);}"), 'collapsed current-page click toggles, expanded current-page click does nothing (v33: effectiveCollapsed())');
check(!shell.includes("if(state.data.settings?.sidebarCollapsed)toggleCollapse();"), 'old dispatch condition is gone (v33 effectiveCollapsed() supersedes it)');
check(shell.includes("else if(a==='collapse')toggleCollapse();"), 'collapse button reuses the same toggle path');
check(!shell.includes("if(a==='page')go(b.dataset.page);"), 'old unconditional page click is gone');
check(!/toggleCollapse\(\)\{[^}]*go\(/.test(shell), 'toggle path never navigates (no reload, no white flash)');
check(shell.includes("function go(p){if(!titles[p])return;state.page=p;render();send({type:'page',page:p});}"), 'go() itself unchanged (different-page clicks still navigate)');

// --- flip moves only the sidebar: nav() only, no render(), scroll preserved ---
check(shell.includes("animBegin('flip',MOTION.normal);document.body.classList.add('side-flipping');"), 'flip animation entry kept');
check(/else if\(a==='flip'\)\{[^}]*nav\(\);[^}]*bounds\(\);/.test(shell), 'flip re-renders only the sidebar and re-reports bounds');
check(!/else if\(a==='flip'\)\{[^}]*render\(\)/.test(shell), 'flip never re-renders the page');
check(shell.includes("if($('#main .page'))$('#main .page').scrollTop=scroll;"), 'snapshot handler still restores page scroll position');

// --- narrow-window fallback matches the rail (was 65px, now 48px) ---
// v29 4px-grid convergence: same change as the collapsed rail (audit L162).
check(shell.includes('@media(max-width:800px){.sidebar{width:48px;flex-basis:48px;padding:16px 0 12px}'), 'narrow-window sidebar matches the 48px rail (v29: padding 18px 0 12px -> 16px 0 12px)');
check(shell.includes('.history-item,.side-link{justify-content:center;padding:0;height:48px}.history-item svg,.side-link svg{height:20px;width:20px}'), 'narrow-window items match the 48x48 / 20px rail geometry');
check(!shell.includes('@media(max-width:800px){.sidebar{width:65px'), 'old 65px narrow-window width is gone');

// --- expanded layout untouched ---
check(shell.includes('.sidebar{position:relative;width:250px;flex:0 0 250px'), 'expanded sidebar still 250px'); // v25: position:relative added (pill positioning context); width unchanged
check(shell.includes('.brand-title{font-size:14px'), 'expanded brand title kept');
check(shell.includes('.brand-caption{font-size:10.5px'), 'expanded brand caption kept');
check(shell.includes('.side-link{height:36px'), 'expanded item height still 36px');

// --- motion tokens untouched: expand 250ms enter, collapse 188ms exit ---
check(tokens.includes('public const int ControlNormalMs = 250'), 'token table: normal 250ms kept');
check(tokens.includes('public const int ControlNormalExitMs = 188'), 'token table: normal exit 188ms kept');
check(shell.includes('--motion-normal:250ms;'), 'CSS token: normal 250ms kept');
check(shell.includes('--motion-normal-exit:188ms;'), 'CSS token: normal exit 188ms kept');
check(shell.includes('body.sidebar-collapsed .sidebar{transition:width var(--motion-normal-exit) var(--motion-ease-out)'), 'collapse still uses the normal exit token');
check(shell.includes('const MOTION={faster:83,fast:167,theme:200,normal:250,fastExit:125};'), 'JS MOTION const mirrors the token table, unchanged');
check(shell.includes("body.no-anim *,body.no-anim *:before,body.no-anim *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}"), 'animations-off instant switching kept');

// --- v20 window clamp untouched (MinWidth 570 = expanded 250 + content 320) ---
check(geom.includes('public const int SidebarWidth = 250;'), 'clamp math: expanded sidebar 250 kept');
check(geom.includes('public const int MinWidth = SidebarWidth + MinContentWidth;'), 'clamp MinWidth 570 kept');
check(!/CollapsedWidth|RailWidth|48px/.test(geom), 'no collapsed-width constant leaked into the geometry math');
check(geom.includes('public const int MinContentWidth = 320;'), 'clamp math: min content 320 kept');

// --- v20 AnimOverlay fixes intact ---
check(overlay.includes('动画收尾核对'), 'v20 Finish bounds-check log kept');
check(overlay.includes('glideMs=Math.Max(1,durationMs);'), 'v20 Begin stores the duration kept');
check(overlay.includes('safetyTimer=new Timer{Interval=Math.Max(60,durationMs+150)}'), 'overlay safety margin kept');
check(overlay.includes('Task.Delay(200)'), 'overlay capture timeout kept');

// --- version bump only, no settings change ---
check(main.includes('Muse Reach v22'), 'MainForm version bumped to v22');
check(main.includes('Text="Muse Reach v22"'), 'window title bumped to v22');
check(proj.includes('<Version>0.22.0</Version>'), 'project version bumped to 0.22.0');
check(!main.includes('Muse Reach v21'), 'no v21 version string left in MainForm');
check(!proj.includes('<Version>0.21.0</Version>'), 'no 0.21.0 left in the project file');
// v36: the strip follows the effective value (user switch AND OS switch),
// not the raw user switch — the same fix v42 applied to ui-v18 (REPORT §02).
check(main.includes('_captionStrip.AnimationsEnabled = EffectiveAnimations;'), 'caption-strip animations wiring follows the effective value (v36: EffectiveAnimations)');

console.log('TOTAL ' + n);
