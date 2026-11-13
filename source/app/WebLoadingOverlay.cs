using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
namespace MuseReach {
 // v32：Muse 页加载态覆盖层（Fluent 2 Wait UX）。Reach 自己画的原生 WinForms
 // 覆盖层，盖在 _web 的位置上（_webBounds），不遮侧栏与标题栏；绝不向
 // muse.ai 页面注入脚本或 CSS。
 //
 // 分档（阈值见 WebLoadingTiers）：<1s 什么都不画；1–3s 居中 spinner；
 // >3s 进度条＋一句安抚文案。加载完成或失败时立即消失，不残留。
 // 切页回 Muse 页时若网页已在，不会重新触发——覆盖层只由导航事件驱动。
 //
 // 动效走 MotionTokens：spinner 每 ControlFasterMs（83ms）转 30°；
 // 出现淡入 ControlFastMs（167ms）、消失淡出 ControlFastExitMs（125ms）。
 // animationsEnabled 关时：无淡入淡出；spinner 档位改画静态半格进度条
 // （无旋转、无跑马灯），与 v31 骨架"动效关时静止"的规矩一致。
 //
 // 颜色取当前主题的 --bg/--text/--accent（与 shell.html 主题表同值，
 // 见 ThemeColors）；主题切换时 MainForm 调 ApplyTheme。
 internal sealed class WebLoadingOverlay : Panel {
  private enum OverlayState { Hidden, Loading, Error }
  private OverlayState _state = OverlayState.Hidden;
  private WebLoadingTiers.Tier _tier = WebLoadingTiers.Tier.Hidden;
  private DateTimeOffset _startedAt;
  private bool _museActive = true;
  private bool _animationsEnabled = true;
  private bool _disposed;

  private readonly Timer _tick = new Timer();
  private readonly Timer _fade = new Timer();
  private int _spinAngle;
  private int _alpha;
  private int _fadeTarget = 255;
  private int _fadeFrom;
  private int _fadeDurationMs = MotionTokens.ControlFastMs;
  private DateTimeOffset _fadeStartedAt;

  private readonly ProgressBar _progress = new ProgressBar();
  private readonly Label _reassure = new Label();
  private readonly Label _errorTitle = new Label();
  private readonly Button _retry = new Button();
  private readonly Font _titleFont;
  private readonly Font _bodyFont;

  private Color _bg = Color.FromArgb(0x0b, 0x0b, 0x0d);
  private Color _layer2 = Color.FromArgb(0x1e, 0x1e, 0x21);
  private Color _border = Color.FromArgb(0x2c, 0x2c, 0x31);
  private Color _text = Color.FromArgb(0xec, 0xec, 0xf0);
  private Color _sub = Color.FromArgb(0xa9, 0xa9, 0xb2);
  private Color _accent = Color.FromArgb(0xe8, 0xe8, 0xec);
  private Color _error = Color.FromArgb(0xf1, 0x8b, 0x92);

  public event EventHandler RetryClicked;
  public event EventHandler WatchdogFired;
  public bool IsLoading => _state == OverlayState.Loading;
  public bool IsError => _state == OverlayState.Error;

  public bool AnimationsEnabled {
   get => _animationsEnabled;
   set { _animationsEnabled = value; ApplyAnimationsMode(); }
  }

