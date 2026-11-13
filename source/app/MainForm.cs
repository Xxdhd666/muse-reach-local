using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace MuseReach
{
    internal sealed class MainForm : Form
    {
        

        [DllImport("user32.dll")] private static extern bool ReleaseCapture();
        [DllImport("user32.dll")] private static extern int SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
        [DllImport("dwmapi.dll")] private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
        [DllImport("dwmapi.dll")] private static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);
        [StructLayout(LayoutKind.Sequential)] private struct Margins { public int Left, Right, Top, Bottom; }

        private readonly WebView2 _shell = new WebView2();
        private readonly WebView2 _web = new WebView2();
        private WebLoadingOverlay _loadingOverlay;
        private bool _webLoaded;
        private ulong _webNavId;
        private bool _geometryReady;
        private CoreWebView2Environment _environment;
        private Task _webInit;
        private bool _webRequested;
        private bool _webNavigated;
        private int _webNavigationCount;

        
        private readonly StatusPill _status = new StatusPill();
        private Panel _titleBar;
        private CaptionStrip _captionStrip;
        private Label _titleLabel;
        
        private readonly Timer _timer = new Timer();
        
        private readonly ConsoleData _data=new ConsoleData(LocalOps.AppDir);
        private System.Collections.Generic.List<Operation> _operations=new();
        private System.Collections.Generic.List<WorkFile> _files=new();
        private ChangeWatcher _watcher;
        private ConnectionSettings _connection=new ConnectionSettings();
        private string _connectionError;
        private WatchList _watch;
        private DateTimeOffset? _heartbeat;
        private string _page="muse";
        private bool _refreshFiles=true;
        private Rectangle _webBounds;
        private AnimOverlay _anim;
        private string _animKind="collapse";
        private bool _autoCollapsed; // v33：窄窗口自动收起态（只活在内存里，永不写 settings）
        private bool _ncMouseTracking; // v38：非客户区鼠标离开追踪是否已登记（WM_NCMOUSELEAVE 靠它来）

        private bool _polling;
        private string _lastError;
        private AppSettings _settings;
        private ProbeResult _probe=new ProbeResult {error="尚未采集"};
        private DateTime _probeAt=DateTime.MinValue;
        private NotifyIcon _tray;
        private readonly HiddenNotify _hiddenNotify = new HiddenNotify(); // v35：托盘隐藏时连接事件的通知决策（状态机，见 HiddenNotify.cs）
        private bool _osAnimationsEnabled = true; // v36：系统“动画效果”开关（默认 true＝读不到时只认应用内开关，见 OsAnimations.cs）
        private bool _exit;
        private bool _hotkeyRegistered;
        private bool _controlBusy;
        [DllImport("user32.dll",SetLastError=true)] private static extern bool RegisterHotKey(IntPtr h,int id,uint mods,uint key);
        [DllImport("user32.dll")] private static extern bool UnregisterHotKey(IntPtr h,int id);
        [DllImport("user32.dll")] private static extern bool DestroyIcon(IntPtr h);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern uint RegisterWindowMessage(string lpString);
        [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool TrackMouseEvent(ref TRACKMOUSEEVENT lpEventTrack);
        [StructLayout(LayoutKind.Sequential)] private struct TRACKMOUSEEVENT { public int cbSize; public int dwFlags; public IntPtr hwndTrack; public int dwHoverTime; }

        // v34：单实例唤醒消息。第二个进程用它通知第一个进程把窗口带到前台
        // （RegisterWindowMessage 按名字取系统级消息号，两个进程算出同一个号）。
        // HWND_BROADCAST=0xffff：发给所有顶层窗口，只有 MainForm 的 WndProc 接它。
        internal static readonly uint BringToFrontMessage = RegisterWindowMessage("MuseReach.BringToFront");
        internal static void NotifyFirstInstance() { PostMessage((IntPtr)0xffff, (int)BringToFrontMessage, IntPtr.Zero, IntPtr.Zero); }



        public MainForm()
        {
            Text = "Muse Reach v48";
            _anim=new AnimOverlay(this,_web);
            try {_settings=AppSettings.Load(Path.Combine(LocalOps.AppDir,"settings.json"));}
            catch(Exception ex){_settings=new AppSettings();LocalOps.AppendLog("error",ex.Message);_lastError=ex.Message;}
            if(AppSettings.ClearLegacyRecents(Path.Combine(LocalOps.AppDir,"settings.json")))LocalOps.AppendLog("settings","已清除旧版最近对话记录");_watch=new WatchList(Path.Combine(LocalOps.AppDir,"watch.json"));try{_settings.SetWebZoom(_settings.webZoom);}catch{_settings.webZoom=1;}
            try { _connection=ConnectionSettings.Load(Path.Combine(LocalOps.AppDir,"connection.json")); }
            catch(Exception){ _connectionError="连接配置无法读取，请在设置页检查后保存；原文件未覆盖"; }
            try{_settings.SetConsoleScale(_settings.consoleScale);}catch{_settings.consoleScale=1;}
            InitTray();
            Resize += (s,e)=>{if(WindowState==FormWindowState.Minimized&&_settings.minimizeToTray)Hide();};
            FormClosing += (s,e)=>{SaveGeometry();if(!_exit&&_settings.minimizeToTray&&e.CloseReason==CloseReason.UserClosing){e.Cancel=true;Hide();}};
            FormClosed += (s,e)=>{UnregisterHotKey(Handle,8001);_tray.Visible=false;_tray.Dispose();_timer.Dispose();_watcher?.Dispose();_anim?.Dispose();_loadingOverlay?.Dispose();};

            FormBorderStyle = FormBorderStyle.None;
            Width = 1180; Height = 780;
            MinimumSize = new Size(860, 560);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(17, 19, 23);
            Padding = new Padding(8);
            Resize += (s, e) => { Padding = WindowState == FormWindowState.Maximized ? new Padding(0) : new Padding(8); };
            Resize += (s, e) => UpdateAutoCollapse(); // v33：窗口改宽时重算自动收起（只在越过阈值时发消息）

            _titleBar = new Panel { Dock = DockStyle.Top, Height = 38, BackColor = Color.FromArgb(23, 25, 29) };
            _titleLabel = new Label
            {
                Text = "Muse Reach",
                ForeColor = Color.FromArgb(236, 238, 241),
                Font = new Font(Font.FontFamily, 9.5f, FontStyle.Bold),
                AutoSize = true,
                Location = new Point(12, 10)
            };
            _titleLabel.Location = Point.Empty;
            _titleLabel.Margin = new Padding(12, 10, 10, 0);
            _status.AutoSize = true;
            _status.ForeColor = Color.FromArgb(161, 166, 176);
            _status.Font = new Font(Font.FontFamily, 8.5f);
            _status.Margin = new Padding(0, 5, 0, 0);
            _status.Text = "真实状态：读取中…";
            var leftFlow = new FlowLayoutPanel { Dock = DockStyle.Left, AutoSize = true, FlowDirection = FlowDirection.LeftToRight, WrapContents = false, BackColor = Color.Transparent, Margin = new Padding(0), Padding = new Padding(0) };
            leftFlow.Controls.Add(_titleLabel);
            leftFlow.Controls.Add(_status);

            // v17：标题栏按钮整条自绘（CaptionStrip），一次 OnPaint 画完三枚图标。
            // v16 的三个独立透明 Control 在 DPI 缩放后重叠/重绘错位，悬停串位、
            // 全变红、图标透印——分开的控件加补丁修不彻底，改成一整条：状态只用
            // 一个字段（当前段），按 x 坐标命中，点击同样按坐标分发。
            _captionStrip = new CaptionStrip();
            _captionStrip.AnimationsEnabled = EffectiveAnimations; // v18：动效开关同步给标题栏悬停淡入淡出（v36：按有效值，不是只按用户开关）
            _captionStrip.SegmentClicked += seg => {
                _captionStrip.ResetVisualState();
                if (seg == CaptionSegment.Min) WindowState = FormWindowState.Minimized;
                else if (seg == CaptionSegment.Max) ToggleMaximize();
                else if (seg == CaptionSegment.Close) Close();
            };

            _titleBar.Controls.Add(leftFlow);
            _titleBar.Controls.Add(_captionStrip);
            _titleBar.MouseDown += DragWindow;
            leftFlow.MouseDown += DragWindow;
            _titleLabel.MouseDown += DragWindow;
            _status.MouseDown += DragWindow;
            _titleBar.DoubleClick += (s, e) => ToggleMaximize();
            // v17：窗口失活时悬停状态立即复位，红色不得粘住、不得串段。
            // v23：失活走 SetWindowActive(false)——悬停/按下即时归零、三枚图标变灰；
            // 重新激活走 SetWindowActive(true)——按当前光标位置即时恢复常态，
            // 不走淡入淡出、不等下一次鼠标移动。
            Deactivate += (s, e) => {_captionStrip?.SetWindowActive(false);};
            Activated += (s, e) => {_captionStrip?.SetWindowActive(true);};

            _shell.Dock = DockStyle.Fill;
            _web.Dock=DockStyle.None;_web.Visible=false;
            Controls.Add(_web);


            Controls.Add(_shell);
            Controls.Add(_titleBar);

            // v32：Muse 页加载态覆盖层（原生 WinForms，盖在 _web 的位置上，
            // 不遮侧栏与标题栏；绝不向 muse.ai 注入脚本或 CSS）。
            // 最后加入 Controls，天然在 _web 之上；PositionWeb 里 _web 每次
            // BringToFront 后再把它带到前面（见 SyncLoadingOverlayBounds）。
            _loadingOverlay=new WebLoadingOverlay();
            _loadingOverlay.Visible=false;
            _loadingOverlay.AnimationsEnabled=EffectiveAnimations; // v36：按有效值（构造时 _osAnimationsEnabled 默认 true，即用户开关的值；首轮 PollAsync 读到系统值后重同步）
            _loadingOverlay.ApplyTheme(_settings.theme);
            _loadingOverlay.RetryClicked+=(s,e)=>{try{_web.CoreWebView2?.Reload();}catch(Exception ex){LocalOps.AppendLog("error","Muse 网页重试失败："+ex.Message);}};
            _loadingOverlay.WatchdogFired+=(s,e)=>LocalOps.AppendLog("error","Muse 网页加载超时（60 秒内无被追踪导航的完成信号）");
            Controls.Add(_loadingOverlay);
            RefreshOsAnimations(); // v36：启动时即读一次系统开关，首帧动效就按有效值走（shell 未就绪时 PostToShell 是空操作，快照里也会带 osAnimationsEnabled）

            Shown += async (s,e)=>{try {ApplyDwmFrame();LayoutTitleBar();MinimumSize=WindowGeometryMath.MinimumSize;if(!RestoreGeometry())ApplyInitialScale();await InitAsync();ApplyHotkey();if(Environment.GetCommandLineArgs().Contains("--self-test"))await NativeSmokeAsync();if(Environment.GetCommandLineArgs().Contains("--minimized"))Hide();}catch(Exception ex){LocalOps.AppendLog("error","界面初始化失败："+ex.Message);_status.Text="界面初始化失败："+ex.Message;if(Environment.GetCommandLineArgs().Contains("--self-test")&&!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MUSEREACH_TEST_HOME"))){File.WriteAllText(Path.Combine(LocalOps.AppDir,"native-smoke.json"),JsonSerializer.Serialize(new {passed=false,error=ex.ToString()}));_exit=true;Close();}}};
            _timer.Interval = 1000;
            _timer.Tick += async (s, e) => await PollAsync();
            _timer.Start();
        }

        private void DragWindow(object sender, MouseEventArgs e)
        {
            if (e.Button != MouseButtons.Left) return;
            ReleaseCapture();
            SendMessage(Handle, 0xA1, 0x2, 0);
        }

        // v20：不再信 Shown 时的原始 Screen.WorkingArea（物理像素）。先换算成逻辑像素
        // 再算初始尺寸；即便 DeviceDpi 不准，尺寸仍会被钳制进逻辑工作区，不会再出屏。
        // 目标 1180×780 逻辑 px（150% 下 1770×1170 物理目标的换算值），超过工作区时
        // 缩小到工作区内（留 8px 余量），首次启动在工作区内居中。只在无保存几何时调用
        // （有保存几何时 RestoreGeometry 已恢复并钳制，见 Shown 的调用顺序）。
        private void ApplyInitialScale()
        {
            int dpi = WindowGeometryMath.EffectiveDpi(DeviceDpi);
            var wa = WindowGeometryMath.ToLogical(Screen.FromControl(this).WorkingArea, dpi);
            var size = WindowGeometryMath.InitialSize(dpi);
            int w = Math.Min(size.Width, Math.Max(200, wa.Width - 2 * WindowGeometryMath.Margin));
            int h = Math.Min(size.Height, Math.Max(WindowGeometryMath.MinHeight, wa.Height - 2 * WindowGeometryMath.Margin));
            ClientSize = new Size(w, h);
            MinimumSize = WindowGeometryMath.MinimumSize;
            Location = new Point(wa.Left + Math.Max(0, (wa.Width - Width) / 2), wa.Top + Math.Max(0, (wa.Height - Height) / 2));
        }

        // v17：标题栏与整条按钮的尺寸唯一入口。标题栏高度 round(38 × DPI/96)，
        // 整条按钮三段等宽 46 逻辑像素按 DPI 放大、高度与标题栏同高；Shown 时
        // 调一次（此时 DeviceDpi 已是真实值），DPI 变化时再调。
        private void LayoutTitleBar()
        {
            float scale = DeviceDpi / 96f;
            int barH = Math.Max(30, (int)Math.Round(38 * scale));
            _titleBar.Height = barH;
            _titleLabel.Margin = new Padding(12, (int)Math.Round(10 * scale), 10, 0);
            _status.Margin = new Padding(0, (int)Math.Round(5 * scale), 0, 0);
            _captionStrip.ApplyDpi(scale, barH);
        }

        protected override void OnDpiChanged(DpiChangedEventArgs e)
        {
            base.OnDpiChanged(e);
            LayoutTitleBar();
        }

        // v20：返回是否按保存的几何恢复（true）还是没有保存的几何（false，调用方走首次启动）。
        // 单位错配是 v19 钳制没生效的根因：保存的 windowBounds 是逻辑像素（截屏为证：
        // 窗口右缘在逻辑 471+1758=2229，超出 1707 宽的逻辑屏 522px），而 Screen.WorkingArea
        // 给的是物理像素（2560×1600）。v19 拿 1758 宽的逻辑 bounds 去跟 2560 宽的物理
        // 工作区比，以为完全放得下，原样返回——reach.log 23:44:00：Restore 与保存值一字
        // 不差、无钳制行。现在先把每个工作区换算成逻辑像素再比；保存的 bounds、钳制结果、
        // 写回 settings 的值全部按逻辑像素。DeviceDpi 异常时退回 96（见 EffectiveDpi）。
        private bool RestoreGeometry(){
            int dpi = WindowGeometryMath.EffectiveDpi(DeviceDpi);
            var areas = WindowGeometryMath.ToLogicalAreas(Screen.AllScreens.Select(x=>x.WorkingArea).ToArray(), dpi);
            var primary = WindowGeometryMath.ToLogical(Screen.PrimaryScreen.WorkingArea, dpi);
            var b=_settings.windowBounds;
            bool restored=false; var waUsed=primary;
            if(WindowGeometry.IsVisible(b,areas)){
                var saved=new Rectangle(b.x,b.y,b.width,b.height);
                var wa=WindowGeometryMath.PickWorkingArea(saved,areas,primary);
                waUsed=wa;
                var clamped=WindowGeometryMath.ClampToWorkingArea(saved,wa);
                StartPosition=FormStartPosition.Manual;Bounds=clamped;restored=true;
                if(clamped!=saved){_settings.windowBounds=new WindowGeometry{x=clamped.X,y=clamped.Y,width=clamped.Width,height=clamped.Height};try{SaveUiSettings();}catch(Exception ex){LocalOps.AppendLog("error","钳制后的窗口位置未保存："+ex.Message);}LocalOps.AppendLog("window","窗口几何已钳制进工作区：原="+saved+" 新="+clamped);}
            }
            if(_settings.windowMaximized)WindowState=FormWindowState.Maximized;
            _geometryReady=true;LocalOps.AppendLog("window","恢复后 DeviceDpi="+DeviceDpi+" 逻辑工作区="+waUsed+" Bounds="+Bounds+" Restore="+RestoreBounds+" Maximized="+(WindowState==FormWindowState.Maximized));
            return restored;
        }
        private void SaveGeometry(){if(!_geometryReady)return;var r=WindowState==FormWindowState.Normal?Bounds:RestoreBounds;if(r.Width<200||r.Height<150)return;_settings.windowBounds=new WindowGeometry{x=r.X,y=r.Y,width=r.Width,height=r.Height};if(WindowState!=FormWindowState.Minimized)_settings.windowMaximized=WindowState==FormWindowState.Maximized;try{SaveUiSettings();}catch(Exception ex){LocalOps.AppendLog("error","窗口位置未保存："+ex.Message);}}
        private void SaveUiSettings()=>_settings.Save(Path.Combine(LocalOps.AppDir,"settings.json"));
        private void ToggleMaximize()
        {
            WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
        }

        // v33：窄窗口自动收起。C# 是唯一量宽方：逻辑宽用 ClientSize.Width
        // （逻辑像素，与 v20 钳制单位一致）；最小化时不量宽（尺寸不可信，
        // 恢复时 Resize 会再算一次）；状态变化才发消息，拖动时只在越过阈值
        // 时发一次；force=true 只在 shell 刚 ready 时用——同步 JS 的初始态。
        // 快照里也带 autoCollapsed（见 PollAsync），shell 重载后靠它重同步。
        private void UpdateAutoCollapse(bool force=false){
            if(WindowState==FormWindowState.Minimized)return;
            bool next=SidebarAutoCollapse.Next(_autoCollapsed,ClientSize.Width);
            if(!force&&next==_autoCollapsed)return;
            _autoCollapsed=next;
            PostToShell(new{type="auto-collapse",collapsed=_autoCollapsed});
        }

        // v36：最终动效开关 = 用户开关 AND 系统开关（见 OsAnimations.Effective）。
        // 用户开关的值永远不被系统开关改写（本类只读 OsAnimations，不写
        // AppSettings；settings.json 里 animationsEnabled 一次都不动）。
        private bool EffectiveAnimations => _settings.animationsEnabled && _osAnimationsEnabled;
        // v36：重读系统“动画效果”开关；值变了才应用（幂等）：同步给标题栏
        // 与加载覆盖层，并立即发 os-anim 消息让 shell 跟上（快照里也带
        // osAnimationsEnabled，shell 重载后靠它重同步，与 v33 的 auto-collapse
        // 同款双保险）。调用点：构造末尾（启动即读一次）、PollAsync 每轮
        // （1 秒一次兜底，覆盖漏掉的广播）、WndProc 的 WM_SETTINGCHANGE
        // （用户在系统设置里改了就立即跟上，下一次动效按新值走）。
        // v40：动画设置读取路径的日志（补 v36 缺口）：每次重读都算一次
        // 日志决策——启动写一行（路径＋系统值＋应用内值＋生效值），之后
        // 值变了或路径变了才写一行，值和路径都没变不写（每秒轮询不刷日志）。
        // 日志只含路径与开关值，不含个人信息。读路径与动效行为本身一字
        // 未动（WinRT 优先、SPI 退路、fail-open，见 OsAnimations.cs）。
        private readonly OsAnimLog _osAnimLog = new OsAnimLog();
        private void RefreshOsAnimations(){
            bool next; string source;
            try { var r = OsAnimations.ReadWithSource(OsAnimationsWinRt.Read); next = r.value; source = r.source; }
            catch { next = true; source = "fail-open"; }
            string logLine = _osAnimLog.Next(source, next, _settings.animationsEnabled);
            if (logLine != null) LocalOps.AppendLog("app", logLine);
            if (next == _osAnimationsEnabled) return;
            _osAnimationsEnabled = next;
            ApplyEffectiveAnimations();
        }
        private void ApplyEffectiveAnimations(){
            bool effective = EffectiveAnimations;
            if (_captionStrip != null) _captionStrip.AnimationsEnabled = effective;
            if (_loadingOverlay != null) _loadingOverlay.AnimationsEnabled = effective;
            PostToShell(new { type = "os-anim", enabled = _osAnimationsEnabled });
        }

        private void ApplyDwmFrame()
        {
            try
            {
                int pref = 2; // DWMWCP_ROUND
                DwmSetWindowAttribute(Handle, 33, ref pref, sizeof(int));
                var m = new Margins { Left = 1, Right = 1, Top = 1, Bottom = 1 };
                DwmExtendFrameIntoClientArea(Handle, ref m);
            }
            catch { }
        }

        // v38：声明窗口可最大化/最小化（WS_MAXIMIZEBOX 0x00010000 /
        // WS_MINIMIZEBOX 0x00020000）。窗口是无边框的（FormBorderStyle.None），
        // 这两个位不画任何标题栏——三枚键仍是手绘 CaptionStrip；但系统要靠
        // 它们知道窗口能最大化，否则只给 HTMAXBUTTON 也未必能唤出 Snap
        // Layouts 贴靠浮层。附带：Win+上、任务栏右键的最大化/最小化也会认
        // 这两个位。不加 WS_SYSMENU，不产生可见系统菜单。
        // 判断：若真机仍不出浮层，下一步先核这里（窗口样式/DPI/WebView2 覆盖），
        // 见 REPORT §06。
        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.Style |= 0x00010000 | 0x00020000; // WS_MAXIMIZEBOX | WS_MINIMIZEBOX
                return cp;
            }
        }

        protected override void WndProc(ref Message m)
        {
            if(m.Msg==0x0312&&m.WParam.ToInt32()==8001){QuickInput();return;}
            if(m.Msg==(int)BringToFrontMessage){ShowReach();return;} // v34：重复启动的唤醒（第二个进程已把消息广播过来）
            // v36：系统设置变化（例如在“设置→辅助功能→视觉效果”里开关“动画效果”）
            // 会广播 WM_SETTINGCHANGE；立即重读系统开关，下一次动效按新值走。
            // 不按 wParam 过滤——重读本身是幂等的（值没变就什么都不做），比只认
            // SPI_SETANIMATION 更稳（广播的 wParam 不保证是它）；不 return，
            // 仍要走 base.WndProc 做默认处理。
            const int WM_SETTINGCHANGE = 0x001A;
            if (m.Msg == WM_SETTINGCHANGE) RefreshOsAnimations();
            const int WM_NCHITTEST = 0x84;
            const int HTCLIENT = 1, HTMAXBUTTON = 9, HTLEFT = 10, HTRIGHT = 11, HTTOP = 12, HTTOPLEFT = 13, HTTOPRIGHT = 14, HTBOTTOM = 15, HTBOTTOMLEFT = 16, HTBOTTOMRIGHT = 17;
            if (m.Msg == WM_NCHITTEST)
            {
                base.WndProc(ref m);
                int lp = m.LParam.ToInt32();
                var p = PointToClient(new Point((short)(lp & 0xFFFF), (short)((lp >> 16) & 0xFFFF)));
                // v38：Snap Layouts——最大化段返回 HTMAXBUTTON，Windows 才会在
                // 悬停时弹出贴靠浮层。标题栏按钮优先于顶部尺寸调整边（原生窗口
                // 也是这样：按钮区不是 resize 握柄），所以这一步先于边距换算。
                // 最大化与还原态都返回 HTMAXBUTTON（还原键悬停同样出浮层），
                // 所以不设 WindowState 条件；其余区域的返回值原样不动。
                // 注意：标题栏空白处返回 HTCLIENT，不是 HTCAPTION——拖动靠
                // DragWindow 的 ReleaseCapture + SC_MOVE（v1 以来的做法），
                // 行为不变，见 REPORT 的完整映射表。
                if (_captionStrip != null && _captionStrip.IsHandleCreated)
                {
                    var seg = CaptionHitTest.SegmentAt(p, StripRectInForm(), _captionStrip.DpiScale);
                    if (seg == CaptionSegment.Max) { m.Result = (IntPtr)HTMAXBUTTON; return; }
                    // v38：鼠标从最大化段（非客户区悬停）移开后，条的悬停要清掉。
                    // 移到 Min/Close 段时条自己的 MouseMove 会接手；移到条外时
                    // 没人清（条从没收到过这个悬停的 MouseMove，也就不会收到
                    // MouseLeave），这里只清 Max 悬停，Min/Close 的悬停是条自己
                    // 的事，不碰。捕获中按住拖动时不走 WM_NCHITTEST，不会干扰按下态。
                    if (_captionStrip.Hover == CaptionSegment.Max) _captionStrip.NcLeave();
                }
                if (WindowState != FormWindowState.Maximized && (int)m.Result == HTCLIENT)
                {
                    int g = 6;
                    bool l = p.X <= g, r = p.X >= ClientSize.Width - g, t = p.Y <= g, b = p.Y >= ClientSize.Height - g;
                    m.Result = (IntPtr)(t && l ? HTTOPLEFT : t && r ? HTTOPRIGHT : b && l ? HTBOTTOMLEFT : b && r ? HTBOTTOMRIGHT : l ? HTLEFT : r ? HTRIGHT : t ? HTTOP : b ? HTBOTTOM : HTCLIENT);
                }
                return;
            }
            // v38：最大化段命中 HTMAXBUTTON 后，鼠标消息以非客户区消息到达
            // 窗口，条自己的 MouseMove/MouseDown/Up 收不到这个段的消息。窗口
            // 按条内 x 把悬停与按下喂回条里，复用 HoverState 同一套状态机
            // （v23 的悬停 pill、按下态、失活态原样不动）；点击仍走
            // ToggleMaximize（与 SegmentClicked 的分发相同），不依赖
            // DefWindowProc 对无 WS_MAXIMIZEBOX 窗口的 SC_MAXIMIZE 处理。
            // wParam 就是该点的命中码；坐标再复核一次，防几何漂移。
            const int WM_NCMOUSEMOVE = 0x00A0, WM_NCMOUSELEAVE = 0x02A2;
            const int WM_NCLBUTTONDOWN = 0x00A7, WM_NCLBUTTONUP = 0x00A8, WM_NCLBUTTONDBLCLK = 0x00A9;
            if (m.Msg == WM_NCMOUSEMOVE)
            {
                if ((int)m.WParam == HTMAXBUTTON) { ArmNcMouseLeave(); if (TryMaxPoint(m, out float x)) _captionStrip.NcMove(x); }
                else if (_captionStrip.Hover == CaptionSegment.Max) _captionStrip.NcLeave();
                base.WndProc(ref m);
                return;
            }
            if (m.Msg == WM_NCMOUSELEAVE)
            {
                _ncMouseTracking = false;
                _captionStrip.NcLeave();
                base.WndProc(ref m);
                return;
            }
            if ((m.Msg == WM_NCLBUTTONDOWN || m.Msg == WM_NCLBUTTONDBLCLK) && (int)m.WParam == HTMAXBUTTON)
            {
                // 按下走条自己的状态机（NcDown 会捕获鼠标，抬起走条的 MouseUp →
                // SegmentClicked → ToggleMaximize，与 v23 的段内点击同一条路）；
                // 不调 base——DefWindowProc 的非客户区按下处理会自己接管点击
                // （SC_MAXIMIZE），与条的状态机打架。双击与单击同路：两次抬起
                // 各触发一次 ToggleMaximize（与原生双击最大化键先最大化再还原
                // 一致；v37 的双击是三次触发，见 REPORT §05）。
                if (TryMaxPoint(m, out float x)) { _captionStrip.NcDown(x); return; }
            }
            if (m.Msg == WM_NCLBUTTONUP && (int)m.WParam == HTMAXBUTTON)
            {
                // 安全网：正常流程里 NcDown 已让条捕获鼠标，抬起走条的 MouseUp；
                // 只有没捕获到（例如按下时窗口失活、NcDown 被守卫拦下）才会到这里。
                // 按条内 x 复用同一套 Up：真落在最大化段上才补一次与 SegmentClicked
                // 相同的分发；落在段外（x=-1）只清按下，不触发。
                float x = -1;
                if (TryMaxPoint(m, out float mx)) x = mx;
                var fired = _captionStrip.NcUp(x);
                if (fired == CaptionSegment.Max) { _captionStrip.ResetVisualState(); ToggleMaximize(); }
                return;
            }
            base.WndProc(ref m);
        }

        // v38：条在窗口客户区内的矩形（供 WM_NCHITTEST 与非客户区消息共用）。
        // 用 RectangleToScreen/RectangleToClient 换算，不手算 Padding 与 Dock
        // （最大化时 Padding=0，标题栏位置会变，手算容易错）。
        private Rectangle StripRectInForm()
        {
            if (_captionStrip == null || _titleBar == null || !_captionStrip.IsHandleCreated) return Rectangle.Empty;
            return RectangleToClient(_captionStrip.RectangleToScreen(_captionStrip.ClientRectangle));
        }
        // v38：非客户区消息的屏幕坐标 → 条内 x（只当该点真落在最大化段上才
        // 返回 true；wParam 已经是 HTMAXBUTTON 时再复核一次坐标，防几何漂移）。
        private bool TryMaxPoint(Message m, out float xInStrip)
        {
            xInStrip = 0;
            if (_captionStrip == null || !_captionStrip.IsHandleCreated) return false;
            int lp = m.LParam.ToInt32();
            var p = PointToClient(new Point((short)(lp & 0xFFFF), (short)((lp >> 16) & 0xFFFF)));
            var rect = StripRectInForm();
            if (CaptionHitTest.SegmentAt(p, rect, _captionStrip.DpiScale) != CaptionSegment.Max) return false;
            xInStrip = p.X - rect.Left;
            return true;
        }
        // v38：登记非客户区鼠标离开追踪（TME_LEAVE | TME_NONCLIENT），
        // 鼠标离开非客户区时系统发 WM_NCMOUSELEAVE。WinForms 默认不发这条
        // 消息，不登记就收不到。首次悬停到最大化段时登记一次；收到离开
        // 消息后清标志，下次悬停再登记。
        private void ArmNcMouseLeave()
        {
            if (_ncMouseTracking) return;
            try
            {
                var t = new TRACKMOUSEEVENT { cbSize = Marshal.SizeOf(typeof(TRACKMOUSEEVENT)), dwFlags = 0x00000002 | 0x00000010, hwndTrack = Handle, dwHoverTime = 0 };
                if (TrackMouseEvent(ref t)) _ncMouseTracking = true;
            }
            catch { }
        }

        private async Task InitAsync()
        {
            LocalOps.AppendLog("app", "Reach 程序启动");
            try{int backfilled=Backfill.Ensure(LocalOps.AppDir);if(backfilled>0)LocalOps.AppendLog("backfill","已补记 "+backfilled+" 条旧交付记录");}catch(Exception ex){LocalOps.AppendLog("error","补记失败："+ex.Message);}
            StartWatcher();
            string udf = Path.Combine(LocalOps.AppDir, "WebView2");
            Directory.CreateDirectory(udf);
            var env = await CoreWebView2Environment.CreateAsync(null, udf).WaitAsync(TimeSpan.FromSeconds(20));
            _environment=env;
            LocalOps.AppendLog("app","WebView2 环境已创建");

            await _shell.EnsureCoreWebView2Async(env).WaitAsync(TimeSpan.FromSeconds(20));
            LocalOps.AppendLog("app","WebView2 控件已就绪 core="+(_shell.CoreWebView2!=null));
            _shell.CoreWebView2.ProcessFailed+=(s,e)=>LocalOps.AppendLog("error","WebView2 进程故障 "+e.ProcessFailedKind);
            _shell.CoreWebView2.NavigationCompleted+=(s,e)=>LocalOps.AppendLog("app","导航完成 success="+e.IsSuccess+" status="+e.WebErrorStatus);
            // The shell owns its native message bridge; no document injection is needed.
            _shell.CoreWebView2.WebMessageReceived += OnShellMessage;
            _shell.ZoomFactor=_settings.consoleScale;
            _shell.CoreWebView2.NavigateToString(LoadShellHtml());
            LocalOps.AppendLog("app","已提交本地界面导航");

            // v10 never reads or writes the retired link directory.
            await PollAsync();
            
            try
            {
                var scr = Screen.FromControl(this);
                LocalOps.AppendLog("metrics2", "DeviceDpi=" + DeviceDpi + " ClientSize=" + ClientSize.Width + "x" + ClientSize.Height + " Bounds=" + Bounds.Width + "x" + Bounds.Height + " Screen=" + scr.Bounds.Width + "x" + scr.Bounds.Height);
            }
            catch { }
        }

        private static string LoadShellHtml()
        {
            var asm = Assembly.GetExecutingAssembly();
            using (var stream = asm.GetManifestResourceStream("MuseReach.shell.html"))
            using (var reader = new StreamReader(stream))
                return reader.ReadToEnd();
        }

        private void RefreshStatus(){_status.Text=StatusPresentation.Short(_probe);}

        private void PostToShell(object obj)
        {
            try { _shell.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(obj)); } catch { }
        }


        // v34：托盘右键菜单只有“打开/退出”两项。“快速输入”仍走 Ctrl+Alt+Space 热键
        // （WndProc 0x0312 → QuickInput）；“连接控制”仍在连接状态页与安全页
        // （data-action="reconnect"/"control" → ExecuteConnectionAsync 的弹窗入口）。
        private void InitTray(){
            using var bmp=new Bitmap(32,32);using(var g=Graphics.FromImage(bmp)){g.Clear(Color.FromArgb(23,25,29));using var f=new Font("Segoe UI",20,FontStyle.Bold);using var brush=new SolidBrush(Color.FromArgb(117,215,187));g.DrawString("R",f,brush,-1,-3);}
            IntPtr handle=bmp.GetHicon();Icon icon;try{using var temp=Icon.FromHandle(handle);icon=(Icon)temp.Clone();}finally{DestroyIcon(handle);}
            _tray=new NotifyIcon{Text=TrayTooltip.For(_settings.hotkeyEnabled),Icon=icon,Visible=true};var menu=new ContextMenuStrip();
            menu.Items.Add("打开",null,(s,e)=>ShowReach());menu.Items.Add("退出",null,(s,e)=>{_exit=true;Close();});_tray.ContextMenuStrip=menu;_tray.DoubleClick+=(s,e)=>ShowReach();
            // v35：点通知＝还原窗口并打开连接状态页（真实跳转，不是摆设）。BalloonTipClicked
            // 只在点通知时触发；从通知中心划掉不触发，不做任何事。
            _tray.BalloonTipClicked+=(s,e)=>{ShowReach();PostToShell(new{type="navigate",page="connection"});};
        }
        // v34：托盘还原/带到前台。决策走 TrayRestore（纯逻辑，见 TrayRestore.cs）：
        // 已在前台时 no-op；可见未最小化时只 Activate、不碰尺寸（旧写法无条件
        // WindowState=Normal，会把最大化窗口打回普通尺寸）；隐藏或最小化时先还原
        // 再激活。跨进程唤醒时 Activate 可能抢不到前台（前台权限在第二个进程手里），
        // 此时 TopMost 顶一下再放回是通行做法，只在没抢到前台时用。
        private void ShowReach(){
            switch(TrayRestore.Next(Visible,WindowState==FormWindowState.Minimized,GetForegroundWindow()==Handle)){
                case TrayRestore.Action.NoOp:return;
                case TrayRestore.Action.ActivateOnly:Activate();break;
                default:
                    Show();
                    if(WindowState==FormWindowState.Minimized)WindowState=FormWindowState.Normal;
                    Activate();
                    if(GetForegroundWindow()!=Handle){TopMost=true;TopMost=false;}
                    break;
            }
        }
        private void ApplyHotkey(){UnregisterHotKey(Handle,8001);_hotkeyRegistered=false;if(_settings.hotkeyEnabled){_hotkeyRegistered=RegisterHotKey(Handle,8001,0x4003,0x20);if(!_hotkeyRegistered)LocalOps.AppendLog("error","Ctrl+Alt+Space 注册失败，可能被占用");}if(_tray!=null)_tray.Text=TrayTooltip.For(_settings.hotkeyEnabled);}
        // v35：窗口藏进托盘（或最小化到任务栏、看不见）时，连接断开/重连走 Windows 系统通知；
        // 窗口可见时只出 v27 的 InfoBar，同一件事绝不两边都弹。只覆盖连接事件——
        // 其他事件（文件变化、执行记录新增、设置变化）到不了这里（本方法只读 health）。
        // 文案与 v27 InfoBar 同一口径（标题一字不差：通道中断“与云端的连接断开了”、
        // 疑似假死“Muse 超过 90 秒没有动静”、重连“已重新连接”），只用人话，不贴
        // 错误码、网址、技术名词；正文是点通知后的动作提示。
        // 实现选 NotifyIcon 气球提示（BalloonTip），不用真 Toast：真 Toast
        // （Windows.UI.Notifications）对未打包 Win32 程序要先
        // SetCurrentProcessExplicitAppUserModelID＋在开始菜单注册同名快捷方式，
        // 否则 Win11 上静默丢弃；Reach 没有安装器、从桌面直接启动，做那套注册是
        // 安装器 scope 的活，不在本单里。BalloonTip 不需要任何注册，托盘图标本来就在。
        // 局限（见 REPORT §04）：Win11 把气球提示收进通知中心、以“Muse Reach”
        // 之名显示，系统控制停留时长（5000ms 只是提示值）；没有操作按钮，只有
        // 点通知打开连接页；专注助手/勿扰开着时只进中心、不弹窗；用户在系统设置里
        // 关掉本程序通知就什么都不出。
        private void NotifyHidden(HealthStatus health){
            var kind=health.reconnect?(health.label=="疑似假死"?HiddenNotify.HealthKind.SuspectedStuck:HiddenNotify.HealthKind.Interrupted):health.label=="通道正常"?HiddenNotify.HealthKind.Healthy:HiddenNotify.HealthKind.Neutral;
            bool windowVisible=Visible&&WindowState!=FormWindowState.Minimized;
            switch(_hiddenNotify.Next(windowVisible,kind)){
                case HiddenNotify.Decision.NotifyInterrupted:_tray.ShowBalloonTip(5000,"与云端的连接断开了","点一下打开连接状态页。",ToolTipIcon.Warning);break;
                case HiddenNotify.Decision.NotifySuspectedStuck:_tray.ShowBalloonTip(5000,"Muse 超过 90 秒没有动静","可能只是暂时没动静，点一下打开连接状态页。",ToolTipIcon.Warning);break;
                case HiddenNotify.Decision.NotifyReconnect:_tray.ShowBalloonTip(5000,"已重新连接","与云端的连接已恢复，点一下打开连接状态页。",ToolTipIcon.Info);break;
            }
        }
        private void QuickInput(){ShowReach();PostToShell(new {type="navigate",page="muse"});}
        private static void SetStartup(bool enabled){using var key=Microsoft.Win32.Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run");if(enabled)key.SetValue("MuseReach","\""+Application.ExecutablePath+"\" --minimized");else key.DeleteValue("MuseReach",false);}
        private async Task SwitchWebAsync(bool show){
            try{_anim?.CompleteNow();}catch{}
            _webRequested=show;_shell.Visible=true;
            if(!show){_web.Visible=false;_loadingOverlay?.SetMusePageActive(false);return;}
            if(_environment==null)return;
            try{if(_webInit==null){_webInit=_web.EnsureCoreWebView2Async(_environment);await _webInit;_web.ZoomFactor=_settings.webZoom;
                _web.CoreWebView2.NavigationStarting+=(s,e)=>_webNavigationCount++;
                _web.CoreWebView2.NavigationStarting+=OnWebNavigationStarting;
                _web.CoreWebView2.NavigationCompleted+=OnWebNavigationCompleted;
                }else await _webInit;
                if(!_webNavigated&&(string.IsNullOrEmpty(_web.CoreWebView2.Source)||_web.CoreWebView2.Source=="about:blank")){
                    _webNavigated=true;
                    if(Environment.GetCommandLineArgs().Contains("--self-test"))_web.CoreWebView2.NavigateToString("<html><body>Muse 默认网页自测（本地测试页）</body></html>");
                    else {string url=_settings.museStartUrl;try{new AppSettings().SetMuseUrl(url);}catch{url="https://muse.ai/";}_web.CoreWebView2.Navigate(url);}
                }
                if(_webRequested&&_page=="muse"&&_webBounds.Width>0){_web.Bounds=_webBounds;_web.Visible=_webLoaded;_web.BringToFront();_loadingOverlay?.SetMusePageActive(true);SyncLoadingOverlayBounds();}
            }catch(Exception ex){_web.Visible=false;LocalOps.AppendLog("error","Muse 网页打开失败："+ex.Message);PostToShell(new {type="error",text="Muse 网页暂时没打开，请稍后重试；控制台仍可使用"});}
        }
        private void SyncLoadingOverlayBounds(){
            if(_loadingOverlay==null||_webBounds.Width<=0||_webBounds.Height<=0)return;
            _loadingOverlay.Bounds=_webBounds;
            // 动画进行时 AnimOverlay 的截图在最上层，别把加载层顶到它前面。
            if(_anim==null||!_anim.Active)_loadingOverlay.BringToFront();
        }
        // v32：Muse 页加载态。WebView2 的导航事件按官方文档主帧与子帧都会触发，
        // 没有只限主帧的开关；用 NavigationId 关联一次导航的开始与完成，
        // 子帧的完成信号按 id 忽略——失败的子帧永远不弹错误页。
        // NavigationStarting 在重定向链上每跳都触发，BeginLoad 在加载中是幂等的
        // （不重置计时起点），所以慢重定向不会把 1 秒档位一直往后推。
        // 兜底：60 秒内没有任何被追踪导航的完成信号（例如跨站登录重定向后
        // 不再回到 muse.ai、或完成事件丢了），看门狗按失败处理，见 overlay。
        // 首次加载完成前 _web 不可见：WebView2 默认空白底是白色，WinForms 控件
        // 未公开 Controller，C# 侧改不了 DefaultBackgroundColor（它在
        // CoreWebView2Controller 上）；藏起 _web 后加载中只看到 shell 本来就有的
        // “正在准备 Muse 网页”静态提示（v31 已有），绝不白屏。首次成功后
        // _webLoaded 锁存，之后切页不再经过这个门。
        private void OnWebNavigationStarting(object sender,CoreWebView2NavigationStartingEventArgs e){
            _webNavId=e.NavigationId;
            try{_loadingOverlay?.BeginLoad();}catch{}
        }
        private void OnWebNavigationCompleted(object sender,CoreWebView2NavigationCompletedEventArgs e){
            if(e.NavigationId!=_webNavId)return; // 子帧或其他导航的完成信号，忽略
            if(e.IsSuccess){
                if(!_webLoaded)LocalOps.AppendLog("app","Muse 网页首次加载完成");
                _webLoaded=true;
                try{_loadingOverlay?.FinishLoad();_loadingOverlay?.DismissError();
                    if(_page=="muse"&&_webRequested&&_webBounds.Width>0){_web.Bounds=_webBounds;_web.Visible=true;_web.BringToFront();SyncLoadingOverlayBounds();}
                }catch{}
            }
            else{LocalOps.AppendLog("error","Muse 网页加载失败："+e.WebErrorStatus);try{_loadingOverlay?.ShowError();}catch{}}
        }
        private void PositionWeb(JsonElement r){double viewport=r.GetProperty("viewport").GetDouble();if(viewport<=0)return;double scale=_shell.ClientSize.Width/viewport;
            _webBounds=new Rectangle(_shell.Left+(int)Math.Round(r.GetProperty("x").GetDouble()*scale),_shell.Top+(int)Math.Round(r.GetProperty("y").GetDouble()*scale),(int)Math.Round(r.GetProperty("width").GetDouble()*scale),(int)Math.Round(r.GetProperty("height").GetDouble()*scale));
            SyncLoadingOverlayBounds();
            if(_anim!=null&&_anim.Active){if(_animKind=="flip")_anim.GlideTo(_webBounds,MotionTokens.ControlNormalMs);else _anim.Follow(_webBounds);return;}
            if(_page=="muse"&&_web.CoreWebView2!=null){_web.Bounds=_webBounds;_web.Visible=_webLoaded;_web.BringToFront();SyncLoadingOverlayBounds();}
        }
        private async Task ControlConnection(){await SwitchWebAsync(false);ShowReach();PostToShell(new {type="open-connection"});}
        private async Task ExecuteConnectionAsync(string action){
            if(action!="disconnect"&&action!="reconnect")throw new ArgumentException("请选择断开或重新连接");
            if(_controlBusy){PostToShell(new {type="control-state",busy=true});return;}_controlBusy=true;PostToShell(new{type="control-state",busy=true});
            try {
                string result=await TunnelControl.RequestAsync(this,action,true);LocalOps.AppendLog("connection",result);
                _probeAt=DateTime.MinValue;while(_polling)await Task.Delay(50);await PollAsync();
                string text=result.Contains("取消")?"已取消授权，尚未确认通道状态发生变化。":result.Contains("失败")||result.Contains("无法")||result.Contains("未能")?"这次操作没有成功，请查看下方连接检查。":"系统已执行这次请求，请以下方连接检查为准。";
                PostToShell(new {type="connection-result",text,summary=StatusPresentation.Conclusion(_probe),evidence=result+"\n"+StatusPresentation.Evidence(_probe)});
            }finally{_controlBusy=false;PostToShell(new{type="control-state",busy=false});}
        }

        private async Task NativeSmokeAsync(){
            if(string.IsNullOrEmpty(Environment.GetEnvironmentVariable("MUSEREACH_TEST_HOME")))throw new InvalidOperationException("原生自测需要独立目录");
            try{
                for(int i=0;i<100&&(_web.CoreWebView2==null||!_web.Visible);i++)await Task.Delay(100);await Task.Delay(400);
                if(!_web.Visible||_page!="muse")throw new Exception("默认Muse未显示");
                string phaseFile=Path.Combine(LocalOps.AppDir,"native-phase1.json");
                if(File.Exists(phaseFile)){
                    var expected=JsonSerializer.Deserialize<WindowGeometry>(File.ReadAllText(phaseFile));var actual=RestoreBounds;
                    if(!_settings.sidebarCollapsed||Math.Abs(_web.ZoomFactor-1.1)>.001||WindowState!=FormWindowState.Maximized||actual.X!=expected.x||actual.Y!=expected.y||actual.Width!=expected.width||actual.Height!=expected.height)throw new Exception("重启后的侧栏/缩放/最大化几何不一致："+actual);
                    File.WriteAllText(Path.Combine(LocalOps.AppDir,"native-restart.json"),JsonSerializer.Serialize(new{passed=true,DeviceDpi,Bounds,RestoreBounds,zoom=_web.ZoomFactor,sidebarCollapsed=_settings.sidebarCollapsed,maximized=true}));return;
                }
                var web=_web.CoreWebView2;int navs=_webNavigationCount;
                for(int i=0;i<6;i++){await _shell.CoreWebView2.ExecuteScriptAsync("document.querySelector('[data-action=collapse]').click()");await Task.Delay(120);}
                if(web!=_web.CoreWebView2||navs!=_webNavigationCount||!_web.Visible)throw new Exception("侧栏切换刷新了网页");
                foreach(double z in new[]{.9,1,1.1}){_settings.SetWebZoom(z);_web.ZoomFactor=z;if(Math.Abs(_web.ZoomFactor-z)>.001)throw new Exception("缩放未生效");}
                string initial=_status.Text;_status.Text="疑似假死";await Task.Delay(100);bool stateChanged=_status.Text=="疑似假死";_status.Text=initial;
                PostToShell(new{type="navigate",page="connection"});await Task.Delay(300);
                string globalCount=await _shell.CoreWebView2.ExecuteScriptAsync("document.querySelectorAll('.status').length");if(globalCount!="0")throw new Exception("页面仍有全局状态丸");
                if(DeviceDpi!=144)LocalOps.AppendLog("self-test","当前DPI不为150%，实测="+DeviceDpi);
                WindowState=FormWindowState.Normal;Bounds=new Rectangle(180,140,1500,1000);await Task.Delay(200);var expectedBounds=Bounds;
                _settings.sidebarCollapsed=true;WindowState=FormWindowState.Maximized;await Task.Delay(200);SaveGeometry();
                File.WriteAllText(phaseFile,JsonSerializer.Serialize(new WindowGeometry{x=expectedBounds.X,y=expectedBounds.Y,width=expectedBounds.Width,height=expectedBounds.Height}));
                using(var image=File.Create(Path.Combine(LocalOps.AppDir,"native-preview.png")))await _shell.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,image);
                File.WriteAllText(Path.Combine(LocalOps.AppDir,"native-smoke.json"),JsonSerializer.Serialize(new{passed=true,collapseCycles=6,webInstanceSame=true,webNavigationsBefore=navs,webNavigationsAfter=_webNavigationCount,zoomValues=new[]{.9,1,1.1},nativeStatusPill=true,stateChanged,shellGlobalPills=0,DeviceDpi,expectedBounds,restoreBounds=RestoreBounds}));
            }catch(Exception ex){File.WriteAllText(Path.Combine(LocalOps.AppDir,"native-error.json"),JsonSerializer.Serialize(new{passed=false,error=ex.ToString()}));}
            finally{_exit=true;Close();}
        }

        private void StartWatcher(){
            try{
                _watcher?.Dispose();
                var dirs=_connection.watchedDirectories;
                _watcher=new ChangeWatcher(dirs,(path,change)=>{try{BeginInvoke(new Action(()=>{if(_watch.Add(path,change,DateTimeOffset.Now)){_refreshFiles=true;_ = PollAsync();}}));}catch{}},RecentlyRecorded);
            }catch(Exception ex){LocalOps.AppendLog("error","目录盯梢启动失败："+ex.Message);}
        }
        private bool RecentlyRecorded(string path){try{var now=DateTimeOffset.Now;return _operations.Any(o=>o.ts.HasValue&&(now-o.ts.Value).TotalMinutes<5&&o.files.Any(f=>string.Equals(Path.GetFullPath(f),Path.GetFullPath(path),StringComparison.OrdinalIgnoreCase)));}catch{return false;}}
        private async Task PollAsync(){
            if(_polling||_shell.CoreWebView2==null)return;_polling=true;
            RefreshOsAnimations(); // v36：每轮询重读一次系统开关（1 秒兜底，覆盖漏掉的广播）
            try{
                bool checkFiles=_refreshFiles;_refreshFiles=false;
                await Task.Run(()=>{_operations=_data.ReadOperations();if(checkFiles||_page=="files")_files=_data.WorkFiles(_operations);_heartbeat=_data.ReadHeartbeat();});
                if((DateTime.Now-_probeAt).TotalSeconds>=5){_probe=await Task.Run(()=>TunnelProbe.Capture(_connection));_probeAt=DateTime.Now;}
                var health=ConsoleData.Health(_probe,_heartbeat,DateTimeOffset.Now);
                PostToShell(new{type="snapshot",operations=_operations,events=_data.ProgramEvents(LocalOps.ReadLogTail(500)),files=_files,watch=_watch.Pending(),heartbeat=_heartbeat,heartbeatError=_data.heartbeatError,opsError=_data.opsError,health,probeEvidence=StatusPresentation.Evidence(_probe),evidence=_probe,settings=_settings,autoCollapsed=_autoCollapsed,osAnimationsEnabled=_osAnimationsEnabled,currentWebUrl=_web.CoreWebView2?.Source,connection=_connection,connectionError=_connectionError,watcherStatus=_watcher?.Status,hotkeyRegistered=_hotkeyRegistered,controlBusy=_controlBusy});
                _status.Text=health.label;
                NotifyHidden(health); // v35：窗口藏进托盘时，连接断开/重连走系统通知
            }catch(Exception ex){if(_lastError!=ex.Message){_lastError=ex.Message;LocalOps.AppendLog("error",ex.Message);PostToShell(new{type="error",text="本地记录暂时无法读取，请稍后重试"});}}finally{_polling=false;}
        }
        private void FileAction(string action,string raw){
            string p=Path.GetFullPath(raw);
            if(!Path.IsPathFullyQualified(raw)||!_operations.SelectMany(x=>x.files).Any(x=>{try{return string.Equals(Path.GetFullPath(x),p,StringComparison.OrdinalIgnoreCase);}catch{return false;}}))throw new InvalidOperationException("这个文件没有出现在本机操作记录中");
            if(action=="copy"){Clipboard.SetText(p);PostToShell(new{type="notice",text="路径已复制"});return;}
            if(!File.Exists(p))throw new FileNotFoundException("文件已不在原位置，记录仍然保留");
            if(action=="open")System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(p){UseShellExecute=true});
            else if(action=="locate"){var info=new System.Diagnostics.ProcessStartInfo("explorer.exe"){UseShellExecute=true};info.ArgumentList.Add("/select,"+p);System.Diagnostics.Process.Start(info);}
            else throw new ArgumentException("未支持的文件动作");
        }
        private async void OnShellMessage(object sender,CoreWebView2WebMessageReceivedEventArgs e){
            // WebView2 的消息回调原则上在 UI 线程，但仍先取好字符串再切回 UI 线程处理：
            // 动画与监听器的回调碰控件前必须回到 UI 线程，跨线程碰控件是闪退的常见根因。
            string source=null,text=null;
            try{source=e.Source;text=e.TryGetWebMessageAsString();}catch{return;}
            if(source!="about:blank"||text==null)return;
            if(IsHandleCreated&&InvokeRequired){BeginInvoke(new Action<string>(t=>{ _ = HandleShellMessage(t); }),text);return;}
            await HandleShellMessage(text);
        }
        private async Task HandleShellMessage(string text){
            try{using var doc=JsonDocument.Parse(text);var r=doc.RootElement;string type=r.GetProperty("type").GetString();
                if(type=="ready"){UpdateAutoCollapse(true);await PollAsync();await SwitchWebAsync(true);return;}
                if(type=="web-bounds"){PositionWeb(r);return;}
                if(type=="anim-start"){try{string kind=r.TryGetProperty("kind",out var k)&&k.ValueKind==JsonValueKind.String?k.GetString():"collapse";int dur=r.TryGetProperty("duration",out var d)&&d.ValueKind==JsonValueKind.Number&&d.TryGetInt32(out int v)?v:MotionTokens.ControlNormalMs;if(EffectiveAnimations){_animKind=kind;_anim?.Begin(_webBounds,kind,dur);}}catch(Exception ex){LocalOps.AppendLog("error","动画启动失败："+ex.Message);}return;}
                if(type=="anim-end"){try{_anim?.Finish(_webBounds);}catch(Exception ex){LocalOps.AppendLog("error","动画收尾失败："+ex.Message);}return;}
                if(type=="page"){_page=r.GetProperty("page").GetString();if(!new[]{"muse","files","records","connection","security","settings"}.Contains(_page))throw new ArgumentException("页面不存在");if(_page=="files")_refreshFiles=true;await SwitchWebAsync(_page=="muse");await PollAsync();return;}
                if(type=="refresh-files"){_refreshFiles=true;while(_polling)await Task.Delay(30);await PollAsync();return;}
                if(type=="refresh-records"){while(_polling)await Task.Delay(30);await PollAsync();return;}
                if(type=="connection-settings"){
                    if(_controlBusy)throw new InvalidOperationException("连接操作进行中，请完成后再修改配置");
                    var next=JsonSerializer.Deserialize<ConnectionSettings>(r.GetProperty("value").GetRawText());
                    if(next==null)throw new ArgumentException("配置为空");next.Validate();
                    next.Save(Path.Combine(LocalOps.AppDir,"connection.json"));_connection=next;_connectionError=null;
                    StartWatcher();_probeAt=DateTime.MinValue;
                    PostToShell(new{type="configuration-saved"});await PollAsync();return;
                }
                if(type=="file-action"){FileAction(r.GetProperty("action").GetString(),r.GetProperty("path").GetString());return;}
                if(type=="watch-clear"){try{_watch.Clear();LocalOps.AppendLog("watch","已清空最近变化");}catch{} await PollAsync();return;}
                if(type=="watch-toggle"){try{_settings.recentChangesCollapsed=!_settings.recentChangesCollapsed;_settings.Save(Path.Combine(LocalOps.AppDir,"settings.json"));}catch{} await PollAsync();return;}
                if(type=="files-toggle"){try{_settings.recentFilesCollapsed=!_settings.recentFilesCollapsed;_settings.Save(Path.Combine(LocalOps.AppDir,"settings.json"));}catch{} await PollAsync();return;}
                if(type=="minimize"){WindowState=FormWindowState.Minimized;return;}
                if(type=="connection"){await ExecuteConnectionAsync(r.GetProperty("action").GetString());return;}
                if(type=="save-start"){string url=_web.CoreWebView2?.Source;_settings.SetMuseUrl(url);_settings.Save(Path.Combine(LocalOps.AppDir,"settings.json"));PostToShell(new{type="notice",text="已保存。以后打开 Reach 会直接进入这条网页对话"});await PollAsync();return;}
                if(type=="setting"){string key=r.GetProperty("key").GetString();if(key=="webZoom"){_settings.SetWebZoom(r.GetProperty("value").GetDouble());if(_web.CoreWebView2!=null)_web.ZoomFactor=_settings.webZoom;}else if(key=="theme"){_settings.SetTheme(r.GetProperty("value").GetString());_loadingOverlay?.ApplyTheme(_settings.theme);}else if(key=="consoleScale"){_settings.SetConsoleScale(r.GetProperty("value").GetDouble());_shell.ZoomFactor=_settings.consoleScale;}else if(key=="sidebarSide")_settings.SetSidebarSide(r.GetProperty("value").GetString());else _settings.Set(key,r.GetProperty("value").GetBoolean(),SetStartup);if(key=="animationsEnabled")_captionStrip.AnimationsEnabled=EffectiveAnimations;if(key=="animationsEnabled"&&_loadingOverlay!=null)_loadingOverlay.AnimationsEnabled=EffectiveAnimations;_settings.Save(Path.Combine(LocalOps.AppDir,"settings.json"));ApplyHotkey();LocalOps.AppendLog("settings","已保存 "+key);PostToShell(new{type="notice",text="设置已保存"});await PollAsync();}
            }catch(Exception ex){LocalOps.AppendLog("error",ex.Message);PostToShell(new{type="error",text=ex.Message});}
        }
    }
}
