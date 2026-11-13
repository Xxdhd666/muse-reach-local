// v17 static checks for C# sources (run with TZ=Asia/Shanghai):
// - Title-bar caption buttons are ONE self-drawn strip (CaptionStrip), not three
//   independent transparent controls: single hover field, x-coordinate hit test,
//   solid title-bar background, hover fills only the hovered segment.
// - v16 per-glyph visual tuning retired in v39 (all glyphs 12px / 2.0 stroke,
//   matching the v30 Lucide stroke); the checks below pin the v39 values.
// - v41: five v17 pins were stale — v23 replaced the bare deactivation reset
//   with SetWindowActive, v18 replaced FillSegment with the pill and the
//   `Color.White : Ink` ternary with HotInk brightening; the checks below pin
//   the current forms (see the note at each updated check). The version pin
//   ('Muse Reach v17') is intentionally left: old version files stop at their
//   version assertions by design (cf. ui-v23 stopping at 'window title is v23').
// - No new settings keys; everything else from v16 untouched.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const settings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }
function exists(p) { try { fs.accessSync(p); return true; } catch { return false; } }

// --- the three-button implementation is gone ---
check(!exists(__dirname + '/../app/TitleBarButton.cs'), 'TitleBarButton.cs is deleted');
check(!main.includes('TitleBarButton'), 'MainForm has no TitleBarButton references');
check(!main.includes('_btnMin') && !main.includes('_btnMax') && !main.includes('_btnClose'), 'no per-button fields remain');
check(!main.includes('var right = new FlowLayoutPanel'), 'no right FlowLayoutPanel for the buttons (left title/status flow stays)');

// --- the strip exists and is a single opaque control ---
const strip = fs.readFileSync(__dirname + '/../app/CaptionStrip.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/CaptionStripMath.cs', 'utf8');
check(/class CaptionStrip : Control/.test(strip), 'CaptionStrip derives from Control');
check(!strip.includes('SupportsTransparentBackColor'), 'strip never opts into transparent back color');
check(!strip.includes('BackColor=Color.Transparent'), 'strip background is never transparent');
check(strip.includes('BackColor = BarBg'), 'strip background is the solid title-bar color');
check(strip.includes('Color.FromArgb(23, 25, 29)'), 'strip background matches the title-bar panel color');
check(strip.includes('Dock = DockStyle.Right'), 'strip docks right in the title bar');

