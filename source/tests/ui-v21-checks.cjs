// v21 static checks for C# sources + shell.html (run with TZ=Asia/Shanghai):
// ONE change: every animation duration/easing in the app converges on the
// Microsoft Fluent motion tokens (MotionTokens.cs on the C# side, --motion-*
// custom properties in shell.html). ControlFaster 83ms (hover/press feedback),
// ControlFast 167ms (page fade, small panels), theme 200ms, ControlNormal
// 250ms (sidebar slide, panel animations); enter = Fast Out Slow In
// cubic-bezier(0,0,0,1), exit = Slow Out Fast In cubic-bezier(1,0,1,1),
// exits ~25% faster than entries (83->62, 167->125, 250->188).
// The v20 AnimOverlay fixes (Begin clears old state, Finish checks web.Bounds)
// are untouched; animations-off instant switching is unchanged.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const overlay = fs.readFileSync(__dirname + '/../app/AnimOverlay.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/CaptionStripMath.cs', 'utf8');
const strip = fs.readFileSync(__dirname + '/../app/CaptionStrip.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const animMath = fs.readFileSync(__dirname + '/../app/AnimMath.cs', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- token table: four durations, three exits, two beziers ---
check(tokens.includes('public const int ControlFasterMs = 83'), 'token table: ControlFaster 83ms');
check(tokens.includes('public const int ControlFastMs = 167'), 'token table: ControlFast 167ms');
check(tokens.includes('public const int ThemeMs = 200'), 'token table: theme 200ms');
check(tokens.includes('public const int ControlNormalMs = 250'), 'token table: ControlNormal 250ms');
check(tokens.includes('public const int ControlFasterExitMs = 62'), 'token table: faster exit 62ms');
check(tokens.includes('public const int ControlFastExitMs = 125'), 'token table: fast exit 125ms');
check(tokens.includes('public const int ControlNormalExitMs = 188'), 'token table: normal exit 188ms');
check(tokens.includes('public static int ExitDuration(int enterMs)'), 'token table: ExitDuration helper exists');
check(tokens.includes('Math.Round(enterMs * 0.75)'), 'exit is enter x 0.75');
check(tokens.includes('public static double EaseEnter(double t) => CubicBezier(t, 0, 0, 0, 1);'), 'enter easing is cubic-bezier(0,0,0,1)');
check(tokens.includes('public static double EaseExit(double t) => CubicBezier(t, 1, 0, 1, 1);'), 'exit easing is cubic-bezier(1,0,1,1)');
check(tokens.includes('public static double CubicBezier(double t, double x1, double y1, double x2, double y2)'), 'cubic-bezier evaluator exists');

// --- C# call sites take durations from the table, no literals ---
check(main.includes('_anim.GlideTo(_webBounds,MotionTokens.ControlNormalMs)'), 'flip glide takes 250ms from the token table');
check(main.includes('?v:MotionTokens.ControlNormalMs;'), 'anim-start default duration comes from the token table');
check(!/GlideTo\(_webBounds,250\)/.test(main), 'no literal 250 left in the glide call');
check(!/v:200;/.test(main), 'no literal 200 left in the anim-start default');
check(math.includes('MotionTokens.ControlFasterMs'), 'fade enter duration comes from the token table');
check(math.includes('MotionTokens.ControlFasterExitMs'), 'fade exit duration comes from the token table');
check(math.includes('MotionTokens.EaseEnter(t)'), 'fade enter uses the Fluent enter easing');
check(math.includes('MotionTokens.EaseExit(t)'), 'fade exit uses the Fluent exit easing');
check(!math.includes('DurationMs = 120'), 'no 120ms fade literal left');
check(animMath.includes('MotionTokens.EaseEnter(t)'), 'glide uses the Fluent enter easing');
check(!animMath.includes('public static double EaseOutCubic'), 'old ease-out cubic method is gone from AnimMath');
check(!/AnimMath\.EaseOutCubic\(/.test(tokens + math + animMath + main), 'no EaseOutCubic call left in animation code');
check(overlay.includes('Timer{Interval=16}'), 'overlay glide frame interval stays 16ms (frame rate, not a token)');
check(strip.includes('new Timer { Interval = 16 }'), 'caption fade timer stays 16ms (frame rate, not a token)');
check(overlay.includes('safetyTimer=new Timer{Interval=Math.Max(60,durationMs+150)}'), 'overlay safety margin is duration+150, not a motion duration');
check(overlay.includes('Task.Delay(200)'), 'overlay capture timeout stays 200ms (not a motion duration)');
check(overlay.includes('动画收尾核对'), 'v20 Finish bounds-check log kept');
check(overlay.includes('glideMs=Math.Max(1,durationMs);'), 'v20 Begin stores the duration kept');

// --- shell.html: CSS token vars mirror the C# table, old vars gone ---
check(shell.includes('--motion-faster:83ms;'), 'CSS token: faster 83ms');
check(shell.includes('--motion-faster-exit:62ms;'), 'CSS token: faster exit 62ms');
check(shell.includes('--motion-fast:167ms;'), 'CSS token: fast 167ms');
check(shell.includes('--motion-fast-exit:125ms;'), 'CSS token: fast exit 125ms');
check(shell.includes('--motion-theme:200ms;'), 'CSS token: theme 200ms');
check(shell.includes('--motion-normal:250ms;'), 'CSS token: normal 250ms');
check(shell.includes('--motion-normal-exit:188ms;'), 'CSS token: normal exit 188ms');
check(shell.includes('--motion-ease-in:cubic-bezier(0,0,0,1);'), 'CSS token: enter easing');
check(shell.includes('--motion-ease-out:cubic-bezier(1,0,1,1);'), 'CSS token: exit easing');
check(!shell.includes('var(--motion-duration)'), 'old --motion-duration var is gone');
check(!shell.includes('var(--motion-ease)'), 'old --motion-ease var is gone');
check(!shell.includes('cubic-bezier(0.215, 0.61, 0.355, 1)'), 'old easing curve is gone');
// comment text may quote old numbers; the literal-duration checks run on code only
const shellCode = shell.replace(/\/\*[\s\S]*?\*\//g, '');
check(!/transition:[^;{]*\b(150|180|200|250)ms/.test(shellCode), 'no literal ms duration left in CSS transitions');
check(!/animation:[^;{]*\b(150|180)ms/.test(shellCode), 'no literal ms duration left in CSS animations');
check(!/transition-duration:100ms/.test(shell), 'no 100ms micro-feedback literal left');
check(shell.includes('transition-duration:var(--motion-faster)'), 'micro-feedback uses the faster token');
check(shell.includes('.view-enter{animation:reach-page-in var(--motion-fast) var(--motion-ease-in) both}'), 'page fade uses the fast token');
check(shell.includes('body.sidebar-collapsed .sidebar{transition:width var(--motion-normal-exit) var(--motion-ease-out)'), 'sidebar collapse uses the normal exit token');
check(shell.includes('.backdrop.visual-leaving { pointer-events:none;animation:reach-mask-out var(--motion-fast-exit) var(--motion-ease-out) both; }'), 'dialog exit uses the fast exit token');
check(shell.includes('.watch-body.open{grid-template-rows:1fr;transition:grid-template-rows var(--motion-fast) var(--motion-ease-in)}'), 'panel open uses the fast token');
check(shell.includes('transition:grid-template-rows var(--motion-fast-exit) var(--motion-ease-out)'), 'panel close uses the fast exit token');
check(shell.includes('animation:reach-ico-pop var(--motion-faster) var(--motion-ease-in)'), 'icon hover pop uses the faster token');
check(shell.includes('transition:width var(--motion-theme) var(--motion-ease-in)'), 'progress fill uses the theme token');
check(shell.includes('const MOTION={faster:83,fast:167,theme:200,normal:250,fastExit:125};'), 'JS MOTION const mirrors the token table');
check(shell.includes("animBegin('collapse',MOTION.normal);"), 'collapse sends the normal token duration');
check(shell.includes("animBegin('flip',MOTION.normal);"), 'flip sends the normal token duration');
check(shell.includes('setTimeout(()=>ghost.remove(),window.MOTION.fastExit+30);'), 'dialog ghost removal follows the exit token (v26: MOTION is shared via window, the first script IIFE no longer hides it)');
check(shell.includes("body.no-anim *,body.no-anim *:before,body.no-anim *:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}"), 'animations-off instant switching kept');

// --- version bump only, no settings change ---
check(main.includes('Muse Reach v21'), 'MainForm version bumped to v21');
check(main.includes('Text="Muse Reach v21"'), 'tray text bumped to v21');
check(proj.includes('<Version>0.21.0</Version>'), 'project version bumped to 0.21.0');
check(!main.includes('Muse Reach v20'), 'no v20 version string left in MainForm');
check(main.includes('_captionStrip.AnimationsEnabled = _settings.animationsEnabled;'), 'caption-strip animations wiring untouched');

console.log('TOTAL ' + n);
