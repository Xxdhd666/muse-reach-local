// v26 static checks for the dialog MOTION scope fix (run with TZ=Asia/Shanghai):
// ONE fix: closing any dialog threw `Uncaught [ReferenceError: MOTION is not
// defined]` because the second script block (reach-visual-polish) read MOTION,
// which lived only inside the first script's IIFE. The 125ms exit ghost was
// therefore never removed (it leaked in the DOM, invisible after its CSS
// fade-out) and — with animations off — was created at all while its fade was
// disabled, so it sat opaque until nothing removed it. Fix chosen: option (b),
// share the token table via window.MOTION (one assignment, nothing else
// exposed); the callback now reads window.MOTION.fastExit+30, so the exit
// duration still comes from the token table and no new number is written.
// Option (a) (literal 155) was rejected: it would duplicate the 125ms value
// outside the token table and go stale silently if fastExit ever changes.
// The observer also skips ghost creation when body.no-anim (animations off),
// mirroring the existing prefers-reduced-motion early return.
// Behaviour of the ghost itself is a live jsdom run: tests/dialog-ghost-test.cjs
// (26 checks; needs jsdom in /tmp/v26-jsdom or /tmp/v25-jsdom, scratch-only,
// not a repo dep). The old probe tests/motion-scope-probe.cjs still runs as a
// before/after smoke check. Pixel behaviour on the real 150% DPI machine is
// still a real-machine item — see REPORT.md §06.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }
function count(re) { return (shell.match(re) || []).length; }

// --- option (b): exactly one shared token table, nothing else exposed ------
check(shell.includes('const MOTION={faster:83,fast:167,theme:200,normal:250,fastExit:125};'), 'JS MOTION const still mirrors the token table');
check(shell.includes('window.MOTION=MOTION;'), 'MOTION is shared on window (option b)');
check(count(/window\.MOTION\s*=/g) === 1, 'exactly one window.MOTION assignment (no other IIFE private is exposed)');
check(!/window\.(state|nav|render|toast|send|icon|selPill|animBegin|animStop|bounds|modal|go|toggleCollapse)\s*=/.test(shell), 'no other first-script private is exposed on window');
check(shell.includes('setTimeout(()=>ghost.remove(),window.MOTION.fastExit+30);'), 'ghost removal reads fastExit from the shared table');
check(!shell.includes('setTimeout(()=>ghost.remove(),MOTION.fastExit+30);'), 'the old bare-MOTION call (which threw) is gone');
check(count(/fastExit:125/g) === 1, 'fastExit 125 has exactly one definition (the token table)');
check(count(/155/g) === 0, 'no 155 literal anywhere (the exit duration is not duplicated outside the token)');
check(tokens.includes('public const int ControlFastExitMs = 125;'), 'MotionTokens ControlFastExitMs is still 125');
check(shell.includes('--motion-fast-exit:125ms'), 'CSS --motion-fast-exit is still 125ms');

// --- observer: no ghost when animations are off, reduced-motion kept -------
check(shell.includes("if(reduce.matches||document.body.classList.contains('no-anim')||modalRoot.querySelector('.backdrop,.minimized'))return;"), 'observer skips ghost creation when animations are off (no-anim), like reduced-motion');
check(shell.includes("const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');"), 'reduced-motion detection untouched');
check(shell.includes('.backdrop.visual-leaving { pointer-events:none;animation:reach-mask-out var(--motion-fast-exit) var(--motion-ease-out) both; }'), 'ghost exit animation still uses the fast exit token');
check(shell.includes("ghost.setAttribute('aria-hidden','true');"), 'ghost stays aria-hidden');
check(shell.includes('ghost.inert=true;'), 'ghost stays inert');

// --- untouched: v25 pill, dialog behaviour, C# side, version ---------------
check(shell.includes('.sel-pill{position:absolute;left:0;top:0;width:0;height:0;border-radius:8px;'), 'v25 selection pill untouched');
check(shell.includes('function moveSelBar(){'), 'v25 moveSelBar untouched');
check(shell.includes('function modal(){'), 'dialog open/close function untouched');
check(shell.includes("else if(a==='close-modal'||(a==='backdrop'&&ev.target===b)){state.modal=null;modal();}"), 'dialog close dispatch untouched');
check(!main.includes('window.MOTION'), 'no C# change for the fix (pure shell change)');
check(main.includes('Text = "Muse Reach v26"'), 'window title is v26');
check(main.includes('Text="Muse Reach v26"'), 'tray text is v26');
check(!main.includes('Muse Reach v25'), 'no v25 version string left in MainForm');
check(proj.includes('<Version>0.26.0</Version>'), 'project version is 0.26.0');
check(!proj.includes('0.25.0'), 'no 0.25.0 left in the project file');
check(!shell.includes('AppWindow'), 'no AppWindow.TitleBar API introduced');

console.log('TOTAL ' + n);
