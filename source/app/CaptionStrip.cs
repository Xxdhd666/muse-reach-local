using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;
namespace MuseReach {
 // v17：标题栏按钮整条自绘（CaptionStrip），一次 OnPaint 画完三枚图标。背景实色
 // （与标题栏同色），平时三枚图标只是灰色细线，与标题栏融为一体；悬停只亮当
 // 前段（另两枚 #292D33、关闭 #E81123），按下加深；鼠标移开、窗口失活、点击
 // 后立即复位，不得残留红色、不得串到别的段。关键：不用透明背景。WinForms
 // 假透明是 v16 错乱的根子。
 // v18：悬停/按下底色改为圆角 pill——内缩 4 逻辑 px、圆角 6px，居中于当前段，
 // 平时无底色；83ms 进场 / 62ms 退场淡入淡出（Timer 逐帧推进，不阻塞 UI 线程），图标
 // 同步微亮（另两枚灰→亮灰，关闭段灰→白）；动效关闭时全部即时切换。
 // v23：补齐按下态与失活态。按下色不再瞬间切换：pill 底色在悬停色与按下色之间
 // 按按下量插值，按下量与淡入值走同一套 MotionTokens（按下 83ms、松开 62ms）。
 // 按下时拖出段外，被按段的按下色立即退掉（视觉按下只在指针仍压在被按段上时
 // 显示；点击分发仍按 HoverState.Pressed 的记忆，拖回来再松开照样触发）。
 // 失活时三枚图标变灰（InactiveInk）、不画 pill、悬停与按下无可见变化；重新
 // 激活时按当前光标位置即时恢复常态（不走淡入淡出、不等下一次鼠标移动）。
 // 单控件、单悬停字段、按 x 坐标命中，v17 的做法保留。
 internal sealed class CaptionStrip : Control {
  static readonly Color BarBg = Color.FromArgb(23, 25, 29); // 与标题栏 Panel 同色
  static readonly Color Ink = Color.FromArgb(161, 166, 176); // 图标灰，与标题栏文字同级
  static readonly Color InactiveInk = Color.FromArgb(0x73, 0x79, 0x84); // v23 失活态图标灰：主题色板 --dim（默认主题），比常态 Ink #A1A6B0 暗一档
  static readonly Color HotInk = Color.FromArgb(216, 220, 226); // 另两枚悬停时图标微亮到的灰
  static readonly Color HoverOther = Color.FromArgb(0x29, 0x2D, 0x33);
  static readonly Color HoverClose = Color.FromArgb(0xE8, 0x11, 0x23);
  static readonly Color PressedOther = Color.FromArgb(0x3A, 0x3F, 0x46);
  static readonly Color PressedClose = Color.FromArgb(0xC5, 0x0F, 0x1F);
  readonly CaptionStripMath.HoverState _state = new CaptionStripMath.HoverState();
  readonly CaptionStripMath.CaptionFade _fade = new CaptionStripMath.CaptionFade();
  readonly Timer _fadeTimer;
  float _scale = 1f;
  bool _windowActive = true; // v23：窗口激活态；失活时图标变灰、悬停与按下无可见变化
  public event Action<CaptionSegment> SegmentClicked;
  // 动效开关：MainForm 在创建后与设置变化时同步 _settings.animationsEnabled。
  // 关闭时底色与图标全部即时切换，不启动 Timer。
  public bool AnimationsEnabled { get; set; } = true;
  public CaptionStrip() {
   Dock = DockStyle.Right;
   TabStop = false;
   BackColor = BarBg; // 实色底，不透明
   SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
   SetStyle(ControlStyles.Selectable, false); // 永不取焦点：不会出现焦点框
   Width = CaptionStripMath.SegmentWidthLogical * 3;
   Height = 38;
   DoubleBuffered = true;
   _fadeTimer = new Timer { Interval = 16 };
   _fadeTimer.Tick += (s, e) => { if (_fade.Tick(DateTimeOffset.Now)) Invalidate(); else _fadeTimer.Stop(); };
   MouseMove += (s, e) => { if (!_windowActive) return; var before = _state.Hover; _state.Move(e.X, Width, _scale); if (_state.Hover != before) UpdateFade(); };
   MouseLeave += (s, e) => { _state.Leave(); UpdateFade(); };
   MouseDown += (s, e) => { if (!_windowActive) return; if (e.Button == MouseButtons.Left) { _state.Down(e.X, Width, _scale); Capture = true; UpdateFade(); } };
   MouseUp += (s, e) => { var fired = _state.Up(e.X, Width, _scale); Capture = false; UpdateFade(); if (fired != CaptionSegment.None) SegmentClicked?.Invoke(fired); };
   DoubleClick += (s, e) => { if (!_windowActive) return; var seg = CaptionStripMath.HitTest(((MouseEventArgs)e).X, Width, _scale); if (seg != CaptionSegment.None) SegmentClicked?.Invoke(seg); };
  }
  // v23：窗口激活态切换（MainForm 的 Activated/Deactivate 接线）。
  // 失活：悬停与按下立即复位（即时归零，不走淡入淡出）、图标变灰；按下若正在
  // 进行中也被清掉，不得粘住。重新激活：按当前光标位置即时重建悬停（Snap，
  // 不走淡入淡出、不等下一次鼠标移动）；光标不在条上时就是常态。
  // 注意：MouseUp 不设失活守卫——按住时窗口失活，松开那下仍须走完 Up 释放
  // Capture（Up 在 Pressed 已清时是空操作，不会误触发点击）。
  public void SetWindowActive(bool active) {
   if (active == _windowActive) return;
   _windowActive = active;
   ResetVisualState();
   if (active && IsHandleCreated) {
    try { var p = PointToClient(Cursor.Position); _state.Move(p.X, Width, _scale); if (_state.Hover != CaptionSegment.None) { _fade.Snap(_state.Hover, CaptionSegment.None); Invalidate(); } }
    catch { _state.Reset(); }
   }
  }
  // v38：窗口的非客户区消息转发入口。最大化段命中 HTMAXBUTTON 后，
  // 鼠标消息以 WM_NCMOUSEMOVE / WM_NCLBUTTONDOWN / WM_NCLBUTTONUP 到达
  // 窗口，不再经过本控件的 MouseMove/MouseDown/MouseUp；窗口按条内 x
  // 把状态喂回来。直接复用 HoverState 的同一套状态机：悬停 pill、
  // 按下态、失活态与 v23 的段内鼠标处理完全一致；NcUp 返回触发的段，
  // 调用方按它做与 SegmentClicked 相同的分发。
  // x 是条内横坐标（逻辑像素），与 MouseMove 的 e.X 同义。
  public CaptionSegment Hover => _state.Hover;
  public float DpiScale => _scale;
  public void NcMove(float x) { if (!_windowActive) return; var before = _state.Hover; _state.Move(x, Width, _scale); if (_state.Hover != before) UpdateFade(); }
  public void NcDown(float x) { if (!_windowActive) return; if (_state.Down(x, Width, _scale) != CaptionSegment.None) Capture = true; UpdateFade(); }
  public CaptionSegment NcUp(float x) { var fired = _state.Up(x, Width, _scale); Capture = false; UpdateFade(); return fired; }
  public void NcLeave() { if (_state.Hover == CaptionSegment.None && _state.Pressed == CaptionSegment.None) return; _state.Leave(); UpdateFade(); }
  // 尺寸唯一入口：三段等宽 46 逻辑像素按 DPI 放大，高度与标题栏同高。
  public void ApplyDpi(float dpiScale, int height) { _scale = dpiScale > 0 ? dpiScale : 1f; Width = Math.Max(90, (int)Math.Round(CaptionStripMath.TotalWidth(_scale))); Height = height; Invalidate(); }
  // 失活/点击后立即复位：直接跳到零，不留淡出（v17 行为保留，红色不得粘住）。
  public void ResetVisualState() { _state.Reset(); _fade.Snap(CaptionSegment.None, CaptionSegment.None); _fadeTimer.Stop(); Invalidate(); }
  // 悬停目标变化时调用：动效开 → 进场 83ms / 退场 62ms 淡入/淡出（Timer 逐帧）；动效关 → 即时切换。
  // v23：传给淡入状态机的是视觉按下（VisualPressed），不是按下记忆：按住拖出
  // 段外，被按段的按下色立即退掉；点击分发仍按 HoverState.Pressed 的记忆。
  void UpdateFade() {
   var pressed = CaptionStripMath.VisualPressed(_state.Hover, _state.Pressed);
   if (!AnimationsEnabled) { _fade.Snap(_state.Hover, pressed); _fadeTimer.Stop(); Invalidate(); return; }
   _fade.SetTarget(_state.Hover, pressed, DateTimeOffset.Now);
   if (_fade.Animating && !_fadeTimer.Enabled) _fadeTimer.Start();
   Invalidate();
  }
  protected override void Dispose(bool disposing) { if (disposing) _fadeTimer?.Dispose(); base.Dispose(disposing); }
  protected override void OnPaintBackground(PaintEventArgs e) { using var b = new SolidBrush(BarBg); e.Graphics.FillRectangle(b, ClientRectangle); }
  protected override void OnPaint(PaintEventArgs e) {
   var g = e.Graphics; g.SmoothingMode = SmoothingMode.AntiAlias;
   using var bg = new SolidBrush(BarBg); g.FillRectangle(bg, ClientRectangle);
   float segW = CaptionStripMath.SegmentWidth(_scale);
   for (int i = 0; i < 3; i++) {
    var seg = (CaptionSegment)(i + 1);
    if (!_windowActive) continue; // v23 失活态不画 pill 底色
    float fade = _fade.Value(seg);
    if (fade <= 0.001f) continue;
    // v23：pill 底色在悬停色与按下色之间按按下量插值（按下 83ms、松开 62ms，
    // 与淡入值同一套 MotionTokens）；v22 是瞬间换色。
    Color hoverColor = seg == CaptionSegment.Close ? HoverClose : HoverOther;
    Color pressColor = seg == CaptionSegment.Close ? PressedClose : PressedOther;
    Color baseColor = CaptionStripMath.LerpColor(hoverColor, pressColor, _fade.PressValue(seg));
    var rect = CaptionStripMath.PillRect(i, segW, ClientSize.Height, _scale);
    using var path = RoundedRect(rect, CaptionStripMath.PillRadius(_scale));
    using var b = new SolidBrush(CaptionStripMath.WithAlpha(baseColor, fade));
    g.FillPath(b, path);
   }
   for (int i = 0; i < 3; i++) {
    var seg = (CaptionSegment)(i + 1);
    var glyph = CaptionStripMath.GlyphFor(seg);
    float cx = (i + 0.5f) * segW, cy = ClientSize.Height / 2f;
    float span = CaptionStripMath.GlyphSpan(glyph, _scale);
    float w = CaptionStripMath.GlyphStroke(glyph, _scale);
    Color hot = seg == CaptionSegment.Close ? Color.White : HotInk;
    Color ink = _windowActive ? CaptionStripMath.LerpColor(Ink, hot, _fade.Value(seg)) : InactiveInk; // v23 失活态三枚图标一律变灰
    using var pen = new Pen(ink, w) { StartCap = LineCap.Round, EndCap = LineCap.Round };
    if (glyph == CaptionGlyph.Minus) { g.DrawLine(pen, cx - span / 2, cy, cx + span / 2, cy); }
    else if (glyph == CaptionGlyph.Square) { using var path = new GraphicsPath(); float r = 1.5f * _scale; path.AddArc(cx - span / 2, cy - span / 2, r * 2, r * 2, 180, 90); path.AddArc(cx + span / 2 - r * 2, cy - span / 2, r * 2, r * 2, 270, 90); path.AddArc(cx + span / 2 - r * 2, cy + span / 2 - r * 2, r * 2, r * 2, 0, 90); path.AddArc(cx - span / 2, cy + span / 2 - r * 2, r * 2, r * 2, 90, 90); path.CloseFigure(); g.DrawPath(pen, path); }
    else { float h = span / 2; g.DrawLine(pen, cx - h, cy - h, cx + h, cy + h); g.DrawLine(pen, cx + h, cy - h, cx - h, cy + h); }
   }
  }
  static GraphicsPath RoundedRect(RectangleF r, float radius) {
   var path = new GraphicsPath();
   float d = radius * 2;
   if (d <= 0) { path.AddRectangle(r); return path; }
   path.AddArc(r.X, r.Y, d, d, 180, 90);
   path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
   path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
   path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
   path.CloseFigure();
   return path;
  }
 }
}
