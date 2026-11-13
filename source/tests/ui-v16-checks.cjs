// v16 static checks for shell.html + C# sources (run with TZ=Asia/Shanghai):
// - Title-bar caption buttons: uniform 46px width (DPI-scaled), DPI-aware height
//   matching the title bar, per-glyph visual tuning (minus longer/heavier),
//   reliable hover/press reset (mouse leave, window deactivate, after click)
// - Work Files page: confirmed-files list ("最近文件") is collapsible with the
//   same pattern as v15's recent-changes section, expanded by default,
//   state persisted in recentFilesCollapsed
'use strict';
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const btn = fs.readFileSync(__dirname + '/../app/TitleBarButton.cs', 'utf8');
const prefs = fs.readFileSync(__dirname + '/../app/UiPreferences.cs', 'utf8');
const settings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- title-bar buttons: uniform width, DPI-aware height ---
check(main.includes('new TitleBarButton(TitleGlyph.Minus, 46,'), 'minimize button width is 46');
check(main.includes('new TitleBarButton(TitleGlyph.Square, 46,'), 'maximize button width is 46');
check(main.includes('new TitleBarButton(TitleGlyph.Close, 46,'), 'close button width is 46 (was 44 in v15)');
check(!main.includes('TitleGlyph.Minus, 40') && !main.includes('TitleGlyph.Close, 44'), 'no v15 widths (40/40/44) remain');
check(main.includes('LayoutTitleBar'), 'MainForm lays out the title bar from DPI');
check(main.includes('Math.Round(38 * scale)'), 'title-bar height follows DPI instead of hardcoded 38');
check(main.includes('ApplyDpi(scale, barH)'), 'buttons get DPI-scaled width and title-bar height');
check(main.includes('OnDpiChanged'), 'layout re-runs when DPI changes');
check(btn.includes('public void ApplyDpi(float dpiScale,int height)'), 'TitleBarButton has the ApplyDpi entry point');
check(btn.includes('Width=Math.Max(30,(int)Math.Round(baseWidth*scale))'), 'button width scales from the 46px base');
check(btn.includes('public void ResetVisualState()'), 'TitleBarButton can reset hover/press state');
check(main.includes('Deactivate'), 'window deactivation resets the caption buttons');
check(main.includes('ResetVisualState();WindowState = FormWindowState.Minimized'), 'minimize click resets visual state');
check(main.includes('ResetVisualState();ToggleMaximize()'), 'maximize click resets visual state');
check(main.includes('Muse Reach v16'), 'MainForm version bumped to v16');

// --- per-glyph visual tuning: minus longer and heavier, square/close unchanged ---
check(btn.includes("glyph==TitleGlyph.Minus?14f:12f"), 'minus span is 14px, square/close stay 12px');
check(btn.includes("glyph==TitleGlyph.Minus?2.1f:1.7f"), 'minus stroke is 2.1, square/close stay 1.7');
check(/class TitleBarButton : Control/.test(btn), 'title button still derives from Control, not Button');

// --- recent-files collapse: settings key ---
check(prefs.includes('recentFilesCollapsed{get;set;}=false'), 'recentFilesCollapsed property defaults to false (expanded)');
check(settings.includes('case "recentFilesCollapsed":recentFilesCollapsed=value;break;'), 'Set() accepts recentFilesCollapsed');
check(main.includes('"files-toggle"'), 'MainForm handles files-toggle');
check(main.includes('recentFilesCollapsed=!_settings.recentFilesCollapsed'), 'files-toggle flips and persists the setting');

// --- files page structure: header + collapsible body around the card ---
const filesBranch = html.slice(html.indexOf("else if(state.page==='files')"));
check(filesBranch.includes("const filesOpen=!(state.data.settings&&state.data.settings.recentFilesCollapsed===true)"), 'open state is true unless the setting is explicitly true (default expanded)');
check(filesBranch.includes("const filesHtmlOpen='"), 'files section opener is built before render');
for (const s of ['data-action="files-toggle"', "最近文件（'+files.length+'）", "icon('chevron')", 'files-body', 'watch-inner', 'aria-expanded']) {
  check(filesBranch.includes(s), 'files page contains "' + s + '"');
}
check(filesBranch.indexOf("'+filesHtmlOpen+'") < filesBranch.indexOf("'<div class=\"card\">"), 'files header renders before the confirmed-files card');
check(filesBranch.includes("'</div></div></div></div>'+watchHtml+'"), 'files section closes after the card, before the recent-changes section');
check(filesBranch.indexOf('files-body') < filesBranch.indexOf("'+watchHtml+'"), 'files body sits above the recent-changes section');

// --- transition: ~150ms, killed when animations are off ---
check(html.includes('.files-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows 150ms var(--motion-ease)}'), 'expand transition is 150ms on grid-template-rows');
check(html.includes('.files-body.open{grid-template-rows:1fr}'), 'open state expands the grid row');
check(html.includes('body.no-anim *,body.no-anim *:before,body.no-anim *:after{animation:none!important;transition:none!important'), 'animationsEnabled off still kills all transitions (instant switch)');

// --- expanded content identical to v15 ---
for (const s of ['来源：Muse 操作', '定位文件', '清空已看', '检测到变化']) {
  check(filesBranch.includes(s), 'expanded content keeps "' + s + '"');
}
check(filesBranch.includes("const watchOpen=!!(state.data.settings&&state.data.settings.recentChangesCollapsed===false)"), 'recent-changes section keeps its v15 default-collapsed behavior');

// --- click wiring ---
check(html.includes("else if(a==='files-toggle')send({type:'files-toggle'});"), 'header click sends files-toggle');

console.log('TOTAL ' + n);
