// v20 static checks for C# sources (run with TZ=Asia/Shanghai):
// DEFECT 1 (v19 clamp never fired): saved windowBounds are logical px, but
// Screen.WorkingArea is physical px (2560x1600). v19 compared them directly, so
// the 1758-logical-px window looked like it fit the 2560-physical-px area and the
// clamp returned the bounds unchanged (reach.log 23:44:00: Restore identical to
// saved, no clamp line). v20 converts every working area to logical px BEFORE
// Pick/Clamp/IsVisible, and reorders Shown so RestoreGeometry runs first when
// saved bounds exist (ApplyInitialScale only for first launch).
// DEFECT 2 (ghost rail): AnimOverlay.CompleteNowLocked() used to return early
// when the animation state was idle WITHOUT removing the PictureBox. The flip
// glide (250ms) always finishes before the JS anim-end (250+80=330ms), so after
// every flip the state was idle while the screenshot was still up; Finish and
// the safety timer both hit the early return and the overlay was orphaned. The
// next ShowShot overwrote the box field, so the orphan was never removed again;
// when a later sidebar toggle moved the live WebView, the stale screenshot
// peeked out and the muse.ai left rail appeared twice (reach-shot5.png: two
// copies ~65px apart). v20 removes the overlay unconditionally, stores the
// animation duration in Begin (the glideMs field was never set there, so the
// first flip glided in 1ms), and logs a bounds check at Finish.
'use strict';
const fs = require('fs');
const main = fs.readFileSync(__dirname + '/../app/MainForm.cs', 'utf8');
const overlay = fs.readFileSync(__dirname + '/../app/AnimOverlay.cs', 'utf8');
const math = fs.readFileSync(__dirname + '/../app/WindowGeometryMath.cs', 'utf8');
const proj = fs.readFileSync(__dirname + '/../app/Reach.csproj', 'utf8');
let n = 0;
function check(v, name) { if (!v) throw new Error('FAIL ' + name); console.log('PASS ' + name); n++; }

// --- defect 1: unit conversion exists and is used before Pick/Clamp/IsVisible ---
check(math.includes('public static int EffectiveDpi(int dpi)'), 'effective-DPI helper exists');
check(math.includes('public static Rectangle ToLogical(Rectangle physical, int dpi)'), 'physical-to-logical rectangle conversion exists');
check(math.includes('public static Rectangle[] ToLogicalAreas(Rectangle[] physical, int dpi)'), 'physical-to-logical areas conversion exists');
check(math.includes('EffectiveDpi(dpi) / 96.0'), 'conversion divides by the DPI scale factor');
check(math.includes('(dpi >= 96 && dpi <= 480) ? dpi : 96'), 'abnormal DPI falls back to 96');
check(main.includes('WindowGeometryMath.ToLogicalAreas(Screen.AllScreens.Select(x=>x.WorkingArea).ToArray(), dpi)'), 'restore converts all working areas to logical px');
check(main.includes('WindowGeometryMath.ToLogical(Screen.PrimaryScreen.WorkingArea, dpi)'), 'restore converts the primary fallback to logical px');
check(main.includes('WindowGeometryMath.PickWorkingArea(saved,areas,primary)'), 'restore picks from the converted areas');
check(main.includes('if(WindowGeometry.IsVisible(b,areas))'), 'IsVisible sees the converted areas');
check(main.includes('逻辑工作区='), 'restore logs the logical working area it used');
check(main.includes('WindowGeometryMath.ToLogical(Screen.FromControl(this).WorkingArea, dpi)'), 'ApplyInitialScale uses the converted working area');
check(main.includes('if(!RestoreGeometry())ApplyInitialScale();'), 'Shown restores first, initial scale only when no saved bounds');
check(!/var wa = Screen\.FromControl\(this\)\.WorkingArea;/.test(main), 'no raw physical working area left in ApplyInitialScale');
check(main.includes('ToLogicalAreas(Screen.AllScreens.Select(x=>x.WorkingArea).ToArray(), dpi)'), 'raw physical areas only appear as the conversion input');

// --- defect 2: overlay cleanup no longer depends on the animation state ---
check(!overlay.includes('if(!state.Active)return;'), 'no early return on idle state left in the overlay');
check(overlay.includes('bool hadOverlay = box != null || hasImage;'), 'overlay cleanup tracks whether a screenshot was shown');
check(overlay.includes('bool stateWasActive = state.Active;'), 'overlay cleanup records whether the state was alive');
check(overlay.includes('if((hadOverlay||stateWasActive)&&web!=null&&web.CoreWebView2!=null)'), 'web is restored only when the overlay owned it');
check(overlay.includes('glideMs=Math.Max(1,durationMs);'), 'Begin stores the animation duration for the glide');
check(overlay.includes('if(box!=null){ try{ host.Controls.Remove(box); box.Dispose(); }catch{} box=null; }'), 'ShowShot removes any previous box before adding a new one');
check(overlay.includes('if(!state.Active&&box==null&&!hasImage)return;'), 'Finish skips only when there is truly nothing to clean up');
check(overlay.includes('动画收尾核对'), 'Finish logs the web-bounds check');
check(overlay.includes('web.Bounds==finalRect'), 'Finish verifies web bounds equal the settled rect');

// --- nothing else changes: version bump only, no new settings keys ---
check(main.includes('Muse Reach v20'), 'MainForm version bumped to v20');
check(main.includes('Text="Muse Reach v20"'), 'tray text bumped to v20');
check(proj.includes('<Version>0.20.0</Version>'), 'project version bumped to 0.20.0');
check(!main.includes('Muse Reach v19'), 'no v19 version string left in MainForm');
check(main.includes('_captionStrip.AnimationsEnabled = _settings.animationsEnabled;'), 'caption-strip animations wiring untouched');
check(main.includes('if(_settings.windowMaximized)WindowState=FormWindowState.Maximized;'), 'maximized restore kept after clamping');
check(main.includes('窗口几何已钳制进工作区'), 'clamp log line kept');

console.log('TOTAL ' + n);
