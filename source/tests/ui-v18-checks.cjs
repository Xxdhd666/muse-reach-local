// v18 static checks for C# sources (run with TZ=Asia/Shanghai):
// - Caption-strip hover/press background is a rounded-corner pill (inset 4 logical
//   px, radius 6px), NOT a hard-edged full-segment rectangle.
// - Hover fades in/out via a Timer (v21: 83ms in / 62ms out from the Fluent token
//   table); the glyph brightens in sync; animationsEnabled off switches everything instantly.
// - Single strip, single hover field, x-coordinate hit test (v17) all kept; no new
//   settings keys; glyph tuning retired in v39 (all glyphs 12px / 2.0 stroke).
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const settings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const strip = fs.readFileSync(__dirname + '/../app/CaptionStrip.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/CaptionStripMath.cs', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- pill geometry: inset 4 logical px, radius 6px, centered in the segment ---
check(math.includes('PillInsetLogical = 4f'), 'pill inset is 4 logical px');
check(math.includes('PillRadiusLogical = 6f'), 'pill radius is 6px');
check(math.includes('RectangleF PillRect(int index, float segW, float height, float scale)'), 'pill rect is computed per segment');
check(math.includes('index * segW + inset'), 'pill rect is centered in its segment');
check(math.includes('PillRadius(float scale)'), 'pill radius scales with DPI');
check(strip.includes('CaptionStripMath.PillRect(i, segW, ClientSize.Height, _scale)'), 'strip draws the pill from the math helper');
check(strip.includes('CaptionStripMath.PillRadius(_scale)'), 'strip uses the scaled pill radius');
check(strip.includes('GraphicsPath RoundedRect(RectangleF r, float radius)'), 'strip draws a rounded rectangle path');
check(!strip.includes('void FillSegment('), 'no full-segment rectangle fill remains');
check(!strip.includes('g.FillRectangle(b, i * segW'), 'no hard-edged full-segment fill remains');

// --- fade: token durations (v21: 83ms in / 62ms out), Timer-driven, never blocks the UI thread ---
// v18 pinned 120ms + EaseOutCubic; v21 replaced both with the Fluent token table
// (pill geometry, snap behavior and timer wiring below are unchanged).
check(!math.includes('DurationMs = 120'), 'no 120ms fade literal left');
check(math.includes('MotionTokens.ControlFasterMs'), 'fade takes its enter duration from the token table');
check(math.includes('MotionTokens.ControlFasterExitMs'), 'fade takes its exit duration from the token table');
check(math.includes('internal sealed class CaptionFade'), 'fade state machine is pure logic');
check(math.includes('SetTarget(CaptionSegment hover, CaptionSegment pressed, DateTimeOffset now)'), 'fade targets are hover and pressed');
check(math.includes('public void Snap(CaptionSegment hover, CaptionSegment pressed)'), 'fade can snap instantly when animations are off');
check(math.includes('MotionTokens.EaseEnter(t)'), 'fade uses the Fluent enter easing');
check(math.includes('MotionTokens.EaseExit(t)'), 'fade uses the Fluent exit easing');
check(strip.includes('readonly Timer _fadeTimer'), 'strip owns one fade timer');
check(strip.includes('new Timer { Interval = 16 }'), 'fade timer ticks at ~60fps');
check(strip.includes('_fade.Tick(DateTimeOffset.Now)'), 'timer advances the fade state machine');
check(!strip.includes('Thread.Sleep'), 'no Thread.Sleep anywhere in the strip');
check(!math.includes('Thread.Sleep'), 'no Thread.Sleep in the fade math');
check(strip.includes('void UpdateFade()'), 'hover changes go through one fade update');
// v23: the pressed argument is now the VISUAL pressed segment (VisualPressed),
// not the press memory — dragging off the pressed segment retreats the pressed
// color while the click memory stays in HoverState.Pressed. The old literal
// '_fade.SetTarget(_state.Hover, _state.Pressed, ...)' no longer exists;
// the intent (fade targets follow hover and pressed) is unchanged and is
// asserted in its new form by ui-v23-checks.cjs.
check(strip.includes('_fade.SetTarget(_state.Hover, pressed, DateTimeOffset.Now)'), 'fade targets follow hover and pressed');
check(strip.includes('!_fadeTimer.Enabled) _fadeTimer.Start()'), 'timer runs only while a fade is in flight');
check(strip.includes('if (!AnimationsEnabled)'), 'animations-off path exists');
// v23: same VisualPressed change as the SetTarget line above (see the note there).
check(strip.includes('_fade.Snap(_state.Hover, pressed)'), 'animations off snaps straight to the target');

// --- glyph brightens in sync with the background fade ---
check(strip.includes('static readonly Color HotInk'), 'hot ink color defined for brightening');
check(strip.includes('CaptionStripMath.LerpColor(Ink, hot, _fade.Value(seg))'), 'glyph ink lerps with the segment fade');
check(strip.includes('seg == CaptionSegment.Close ? Color.White : HotInk'), 'close glyph brightens to white, others to light gray');
check(strip.includes('CaptionStripMath.WithAlpha(baseColor, fade)'), 'background alpha follows the fade value');

// --- reset still snaps immediately (v17 behavior kept) ---
check(strip.includes('public void ResetVisualState()'), 'strip can reset its visual state');
check(/ResetVisualState\(\) \{ _state\.Reset\(\); _fade\.Snap\(CaptionSegment\.None, CaptionSegment\.None\); _fadeTimer\.Stop\(\);/.test(strip), 'reset snaps to zero and stops the timer');
check(strip.includes('protected override void Dispose(bool disposing)'), 'strip disposes its timer');

// --- v17 strip architecture kept ---
check(/class CaptionStrip : Control/.test(strip), 'CaptionStrip is still one self-drawn control');
check(strip.includes('CaptionStripMath.HoverState _state'), 'strip keeps exactly one hover/pressed state object');
check(strip.includes('public event Action<CaptionSegment> SegmentClicked'), 'clicks still dispatch by segment through one event');
check(math.includes('public static CaptionSegment HitTest(float x, float totalWidth, float scale)'), 'hit test still resolves the segment from the x coordinate');
check(strip.includes('Color.FromArgb(0xE8, 0x11, 0x23)'), 'close hover red is still Windows 11 #E81123');
check(strip.includes('Color.FromArgb(0x29, 0x2D, 0x33)'), 'other segments still hover with #292D33');
check(strip.includes('Color.FromArgb(0xC5, 0x0F, 0x1F)'), 'close pressed red is still #C50F1F');
check(strip.includes('Color.FromArgb(0x3A, 0x3F, 0x46)'), 'other segments still press with #3A3F46');
check(math.includes('public static float GlyphSpan(CaptionGlyph g, float scale) => 12f'), 'all glyph spans are still 12px (v39 unified, was minus 14px)');
check(math.includes('public static float GlyphStroke(CaptionGlyph g, float scale) => 2f'), 'all glyph strokes are still 2.0 (v39 unified, was minus 2.1 / square+close 1.7)');

// --- animationsEnabled wiring in MainForm ---
check(strip.includes('public bool AnimationsEnabled { get; set; } = true'), 'strip exposes an animationsEnabled switch defaulting to on');
// v36: the sync value is no longer the raw user switch. EffectiveAnimations
// (MainForm.cs:273) is user AND OS — `_settings.animationsEnabled &&
// _osAnimationsEnabled` — and both sync sites (construction and the live
// settings handler) were changed to it in v36; ui-v36 pins both new forms
// ('caption strip follows the effective value (not just the user switch)'
// and 'setting handler re-syncs the caption strip with the effective value
// after a user toggle'). The two checks below pinned the v18 form and are
// updated to the v36 form, not deleted; the behaviour (the strip follows
// the effective value, so the user switch off OR the OS switch off both
// turn the strip animations off) is unchanged.
check(main.includes('_captionStrip.AnimationsEnabled = EffectiveAnimations;'), 'MainForm syncs the strip switch from settings');
check(main.includes('if(key=="animationsEnabled")_captionStrip.AnimationsEnabled=EffectiveAnimations;'), 'settings changes update the strip switch live');

// --- version bump, no new settings keys ---
check(main.includes('Muse Reach v18'), 'MainForm version bumped to v18');
check(!settings.includes('CaptionStrip') && !settings.includes('captionStrip'), 'no caption-strip settings key added');
check(settings.includes('recentFilesCollapsed'), 'v16 files-collapse key untouched');

console.log('TOTAL ' + n);