  // 主题色表：与 shell.html 的 :root / body[data-theme] 同值（--bg/--layer2/
  // --border/--text/--sub/--accent/--red；未覆写的项取 :root 的继承值）。
  private static (Color _bg, Color _layer2, Color _border, Color _text, Color _sub, Color _accent, Color _error) ThemeColors(string theme) {
   switch (theme) {
    case "dark": return (C(0x11, 0x13, 0x17), C(0x25, 0x29, 0x2f), C(0x2d, 0x31, 0x38), C(0xec, 0xee, 0xf1), C(0xa1, 0xa6, 0xb0), C(0x75, 0xd7, 0xbb), C(0xf1, 0x8b, 0x92));
    case "light": return (C(0xff, 0xff, 0xff), C(0xeb, 0xef, 0xf2), C(0xe2, 0xe5, 0xe8), C(0x20, 0x23, 0x28), C(0x62, 0x6a, 0x75), C(0x13, 0x8c, 0x70), C(0xc9, 0x49, 0x59));
    case "midnight": return (C(0x10, 0x12, 0x1b), C(0x28, 0x30, 0x44), C(0x31, 0x3a, 0x4a), C(0xec, 0xee, 0xf1), C(0xa1, 0xa6, 0xb0), C(0x95, 0xbe, 0xfb), C(0xf1, 0x8b, 0x92));
    case "pink": return (C(0x16, 0x10, 0x1a), C(0x2f, 0x21, 0x37), C(0x43, 0x31, 0x4c), C(0xec, 0xee, 0xf1), C(0xc4, 0xab, 0xbf), C(0xff, 0x8e, 0xc4), C(0xf1, 0x8b, 0x92));
    case "purple": return (C(0x13, 0x0f, 0x1f), C(0x2a, 0x21, 0x40), C(0x3b, 0x30, 0x59), C(0xee, 0xe9, 0xfb), C(0xb3, 0xa9, 0xcf), C(0xb9, 0x9c, 0xff), C(0xf1, 0x8b, 0x92));
    case "ocean": return (C(0x0d, 0x15, 0x24), C(0x1f, 0x2f, 0x4a), C(0x2b, 0x3d, 0x5c), C(0xe8, 0xee, 0xfb), C(0xa9, 0xb8, 0xd4), C(0x5d, 0xb4, 0xff), C(0xf1, 0x8b, 0x92));
    case "forest": return (C(0x0f, 0x1a, 0x13), C(0x22, 0x36, 0x26), C(0x33, 0x49, 0x2f), C(0xe9, 0xf4, 0xec), C(0xab, 0xc4, 0xae), C(0x5f, 0xd6, 0x8a), C(0xf1, 0x8b, 0x92));
    case "amber": return (C(0x1a, 0x14, 0x0e), C(0x3a, 0x2f, 0x1c), C(0x55, 0x45, 0x27), C(0xf7, 0xef, 0xe2), C(0xcb, 0xb8, 0x94), C(0xff, 0xb3, 0x47), C(0xf1, 0x8b, 0x92));
    case "obsidian": return (C(0x0b, 0x0b, 0x0d), C(0x1e, 0x1e, 0x21), C(0x2c, 0x2c, 0x31), C(0xec, 0xec, 0xf0), C(0xa9, 0xa9, 0xb2), C(0xe8, 0xe8, 0xec), C(0xf1, 0x8b, 0x92));
    default: return (C(0x11, 0x13, 0x17), C(0x25, 0x29, 0x2f), C(0x2d, 0x31, 0x38), C(0xec, 0xee, 0xf1), C(0xa1, 0xa6, 0xb0), C(0x75, 0xd7, 0xbb), C(0xf1, 0x8b, 0x92));
   }
  }
  private static Color C(int r, int g, int b) => Color.FromArgb(r, g, b);

  public WebLoadingOverlay() {
   SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
   DoubleBuffered = true;
   Visible = false;
   _tick.Interval = MotionTokens.ControlFasterMs;
   _tick.Tick += (s, e) => OnTick();
   _fade.Interval = 16; // 逐帧淡入淡出（与 CaptionStrip 同款 16ms 计时器）
   _fade.Tick += (s, e) => OnFadeTick();
   _progress.Style = ProgressBarStyle.Marquee;
   _progress.MarqueeAnimationSpeed = 30;
   _progress.Height = 8;
   _progress.Visible = false;
   _titleFont = new Font(Font.FontFamily, 10f, FontStyle.Bold);
   _bodyFont = new Font(Font.FontFamily, 9f);
   _reassure.AutoSize = false;
   _reassure.TextAlign = ContentAlignment.MiddleCenter;
   _reassure.Text = "正在打开 Muse 对话，稍等一下";
   _reassure.Font = _bodyFont;
   _reassure.Visible = false;
   _errorTitle.AutoSize = false;
   _errorTitle.TextAlign = ContentAlignment.MiddleCenter;
   _errorTitle.Text = "Muse 对话暂时打不开";
   _errorTitle.Font = _titleFont;
   _errorTitle.Visible = false;
   _retry.Text = "重试";
   _retry.TabStop = false;
   _retry.Cursor = Cursors.Hand;
   _retry.FlatStyle = FlatStyle.Flat;
   _retry.Font = _bodyFont;
   _retry.Visible = false;
   _retry.Click += (s, e) => RetryClicked?.Invoke(this, EventArgs.Empty);
   Controls.Add(_progress);
   Controls.Add(_reassure);
   Controls.Add(_errorTitle);
   Controls.Add(_retry);
   ApplyTheme("obsidian");
  }

