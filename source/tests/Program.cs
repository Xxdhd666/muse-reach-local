using MuseReach;using System.Drawing;
int n=0;void Check(bool v,string name){if(!v)throw new Exception(name);Console.WriteLine("PASS "+name);n++;}
var s=new AppSettings();
Check(!s.sidebarCollapsed&&s.sidebarSide=="left"&&s.animationsEnabled&&s.webZoom==1,"new preference defaults");
foreach(var t in new[]{"dark","midnight","light","pink","purple","ocean","forest","amber","obsidian"}){s.SetTheme(t);Check(s.theme==t,"theme accepted "+t);}
try{s.SetTheme("neon");throw new Exception("unknown theme");}catch(ArgumentException){Check(true,"unknown theme rejected");}
s.SetSidebarSide("right");Check(s.sidebarSide=="right","sidebar side right");
s.SetSidebarSide("left");Check(s.sidebarSide=="left","sidebar side left");
try{s.SetSidebarSide("top");throw new Exception("bad side");}catch(ArgumentException){Check(true,"invalid sidebar side rejected");}
s.Set("animationsEnabled",false,null);Check(!s.animationsEnabled,"animations toggle off");
s.Set("animationsEnabled",true,null);Check(s.animationsEnabled,"animations toggle on");
try{s.Set("nope",true,null);throw new Exception("bad key");}catch(ArgumentException){Check(true,"unknown switch rejected");}
s.SetWebZoom(1.1);try{s.SetWebZoom(1.5);throw new Exception("invalid zoom");}catch(ArgumentException){}Check(s.webZoom==1.1,"only three zoom values accepted");
string file=Path.GetTempFileName();
File.WriteAllText(file,"{\"museStartUrl\":\"https://muse.ai/thread/abc\",\"theme\":\"ocean\",\"sidebarSide\":\"right\",\"recents\":[{\"id\":\"abc\",\"url\":\"https://muse.ai/thread/abc\",\"title\":\"未命名对话\",\"lastVisited\":\"2026-11-12T00:00:00+08:00\"}]}");
Check(AppSettings.ClearLegacyRecents(file),"legacy recents key cleared");
Check(!File.ReadAllText(file).Contains("recents"),"settings file no longer contains recents");
var read=AppSettings.Load(file);Check(read.theme=="ocean"&&read.sidebarSide=="right","other settings survive migration");
Check(!AppSettings.ClearLegacyRecents(file),"second migration is a no-op");
s.sidebarCollapsed=true;s.sidebarSide="right";s.animationsEnabled=false;s.windowBounds=new WindowGeometry{x=200,y=100,width=1400,height=900};s.windowMaximized=true;s.Save(file);
read=AppSettings.Load(file);File.Delete(file);
Check(read.sidebarCollapsed&&read.sidebarSide=="right"&&!read.animationsEnabled&&read.webZoom==1.1&&read.windowMaximized,"settings restart round trip with v12 keys");
Check(WindowGeometry.IsVisible(read.windowBounds,new[]{new Rectangle(0,0,2560,1600)}),"on-screen geometry restored");
Check(!WindowGeometry.IsVisible(new WindowGeometry{x=99999,y=99999,width=1000,height=800},new[]{new Rectangle(0,0,2560,1600)}),"off-screen geometry rejected");

