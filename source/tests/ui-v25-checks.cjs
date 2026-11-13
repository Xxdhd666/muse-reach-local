// v25 static checks for the sliding selection pill (run with TZ=Asia/Shanghai):
// ONE change: the sidebar selection indicator stops being a per-item ::before
// that jumps with the .active class, and becomes ONE shared pill element
// (#sel-pill, created by JS) that slides from the old item to the new one in
// --motion-fast (167ms, MotionTokens ControlFastMs) with the ease-in curve.
// The pill carries both halves of the v22 indicator — the 3px accent bar and
// the light background — so the background slides with the bar (Fluent
// NavigationView behaviour). CSS transitions do the sliding: a new target
// mid-transition restarts from the current rendered position, so rapid clicks
// cannot queue or strand an overlay; body.no-anim and prefers-reduced-motion
// kill the transition, so animations-off stays a true instant jump.
// The pill lives outside #sidebar's innerHTML (nav() rebuilds the sidebar on
// every switch) and is re-inserted as its first child, so it paints below the
// links and survives rebuilds without losing its transition start point.
// Verification of the actual slide (timing, interruption, collapsed rail,
// flip, no-anim) is a live jsdom run: tests/pill-dom-test.cjs (48 checks;
// needs jsdom in /tmp/v25-jsdom, scratch-only, not a repo dep). Its output is
// evidence/pill-dom-test.txt. Pixel geometry on the real 150% DPI machine is
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

// --- the pill exists: one shared element, bar + background, token timing ---
check(shell.includes('.sel-pill{position:absolute;left:0;top:0;width:0;height:0;border-radius:8px;background:var(--layer2);pointer-events:none;transition:left var(--motion-fast) var(--motion-ease-in),top var(--motion-fast) var(--motion-ease-in),width var(--motion-fast) var(--motion-ease-in),height var(--motion-fast) var(--motion-ease-in)}'), 'pill is one shared element sliding on left/top/width/height');
check(shell.includes('.sel-pill:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:4px;background:var(--accent)}'), 'pill bar is the v22 3px accent bar (9px insets, 4px radius)');
check(shell.includes('.history-item.active:before,.sel-pill:before{background:var(--grad)}'), 'pill bar takes the pink/purple gradient override like the old bar');
check(shell.includes('.sidebar{position:relative;width:250px'), 'sidebar is the pill positioning context (offsetParent)');

// --- the old per-item side-link indicator is fully gone ---
check(!shell.includes('.side-link.active:before'), 'no .side-link.active:before rule left anywhere');
check(!shell.includes('.side-link.active{background'), 'no .side-link.active background left (the pill provides it)');
check(shell.includes('.history-item.active:before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:4px;background:var(--accent)}'), 'history-item bar untouched (dead path, sessionKey only reads it)');
check(shell.includes('.history-item.active{background:var(--layer2);color:var(--text)}'), 'history-item background untouched');
check(shell.includes('.side-link.active{color:var(--text)}'), 'side-link active keeps the text colour');
check(shell.includes('.history-item.active svg,.side-link.active svg{color:var(--accent)}'), 'side-link active keeps the accent icon');

// --- timing comes from the token table only, no new magic numbers ---
check(shell.includes('--motion-fast:167ms'), ':root defines --motion-fast as 167ms');
check(shell.includes('--motion-ease-in:cubic-bezier(0,0,0,1)'), ':root defines the ease-in curve');
check(count(/167ms/g) === 1, '167ms appears exactly once (the token definition, not a scattered literal)');
check(count(/cubic-bezier\(0,0,0,1\)/g) === 1, 'the ease-in curve literal appears exactly once (the token definition)');
check(tokens.includes('public const int ControlFastMs = 167;'), 'MotionTokens ControlFastMs is still 167');
check(tokens.includes('public const int ControlNormalMs = 250;'), 'MotionTokens ControlNormalMs is still 250 (used only for the re-sync delay)');
check(shell.includes('fast:167'), 'the JS MOTION table still reads fast:167 from the token sync');

// --- JS wiring: persistent node, geometry from the live active item -------
check(shell.includes("const selPill=document.createElement('div');selPill.className='sel-pill';selPill.setAttribute('aria-hidden','true');"), 'pill is created once as a persistent node');
check(shell.includes("const active=side.querySelector('.side-link.active');"), 'moveSelBar reads the live active link');
check(shell.includes("if(!active){selPill.style.display='none';return;}"), 'no active link hides the pill instead of throwing');
check(shell.includes('side.insertBefore(selPill,side.firstChild)'), 'pill is re-inserted as the first sidebar child (paints below the links)');
check(shell.includes("selPill.style.left=active.offsetLeft+'px';selPill.style.top=active.offsetTop+'px';selPill.style.width=active.offsetWidth+'px';selPill.style.height=active.offsetHeight+'px';"), 'pill rect is copied from the active item (left/top/width/height)');
check(shell.includes("if(!selPlaced){selPill.style.transition='none';set();void selPill.offsetWidth;selPill.style.transition='';selPlaced=true;}"), 'first placement is instant (no slide in from 0,0,0,0)');
check(shell.includes('clearTimeout(moveSelBar._t);moveSelBar._t=setTimeout(()=>moveSelBar(),MOTION.normal);'), 'a 250ms re-sync re-reads the live DOM after layout transitions (collapse/resize)');
check(shell.includes("</span></button></div>';moveSelBar();}"), 'nav() positions the pill (single choke point: switch, collapse, flip, snapshot, first render)');
check(shell.includes("window.addEventListener('resize',()=>moveSelBar());"), 'window resize re-tracks the pill (covers the 800px media-query collapse, which never calls nav())');

// --- animations-off stays a true instant jump -----------------------------
check(shell.includes("document.body.classList.toggle('no-anim',state.data.settings?.animationsEnabled===false)"), 'nav() still toggles body.no-anim from the setting');
check(shell.includes('body.no-anim *,body.no-anim *:before,body.no-anim *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'), 'the no-anim rule kills the pill transition too');
check(shell.includes('@media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}'), 'reduced-motion also reduces the pill to an instant jump');

// --- untouched: tokens, C# side, v24 radii, collapsed rail, version -------
check(!main.includes('selPill'), 'no C# change for the pill (pure shell change)');
check(main.includes('Text = "Muse Reach v25"'), 'window title is v25');
check(main.includes('Text="Muse Reach v25"'), 'tray text is v25');
check(!main.includes('Muse Reach v24'), 'no v24 version string left in MainForm');
check(proj.includes('<Version>0.25.0</Version>'), 'project version is 0.25.0');
check(!proj.includes('0.24.0'), 'no 0.24.0 left in the project file');
check(count(/border-radius:8px[;}]|border-radius:4px[;}]/g) === 52, 'v24 radius census holds (46 plain 8px + 6 plain 4px, pill included)');
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:18px 0 12px}'), 'v22 collapsed rail is untouched in the shell');
check(shell.includes('.sidebar-collapsed .side-link{justify-content:center;padding:0;height:48px;width:48px}'), 'collapsed items stay 48x48 (pill height follows the live item)');
check(!shell.includes('AppWindow'), 'no AppWindow.TitleBar API introduced');

console.log('TOTAL ' + n);
