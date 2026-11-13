// v23 static checks for C# sources (run with TZ=Asia/Shanghai):
// ONE change: the custom caption buttons (minimize/maximize/close) get their
// pressed and window-inactive states. Pressed: the pill background animates
// from the hover color to the pressed color (close #C50F1F, others #3A3F46)
// over the v21 MotionTokens 83ms in / 62ms out — v22 snapped the color
// instantly. Inactive: all three icons go gray (#737984, the theme --dim,
// one tier below the normal #A1A6B0), no pill, no hover, no press; re-activation
// restores instantly from the cursor position (no fade, no waiting for a mouse
// move). Press-drag-out retreats the pressed color; press-then-deactivate is
// covered by the reset path. The implementation stays a self-drawn CaptionStrip
// (no AppWindow.TitleBar API); pill shape (4px inset, 6px radius), hover,
// layout, corner radii, the motion token table and all user settings are
// untouched. Maximize-hover Snap Layouts is NOT claimed verified anywhere.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const strip = fs.readFileSync(__dirname + '/../app/CaptionStrip.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/CaptionStripMath.cs', 'utf8');
const tokens = fs.readFileSync(__dirname + '/../app/MotionTokens.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
const shell = fs.readFileSync(__dirname + '/../app/shell.html', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- pressed colors: already in v22, confirmed by literal, not re-guessed ---
check(strip.includes('PressedOther = Color.FromArgb(0x3A, 0x3F, 0x46)'), 'pressed color for minimize/maximize is #3A3F46');
check(strip.includes('PressedClose = Color.FromArgb(0xC5, 0x0F, 0x1F)'), 'pressed color for close is #C50F1F');
check(strip.includes('HoverOther = Color.FromArgb(0x29, 0x2D, 0x33)'), 'hover color for minimize/maximize is unchanged #292D33');
check(strip.includes('HoverClose = Color.FromArgb(0xE8, 0x11, 0x23)'), 'hover color for close is unchanged #E81123');

// --- inactive ink: theme --dim, one tier below the normal #A1A6B0 ---
check(strip.includes('InactiveInk = Color.FromArgb(0x73, 0x79, 0x84)'), 'inactive icon gray is #737984 (theme --dim)');
check(strip.includes('Ink = Color.FromArgb(161, 166, 176)'), 'normal icon gray stays #A1A6B0');

// --- press amount: animated color, same tokens as the fade, no new numbers ---
check(math.includes('public float PressValue(CaptionSegment seg)'), 'CaptionFade exposes the per-segment press amount');
check(math.includes('_pressValues = new float[3]') || math.includes('_pressValues[i]'), 'press amount is stored per segment');
check(math.includes('_pressDurMs[i] = _pressTarget[i] > _pressFrom[i] ? MotionTokens.ControlFasterMs : MotionTokens.ControlFasterExitMs'), 'press durations come from MotionTokens (83 in / 62 out)');
check(!/ControlFasterMs\s*=\s*83/.test(math), 'no 83ms literal smuggled into the fade math (it lives in MotionTokens)');
check(math.includes('public static CaptionSegment VisualPressed(CaptionSegment hover, CaptionSegment pressed)'), 'visual-pressed helper exists in pure logic');
check(math.includes('pressed != CaptionSegment.None && hover == pressed ? pressed : CaptionSegment.None'), 'visual press shows only while the pointer stays on the pressed segment');

// --- CaptionStrip wiring: active flag, guards, animated press color, inactive paint ---
check(strip.includes('bool _windowActive = true'), 'window-active flag exists, default active');
check(strip.includes('public void SetWindowActive(bool active)'), 'SetWindowActive exists');
check(strip.includes('if (active == _windowActive) return;'), 'SetWindowActive is a no-op when the state does not change');
check(strip.includes('ResetVisualState();'), 'SetWindowActive reuses the reset path (state + snap + timer stop)');
check(strip.includes('PointToClient(Cursor.Position)'), 're-activation rebuilds hover from the cursor position');
check(strip.includes('_fade.Snap(_state.Hover, CaptionSegment.None)'), 're-activation restores instantly via Snap, not a fade');
check(strip.includes("MouseMove += (s, e) => { if (!_windowActive) return;"), 'mouse move is ignored while inactive');
check(strip.includes("MouseDown += (s, e) => { if (!_windowActive) return;"), 'mouse down is ignored while inactive');
check(strip.includes("DoubleClick += (s, e) => { if (!_windowActive) return;"), 'double-click is ignored while inactive');
check(strip.includes('var pressed = CaptionStripMath.VisualPressed(_state.Hover, _state.Pressed);'), 'UpdateFade passes the visual pressed segment, not the press memory');
check(strip.includes('Color baseColor = CaptionStripMath.LerpColor(hoverColor, pressColor, _fade.PressValue(seg));'), 'pill color lerps hover to pressed by the press amount');
check(!strip.includes('_state.Pressed == seg ? (seg == CaptionSegment.Close ? PressedClose : PressedOther)'), 'old instant press-color switch is gone');
check(strip.includes('if (!_windowActive) continue; // v23 失活态不画 pill 底色'), 'no pill is painted while inactive');
check(strip.includes('Color ink = _windowActive ? CaptionStripMath.LerpColor(Ink, hot, _fade.Value(seg)) : InactiveInk;'), 'icons are dim gray while inactive, lerped normally while active');

// --- MainForm wiring: Activated + Deactivate, version bump ---
check(main.includes('_captionStrip?.SetWindowActive(false);'), 'Deactivate sets the strip inactive');
check(main.includes('_captionStrip?.SetWindowActive(true);'), 'Activated sets the strip active again');
check(main.includes('Deactivate += (s, e) => {_captionStrip?.SetWindowActive(false);}'), 'Deactivate wiring is the SetWindowActive path, not a bare reset');
check(main.includes('Text = "Muse Reach v23"'), 'window title is v23');
check(main.includes('Text="Muse Reach v23"'), 'tray text is v23');
check(!main.includes('Muse Reach v22'), 'no v22 version string left in MainForm');
check(proj.includes('<Version>0.23.0</Version>'), 'project version is 0.23.0');
check(!proj.includes('0.22.0'), 'no 0.22.0 left in the project file');

// --- untouched: tokens, pill geometry, reset path, no AppWindow API ---
check(tokens.includes('public const int ControlFasterMs = 83;'), 'ControlFaster is still 83ms');
check(tokens.includes('public const int ControlFasterExitMs = 62;'), 'ControlFaster exit is still 62ms');
check(math.includes('PillInsetLogical = 4f'), 'pill inset stays 4 logical px');
check(math.includes('PillRadiusLogical = 6f'), 'pill radius stays 6px');
check(strip.includes('public void ResetVisualState()'), 'ResetVisualState still exists');
check(main.includes('_captionStrip.ResetVisualState();'), 'click path still resets the visual state');
check(!strip.includes('AppWindow') && !main.includes('AppWindow'), 'no AppWindow.TitleBar API introduced');
check(!strip.includes('TitleBar'), 'no TitleBar API reference in the strip');
check(!/Snap\s+Layouts|SnapLayouts|snap.?layout/i.test(strip + main), 'Snap Layouts behavior is not claimed anywhere in the caption code');

// --- shell.html untouched by this change (caption work is C#-only) ---
check(shell.includes('.sidebar-collapsed .sidebar{width:48px;flex-basis:48px;padding:18px 0 12px}'), 'v22 collapsed rail is untouched in the shell');

console.log('TOTAL ' + n);
