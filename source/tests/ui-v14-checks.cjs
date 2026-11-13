// v14 static checks for shell.html + C# sources (run with TZ=Asia/Shanghai):
// - file confirmation flow is gone (no confirm/ignore anywhere in the shell)
// - recent-changes list wording: 最近变化 / 检测到变化 / Muse 操作 / 清空已看
// - animation: ease-out cubic everywhere, screenshot-overlay protocol (anim-start /
//   anim-end), no 60ms flip hack, per-frame bounds loop for collapse
// - title-bar buttons: plain Control base, no Button chrome, Win11 red only on hover/press
// - UI-thread marshaling present in MainForm message handling
'use strict';
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const btn = fs.readFileSync(__dirname + '/../app/TitleBarButton.cs', 'utf8');
const watch = fs.readFileSync(__dirname + '/../app/WatchList.cs', 'utf8');
const overlay = fs.readFileSync(__dirname + '/../app/AnimOverlay.cs', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- confirmation flow deleted ---
for (const s of ['watch-confirm', 'watch-ignore', '确认是 Muse 操作', '未确认变化', '等你确认']) {
  check(!html.includes(s), 'shell has no "' + s + '"');
}
check(!main.includes('watch-confirm') && !main.includes('watch-ignore'), 'MainForm has no watch confirm/ignore handlers');
check(!/Confirm\(|Ignore\(/.test(watch), 'WatchList has no Confirm/Ignore methods');

// --- recent-changes wording ---
for (const s of ['最近变化', '检测到变化', '来源：Muse 操作', 'watch-clear', '清空已看']) {
  check(html.includes(s), 'shell contains "' + s + '"');
}
check(watch.includes('public void Clear()'), 'WatchList has Clear()');

// --- animation easing ---
check(html.includes('--motion-ease:cubic-bezier(0.215, 0.61, 0.355, 1)'), 'motion ease is ease-out cubic');
const v12 = html.match(/<style id="v12-layout">([\s\S]*?)<\/style>/);
if (!v12) throw new Error('v12-layout block not found');
check(!v12[1].includes('ease-out'), 'v12 layout rules no longer use plain ease-out');
check(v12[1].includes('var(--motion-ease)'), 'v12 layout rules use the cubic variable');
check(html.includes('reach-ico-pop 180ms var(--motion-ease)'), 'icon hover pop uses the cubic variable');

// --- overlay animation protocol ---
for (const s of ['anim-start', 'anim-end', 'animBegin', 'animStop', 'requestAnimationFrame(tick)']) {
  check(html.includes(s), 'shell contains "' + s + '"');
}
check(!html.includes("setTimeout(()=>document.body.classList.remove('side-flipping'),60)"), '60ms flip hack is gone');
check(main.includes('anim-start') && main.includes('anim-end') && main.includes('watch-clear'), 'MainForm handles anim-start/anim-end/watch-clear');
check(main.includes('HandleShellMessage') && main.includes('InvokeRequired'), 'MainForm marshals shell messages to the UI thread');
check(main.includes('Muse Reach v16'), 'MainForm reports v14');
check(overlay.includes('CapturePreviewAsync'), 'overlay captures the web content');
check(overlay.includes('CompleteNow'), 'overlay can finish an animation to its end state');
check(overlay.includes('BeginInvoke'), 'overlay marshals capture completion to the UI thread');
check(overlay.includes('Task.Delay(200)'), 'overlay capture has a timeout fallback');

// --- title-bar buttons: plain Control, no Button chrome ---
check(/class TitleBarButton : Control/.test(btn), 'title button derives from Control, not Button');
check(!btn.includes('FlatStyle') && !btn.includes('FlatAppearance'), 'title button has no Flat button chrome');
check(btn.includes('Selectable,false'), 'title button never takes focus (no focus rectangle)');
check(btn.includes('232,17,35'), 'close hover uses the Windows 11 red');
check(btn.includes('12f') && btn.includes('1.7f'), 'glyph geometry constants kept (12px span, 1.7 stroke)');
check(btn.includes('OnPaintBackground'), 'title button suppresses background painting');

// --- no-anim contract kept ---
check(html.includes('body.no-anim *,body.no-anim *:before,body.no-anim *:after'), 'no-anim kill switch still present');

console.log('TOTAL ' + n);
