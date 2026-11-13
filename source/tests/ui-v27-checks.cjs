// v27 static checks for the disconnect/reconnect InfoBar (run with TZ=Asia/Shanghai):
// One bar, driven by snapshot health transitions (infobarSync in the snapshot
// branch): disconnect (health.reconnect=true) shows a warning/error bar, recovery
// morphs the same bar into a green success bar that auto-dismisses after 4s;
// a manually dismissed disconnect bar still gets its success bar once. The bar
// lives in the document flow between the topbar and #main (grid 0fr->1fr, so it
// pushes content down instead of floating over it), survives page re-renders
// (it is outside #main), and re-measures the Muse WebView bounds after show/hide.
// Behaviour of the bar itself is a live jsdom run: tests/infobar-test.cjs
// (50 checks; needs jsdom in /tmp/v26-jsdom or /tmp/v25-jsdom, scratch-only,
// not a repo dep). Pixel behaviour on the real 150% DPI machine is still a
// real-machine item — see REPORT.md §06.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }
function count(re) { return (shell.match(re) || []).length; }
function block(start, end) {
  const a = shell.indexOf(start);
  const b = shell.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('FAIL block not found: ' + start);
  return shell.slice(a, b);
}

// --- static placement: one host, in flow between topbar and #main ---------
check(count(/id="infobarHost"/g) === 1, 'exactly one #infobarHost in the document');
check(shell.includes('</header><div id="infobarHost" class="infobar-host"><div class="infobar-inner" id="infobarInner"></div></div><main class="content" id="main">'), 'host sits between topbar and #main (outside #main, so page re-renders cannot wipe it)');
check(shell.includes('<div class="infobar-host">') === false, 'host has no stray duplicate markup');

// --- CSS: grid push-down, token durations, levels, no floating -----------
const css = block('<style id="v27-infobar">', '</style>');
check(css.includes('.infobar-host{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--motion-fast-exit) var(--motion-ease-out)}'), 'collapsed host is 0fr with the 125ms exit token');
check(css.includes('.infobar-host.open{grid-template-rows:1fr;transition:grid-template-rows var(--motion-fast) var(--motion-ease-in)}'), 'open host is 1fr with the 167ms enter token');
check(css.includes('.infobar.warn{') && css.includes('.infobar.error{') && css.includes('.infobar.ok{'), 'three levels: warn / error / ok');
check(!css.includes('position:'), 'no positioning anywhere in the v27 CSS (the bar pushes content down, never floats)');
check(css.includes('.infobar{') && css.includes('border-bottom:1px solid var(--border2)'), 'bar is a full-width strip with a bottom border');

