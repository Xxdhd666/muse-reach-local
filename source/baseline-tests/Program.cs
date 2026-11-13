using MuseReach;using System.Text.Json;
try {
var dir=Path.Combine(Path.GetTempPath(),"Reach-v10-"+Guid.NewGuid().ToString("N"));Directory.CreateDirectory(dir);int n=0;void Check(bool b,string s){if(!b)throw new Exception(s);Console.WriteLine("PASS "+s);n++;}string Row(object x)=>JsonSerializer.Serialize(x);var now=DateTimeOffset.Now;var file=Path.Combine(dir,"hello.txt");File.WriteAllText(file,"test");
try{var store=new ConsoleData(dir);Check(store.ReadOperations().Count==0,"missing ops is empty");
var rows=new[]{Row(new{v=1,id="a",ts=now.AddDays(-2),kind="file-create",summary="创建文件",files=new[]{file},result="success",exit=0,cmd="touch redacted"}),"{bad",Row(new{v=1,id="b",ts=now,kind="file-read",summary="读取文件",files=new[]{file},result="unknown",exit=0}),Row(new{v=1,id="c",ts=now,kind="exec",summary="未声明文件",files=new[]{file},result="failure"}),Row(new{summary="缺字段"})};File.WriteAllText(Path.Combine(dir,"ops.jsonl"),string.Join("\n",rows)+"\n{\"v\":");var ops=store.ReadOperations();Check(ops.Count==4,"malformed and partial lines skipped with missing fields tolerated");Check(ops.Single(x=>x.id=="b").result=="unknown","exit zero does not turn unknown into success");Check(ops.Single(x=>x.id=="c").files.Length==0,"exec file list not used for work files");Check(ops.Single(x=>x.id=="a").cmd=="touch redacted","command preserved for collapsed details");
File.AppendAllText(Path.Combine(dir,"ops.jsonl"),"1,\"id\":\"later\",\"result\":\"success\"}\n");Check(store.ReadOperations().Count==5,"partial tail reread after completed append");
var files=store.WorkFiles(store.ReadOperations());Check(files.Count==1&&files[0].kind=="file-read","file aggregation uses latest timestamp");Check(files[0].state=="在","file existence checked");File.Delete(file);Check(store.WorkFiles(store.ReadOperations())[0].state=="已不在","missing file remains in records");Check(store.WorkFiles(store.ReadOperations()).Count==1,"missing record not deleted");
Check(ConsoleData.FilterFiles(files,"today",now).Count==1,"today filter");Check(ConsoleData.FilterFiles(files,"week",now.AddDays(8)).Count==0,"seven day filter");
var p=new ProbeResult{identityVerified=true,tcpEstablished=true,service="运行中"};Check(ConsoleData.Health(p,null,now).label!="通道正常","missing heartbeat never proves Muse reachable");
Check(ConsoleData.Health(p,now.AddSeconds(-89),now).label=="通道正常","fresh heartbeat and local evidence");Check(ConsoleData.Health(p,now.AddSeconds(-91),now).label=="本机通道正常，Muse 到达待确认","idle arrival expiry does not invent a stuck tunnel");Check(ConsoleData.Health(new ProbeResult{service="已停止"},now,now).label=="通道中断","local failure takes priority over heartbeat");Check(ConsoleData.Health(new ProbeResult{error="denied"},now,now).label=="状态待确认","unreadable local layer never invents outage");Check(ConsoleData.Health(p,now.AddMinutes(1),now).label!="通道正常","future heartbeat not accepted as normal");
File.WriteAllText(Path.Combine(dir,"heartbeat.json"),Row(new{v=1,ts=now}));Check(store.ReadHeartbeat()==now,"heartbeat timestamp parsed");File.WriteAllText(Path.Combine(dir,"heartbeat.json"),"{");Check(store.ReadHeartbeat()==null,"partial heartbeat tolerated");
var settings=new AppSettings();settings.SetMuseUrl("https://muse.ai/thread/abc");settings.Save(Path.Combine(dir,"settings.json"));Check(AppSettings.Load(Path.Combine(dir,"settings.json")).museStartUrl=="https://muse.ai/thread/abc","conversation URL persists");try{settings.SetMuseUrl("https://evil.invalid/thread/abc");throw new Exception("external URL accepted");}catch(ArgumentException){Check(true,"saved URL restricted to Muse HTTPS");}
Check(ConsoleData.SourceOf(new Operation{summary="补记：旧文件"})=="补记记录（来源未核验）","backfill source label");
// v32：Muse 页加载态分档（逻辑时间模拟，不是墙钟——WinForms 计时器
// 本机跑不了，墙钟验证见 REPORT §06）。
Check(WebLoadingTiers.TierFor(-5)==WebLoadingTiers.Tier.Hidden,"negative elapsed clamps to Hidden");
Check(WebLoadingTiers.TierFor(0)==WebLoadingTiers.Tier.Hidden,"0ms is Hidden (under 1s shows nothing)");
Check(WebLoadingTiers.TierFor(999)==WebLoadingTiers.Tier.Hidden,"999ms is still Hidden");
Check(WebLoadingTiers.TierFor(1000)==WebLoadingTiers.Tier.Spinner,"1000ms flips to Spinner");
Check(WebLoadingTiers.TierFor(2999)==WebLoadingTiers.Tier.Spinner,"2999ms is still Spinner");
Check(WebLoadingTiers.TierFor(3000)==WebLoadingTiers.Tier.Progress,"3000ms flips to Progress");
Check(WebLoadingTiers.WatchdogMs==60000,"watchdog is 60s without a tracked completion");
Check(WebLoadingTiers.TierFor(0)==WebLoadingTiers.Tier.Hidden&&WebLoadingTiers.TierFor(500)==WebLoadingTiers.Tier.Hidden&&WebLoadingTiers.TierFor(1200)==WebLoadingTiers.Tier.Spinner&&WebLoadingTiers.TierFor(2500)==WebLoadingTiers.Tier.Spinner&&WebLoadingTiers.TierFor(3100)==WebLoadingTiers.Tier.Progress&&WebLoadingTiers.TierFor(59000)==WebLoadingTiers.Tier.Progress,"slow load walks Hidden(0,500)->Spinner(1200,2500)->Progress(3100,59000), never backwards");
Check(ConsoleData.SourceOf(new Operation{summary="用户确认：这台电脑上新建了 a.txt"})=="记录标注：用户确认","user-confirmed source label");
Check(ConsoleData.SourceOf(new Operation{summary="普通操作"})=="操作记录（来源未核验）","default source label");
ConsoleData.AppendOperation(dir,new Operation{id="op-test-1",ts=now,kind="file-create",summary="用户确认：这台电脑上新建了 a.txt",files=new[]{file},result="success",cmd=""});
Check(store.ReadOperations().Any(x=>x.id=="op-test-1"),"user-confirmed operation appended");
// v33：窄窗口自动收起（Fluent NavigationView Auto 模式；逻辑宽模拟，
// 不是真机拖动——WinForms 窗口尺寸在本机量不到，墙钟与真机拖拽见 REPORT §06）。
Check(SidebarAutoCollapse.CollapseBelowWidth==1008,"collapse threshold is 1008 logical px");
Check(SidebarAutoCollapse.RestoreAboveWidth==1024,"restore threshold is 1024 logical px (16px hysteresis)");
Check(SidebarAutoCollapse.Next(false,1007),"1007px collapses when expanded");
Check(!SidebarAutoCollapse.Next(false,1008),"1008px does not collapse when expanded");
Check(SidebarAutoCollapse.Next(true,1024),"1024px stays collapsed inside the hysteresis band");
Check(!SidebarAutoCollapse.Next(true,1025),"1025px restores when collapsed");
Check(SidebarAutoCollapse.Next(false,570),"570px minimum window width still collapses (feature is reachable)");
bool auto=false;
auto=SidebarAutoCollapse.Next(auto,1100);Check(!auto,"drag walk: wide window stays expanded");
auto=SidebarAutoCollapse.Next(auto,1007);Check(auto,"drag walk: crossing below 1008 collapses once");
auto=SidebarAutoCollapse.Next(auto,1010);auto=SidebarAutoCollapse.Next(auto,1020);auto=SidebarAutoCollapse.Next(auto,1024);Check(auto,"drag walk: dragging inside the 1008-1024 band does not flicker back");
auto=SidebarAutoCollapse.Next(auto,1025);Check(!auto,"drag walk: crossing above 1024 restores once");
auto=SidebarAutoCollapse.Next(auto,1007);Check(auto,"drag walk: dragging back below 1008 collapses again");
// v34：托盘还原/带到前台的决策（TrayRestore.Next；状态模拟，不是真机点击——
// WinForms 窗口与托盘图标在本机跑不了，真机点按见 REPORT §06）。
Check(TrayRestore.Next(true,false,true)==TrayRestore.Action.NoOp,"visible + normal + foreground is a no-op (double-click on the front window does nothing)");
Check(TrayRestore.Next(true,false,false)==TrayRestore.Action.ActivateOnly,"visible + normal + behind only activates (maximized stays maximized, no resize)");
Check(TrayRestore.Next(true,true,false)==TrayRestore.Action.RestoreAndActivate,"minimized restores then activates");
Check(TrayRestore.Next(true,true,true)==TrayRestore.Action.RestoreAndActivate,"minimized restores even if it somehow reports foreground");
Check(TrayRestore.Next(false,false,false)==TrayRestore.Action.RestoreAndActivate,"hidden in tray shows then activates");
Check(TrayRestore.Next(false,true,false)==TrayRestore.Action.RestoreAndActivate,"hidden and minimized shows then activates");
Check(TrayRestore.Next(false,false,true)==TrayRestore.Action.RestoreAndActivate,"hidden reports foreground only in theory; restore path is still the safe one");
Check(TrayRestore.Next(true,false,true)==TrayRestore.Action.NoOp&&TrayRestore.Next(false,false,false)==TrayRestore.Action.RestoreAndActivate,"no-op and restore are disjoint decisions (no state maps to both)");
// v35：托盘隐藏时连接事件的通知决策（HiddenNotify.Next；状态模拟，不是真机通知——
// WinForms 托盘图标与气球提示在本机跑不了，真机通知见 REPORT §06）。
// 记号：H=窗口可见，h=窗口不可见；I=通道中断，S=疑似假死，K=通道正常，N=状态待确认。
{var n1=new HiddenNotify();
Check(n1.Next(true,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.None,"startup healthy, visible: no notification");
Check(n1.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.NotifyInterrupted,"hidden + channel interrupted: one disconnect notification");
Check(n1.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.None,"same disconnect round, repeated polls: no repeat");
Check(n1.Next(false,HiddenNotify.HealthKind.SuspectedStuck)==HiddenNotify.Decision.None,"level flips interrupted->suspected inside one round: still no repeat");
Check(n1.Next(false,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.NotifyReconnect,"hidden + reconnect after a bad round: one reconnect notification");
Check(n1.Next(false,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.None,"healthy again: no repeat");
Check(n1.Next(false,HiddenNotify.HealthKind.SuspectedStuck)==HiddenNotify.Decision.NotifySuspectedStuck,"hidden + suspected stuck after reconnect: notifies with the softer copy");
Check(n1.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.None,"level flips suspected->interrupted inside one round: still no repeat");
Check(n1.Next(false,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.NotifyReconnect,"second reconnect: notifies again (one per round, no silencing)");}
{var n2=new HiddenNotify();
Check(n2.Next(true,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.None,"visible + interrupted: no toast (v27 InfoBar covers it in-window)");
Check(n2.Next(true,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.None,"visible + reconnect: no toast (InfoBar shows the green bar)");
Check(n2.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.NotifyInterrupted,"later hidden + new disconnect round: notifies (visible rounds do not consume the hidden one)");}
{var n3=new HiddenNotify();
Check(n3.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.NotifyInterrupted,"hidden disconnect notifies");
Check(n3.Next(false,HiddenNotify.HealthKind.Neutral)==HiddenNotify.Decision.None,"neutral mid-round (probe unreadable): no notification, round not broken");
Check(n3.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.None,"back to interrupted after neutral: still the same round, no repeat");
Check(n3.Next(false,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.NotifyReconnect,"reconnect after the neutral gap still notifies once");}
{var n4=new HiddenNotify();
Check(n4.Next(true,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.None,"visible disconnect: InfoBar only, round recorded");
Check(n4.Next(false,HiddenNotify.HealthKind.Interrupted)==HiddenNotify.Decision.None,"hidden mid-round after a visible disconnect: no re-notification (the round was already presented via InfoBar)");
Check(n4.Next(false,HiddenNotify.HealthKind.Healthy)==HiddenNotify.Decision.NotifyReconnect,"hidden reconnect after a visible disconnect: notifies once (user was told via InfoBar, now told it recovered)");}
// v36：跟随系统“减少动画”设置（最终动效开关 = 用户开关 AND 系统开关；
// 纯逻辑真跑，WinRT 读法与 WinForms 计时器本机跑不了，见 REPORT §06）。
// 记号：U=应用内开关，O=系统开关。
Check(OsAnimations.Effective(true,true),"U on + OS on: animations on");
Check(!OsAnimations.Effective(false,true),"U off + OS on: animations off (in-app switch governs)");
Check(!OsAnimations.Effective(true,false),"U on + OS off: animations off (OS switch wins)");
Check(!OsAnimations.Effective(false,false),"U off + OS off: animations off");
Check(OsAnimations.Read(null)==(OsAnimations.ReadSpi()??true),"no WinRT reader + no user32 on Linux: fail-open true (only the in-app switch governs)");
Check(OsAnimations.Read(()=>false)==false,"WinRT reader says off: Read returns false (WinRT is tried first)");
Check(OsAnimations.Read(()=>true),"WinRT reader says on: Read returns true without touching SPI");
Check(OsAnimations.Read(()=>null)==(OsAnimations.ReadSpi()??true),"WinRT reader returns null (unreadable): falls through to SPI, still true on Linux");
Check(OperatingSystem.IsWindows()||OsAnimations.ReadSpi()==null,"SPI reader on Linux: null (user32.dll absent), never throws");
// v37：托盘悬停提示里写清热键（设计参考第 19 条；纯逻辑真跑，
// 悬停本身是 WinForms 行为，本机看不到，见 REPORT §06）。
Check(TrayTooltip.For(true)=="Muse Reach — Ctrl+Alt+Space 随时呼出","hotkey on: tooltip is exactly 'Muse Reach — Ctrl+Alt+Space 随时呼出'");
Check(TrayTooltip.For(false)=="Muse Reach","hotkey off: tooltip is exactly 'Muse Reach' (no hotkey, no 'disabled' suffix)");
Check(TrayTooltip.WithHotkey.Length==32,"tooltip with hotkey is 32 characters (the spec draft said 31; recount: 10 + 1 + 1 + 1 + 14 + 1 + 4 = 32)");
Check(TrayTooltip.WithHotkey.Length<=127,"32 characters is inside the .NET 6+ NotifyIcon.Text limit of 127 (Microsoft Learn)");
Check(TrayTooltip.WithoutHotkey.Length==10,"tooltip without hotkey is 10 characters");
Check(TrayTooltip.For(true)!=TrayTooltip.For(false),"the two states differ (the switch visibly changes the tooltip)");
// v38：最大化键的命中测试（CaptionHitTest.SegmentAt / IsMaxSegment；
// 纯逻辑真跑。窗口矩形与条矩形用 150% 缩放的真实几何：窗口逻辑宽 1507，
// 条宽 207（46×1.5×3），在窗口内从 x=1300、y=8 起，高 57（38×1.5）。
// 段宽 69（46×1.5）。浮层本身只在真机上出得来，见 REPORT §06。
{var strip=new System.Drawing.Rectangle(1300,8,207,57);
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1300,20),strip,1.5f)==CaptionSegment.Min,"strip left edge (x=1300) is Min");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1368,20),strip,1.5f)==CaptionSegment.Min,"x=1368 (one px left of the boundary) is still Min");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1369,20),strip,1.5f)==CaptionSegment.Max,"x=1369 (the 69px boundary) is Max");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1437,20),strip,1.5f)==CaptionSegment.Max,"x=1437 (one px left of the Close boundary) is still Max");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1438,20),strip,1.5f)==CaptionSegment.Close,"x=1438 (the 138px boundary) is Close");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1506,20),strip,1.5f)==CaptionSegment.Close,"strip right edge (x=1506) is Close");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1507,20),strip,1.5f)==CaptionSegment.None,"x=1507 is past the strip (right edge excluded)");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1400,7),strip,1.5f)==CaptionSegment.None,"one px above the strip is outside (no segment)");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1400,65),strip,1.5f)==CaptionSegment.None,"one px below the strip is outside (no segment)");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1200,20),strip,1.5f)==CaptionSegment.None,"title-bar blank area (left of the strip) is not a segment");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(1400,20),System.Drawing.Rectangle.Empty,1.5f)==CaptionSegment.None,"empty strip rect (handle not created yet) is no segment");
Check(CaptionHitTest.IsMaxSegment(69f,207f,1.5f),"IsMaxSegment: x=69 (boundary) is Max");
Check(!CaptionHitTest.IsMaxSegment(68.9f,207f,1.5f),"IsMaxSegment: x=68.9 is not Max");
Check(!CaptionHitTest.IsMaxSegment(138f,207f,1.5f),"IsMaxSegment: x=138 is Close, not Max");
Check(!CaptionHitTest.IsMaxSegment(0f,207f,1.5f),"IsMaxSegment: x=0 is Min, not Max");
Check(CaptionHitTest.IsMaxSegment(46f,138f,1f),"IsMaxSegment: 100% DPI, x=46 (one segment in) is Max");
Check(CaptionHitTest.SegmentAt(new System.Drawing.Point(46,20),new System.Drawing.Rectangle(0,0,138,38),1f)==CaptionSegment.Max,"100% DPI: strip at origin, x=46 is Max (scale math is not DPI-locked)");
Check(CaptionStripMath.SegmentWidth(1.5f)==69f,"segment width at 150% DPI is 69 (the same number the hit test uses)");
Check(CaptionStripMath.TotalWidth(1.5f)==207f,"strip total width at 150% DPI is 207 (the same number the rect uses)");}
// v39：标题栏三枚字形统一 12px / 描边 2.0（v30 的 Lucide 描边）。
// v16 的逐枚微调（减号 14px/2.1、方框与叉 12px/1.7）退役。
// 150% DPI（scale 1.5）：段宽 69，字形跨度 18，左右边距各 (69-18)/2 = 25.5，
// 三枚字形严格居中；描边 3.0。墨量（面积近似，圆角帽忽略）：减号 12x2=24，
// 方框外环 12x12-8x8=80，叉 2x(12x1.414x2)-重叠≈64——减号天生墨最少，
// 这是字形形状使然（一条线 vs 一个框），Lucide 的 minus/square/x 同样如此；
// 统一描边换来的是同一套线条语言，不是等墨量。
{foreach(var g in new[]{CaptionGlyph.Minus,CaptionGlyph.Square,CaptionGlyph.Close}){
Check(Math.Abs(CaptionStripMath.GlyphSpan(g,1f)-12)<1e-6,"v39 glyph "+g+" span is 12px at 100% DPI");
Check(Math.Abs(CaptionStripMath.GlyphStroke(g,1f)-2f)<1e-6,"v39 glyph "+g+" stroke is 2.0 at 100% DPI");
Check(Math.Abs(CaptionStripMath.GlyphSpan(g,1.5f)-18)<1e-6,"v39 glyph "+g+" span is 18px at 150% DPI");
Check(Math.Abs(CaptionStripMath.GlyphStroke(g,1.5f)-3f)<1e-6,"v39 glyph "+g+" stroke is 3.0 at 150% DPI");}
float segW150=CaptionStripMath.SegmentWidth(1.5f);
Check(Math.Abs(segW150-69)<1e-6,"v39 segment width at 150% DPI is 69");
float margin150=(segW150-CaptionStripMath.GlyphSpan(CaptionGlyph.Minus,1.5f))/2;
Check(Math.Abs(margin150-25.5f)<1e-6,"v39 minus glyph margins at 150% DPI are 25.5px on each side (centered)");
Check(CaptionStripMath.GlyphFor(CaptionSegment.Min)==CaptionGlyph.Minus,"v39 min segment still draws minus");
Check(CaptionStripMath.GlyphFor(CaptionSegment.Max)==CaptionGlyph.Square,"v39 max segment still draws square");
Check(CaptionStripMath.GlyphFor(CaptionSegment.Close)==CaptionGlyph.Close,"v39 close segment still draws X");}
// v40：动画设置读取路径写进日志（补 v36 缺口）。ReadWithSource 与 Read 是
// 同一逻辑——来源只有三种字面值：WinRT（正式接口读到）/ SPI（退路读到）/
// fail-open（两条都读不到，按 true 只认应用内开关）。OsAnimLog 只决定
// “写不写、写什么”：启动写一行（路径＋系统值＋应用内值＋生效值），
// 之后值变了或路径变了才写一行，两者都没变不写（每秒轮询不刷日志）。
// 行文案只含路径与开关值，不含用户名、路径、机器名等个人信息。
{var r = OsAnimations.ReadWithSource(()=>true);
Check(r.value && r.source=="WinRT","v40 ReadWithSource: WinRT reader says on -> (true, WinRT)");
r = OsAnimations.ReadWithSource(()=>false);
Check(!r.value && r.source=="WinRT","v40 ReadWithSource: WinRT reader says off -> (false, WinRT)");
r = OsAnimations.ReadWithSource(()=>null);
Check(r.value==(OsAnimations.ReadSpi()??true) && r.source==(OsAnimations.ReadSpi().HasValue?"SPI":"fail-open"),"v40 ReadWithSource: WinRT null + SPI null on Linux -> (true, fail-open)");
r = OsAnimations.ReadWithSource(()=>{throw new Exception("boom");});
Check(r.value==(OsAnimations.ReadSpi()??true) && r.source==(OsAnimations.ReadSpi().HasValue?"SPI":"fail-open"),"v40 ReadWithSource: WinRT reader throws -> falls through to fail-open, never throws");
Check(OsAnimations.Read(()=>false)==false && OsAnimations.Read(()=>true)==true,"v40 Read still delegates to ReadWithSource (same values, source dropped)");
var log = new OsAnimLog();
Check(log.Next("WinRT",true,true)=="动画设置：读取路径=WinRT，系统开关=开，应用内开关=开，生效动效=开","v40 startup line: WinRT/on/user-on has all four fields");
Check(log.Next("WinRT",true,true)==null,"v40 second identical read writes nothing (no per-second log spam)");
Check(log.Next("WinRT",false,true)=="动画设置变化：系统开关=关，生效动效=关","v40 value change only: change line has the new value + effective, no path repeated");
Check(log.Next("SPI",false,true)=="动画设置变化：读取路径=SPI，系统开关=关，生效动效=关","v40 path change only: change line carries the new path even though the value did not change");
Check(log.Next("SPI",true,true)=="动画设置变化：系统开关=开，生效动效=开","v40 value change back: change line again, path not repeated");
Check(log.Next("SPI",true,true)==null,"v40 steady state writes nothing after the change settles");
var log2 = new OsAnimLog();
Check(log2.Next("SPI",true,false)=="动画设置：读取路径=SPI，系统开关=开，应用内开关=关，生效动效=关","v40 startup line with the in-app switch off: effective is off (user AND OS)");
Check(log2.Next("WinRT",false,false)=="动画设置变化：读取路径=WinRT，系统开关=关，生效动效=关","v40 path + value change together on log2: one line carries both (source SPI->WinRT, value on->off)");
var log2b = new OsAnimLog();
Check(log2b.Next("WinRT",false,true)=="动画设置：读取路径=WinRT，系统开关=关，应用内开关=开，生效动效=关","v40 startup line with the OS switch off: effective is off");
var log3 = new OsAnimLog();
Check(log3.Next("SPI",false,true)=="动画设置：读取路径=SPI，系统开关=关，应用内开关=开，生效动效=关","v40 startup line from the SPI path");
Check(log3.Next("fail-open",true,true)=="动画设置变化：读取路径=fail-open，系统开关=开，生效动效=开","v40 path + value change together: one line carries both");
var log4 = new OsAnimLog();
log4.Next("WinRT",true,false);
Check(log4.Next("WinRT",false,false)=="动画设置变化：系统开关=关，生效动效=关","v40 change line with the in-app switch off: effective stays off");
Check(log4.Next("WinRT",false,false)==null,"v40 no-op after a settled change writes nothing");}
Console.WriteLine("TOTAL "+n);
}finally{Directory.Delete(dir,true);}

} catch(Exception ex) { Console.Error.WriteLine("FAIL: "+ex.Message); return 1; }
return 0;
