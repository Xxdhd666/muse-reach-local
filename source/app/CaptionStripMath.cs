using System;
using System.Drawing;
namespace MuseReach {
 // v17：标题栏按钮的纯逻辑（无 WinForms 依赖，可进控制台测试）。
 // v16 的教训：三枚独立透明 Control + FlowLayoutPanel，WinForms 假透明（控件
 // 画的是父级背景）在 DPI 缩放后重叠/重绘错位，悬停串位、全变红、图标透印。
 // v17 改成一整条自绘（CaptionStrip）：状态只用一个字段（当前段），按鼠标 x
 // 坐标命中测试；点击同样按坐标分发。这份逻辑与绘图分离，可单测。
 internal enum CaptionSegment { None, Min, Max, Close }
 internal enum CaptionGlyph { Minus, Square, Close }
 internal static class CaptionStripMath {
  public const int SegmentWidthLogical = 46; // Windows 11 标题栏惯例，三段等宽
  public static float SegmentWidth(float scale) => SegmentWidthLogical * (scale > 0 ? scale : 1f);
  public static float TotalWidth(float scale) => SegmentWidth(scale) * 3;
  // x 坐标命中测试：段内返回对应段，条外返回 None。
  public static CaptionSegment HitTest(float x, float totalWidth, float scale) {
   if (x < 0 || x >= totalWidth) return CaptionSegment.None;
   int i = (int)Math.Floor(x / SegmentWidth(scale));
   if (i < 0) i = 0; if (i > 2) i = 2;
   return (CaptionSegment)(i + 1); // None=0, Min=1, Max=2, Close=3
  }
  // v39：三枚字形统一：全部 12px、描边全部 2px（与 v30 的 Lucide 描边一致）。
  // v16 的逐枚微调（减号 14px/2.1、方框与叉 12px/1.7）随之退役：同一套描边
  // 才是同一套图标语言，减号不再靠加长加粗补偿。
  public static float GlyphSpan(CaptionGlyph g, float scale) => 12f * (scale > 0 ? scale : 1f);
  public static float GlyphStroke(CaptionGlyph g, float scale) => 2f * (scale > 0 ? scale : 1f);
  public static CaptionGlyph GlyphFor(CaptionSegment s) => s == CaptionSegment.Min ? CaptionGlyph.Minus : s == CaptionSegment.Max ? CaptionGlyph.Square : CaptionGlyph.Close;
  // v23：按下态的视觉只在指针仍压在被按的段上时显示：按住拖出段外，
  // 被按段的按下色立即退掉（按下记忆仍在 HoverState.Pressed 里，拖回来
  // 再松开照样触发点击——与原生按钮行为一致）。
  public static CaptionSegment VisualPressed(CaptionSegment hover, CaptionSegment pressed)
   => pressed != CaptionSegment.None && hover == pressed ? pressed : CaptionSegment.None;
  // 悬停/按下状态机：一次只记住一个段；按下后在同段抬起才算一次点击。
  internal sealed class HoverState {
   public CaptionSegment Hover = CaptionSegment.None;
   public CaptionSegment Pressed = CaptionSegment.None;
   public void Move(float x, float totalWidth, float scale) { Hover = HitTest(x, totalWidth, scale); }
   public void Leave() { Hover = CaptionSegment.None; Pressed = CaptionSegment.None; }
   public CaptionSegment Down(float x, float totalWidth, float scale) { Pressed = HitTest(x, totalWidth, scale); Hover = Pressed; return Pressed; }
   public CaptionSegment Up(float x, float totalWidth, float scale) {
    var seg = HitTest(x, totalWidth, scale);
    var fired = (Pressed != CaptionSegment.None && seg == Pressed) ? Pressed : CaptionSegment.None;
    Pressed = CaptionSegment.None;
    return fired;
   }
   public void Reset() { Hover = CaptionSegment.None; Pressed = CaptionSegment.None; }
  }
  // v18：悬停底色的圆角 pill 几何与颜色插值（纯逻辑，可单测）。
  public const float PillInsetLogical = 4f; // 底色内缩 4 逻辑 px（DPI 缩放）
  public const float PillRadiusLogical = 6f; // 圆角 6px（DPI 缩放）
  public static RectangleF PillRect(int index, float segW, float height, float scale) {
   float inset = PillInsetLogical * (scale > 0 ? scale : 1f);
   return new RectangleF(index * segW + inset, inset, segW - inset * 2, height - inset * 2);
  }
  public static float PillRadius(float scale) => PillRadiusLogical * (scale > 0 ? scale : 1f);
  public static Color LerpColor(Color a, Color b, float k) {
   k = Math.Max(0f, Math.Min(1f, k));
   return Color.FromArgb((int)Math.Round(a.R + (b.R - a.R) * k), (int)Math.Round(a.G + (b.G - a.G) * k), (int)Math.Round(a.B + (b.B - a.B) * k));
  }
  public static Color WithAlpha(Color c, float alpha) {
   alpha = Math.Max(0f, Math.Min(1f, alpha));
   return Color.FromArgb((int)Math.Round(255 * alpha), c.R, c.G, c.B);
  }
  // v18：悬停淡入淡出状态机（纯逻辑，无 WinForms 依赖，可进控制台测试）。
  // 每段一个 0..1 的淡入值：悬停/按下段目标 1，其余段目标 0。
  // v21：时长与缓动全部从 MotionTokens 取，不再写死 120ms。进场（0→1）用
  // ControlFaster 83ms + Fast Out Slow In；退场（1→0）用 62ms（83×0.75）
  // + Slow Out Fast In。Timer 逐帧调用 Tick 推进；动效关闭时 Snap 直接跳到目标。
  // 快速在段之间滑动时，旧段按退场退、新段按进场进（交叉淡化），不跳变、不串色。
  // v23：每段再加一个 0..1 的按下量：pill 底色在悬停色与按下色之间按此量插值。
  // v22 以前按下色是瞬间切换的（淡入值已是 1，Timer 不跑，OnPaint 直接换色），
  // 现在按下量与淡入值走同一套时长与缓动：按下 83ms 进场、松开 62ms 退场。
  // Snap（动效关）把按下量也直接跳到目标。
  internal sealed class CaptionFade {
   readonly float[] _from = new float[3];
   readonly float[] _target = new float[3];
   readonly float[] _values = new float[3];
   readonly double[] _durMs = new double[3]; // 每段本次动画的时长（进场 83 / 退场 62）
   readonly float[] _pressFrom = new float[3];
   readonly float[] _pressTarget = new float[3];
   readonly float[] _pressValues = new float[3];
   readonly double[] _pressDurMs = new double[3]; // 按下量本次动画的时长（同上）
   DateTimeOffset _start;
   bool _started;
   public bool Animating { get; private set; }
   public float Value(CaptionSegment seg) => seg == CaptionSegment.None ? 0f : _values[(int)seg - 1];
   public float PressValue(CaptionSegment seg) => seg == CaptionSegment.None ? 0f : _pressValues[(int)seg - 1];
   public void SetTarget(CaptionSegment hover, CaptionSegment pressed, DateTimeOffset now) {
    for (int i = 0; i < 3; i++) { var seg = (CaptionSegment)(i + 1); _target[i] = (seg == hover || seg == pressed) ? 1f : 0f; _from[i] = _values[i]; _durMs[i] = _target[i] > _from[i] ? MotionTokens.ControlFasterMs : MotionTokens.ControlFasterExitMs; }
    for (int i = 0; i < 3; i++) { var seg = (CaptionSegment)(i + 1); _pressTarget[i] = seg == pressed ? 1f : 0f; _pressFrom[i] = _pressValues[i]; _pressDurMs[i] = _pressTarget[i] > _pressFrom[i] ? MotionTokens.ControlFasterMs : MotionTokens.ControlFasterExitMs; }
    _start = now; _started = true;
    Animating = false;
    for (int i = 0; i < 3; i++) if (Math.Abs(_values[i] - _target[i]) > 0.0001f || Math.Abs(_pressValues[i] - _pressTarget[i]) > 0.0001f) Animating = true;
   }
   public void Snap(CaptionSegment hover, CaptionSegment pressed) {
    for (int i = 0; i < 3; i++) { var seg = (CaptionSegment)(i + 1); _values[i] = _target[i] = (seg == hover || seg == pressed) ? 1f : 0f; _from[i] = _values[i]; }
    for (int i = 0; i < 3; i++) { var seg = (CaptionSegment)(i + 1); _pressValues[i] = _pressTarget[i] = seg == pressed ? 1f : 0f; _pressFrom[i] = _pressValues[i]; }
    Animating = false; _started = false;
   }
   // 推进一帧；返回本帧是否有值变化（需要重绘）。
   public bool Tick(DateTimeOffset now) {
    if (!_started) return false;
    bool changed = false;
    bool anyRunning = false;
    for (int i = 0; i < 3; i++) {
     double t = (now - _start).TotalMilliseconds / _durMs[i];
     // 进场用 Fast Out Slow In，退场用 Slow Out Fast In（MotionTokens）。
     double k = _target[i] > _from[i] ? MotionTokens.EaseEnter(t) : MotionTokens.EaseExit(t);
     float v = (float)(_from[i] + (_target[i] - _from[i]) * k);
     if (t >= 1) { if (Math.Abs(_values[i] - _target[i]) > 0.0001f) changed = true; _values[i] = _target[i]; }
     else { if (Math.Abs(v - _values[i]) > 0.0001f) { _values[i] = v; changed = true; } else _values[i] = _target[i]; anyRunning = true; }
    }
    for (int i = 0; i < 3; i++) {
     double t = (now - _start).TotalMilliseconds / _pressDurMs[i];
     double k = _pressTarget[i] > _pressFrom[i] ? MotionTokens.EaseEnter(t) : MotionTokens.EaseExit(t);
     float v = (float)(_pressFrom[i] + (_pressTarget[i] - _pressFrom[i]) * k);
     if (t >= 1) { if (Math.Abs(_pressValues[i] - _pressTarget[i]) > 0.0001f) changed = true; _pressValues[i] = _pressTarget[i]; }
     else { if (Math.Abs(v - _pressValues[i]) > 0.0001f) { _pressValues[i] = v; changed = true; } else _pressValues[i] = _pressTarget[i]; anyRunning = true; }
    }
    Animating = anyRunning;
    if (!anyRunning) _started = false;
    return changed;
   }
  }
 }
}