  public void ApplyTheme(string theme) {
   var c = ThemeColors(theme ?? "obsidian");
   _bg = c._bg; _layer2 = c._layer2; _border = c._border; _text = c._text; _sub = c._sub; _accent = c._accent; _error = c._error;
   BackColor = Color.FromArgb(_alpha, _bg);
   _reassure.ForeColor = _sub;
   _errorTitle.ForeColor = _text;
   _retry.BackColor = _layer2;
   _retry.ForeColor = _text;
   _retry.FlatAppearance.BorderColor = _border;
   _retry.FlatAppearance.MouseOverBackColor = _layer2;
   Invalidate();
  }

  private void ApplyAnimationsMode() {
   if (_state != OverlayState.Loading) return;
   if (_tier == WebLoadingTiers.Tier.Progress || (!_animationsEnabled && _tier == WebLoadingTiers.Tier.Spinner)) {
    _progress.Style = _animationsEnabled ? ProgressBarStyle.Marquee : ProgressBarStyle.Continuous;
    if (!_animationsEnabled) _progress.Value = 50;
   }
   Invalidate();
  }

  private void Ui(Action a) {
   try { if (IsHandleCreated && InvokeRequired) BeginInvoke(a); else a(); } catch { }
  }

  // 导航开始：加载中时幂等（不重置计时起点，慢重定向链不会把 1 秒档位往后推）；
  // 失败后重试会走这里重新开始一轮。
  public void BeginLoad() {
   Ui(() => {
    if (_disposed) return;
    if (_state == OverlayState.Loading) return;
    _state = OverlayState.Loading;
    _startedAt = DateTimeOffset.Now;
    _tier = WebLoadingTiers.Tier.Hidden;
    _spinAngle = 0;
    UpdateChildren();
    _tick.Start();
    ApplyVisibility();
   });
  }

  // 导航成功完成：立即消失（动效开时 125ms 淡出，关时立刻消失）。
  public void FinishLoad() {
   Ui(() => {
    if (_disposed || _state != OverlayState.Loading) return;
    _state = OverlayState.Hidden;
    _tick.Stop();
    UpdateChildren();
    if (Visible) StartFade(0, MotionTokens.ControlFastExitMs);
    else { _alpha = 0; BackColor = Color.FromArgb(0, _bg); }
   });
  }

  // 迟到的成功完成（看门狗已判失败后页面又加载出来了）：把错误页撤掉。
  public void DismissError() {
   Ui(() => {
    if (_disposed || _state != OverlayState.Error) return;
    _state = OverlayState.Hidden;
    UpdateChildren();
    if (Visible) StartFade(0, MotionTokens.ControlFastExitMs);
    else { _alpha = 0; BackColor = Color.FromArgb(0, _bg); }
   });
  }

  // 导航失败：人话错误页＋重试按钮。文案是固定人话，不贴网址、错误码、
  // WebView2 内部错误（原始状态只进日志，不进界面）。
  public void ShowError() {
   Ui(() => {
    if (_disposed) return;
    _state = OverlayState.Error;
    _tick.Stop();
    UpdateChildren();
    ApplyVisibility();
   });
  }

  // 切页离开 Muse 页时盖住的内容不再显示；切回来时按当前状态重新出现
  // （加载中按当前档位、失败仍是错误页；已加载完成则什么都不显示）。
  public void SetMusePageActive(bool active) {
   Ui(() => {
    if (_disposed) return;
    _museActive = active;
    if (!active) { _fade.Stop(); _alpha = 0; Visible = false; return; }
    ApplyVisibility();
   });
  }

  private void OnTick() {
   if (_disposed || _state != OverlayState.Loading) return;
   int elapsed = (int)(DateTimeOffset.Now - _startedAt).TotalMilliseconds;
   if (elapsed >= WebLoadingTiers.WatchdogMs) {
    ShowError();
    WatchdogFired?.Invoke(this, EventArgs.Empty);
    return;
   }
   var tier = WebLoadingTiers.TierFor(elapsed);
   if (tier != _tier) {
    _tier = tier;
    UpdateChildren();
    ApplyVisibility();
   }
   if (_tier == WebLoadingTiers.Tier.Spinner && _animationsEnabled) _spinAngle = (_spinAngle + 30) % 360;
   if (Visible) Invalidate();
  }

  private void UpdateChildren() {
   bool progress = _state == OverlayState.Loading && (_tier == WebLoadingTiers.Tier.Progress || (!_animationsEnabled && _tier == WebLoadingTiers.Tier.Spinner));
   bool error = _state == OverlayState.Error;
   _progress.Visible = progress;
   _reassure.Visible = progress;
   _errorTitle.Visible = error;
   _retry.Visible = error;
   if (progress) {
    _progress.Style = _animationsEnabled ? ProgressBarStyle.Marquee : ProgressBarStyle.Continuous;
    if (!_animationsEnabled) _progress.Value = 50;
   }
   LayoutContent();
  }

