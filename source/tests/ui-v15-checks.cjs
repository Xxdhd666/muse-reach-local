// v15 static checks for shell.html + C# sources (run with TZ=Asia/Shanghai):
// - Work Files page: confirmed files card comes first, "最近变化" sits below as a
//   collapsible section, collapsed by default, state persisted in
//   recentChangesCollapsed, expand transition ~150ms tied to animationsEnabled
// - nothing else on the page changed: item content, source labels, 清空已看
'use strict';
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const prefs = fs.readFileSync(__dirname + '/../app/UiPreferences.cs', 'utf8');
const settings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- settings key ---
check(prefs.includes('recentChangesCollapsed{get;set;}=true'), 'recentChangesCollapsed property defaults to true (collapsed)');
check(settings.includes('case "recentChangesCollapsed":recentChangesCollapsed=value;break;'), 'Set() accepts recentChangesCollapsed');
check(main.includes('"watch-toggle"'), 'MainForm handles watch-toggle');
check(main.includes('recentChangesCollapsed=!_settings.recentChangesCollapsed'), 'watch-toggle flips and persists the setting');
check(main.includes('Muse Reach v16'), 'MainForm version bumped to v15');

// --- files page structure: files card first, watch section below ---
const filesBranch = html.slice(html.indexOf("else if(state.page==='files')"));
check(filesBranch.includes("const watchOpen=!!(state.data.settings&&state.data.settings.recentChangesCollapsed===false)"), 'open state is false unless the setting is explicitly false (default collapsed)');
const wrapperSeg0 = filesBranch.slice(filesBranch.indexOf("wrapper('工作文件'"));
const filesCardAt = wrapperSeg0.indexOf('<div class="card">\'+(files.length?');
const watchAt = wrapperSeg0.indexOf("'+watchHtml+'");
check(filesCardAt > 0 && watchAt > 0 && filesCardAt < watchAt, 'confirmed-files card renders before the recent-changes section');
check(!filesBranch.includes("'+watchHtml+'<div class=\"card\">"), 'watch section no longer renders above the files card');
const wrapperAt = filesBranch.indexOf("wrapper('工作文件'");
const wrapperSeg = filesBranch.slice(wrapperAt);
check(wrapperSeg.indexOf("'</div>'+watchHtml+'<p class=\"settings-note\">") > 0, 'watch section sits after the files card, before the note');

// --- collapsible header: count + chevron, content inside the collapsible body ---
for (const s of ['watch-header', 'data-action="watch-toggle"', 'aria-expanded', "最近变化（'+watch.length+'）", "icon('chevron')", 'watch-body', 'watch-inner']) {
  check(filesBranch.includes(s), 'files page contains "' + s + '"');
}
const watchSeg = filesBranch.slice(filesBranch.indexOf('const watchHtml='));
check(watchSeg.indexOf('watch-clear') > watchSeg.indexOf('watch-body'), '清空已看 stays inside the expanded section');
check(watchSeg.indexOf('log-arrow') > watchSeg.indexOf('watch-header'), 'chevron arrow lives in the header row');
for (const s of ['检测到变化', '来源：Muse 操作', '清空已看']) {
  check(filesBranch.includes(s), 'expanded content keeps "' + s + '"');
}

// --- transition: ~150ms, killed when animations are off ---
check(html.includes('.watch-body{display:grid;grid-template-rows:0fr;transition:grid-template-rows 150ms var(--motion-ease)}'), 'expand transition is 150ms on grid-template-rows');
check(html.includes('.watch-body.open{grid-template-rows:1fr}'), 'open state expands the grid row');
check(html.includes('.watch-inner{overflow:hidden;min-height:0}'), 'collapsible inner clips overflow');
check(html.includes('body.no-anim *,body.no-anim *:before,body.no-anim *:after{animation:none!important;transition:none!important'), 'animationsEnabled off still kills all transitions (instant switch)');

// --- click wiring ---
check(html.includes("else if(a==='watch-toggle')send({type:'watch-toggle'});"), 'header click sends watch-toggle');

console.log('TOTAL ' + n);