// --- single hover field, x-coordinate hit test ---
check(math.includes('public static CaptionSegment HitTest(float x, float totalWidth, float scale)'), 'hit test resolves the segment from the x coordinate');
check(math.includes('SegmentWidthLogical = 46'), 'segments are 46 logical px wide');
check(strip.includes('CaptionStripMath.HoverState _state'), 'strip keeps exactly one hover/pressed state object');
check(strip.includes('public event Action<CaptionSegment> SegmentClicked'), 'clicks dispatch by segment through one event');
check(strip.includes('MouseMove') && strip.includes('_state.Move(e.X, Width, _scale)'), 'mouse move updates the single hover field');
check(strip.includes('MouseLeave') && strip.includes('_state.Leave()'), 'mouse leave clears hover and pressed');
check(strip.includes('public void ResetVisualState()'), 'strip can reset its visual state');
// v41 (verdict: test bug, not product bug): v23 superseded the v17 bare-reset
// call. Deactivate now goes through SetWindowActive(false), which resets the
// state AND dims the icons (#737984, no pill, hover/press blocked while
// inactive). The v17 literal `_captionStrip?.ResetVisualState()` call site in
// MainForm no longer exists; the reset still runs, one call deeper.
// ui-v23 pins the same wiring ('Deactivate wiring is the SetWindowActive
// path, not a bare reset') and the pure-logic reset is covered by the
// baseline tests ('deactivate reset clears hover and pressed',
// 'deactivate reset snaps fade and press amount to zero').
check(main.includes('Deactivate') && main.includes('_captionStrip?.SetWindowActive(false)'), 'window deactivation resets the strip');
check(/public void SetWindowActive\(bool active\) \{[\s\S]*?ResetVisualState\(\);/.test(strip), 'deactivation path resets the visual state (via SetWindowActive)');
check(main.includes('Activated') && main.includes('_captionStrip?.SetWindowActive(true)'), 'reactivation restores the strip from the cursor position');

// --- hover fills only the hovered segment; close red only on hover/press ---
check(strip.includes('Color.FromArgb(0xE8, 0x11, 0x23)'), 'close hover red is Windows 11 #E81123');
check(strip.includes('Color.FromArgb(0x29, 0x2D, 0x33)'), 'other segments hover with #292D33');
check(strip.includes('Color.FromArgb(0xC5, 0x0F, 0x1F)'), 'close pressed red is #C50F1F');
check(strip.includes('Color.FromArgb(0x3A, 0x3F, 0x46)'), 'other segments press with #3A3F46');
// v41: v18 superseded the v17 full-segment FillSegment — the background is now
// a rounded pill (inset 4px, radius 6px) drawn per segment via FillPath +
// PillRect, and the per-segment fade value gates it (fade 0 => skipped).
// ui-v18 pins the pill geometry and 'no full-segment rectangle fill remains'.
// The three checks below keep the v17 intent (pressed wins over hover; only
// the hovered/pressed segment gets a background; background scoped to one
// segment) in the current form.
check(strip.includes('Color baseColor = CaptionStripMath.LerpColor(hoverColor, pressColor, _fade.PressValue(seg));'), 'pressed pill color takes priority over hover color');
check(strip.includes('float fade = _fade.Value(seg);') && strip.includes('if (fade <= 0.001f) continue;'), 'otherwise only the hovered segment gets a background (per-segment fade gate)');
check(strip.includes('CaptionStripMath.PillRect(i, segW, ClientSize.Height, _scale)') && strip.includes('g.FillPath(b, path);'), 'background is scoped to one segment pill rectangle');

// --- glyphs: v16 visual tuning kept, each centered in its segment ---
check(math.includes('public static float GlyphSpan(CaptionGlyph g, float scale) => 12f'), 'all glyph spans are 12px (v39 unified, was minus 14px)');
check(math.includes('public static float GlyphStroke(CaptionGlyph g, float scale) => 2f'), 'all glyph strokes are 2.0 (v39 unified, was minus 2.1 / square+close 1.7)');
check(strip.includes('float cx = (i + 0.5f) * segW'), 'each glyph is centered in its own segment');
// v41: v18 changed how glyphs brighten — they lerp with the segment fade,
// close to white, others to HotInk light gray. The old `Color.White : Ink`
// ternary no longer exists; ui-v18 pins 'close glyph brightens to white,
// others to light gray'.
check(strip.includes('seg == CaptionSegment.Close ? Color.White : HotInk'), 'close glyph turns white only while hovered/pressed');

// --- wiring in MainForm ---
check(main.includes('private CaptionStrip _captionStrip;'), 'MainForm holds one CaptionStrip field');
check(main.includes('_captionStrip = new CaptionStrip();'), 'MainForm creates the strip');
check(main.includes('_captionStrip.SegmentClicked +='), 'MainForm subscribes to segment clicks');
check(main.includes('if (seg == CaptionSegment.Min) WindowState = FormWindowState.Minimized'), 'minimize dispatches by segment');
check(main.includes('else if (seg == CaptionSegment.Max) ToggleMaximize()'), 'maximize/restore dispatches by segment');
check(main.includes('else if (seg == CaptionSegment.Close) Close()'), 'close dispatches by segment');
check(main.includes('_captionStrip.ApplyDpi(scale, barH)'), 'strip gets DPI-scaled width and title-bar height');
// v41: this version pin is intentionally left pinning v17. Old version files
// stop at their version assertions by design (ui-v23 stops at 'window title
// is v23', ui-v36 at 3 version assertions); updating it to the current
// version would erase what this file is for.
check(main.includes('Muse Reach v17'), 'MainForm version bumped to v17');

// --- no new settings keys ---
check(!settings.includes('CaptionStrip') && !settings.includes('captionStrip'), 'no caption-strip settings key added');
check(settings.includes('recentFilesCollapsed'), 'v16 files-collapse key untouched');

console.log('TOTAL ' + n);