// v13 backfill: append-only, keeps original lines, idempotent
string bdir=Path.Combine(Path.GetTempPath(),"Reach-v13-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(bdir);
string bfile=Path.Combine(bdir,"ops.jsonl");
string firstLine="{\"v\":1,\"id\":\"op-1\",\"ts\":\"2026-11-11T00:43:09+08:00\",\"kind\":\"exec\",\"summary\":\"旧记录\",\"files\":[],\"exit\":null,\"result\":\"success\",\"cmd\":\"\"}";
File.WriteAllText(bfile,firstLine+"\n{bad\n");
int added=Backfill.Ensure(bdir);Check(added==6,"backfill appends six missing entries");
var blines=File.ReadAllLines(bfile);Check(blines.Length==8,"original lines kept, six appended");
Check(blines[0]==firstLine,"original record byte-identical after backfill");
Check(blines.Skip(2).All(l=>l.Contains("\"summary\":\"补记：")),"backfill summaries marked");
Check(blines.Any(l=>l.Contains("\"id\":\"backfill-v13-writerconsole\"")&&l.Contains("\"ts\":\"2026-11-12T01:28:00+08:00\"")),"backfill keeps original delivery time");
Check(Backfill.Ensure(bdir)==0,"second backfill is a no-op");
Directory.Delete(bdir,true);
// v14 watch list: no confirm/ignore any more — entries are just listed, newest first,
// persisted across restarts, clearable in one action.
string wdir=Path.Combine(Path.GetTempPath(),"Reach-v14w-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(wdir);
var wl=new WatchList(Path.Combine(wdir,"watch.json"));
var wnow=DateTimeOffset.Now;
Check(wl.Add("C:\\Temp\\a.txt","created",wnow),"watch add created");
Check(!wl.Add("C:\\Temp\\a.txt","created",wnow.AddSeconds(30)),"watch dedupes repeat within window");
Check(wl.Add("C:\\Temp\\a.txt","created",wnow.AddSeconds(300)),"watch allows same change after window");
Check(!wl.Add("C:\\Temp\\a.txt","modified",wnow.AddSeconds(301)),"watch suppresses modified right after created");
Check(wl.Add("C:\\Temp\\a.txt","deleted",wnow),"watch add deleted");
Check(!wl.Add("C:\\Temp\\a.txt","deleted",wnow.AddSeconds(5)),"watch records a delete only once");
Check(wl.Pending().Count==3,"watch pending count");
Check(wl.Pending()[0].ts>=wl.Pending()[1].ts&&wl.Pending()[1].ts>=wl.Pending()[2].ts,"watch pending newest first");
var wl2=new WatchList(Path.Combine(wdir,"watch.json"));Check(wl2.Pending().Count==3,"watch list persists across restart");
wl2.Clear();Check(new WatchList(Path.Combine(wdir,"watch.json")).Pending().Count==0,"watch clear empties the list");
Directory.Delete(wdir,true);

// v14 animation math: easing + debounce state machine (pure logic, no WinForms)
// v21: easing comes only from the Fluent token table (MotionTokens): enter
// Fast Out Slow In cubic-bezier(0,0,0,1), exit Slow Out Fast In cubic-bezier(1,0,1,1).
// The old EaseOutCubic (1-(1-t)^3) was deleted: it is not the Fluent enter curve
// (midpoint 0.875 vs 0.8899), and one token table means one easing source.
Check(MotionTokens.ControlFasterMs==83&&MotionTokens.ControlFastMs==167&&MotionTokens.ThemeMs==200&&MotionTokens.ControlNormalMs==250,"token table holds 83/167/200/250");
Check(MotionTokens.ControlFasterExitMs==62&&MotionTokens.ControlFastExitMs==125&&MotionTokens.ControlNormalExitMs==188,"exit durations are ~25% faster than entries");
Check(MotionTokens.ExitDuration(83)==62&&MotionTokens.ExitDuration(167)==125&&MotionTokens.ExitDuration(250)==188&&MotionTokens.ExitDuration(200)==150,"ExitDuration is enter x 0.75 rounded");
Check(Math.Abs(MotionTokens.EaseEnter(0)-0)<1e-9&&Math.Abs(MotionTokens.EaseEnter(1)-1)<1e-9,"enter easing starts at 0 and ends at 1");
Check(Math.Abs(MotionTokens.EaseExit(0)-0)<1e-9&&Math.Abs(MotionTokens.EaseExit(1)-1)<1e-9,"exit easing starts at 0 and ends at 1");
Check(Math.Abs(MotionTokens.EaseEnter(0.5)-0.8899)<0.01,"enter easing is past 0.88 at the midpoint (fast out)");
Check(Math.Abs(MotionTokens.EaseExit(0.5)-0.1101)<0.01,"exit easing is near 0.11 at the midpoint (slow out)");
Check(MotionTokens.EaseEnter(0.25)>0.25&&MotionTokens.EaseEnter(0.25)<MotionTokens.EaseEnter(0.75),"enter easing is monotonic and fast-starting");
Check(MotionTokens.EaseExit(0.25)<0.25&&MotionTokens.EaseExit(0.25)<MotionTokens.EaseExit(0.75),"exit easing is monotonic and slow-starting");
Check(MotionTokens.EaseEnter(0.25)>MotionTokens.EaseExit(0.25),"enter is ahead of exit at the same time");
Check(MotionTokens.EaseEnter(-1)==0&&MotionTokens.EaseEnter(2)==1&&MotionTokens.EaseExit(-1)==0&&MotionTokens.EaseExit(2)==1,"easings clamp out of range");
Check(Math.Abs(MotionTokens.CubicBezier(0.5,0,0,0,1)-0.8899)<0.01&&Math.Abs(MotionTokens.CubicBezier(0.5,1,0,1,1)-0.1101)<0.01,"raw cubic-bezier matches the two Fluent curves");
var ar0=new Rectangle(100,50,1600,1000);var ar1=new Rectangle(0,50,1700,1000);
Check(AnimMath.LerpRect(ar0,ar1,0)==ar0,"rect lerp at 0 is start");
Check(AnimMath.LerpRect(ar0,ar1,1)==ar1,"rect lerp at 1 is end");
Check(AnimMath.LerpRect(ar0,ar1,0.5)==new Rectangle(50,50,1650,1000),"rect lerp midpoint");
var st=new AnimState();var t0=DateTimeOffset.Now;
Check(!st.Active,"anim state starts idle");
var prev=st.BeginGlide(ar0,ar1,250,t0);Check(prev==null,"first glide has no previous animation to complete");
Check(st.Active,"glide is active");
var mid=st.GlideTick(t0.AddMilliseconds(125));Check(mid.HasValue&&mid.Value.X>0&&mid.Value.X<50,"glide midpoint is eased past halfway");
var done=st.GlideTick(t0.AddMilliseconds(250));Check(done==null,"glide tick at end returns null");
Check(!st.Active,"glide ends idle");
var prev2=st.BeginFollow(ar1);Check(prev2==null,"follow after a finished glide has nothing to complete");
st.FollowTo(ar0);Check(st.CurrentRect==ar0,"follow tracks the latest rect");
var prev3=st.BeginGlide(ar1,ar0,250,t0.AddMilliseconds(300));Check(prev3.HasValue&&prev3.Value==ar0,"starting a new animation completes the previous one to its end state");
var prev4=st.BeginFollow(ar0);Check(prev4.HasValue&&prev4.Value==ar0,"debounced follow returns the interrupted glide end state");
Check(st.Active&&st.Current==AnimState.Mode.Follow,"debounced follow is active");
Check(st.CompleteNow()==ar0,"complete-now jumps to the end state");
Check(!st.Active,"complete-now leaves idle");

// v15 recent-changes section: collapsed by default, persists, old files default collapsed
Check(s.recentChangesCollapsed,"recent changes collapsed by default");
s.Set("recentChangesCollapsed",false,null);Check(!s.recentChangesCollapsed,"recent changes expand via setting");
s.Set("recentChangesCollapsed",true,null);Check(s.recentChangesCollapsed,"recent changes collapse via setting");
string v15file=Path.GetTempFileName();
File.WriteAllText(v15file,"{\"theme\":\"ocean\"}");
var v15read=AppSettings.Load(v15file);Check(v15read.recentChangesCollapsed,"old settings file without the key defaults to collapsed");
v15read.recentChangesCollapsed=false;v15read.Save(v15file);
Check(AppSettings.Load(v15file).recentChangesCollapsed==false,"recent changes expanded state survives restart");
File.Delete(v15file);
// v16 recent-files section: expanded by default, persists, old files default expanded
Check(!s.recentFilesCollapsed,"recent files expanded by default");
s.Set("recentFilesCollapsed",true,null);Check(s.recentFilesCollapsed,"recent files collapse via setting");
s.Set("recentFilesCollapsed",false,null);Check(!s.recentFilesCollapsed,"recent files expand via setting");
string v16file=Path.GetTempFileName();
File.WriteAllText(v16file,"{\"theme\":\"ocean\"}");
var v16read=AppSettings.Load(v16file);Check(!v16read.recentFilesCollapsed,"old settings file without the key defaults to expanded");
v16read.recentFilesCollapsed=true;v16read.Save(v16file);
Check(AppSettings.Load(v16file).recentFilesCollapsed,"recent files collapsed state survives restart");
File.Delete(v16file);

// v17 caption strip: single-strip hit-testing + hover state machine (pure logic)
// 96 DPI: three 46px segments, total 138
Check(CaptionStripMath.SegmentWidthLogical==46,"caption segments are 46 logical px wide");
Check(Math.Abs(CaptionStripMath.SegmentWidth(1f)-46)<1e-6,"segment width at 96 DPI is 46");
Check(Math.Abs(CaptionStripMath.SegmentWidth(1.5f)-69)<1e-6,"segment width at 144 DPI is 69");
Check(Math.Abs(CaptionStripMath.TotalWidth(1.5f)-207)<1e-6,"strip total width at 144 DPI is 207");
Check(CaptionStripMath.HitTest(-1,138,1f)==CaptionSegment.None,"hit test left of strip is none");
Check(CaptionStripMath.HitTest(0,138,1f)==CaptionSegment.Min,"hit test x=0 is minimize");
Check(CaptionStripMath.HitTest(45.9f,138,1f)==CaptionSegment.Min,"hit test just inside minimize edge");
Check(CaptionStripMath.HitTest(46,138,1f)==CaptionSegment.Max,"hit test x=46 is maximize");
Check(CaptionStripMath.HitTest(91.9f,138,1f)==CaptionSegment.Max,"hit test just inside maximize edge");
Check(CaptionStripMath.HitTest(92,138,1f)==CaptionSegment.Close,"hit test x=92 is close");
Check(CaptionStripMath.HitTest(137.9f,138,1f)==CaptionSegment.Close,"hit test just inside close edge");
Check(CaptionStripMath.HitTest(138,138,1f)==CaptionSegment.None,"hit test at strip end is none");
Check(CaptionStripMath.HitTest(200,138,1f)==CaptionSegment.None,"hit test right of strip is none");
Check(CaptionStripMath.HitTest(68,207,1.5f)==CaptionSegment.Min,"hit test at 144 DPI inside minimize");
Check(CaptionStripMath.HitTest(69,207,1.5f)==CaptionSegment.Max,"hit test at 144 DPI segment boundary is maximize");
Check(CaptionStripMath.HitTest(138,207,1.5f)==CaptionSegment.Close,"hit test at 144 DPI close boundary");
Check(CaptionStripMath.HitTest(207,207,1.5f)==CaptionSegment.None,"hit test at 144 DPI strip end is none");
Check(Math.Abs(CaptionStripMath.GlyphSpan(CaptionGlyph.Minus,1f)-12)<1e-6,"minus span is 12px (v39 unified: was 14px v16 tuning, retired)");
Check(Math.Abs(CaptionStripMath.GlyphSpan(CaptionGlyph.Square,1f)-12)<1e-6,"square span stays 12px");
Check(Math.Abs(CaptionStripMath.GlyphSpan(CaptionGlyph.Close,1f)-12)<1e-6,"close span stays 12px");
Check(Math.Abs(CaptionStripMath.GlyphStroke(CaptionGlyph.Minus,1f)-2f)<1e-6,"minus stroke is 2.0 (v39 unified: was 2.1)");
Check(Math.Abs(CaptionStripMath.GlyphStroke(CaptionGlyph.Square,1f)-2f)<1e-6,"square stroke is 2.0 (v39 unified: was 1.7)");
Check(Math.Abs(CaptionStripMath.GlyphStroke(CaptionGlyph.Close,1f)-2f)<1e-6,"close stroke is 2.0 (v39 unified: was 1.7)");
Check(Math.Abs(CaptionStripMath.GlyphSpan(CaptionGlyph.Minus,1.5f)-18)<1e-6,"minus span scales with DPI (12 x 1.5 = 18)");
Check(Math.Abs(CaptionStripMath.GlyphStroke(CaptionGlyph.Close,1.5f)-3f)<1e-6,"close stroke scales with DPI (2.0 x 1.5 = 3.0)");
Check(CaptionStripMath.GlyphFor(CaptionSegment.Min)==CaptionGlyph.Minus,"min segment draws minus");
Check(CaptionStripMath.GlyphFor(CaptionSegment.Max)==CaptionGlyph.Square,"max segment draws square");
Check(CaptionStripMath.GlyphFor(CaptionSegment.Close)==CaptionGlyph.Close,"close segment draws X");
var hs=new CaptionStripMath.HoverState();
Check(hs.Hover==CaptionSegment.None&&hs.Pressed==CaptionSegment.None,"hover state starts empty");
hs.Move(10,138,1f);Check(hs.Hover==CaptionSegment.Min,"hover tracks minimize on move");
hs.Move(100,138,1f);Check(hs.Hover==CaptionSegment.Close,"hover moves to close, only one segment hovered");
hs.Leave();Check(hs.Hover==CaptionSegment.None&&hs.Pressed==CaptionSegment.None,"mouse leave clears hover and pressed");
hs.Move(50,138,1f);Check(hs.Down(50,138,1f)==CaptionSegment.Max,"press records maximize");
Check(hs.Up(50,138,1f)==CaptionSegment.Max,"release on the same segment fires the click");
Check(hs.Pressed==CaptionSegment.None,"release clears pressed");
hs.Down(10,138,1f);Check(hs.Up(100,138,1f)==CaptionSegment.None,"release on a different segment does not fire");
hs.Down(100,138,1f);hs.Leave();Check(hs.Pressed==CaptionSegment.None,"leave while pressed clears pressed (no stuck red)");
Check(hs.Up(100,138,1f)==CaptionSegment.None,"release with nothing pressed fires nothing");
hs.Move(100,138,1f);hs.Reset();Check(hs.Hover==CaptionSegment.None,"deactivate reset clears hover");

// v18 caption fade: rounded pill + token fade in/out (pure logic)
// v21: fade-in 83ms (ControlFaster, Fast Out Slow In), fade-out 62ms (83 x 0.75, Slow Out Fast In)
// pill geometry: inset 4 logical px, radius 6px, centered in the segment
var pill0 = CaptionStripMath.PillRect(0, 46f, 38f, 1f);
Check(Math.Abs(pill0.X - 4) < 1e-6 && Math.Abs(pill0.Y - 4) < 1e-6 && Math.Abs(pill0.Width - 38) < 1e-6 && Math.Abs(pill0.Height - 30) < 1e-6, "pill rect at 96 DPI is inset 4px");
var pill2 = CaptionStripMath.PillRect(2, 46f, 38f, 1f);
Check(Math.Abs(pill2.X - 96) < 1e-6 && Math.Abs(pill2.Width - 38) < 1e-6, "pill rect of close segment starts at 96");
var pill15 = CaptionStripMath.PillRect(1, 69f, 57f, 1.5f);
Check(Math.Abs(pill15.X - 75) < 1e-6 && Math.Abs(pill15.Y - 6) < 1e-6 && Math.Abs(pill15.Width - 57) < 1e-6 && Math.Abs(pill15.Height - 45) < 1e-6, "pill rect scales with DPI");
Check(Math.Abs(CaptionStripMath.PillRadius(1f) - 6) < 1e-6, "pill radius is 6px");
Check(Math.Abs(CaptionStripMath.PillRadius(1.5f) - 9) < 1e-6, "pill radius scales with DPI");
// color helpers
Check(CaptionStripMath.LerpColor(Color.FromArgb(161,166,176), Color.White, 0) == Color.FromArgb(161,166,176), "ink lerp at 0 is base gray");
var hotInk = CaptionStripMath.LerpColor(Color.FromArgb(161,166,176), Color.White, 1);
Check(hotInk.A == 255 && hotInk.R == 255 && hotInk.G == 255 && hotInk.B == 255, "ink lerp at 1 is hot ink");
var midInk = CaptionStripMath.LerpColor(Color.FromArgb(161,166,176), Color.White, 0.5f);
Check(midInk.R == 208 && midInk.G == 210 && midInk.B == 216, "ink lerp midpoint is (208,210,216)");
Check(CaptionStripMath.WithAlpha(Color.FromArgb(232,17,35), 0).A == 0, "fade alpha 0 is fully transparent");
Check(CaptionStripMath.WithAlpha(Color.FromArgb(232,17,35), 1).A == 255, "fade alpha 1 is fully opaque");
Check(CaptionStripMath.WithAlpha(Color.FromArgb(232,17,35), 0.5f).A == 128, "fade alpha 0.5 is 128");
Check(CaptionStripMath.WithAlpha(Color.FromArgb(232,17,35), 2).A == 255 && CaptionStripMath.WithAlpha(Color.FromArgb(232,17,35), -1).A == 0, "fade alpha clamps out of range");
// fade state machine
var fd = new CaptionStripMath.CaptionFade();
Check(fd.Value(CaptionSegment.Min) == 0 && fd.Value(CaptionSegment.Close) == 0 && !fd.Animating, "fade starts at zero, idle");
var ft0 = DateTimeOffset.Now;
fd.SetTarget(CaptionSegment.Min, CaptionSegment.None, ft0);
Check(fd.Animating, "fade animates after a target change");
Check(fd.Tick(ft0) == false, "fade tick at start moves nothing yet");
fd.Tick(ft0.AddMilliseconds(41.5));
Check(Math.Abs(fd.Value(CaptionSegment.Min) - 0.8899) < 0.02, "fade-in is past 0.88 at half duration (41.5ms, Fast Out Slow In)");
Check(fd.Animating, "fade still animating at midpoint");
fd.Tick(ft0.AddMilliseconds(83));
Check(fd.Value(CaptionSegment.Min) == 1f, "fade-in reaches 1 at 83ms (ControlFaster)");
Check(!fd.Animating, "fade settles idle at the end");
Check(fd.Tick(ft0.AddMilliseconds(200)) == false, "settled fade tick changes nothing");
// cross-fade: hover moves Min -> Close; old exits on the 62ms exit curve, new enters on 83ms
fd.SetTarget(CaptionSegment.Close, CaptionSegment.None, ft0.AddMilliseconds(200));
fd.Tick(ft0.AddMilliseconds(241.5));
Check(Math.Abs(fd.Value(CaptionSegment.Min) - 0.773) < 0.02, "cross-fade: old segment exits slower at first (0.77 at 41.5ms)");
Check(Math.Abs(fd.Value(CaptionSegment.Close) - 0.8899) < 0.02, "cross-fade: new segment fades in fast (0.89 at 41.5ms)");
fd.Tick(ft0.AddMilliseconds(262));
Check(fd.Value(CaptionSegment.Min) == 0f, "cross-fade: old segment is fully out at 62ms (ControlFaster exit)");
Check(fd.Value(CaptionSegment.Close) > 0.95f && fd.Value(CaptionSegment.Close) < 1f, "cross-fade: new segment nearly in at 62ms");
Check(fd.Animating, "cross-fade still animating until the new segment lands");
fd.Tick(ft0.AddMilliseconds(283));
Check(fd.Value(CaptionSegment.Min) == 0f && fd.Value(CaptionSegment.Close) == 1f, "cross-fade ends with only the new segment lit");
Check(!fd.Animating, "cross-fade settles idle at 83ms");
// snap: instant when animations are off
fd.Snap(CaptionSegment.Max, CaptionSegment.None);
Check(fd.Value(CaptionSegment.Max) == 1f && fd.Value(CaptionSegment.Close) == 0f && !fd.Animating, "snap jumps straight to the target");
fd.Snap(CaptionSegment.None, CaptionSegment.None);
Check(fd.Value(CaptionSegment.Max) == 0f, "snap to none clears all fades");
// pressed segment is also a fade target
fd.SetTarget(CaptionSegment.None, CaptionSegment.Max, ft0);
fd.Tick(ft0.AddMilliseconds(83));
Check(fd.Value(CaptionSegment.Max) == 1f, "pressed segment fades in as a target");
// v21: the fade takes its durations from the token table; no 120ms literal left
Check(MotionTokens.ControlFasterMs == 83 && MotionTokens.ControlFasterExitMs == 62, "fade durations come from MotionTokens (83 in / 62 out)");

// v19 window geometry: clamp off-screen bounds into the working area (pure logic)
// reported case: saved bounds (471,169,1758x1170) on the 1707x1067 logical screen
var wa19 = new Rectangle(0, 0, 1707, 1067);
var off19 = new Rectangle(471, 169, 1758, 1170);
var cl19 = WindowGeometryMath.ClampToWorkingArea(off19, wa19);
Check(cl19 == new Rectangle(120, 8, 1579, 1051), "reported off-screen bounds clamp to (120,8,1579x1051)");
Check(cl19.X >= 8 && cl19.Y >= 8 && cl19.Right <= wa19.Right - 8 && cl19.Bottom <= wa19.Bottom - 8, "clamped window sits inside the working area with 8px margin");
Check(cl19.Right - WindowGeometryMath.SidebarWidth >= wa19.Left, "expanded right sidebar (250px) is fully on screen after clamp");
Check(Math.Abs((double)cl19.Width / off19.Width - (double)cl19.Height / off19.Height) < 0.002, "clamp shrinks proportionally, aspect preserved");
Check(WindowGeometryMath.Margin == 8 && WindowGeometryMath.SidebarWidth == 250 && WindowGeometryMath.MinWidth == 570, "clamp constants are margin 8, sidebar 250, min width 570");
// already inside: unchanged
Check(WindowGeometryMath.ClampToWorkingArea(new Rectangle(100, 100, 1200, 800), wa19) == new Rectangle(100, 100, 1200, 800), "in-bounds geometry is left alone");
// wider than the screen only: shrinks proportionally, pins to the left margin
Check(WindowGeometryMath.ClampToWorkingArea(new Rectangle(0, 0, 2000, 500), wa19) == new Rectangle(8, 8, 1691, 423), "over-wide window shrinks to the working area");
// negative position: pinned to the top-left margin, size kept
Check(WindowGeometryMath.ClampToWorkingArea(new Rectangle(-100, -50, 1200, 800), wa19) == new Rectangle(8, 8, 1200, 800), "negative position is pinned to the margin");
// small working area: still fits with the margin
Check(WindowGeometryMath.ClampToWorkingArea(off19, new Rectangle(0, 0, 800, 600)) == new Rectangle(8, 70, 784, 522), "clamp fits a small working area");
// tiny working area: floor keeps at least the sidebar width visible
var tiny19 = WindowGeometryMath.ClampToWorkingArea(new Rectangle(0, 0, 2000, 2000), new Rectangle(0, 0, 400, 300));
Check(tiny19 == new Rectangle(8, 8, 384, 284), "tiny working area keeps the sidebar-width floor and still fits");
// unit conversion: 1770x1170 physical target becomes logical px
Check(WindowGeometryMath.InitialSize(144) == new Size(1180, 780), "initial size at 144 DPI is 1180x780 logical");
Check(WindowGeometryMath.InitialSize(96) == new Size(1770, 1170), "initial size at 96 DPI is 1770x1170 logical");
Check(WindowGeometryMath.InitialSize(120) == new Size(1416, 936), "initial size at 120 DPI is 1416x936 logical");
Check(WindowGeometryMath.MinimumSize == new Size(860, 560), "minimum size is 860x560 logical");
// working-area pick: largest intersection wins, no intersection falls back to primary
var areas19 = new[]{ new Rectangle(0, 0, 1707, 1067), new Rectangle(1707, 0, 1707, 1067) };
Check(WindowGeometryMath.PickWorkingArea(new Rectangle(1500, 100, 800, 600), areas19, areas19[0]) == areas19[1], "straddling bounds pick the screen with the larger intersection");
Check(WindowGeometryMath.PickWorkingArea(new Rectangle(99999, 99999, 100, 100), areas19, areas19[0]) == areas19[0], "bounds on no screen fall back to primary");
Check(WindowGeometryMath.PickWorkingArea(off19, areas19, areas19[0]) == areas19[0], "reported bounds pick the only screen they touch");
// v20 unit conversion: Screen.WorkingArea is physical px, saved bounds are logical px.
// v19 compared them directly, so the clamp never fired (reach.log 23:44:00: Restore
// identical to saved, no clamp line). The working area must be converted first.
Check(WindowGeometryMath.EffectiveDpi(144)==144,"effective DPI keeps a sane value");
Check(WindowGeometryMath.EffectiveDpi(96)==96,"effective DPI keeps 96");
Check(WindowGeometryMath.EffectiveDpi(0)==96,"abnormal DPI 0 falls back to 96");
Check(WindowGeometryMath.EffectiveDpi(-5)==96,"negative DPI falls back to 96");
Check(WindowGeometryMath.EffectiveDpi(9999)==96,"absurd DPI falls back to 96");
Check(WindowGeometryMath.ToLogical(new Rectangle(0,0,2560,1600),144)==new Rectangle(0,0,1707,1067),"physical working area converts to logical at 144 DPI");
Check(WindowGeometryMath.ToLogical(new Rectangle(0,0,2560,1600),96)==new Rectangle(0,0,2560,1600),"conversion is a no-op at 96 DPI");
Check(WindowGeometryMath.ToLogical(new Rectangle(0,0,2560,1600),120)==new Rectangle(0,0,2048,1280),"physical working area converts to logical at 120 DPI");
Check(WindowGeometryMath.ToLogical(new Rectangle(1920,0,2560,1600),144)==new Rectangle(1280,0,1707,1067),"conversion also divides the working-area origin");
Check(WindowGeometryMath.ToLogical(new Rectangle(0,0,2560,1600),0)==new Rectangle(0,0,2560,1600),"conversion with abnormal DPI falls back to 96");
// THE regression test v19 missed: feed the PHYSICAL working area through the
// conversion, then clamp. v19's test fed a logical working area directly, so it
// passed while the real code path never clamped.
var physWa19=new Rectangle(0,0,2560,1600);
var logicalWa19=WindowGeometryMath.ToLogical(physWa19,144);
Check(logicalWa19==new Rectangle(0,0,1707,1067),"reported physical working area converts to the logical screen");
Check(WindowGeometryMath.ClampToWorkingArea(off19,logicalWa19)==new Rectangle(120,8,1579,1051),"reported bounds clamp through the converted working area");
Check(WindowGeometryMath.ClampToWorkingArea(off19,physWa19)==off19,"without conversion the raw physical area leaves the reported bounds untouched (the v19 bug)");
Check(WindowGeometryMath.ClampToWorkingArea(new Rectangle(0,0,1770,1170),logicalWa19)==new Rectangle(8,8,1590,1051),"unscaled 96-DPI initial size still fits after conversion+clamp");
// IsVisible must also see logical areas: the reported title bar sits past the
// logical right edge even though it is inside the physical screen.
Check(!WindowGeometry.IsVisible(new WindowGeometry{x=1700,y=100,width=1000,height=800},new[]{logicalWa19}),"title bar past the logical right edge is rejected");
Check(WindowGeometry.IsVisible(new WindowGeometry{x=100,y=100,width=1200,height=800},new[]{logicalWa19}),"title bar inside the logical screen is accepted");
// v20 ghost rail: the flip glide (250ms) finishes before the JS anim-end
// (250+80=330ms); the overlay must be removable after the state went idle.
// AnimState pins the timing facts the overlay fix relies on.
var gst=new AnimState();var gt0=DateTimeOffset.Now;
gst.BeginGlide(ar0,ar1,MotionTokens.ControlNormalMs,gt0);
// v21: the glide follows the Fluent enter curve: at half duration the rect is
// already 89% of the way (x 100->0 lands at 11, width 1600->1700 at 1689).
Check(gst.GlideTick(gt0.AddMilliseconds(MotionTokens.ControlNormalMs/2))==new Rectangle(11,50,1689,1000),"glide midpoint follows the enter easing (89% at half duration)");
Check(gst.GlideTick(gt0.AddMilliseconds(MotionTokens.ControlNormalMs-1)).HasValue,"glide is still running 1ms before the end");
Check(gst.Active,"glide is active just before the end");
Check(gst.GlideTick(gt0.AddMilliseconds(MotionTokens.ControlNormalMs))==null,"glide tick at the token duration returns null");
Check(!gst.Active,"glide state is idle at the token duration, before the anim-end (duration+80=330ms)");
Check(gst.TargetRect==ar1,"target rect survives after the glide went idle");
Check(gst.CompleteNow()==ar1,"complete-now still returns the end state after idle");
// v23 caption pressed + inactive states (pure logic)
// Pressed colors are verified by the static check (CaptionStrip.cs literals):
// close #C50F1F, others #3A3F46; inactive ink #737984 (theme --dim, one tier
// below the normal #A1A6B0). The fade machine animates the press amount with
// the same MotionTokens: press 83ms in (Fast Out Slow In), 62ms out
// (Slow Out Fast In). The inactive wiring (MainForm Activated/Deactivate ->
// CaptionStrip.SetWindowActive) is WinForms and must be checked on the real
// machine; the reset path it relies on is covered below.
var pfd = new CaptionStripMath.CaptionFade();
var pt0 = DateTimeOffset.Now;
Check(pfd.PressValue(CaptionSegment.Min) == 0 && pfd.PressValue(CaptionSegment.Max) == 0 && pfd.PressValue(CaptionSegment.Close) == 0, "press amount starts at zero");
// press Min: alpha and press amount both animate to 1 over 83ms
pfd.SetTarget(CaptionSegment.Min, CaptionSegment.Min, pt0);
Check(pfd.Animating, "press animates after mousedown");
pfd.Tick(pt0.AddMilliseconds(41.5));
Check(Math.Abs(pfd.PressValue(CaptionSegment.Min) - 0.8899) < 0.02, "press amount is past 0.88 at half duration (41.5ms, Fast Out Slow In)");
Check(Math.Abs(pfd.Value(CaptionSegment.Min) - 0.8899) < 0.02, "hover fade tracks the press at half duration");
pfd.Tick(pt0.AddMilliseconds(83));
Check(pfd.PressValue(CaptionSegment.Min) == 1f && pfd.Value(CaptionSegment.Min) == 1f, "press amount reaches 1 at 83ms (ControlFaster)");
Check(!pfd.Animating, "press settles idle at 83ms");
// release back to hover: press amount exits over 62ms, hover fade stays 1
pfd.SetTarget(CaptionSegment.Min, CaptionSegment.None, pt0.AddMilliseconds(100));
pfd.Tick(pt0.AddMilliseconds(141.5));
Check(Math.Abs(pfd.PressValue(CaptionSegment.Min) - 0.773) < 0.02, "press amount exits slower at first (0.77 at 41.5ms of 62ms)");
Check(pfd.Value(CaptionSegment.Min) == 1f, "hover fade stays lit while the press amount exits");
pfd.Tick(pt0.AddMilliseconds(162));
Check(pfd.PressValue(CaptionSegment.Min) == 0f && pfd.Value(CaptionSegment.Min) == 1f, "press amount is fully out at 62ms, hover remains");
// visual pressed: only while the pointer is still on the pressed segment
Check(CaptionStripMath.VisualPressed(CaptionSegment.Min, CaptionSegment.Min) == CaptionSegment.Min, "visual press shows while the pointer stays on the pressed segment");
Check(CaptionStripMath.VisualPressed(CaptionSegment.Max, CaptionSegment.Min) == CaptionSegment.None, "dragged off the pressed segment: no visual press");
Check(CaptionStripMath.VisualPressed(CaptionSegment.None, CaptionSegment.Min) == CaptionSegment.None, "pointer outside the strip: no visual press");
Check(CaptionStripMath.VisualPressed(CaptionSegment.Min, CaptionSegment.None) == CaptionSegment.None, "no press recorded: no visual press");
// snap (animations off): press amount jumps instantly, both directions
pfd.Snap(CaptionSegment.Max, CaptionSegment.Max);
Check(pfd.Value(CaptionSegment.Max) == 1f && pfd.PressValue(CaptionSegment.Max) == 1f && !pfd.Animating, "snap jumps straight to hover+press");
pfd.Snap(CaptionSegment.None, CaptionSegment.None);
Check(pfd.Value(CaptionSegment.Max) == 0f && pfd.PressValue(CaptionSegment.Max) == 0f, "snap to none clears fade and press amount");
// pill color lerp: hover #E81123 -> pressed #C50F1F on close
var pressMid = CaptionStripMath.LerpColor(Color.FromArgb(0xE8, 0x11, 0x23), Color.FromArgb(0xC5, 0x0F, 0x1F), 0.5f);
Check(pressMid.R == 214 && pressMid.G == 16 && pressMid.B == 33, "pill color midpoint between hover and pressed close is (214,16,33)");
Check(CaptionStripMath.LerpColor(Color.FromArgb(0x29, 0x2D, 0x33), Color.FromArgb(0x3A, 0x3F, 0x46), 0) == Color.FromArgb(0x29, 0x2D, 0x33), "pill color at press 0 is the hover color");
Check(CaptionStripMath.LerpColor(Color.FromArgb(0x29, 0x2D, 0x33), Color.FromArgb(0x3A, 0x3F, 0x46), 1) == Color.FromArgb(0x3A, 0x3F, 0x46), "pill color at press 1 is the pressed color");

// sticky case 1: quick click — press clears on release, hover stays, nothing sticks
var phs = new CaptionStripMath.HoverState();
phs.Move(10, 138, 1f); phs.Down(10, 138, 1f);
Check(phs.Up(10, 138, 1f) == CaptionSegment.Min, "quick click fires on the pressed segment");
Check(phs.Pressed == CaptionSegment.None, "release clears pressed after a quick click");
pfd.SetTarget(phs.Hover, phs.Pressed, pt0.AddMilliseconds(200));
pfd.Tick(pt0.AddMilliseconds(283));
Check(pfd.PressValue(CaptionSegment.Min) == 0f && pfd.Value(CaptionSegment.Min) == 1f, "after a quick click the press amount is gone and only hover remains");
phs.Leave();
pfd.SetTarget(CaptionSegment.None, CaptionSegment.None, pt0.AddMilliseconds(300));
pfd.Tick(pt0.AddMilliseconds(362));
Check(pfd.Value(CaptionSegment.Min) == 0f && pfd.PressValue(CaptionSegment.Min) == 0f && !pfd.Animating, "leaving the strip after a click leaves no pill and no press");

// sticky case 2: press, drag out, release — pressed color retreats while dragging,
// no click fires, and nothing sticks after release
phs.Move(10, 138, 1f); phs.Down(10, 138, 1f);
pfd.SetTarget(CaptionSegment.Min, CaptionSegment.Min, pt0.AddMilliseconds(400));
pfd.Tick(pt0.AddMilliseconds(483));
Check(pfd.PressValue(CaptionSegment.Min) == 1f, "press is fully in before the drag-out");
phs.Move(100, 138, 1f);
Check(phs.Hover == CaptionSegment.Close && phs.Pressed == CaptionSegment.Min, "drag-out moves hover but keeps the press memory");
Check(CaptionStripMath.VisualPressed(phs.Hover, phs.Pressed) == CaptionSegment.None, "visual press is gone while dragged out");
pfd.SetTarget(phs.Hover, CaptionStripMath.VisualPressed(phs.Hover, phs.Pressed), pt0.AddMilliseconds(500));
pfd.Tick(pt0.AddMilliseconds(562));
Check(pfd.PressValue(CaptionSegment.Min) == 0f, "pressed color is fully out 62ms after dragging off");
pfd.Tick(pt0.AddMilliseconds(583));
Check(pfd.Value(CaptionSegment.Close) == 1f && pfd.Value(CaptionSegment.Min) == 0f, "only the newly hovered segment is lit after the drag-out settles");
Check(phs.Up(100, 138, 1f) == CaptionSegment.None, "release on a different segment fires nothing");
Check(phs.Pressed == CaptionSegment.None, "release clears the press memory after a drag-out");
phs.Leave();
pfd.SetTarget(CaptionSegment.None, CaptionSegment.None, pt0.AddMilliseconds(600));
pfd.Tick(pt0.AddMilliseconds(662));
Check(pfd.Value(CaptionSegment.Close) == 0f && pfd.PressValue(CaptionSegment.Close) == 0f && pfd.PressValue(CaptionSegment.Min) == 0f && !pfd.Animating, "after a drag-out release nothing sticks");
// drag back onto the pressed segment and release: the click still fires
phs.Move(100, 138, 1f); phs.Down(100, 138, 1f);
phs.Move(10, 138, 1f);
Check(CaptionStripMath.VisualPressed(phs.Hover, phs.Pressed) == CaptionSegment.None, "dragged off close: no visual press");
phs.Move(100, 138, 1f);
Check(CaptionStripMath.VisualPressed(phs.Hover, phs.Pressed) == CaptionSegment.Close, "dragged back onto close: visual press returns");
Check(phs.Up(100, 138, 1f) == CaptionSegment.Close, "release back on the pressed segment still fires");

// sticky case 3: press, then the window deactivates — reset snaps everything to
// zero (this is what CaptionStrip.SetWindowActive(false) does); re-activation
// rebuilds hover from the cursor position instantly, with no press left over
phs.Move(100, 138, 1f); phs.Down(100, 138, 1f);
pfd.SetTarget(CaptionSegment.Close, CaptionSegment.Close, pt0.AddMilliseconds(700));
pfd.Tick(pt0.AddMilliseconds(783));
Check(pfd.Value(CaptionSegment.Close) == 1f && pfd.PressValue(CaptionSegment.Close) == 1f, "press is fully in before deactivation");
phs.Reset(); pfd.Snap(CaptionSegment.None, CaptionSegment.None);
Check(phs.Hover == CaptionSegment.None && phs.Pressed == CaptionSegment.None, "deactivate reset clears hover and pressed");
Check(pfd.Value(CaptionSegment.Close) == 0f && pfd.PressValue(CaptionSegment.Close) == 0f && !pfd.Animating, "deactivate reset snaps fade and press amount to zero");
phs.Move(100, 138, 1f); // cursor still over close at re-activation
pfd.Snap(phs.Hover, CaptionSegment.None);
Check(pfd.Value(CaptionSegment.Close) == 1f && pfd.PressValue(CaptionSegment.Close) == 0f && !pfd.Animating, "re-activation restores hover instantly from the cursor position, with no press");
Console.WriteLine("TOTAL "+n);