// --- wiring: snapshot health drives the bar, one writer only --------------
check(shell.includes('}infobarSync();document.body.dataset.theme='), 'infobarSync() is called on every snapshot, before nav()/top()');
check(shell.includes('const bad=h.reconnect===true;'), 'bad state is exactly health.reconnect===true');
check(count(/function infobarSync\(\)\{/g) === 1, 'one infobarSync definition');
check(count(/function infobarRender\(level\)\{/g) === 1, 'one infobarRender definition');
check(count(/function infobarDismiss\(auto\)\{/g) === 1, 'one infobarDismiss definition');
check(count(/function infobarTick\(\)\{/g) === 1, 'one infobarTick definition');
check(count(/inner\.innerHTML='<div class="infobar/g) === 1, 'the bar HTML is written in exactly one place (no second bar can be created)');
check(shell.includes("role=\"status\""), 'bar carries role=status');

// --- texts: plain language only, no error codes ---------------------------
check(shell.includes("title:'与云端的连接断开了'"), 'error title is plain language');
check(shell.includes("title:'Muse 超过 90 秒没有动静'"), 'warn title is plain language');
check(shell.includes("title:'已重新连接'"), 'success title is plain language');
check(shell.includes("msg:'正在重连…'"), 'error message is plain language');
check(shell.includes("msg:'本机连接证据正常，可能只是暂时没动静；正在留意…'"), 'warn message is plain language');
check(shell.includes("msg:'与云端的连接已恢复。'"), 'success message is plain language');
const textsFn = block('function infobarTexts(level){', '\nfunction infobarRender');
check(!textsFn.includes('note') && !textsFn.includes('health') && !textsFn.includes('evidence') && !textsFn.includes('probe'), 'the text function never sees the health object (no note/error-code passthrough)');
check(shell.includes("return h.label==='通道中断'?'error':h.label==='疑似假死'?'warn':'warn';"), 'level follows the disconnect cause: 通道中断=error, 疑似假死=warn');

// --- retry: existing reconnect dispatch (opens the confirm modal) ---------
check(shell.includes('<button class="secondary infobar-retry" data-action="reconnect">重试</button>'), 'retry button uses the existing reconnect action');
const renderFn = block('function infobarRender(level){', '\nfunction infobarTick');
check(!renderFn.includes('data-action="connection"'), 'retry does not send the connection message directly (the modal + UAC flow is not bypassed)');
check(shell.includes("else if(a==='control'||a==='reconnect'){returnFocus=b;state.modal='connection';state.busy=false;modal();}"), 'the reconnect dispatch still opens the connection modal');

// --- dismiss: branch exists, auto-dismiss uses a named dwell -------------
check(shell.includes('data-action="infobar-dismiss"'), 'dismiss button carries the dismiss action');
check(shell.includes("else if(a==='infobar-dismiss'){infobarDismiss(false);}"), 'click dispatch handles infobar-dismiss');
check(shell.includes('const INFOBAR_OK_MS=4000;'), 'success dwell is a single named constant (4000ms, not a motion duration)');
check(count(/INFOBAR_OK_MS/g) === 2, 'INFOBAR_OK_MS is referenced exactly twice (definition + auto-dismiss timer)');
check(shell.includes('setTimeout(()=>infobarDismiss(true),INFOBAR_OK_MS)'), 'success bar auto-dismisses via the named dwell');
check(shell.includes("setTimeout(()=>{if(!infobar.shown)inner.innerHTML='';},window.MOTION.fastExit+30);"), 'bar content clears after the 125ms exit token (+30ms margin, same pattern as the dialog ghost)');
check(count(/window\.MOTION\.fastExit\+30/g) === 2, 'fastExit+30 appears twice (v26 dialog ghost + v27 bar clear)');
check(count(/155/g) === 0, 'no 155 literal anywhere (the exit duration is not duplicated outside the token)');

// --- muse page: the WebView is re-measured after show/hide ---------------
check(count(/requestAnimationFrame\(bounds\)/g) === 4, 'bounds() is re-run after bar show and hide (2 pre-existing + 2 v27)');

// --- untouched: v21 tokens, v24 radii, v25 pill, v26 dialog, C# -----------
check(shell.includes('const MOTION={faster:83,fast:167,theme:200,normal:250,fastExit:125};'), 'JS MOTION const still mirrors the token table');
check(tokens.includes('public const int ControlFastMs = 167;'), 'MotionTokens ControlFastMs is still 167');
check(tokens.includes('public const int ControlFastExitMs = 125;'), 'MotionTokens ControlFastExitMs is still 125');
check(shell.includes('--motion-fast:167ms'), 'CSS --motion-fast is still 167ms');
check(shell.includes('--motion-fast-exit:125ms'), 'CSS --motion-fast-exit is still 125ms');
check(shell.includes('.sel-pill{position:absolute;left:0;top:0;width:0;height:0;border-radius:8px;'), 'v25 selection pill untouched');
check(shell.includes('function moveSelBar(){'), 'v25 moveSelBar untouched');
check(shell.includes('window.MOTION=MOTION;'), 'v26 window.MOTION sharing untouched');
check(shell.includes('setTimeout(()=>ghost.remove(),window.MOTION.fastExit+30);'), 'v26 dialog ghost removal untouched');
check(shell.includes('function modal(){'), 'dialog open/close function untouched');
check(!main.includes('infobar'), 'no C# change for the bar (pure shell change)');
check(!shell.includes('data-key="infobar'), 'no new settings key for the bar');
check(main.includes('Text = "Muse Reach v27"'), 'window title is v27');
check(main.includes('Text="Muse Reach v27"'), 'tray text is v27');
check(!main.includes('Muse Reach v26'), 'no v26 version string left in MainForm');
check(proj.includes('<Version>0.27.0</Version>'), 'project version is 0.27.0');
check(!proj.includes('0.26.0'), 'no 0.26.0 left in the project file');
check(!shell.includes('AppWindow'), 'no AppWindow.TitleBar API introduced');

console.log(`\n${n} checks passed`);
