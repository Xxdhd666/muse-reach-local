using System;
namespace MuseReach {
 // v21：全应用动效 token 表（Microsoft Fluent《Timing and easing》）。
 // 唯一事实来源：所有动画时长与缓动只从这里取数，代码里不得再散落魔法数字。
 // CSS 侧（shell.html :root 的 --motion-* 变量）与这里同步，数值必须一字不差；
 // 改时长只改这一张表（回退也只改这里一个数）。
 internal static class MotionTokens {
  // 四档时长（毫秒）。
  public const int ControlFasterMs = 83;  // 悬停/按下反馈（标题栏 pill、图标悬停、列表行悬停）
  public const int ControlFastMs = 167;   // 切页淡入、菜单/小面板出现
  public const int ThemeMs = 200;         // 主题切换过渡
  public const int ControlNormalMs = 250; // 侧栏收起/展开/换边滑动、面板级动画
  // 退场比进场快约 25%（退场时长 = 进场 × 0.75，四舍五入到整毫秒）。
  public const int ControlFasterExitMs = 62;  // 83 × 0.75 = 62.25
  public const int ControlFastExitMs = 125;   // 167 × 0.75 = 125.25
  public const int ControlNormalExitMs = 188; // 250 × 0.75 = 187.5
  public static int ExitDuration(int enterMs) => (int)Math.Round(enterMs * 0.75);
  // 缓动曲线（与 CSS 的 cubic-bezier 同值）：
  // 进场 Fast Out Slow In cubic-bezier(0,0,0,1)——起步快、收尾慢；
  // 退场 Slow Out Fast In cubic-bezier(1,0,1,1)——起步慢、收尾快。
  public static double EaseEnter(double t) => CubicBezier(t, 0, 0, 0, 1);
  public static double EaseExit(double t) => CubicBezier(t, 1, 0, 1, 1);
  // 标准 cubic-bezier 求值：先对 x(u)=t 用 Newton 法解 u，再返回 y(u)。
  // 牛顿法不收敛时退回二分法；曲线单调递增，u 始终在 [0,1] 内。
  public static double CubicBezier(double t, double x1, double y1, double x2, double y2) {
   t = Math.Max(0, Math.Min(1, t));
   double SampleX(double u) { double v = 1 - u; return 3 * v * v * u * x1 + 3 * v * u * u * x2 + u * u * u; }
   double SampleY(double u) { double v = 1 - u; return 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u; }
   double SampleDerivativeX(double u) { double v = 1 - u; return 3 * v * v * x1 + 6 * v * u * (x2 - x1) + 3 * u * u * (1 - x2); }
   double u = t;
   for (int i = 0; i < 8; i++) {
    double x = SampleX(u) - t;
    if (Math.Abs(x) < 1e-6) return SampleY(u);
    double d = SampleDerivativeX(u);
    if (Math.Abs(d) < 1e-6) break;
    u -= x / d;
    if (u < 0) u = 0; else if (u > 1) u = 1;
   }
   double lo = 0, hi = 1; u = t;
   while (hi - lo > 1e-6) {
    double x = SampleX(u);
    if (Math.Abs(x - t) < 1e-6) break;
    if (x < t) lo = u; else hi = u;
    u = (lo + hi) / 2;
   }
   return SampleY(u);
  }
 }
}