  private void ApplyVisibility() {
   if (!_museActive) { Visible = false; return; }
   bool show = _state == OverlayState.Error || (_state == OverlayState.Loading && _tier != WebLoadingTiers.Tier.Hidden);
   if (show && !Visible) {
    Visible = true;
    StartFade(255, MotionTokens.ControlFastMs);
   } else if (!show && Visible) {
    StartFade(0, MotionTokens.ControlFastExitMs);
   }
  }

  private void StartFade(int target, int durationMs) {
   _fadeTarget = target;
   _fadeFrom = _alpha;
   if (!_animationsEnabled) { _alpha = target; BackColor = Color.FromArgb(_alpha, _bg); FinishFade(); return; }
   _fadeDurationMs = Math.Max(1, durationMs);
   _fadeStartedAt = DateTimeOffset.Now;
   _fade.Start();
  }

  private void OnFadeTick() {
   double t = (DateTimeOffset.Now - _fadeStartedAt).TotalMilliseconds / _fadeDurationMs;
   if (t >= 1) { _alpha = _fadeTarget; _fade.Stop(); BackColor = Color.FromArgb(_alpha, _bg); FinishFade(); return; }
   _alpha = (int)Math.Round(_fadeFrom + (_fadeTarget - _fadeFrom) * t);
   BackColor = Color.FromArgb(_alpha, _bg);
   Invalidate();
  }

  private void FinishFade() {
   if (_fadeTarget == 0) Visible = false;
   Invalidate();
  }

  protected override void OnResize(EventArgs e) {
   base.OnResize(e);
   LayoutContent();
  }

  private void LayoutContent() {
   if (Width <= 0 || Height <= 0) return;
   int cx = Width / 2, cy = Height / 2;
   int barW = Math.Min(320, Math.Max(120, Width - 64));
   _progress.Bounds = new Rectangle(cx - barW / 2, cy - 16, barW, 8);
   _reassure.Bounds = new Rectangle(cx - barW / 2, cy + 4, barW, 20);
   int titleW = Math.Min(420, Math.Max(200, Width - 64));
   _errorTitle.Bounds = new Rectangle(cx - titleW / 2, cy - 20, titleW, 22);
   _retry.Bounds = new Rectangle(cx - 48, cy + 14, 96, 32);
  }

  protected override void OnPaint(PaintEventArgs e) {
   var g = e.Graphics;
   g.SmoothingMode = SmoothingMode.AntiAlias;
   using (var bg = new SolidBrush(Color.FromArgb(_alpha, _bg))) g.FillRectangle(bg, ClientRectangle);
   if (!Visible || _alpha == 0) return;
   if (_state == OverlayState.Loading && _tier == WebLoadingTiers.Tier.Spinner && _animationsEnabled) {
    int cx = Width / 2, cy = Height / 2, d = 24, r = d / 2;
    var rect = new Rectangle(cx - r, cy - r, d, d);
    using (var track = new Pen(Color.FromArgb(_alpha, _border), 2f))
     g.DrawEllipse(track, rect);
    using (var arc = new Pen(Color.FromArgb(_alpha, _accent), 2f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
     g.DrawArc(arc, rect, _spinAngle, 270);
   } else if (_state == OverlayState.Error) {
    int cx = Width / 2, cy = Height / 2 - 44, d = 24, r = d / 2;
    var rect = new Rectangle(cx - r, cy - r, d, d);
    using (var circle = new Pen(Color.FromArgb(_alpha, _error), 2f))
     g.DrawEllipse(circle, rect);
    using (var cross = new Pen(Color.FromArgb(_alpha, _error), 2f) { StartCap = LineCap.Round, EndCap = LineCap.Round }) {
     int k = 6;
     g.DrawLine(cross, cx - k, cy - k, cx + k, cy + k);
     g.DrawLine(cross, cx + k, cy - k, cx - k, cy + k);
    }
   }
  }

  protected override void Dispose(bool disposing) {
   if (disposing && !_disposed) {
    _disposed = true;
    _tick.Stop(); _fade.Stop();
    _tick.Dispose(); _fade.Dispose();
    _titleFont.Dispose(); _bodyFont.Dispose();
   }
   base.Dispose(disposing);
  }
 }
}
