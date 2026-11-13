// v19 static checks for C# sources (run with TZ=Asia/Shanghai):
// - The window is clamped into the working area on startup and when restoring
//   saved windowBounds (position + proportional size shrink, 8px margin, the
//   clamped geometry is written back to settings).
// - ApplyInitialScale converts the 1770x1170 physical target to logical px
//   (1180x780 at 144 DPI) instead of multiplying by the scale factor (the v18
//   bug that made the window 1758 logical px wide on a 1707-logical-px screen
//   and pushed the right sidebar off-screen).
// - Nothing else changes: v18 caption strip, animations, icons, records, files,
//   backfill, watcher, GitHub skeleton all untouched; no new settings keys.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const settings = fs.readFileSync(__dirname + '/../app/AppSettings.cs', 'utf8');
const prefs = fs.readFileSync(__dirname + '/../app/UiPreferences.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/WindowGeometryMath.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- pure geometry math exists and is testable without WinForms ---
check(math.includes('public static class WindowGeometryMath'), 'geometry math is a standalone static class');
check(math.includes('public static Rectangle ClampToWorkingArea(Rectangle bounds, Rectangle wa)'), 'clamp helper takes bounds and a working area');
check(math.includes('public static Rectangle PickWorkingArea(Rectangle bounds, Rectangle[] areas, Rectangle fallback)'), 'working-area pick takes bounds, areas and a fallback');
check(math.includes('public static Size InitialSize(int dpi)'), 'initial size is computed from the device DPI');
check(math.includes('public const int Margin = 8'), 'clamp margin is 8px');
check(math.includes('public const int SidebarWidth = 250'), 'expanded sidebar width is 250px');
check(math.includes('public const int MinWidth = SidebarWidth + MinContentWidth'), 'clamped window keeps at least the sidebar width');
check(math.includes('DesignWidthPhysical = 1770'), 'physical design width target is 1770');
check(math.includes('DesignHeightPhysical = 1170'), 'physical design height target is 1170');
check(math.includes('DesignWidthPhysical / f'), 'initial size divides the physical target by the scale factor');
check(!math.includes('1180 * f') && !math.includes('780 * f'), 'no multiply-by-scale-factor left in the size math');
check(math.includes('Math.Min((double)maxW / w, (double)maxH / h)'), 'oversized windows shrink proportionally');
check(math.includes('Rectangle.Intersect(bounds, a)'), 'working-area pick uses the largest intersection');

// --- MainForm wires the clamp in ---
// v20: InitialSize now takes the effective-DPI local (abnormal DPI falls back to 96).
check(main.includes('WindowGeometryMath.InitialSize(DeviceDpi)') || main.includes('WindowGeometryMath.InitialSize(dpi)'), 'ApplyInitialScale uses the logical-size helper');
check(!/ClientSize = new Size\(\(int\)Math\.Round\(1180 \* f\)/.test(main), 'ApplyInitialScale no longer multiplies 1180 by the scale factor');
check(!/MinimumSize = new Size\(\(int\)Math\.Round\(860 \* f\)/.test(main), 'minimum size no longer multiplies 860 by the scale factor');
check(main.includes('MinimumSize = WindowGeometryMath.MinimumSize'), 'minimum size comes from the geometry helper');
// v20: the fallback is the converted logical primary area (was the raw physical WorkingArea).
check(main.includes('WindowGeometryMath.PickWorkingArea(saved,areas,primary)'), 'restore picks the working area with the largest intersection');
check(main.includes('WindowGeometryMath.ClampToWorkingArea(saved,wa)'), 'restore clamps the saved bounds into the working area');
check(main.includes('if(clamped!=saved)'), 'clamped geometry is only written back when it changed');
check(main.includes('_settings.windowBounds=new WindowGeometry{x=clamped.X,y=clamped.Y,width=clamped.Width,height=clamped.Height};'), 'clamped geometry is written back to settings');
check(main.includes('窗口几何已钳制进工作区'), 'clamping is logged when it changes the geometry');
check(main.includes('if(WindowGeometry.IsVisible(b,areas))'), 'the off-screen title-bar gate is kept');
check(main.includes('if(_settings.windowMaximized)WindowState=FormWindowState.Maximized;'), 'maximized restore is kept after clamping');

// --- settings untouched: no new keys, existing defaults kept ---
check(!settings.includes('WindowGeometryMath') && !prefs.includes('WindowGeometryMath'), 'no geometry helper leaked into the settings files');
check(prefs.includes('public bool sidebarCollapsed{get;set;}=false'), 'sidebar collapsed default unchanged');
check(prefs.includes('public string sidebarSide{get;set;}="left"'), 'sidebar side default unchanged');
check(prefs.includes('public bool recentChangesCollapsed{get;set;}=true'), 'recent-changes default unchanged');
check(prefs.includes('public bool recentFilesCollapsed{get;set;}=false'), 'recent-files default unchanged');
check(prefs.includes('public static bool IsVisible(WindowGeometry b,IEnumerable<Rectangle> screens)'), 'IsVisible gate untouched');

// --- v18 caption strip untouched ---
check(main.includes('_captionStrip.AnimationsEnabled = _settings.animationsEnabled;'), 'caption-strip animations wiring untouched');
check(main.includes('if(key=="animationsEnabled")_captionStrip.AnimationsEnabled=_settings.animationsEnabled;'), 'live animations switch wiring untouched');

// --- version bump ---
check(main.includes('Muse Reach v19'), 'MainForm version bumped to v19');
check(main.includes('Text="Muse Reach v19"'), 'tray text bumped to v19');
check(proj.includes('<Version>0.19.0</Version>'), 'project version bumped to 0.19.0');
check(!main.includes('Muse Reach v18'), 'no v18 version string left in MainForm');

console.log('TOTAL ' + n);
