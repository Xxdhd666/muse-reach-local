using System;
using System.Drawing;
namespace MuseReach {
 // v19: 纯窗口几何数学，不依赖 WinForms，所以设置测试程序能在 Linux 上跑它。
 // 根因（2026-11-12 实测钉死）：v18 的 ApplyInitialScale 把 1770×1170 当逻辑尺寸用，
 // 150% DPI 下窗口实际宽 1758 逻辑像素，比屏幕逻辑宽 1707 还宽；窗口几何记忆又
 // 原样恢复了这组出屏的 bounds——右缘 471+1758=2229，超出屏幕 522px，展开的侧栏
 // （右侧 250px，x=1979–2229）整个在屏外。修复分两层：单位换算 + 钳制。
 public static class WindowGeometryMath {
  public const int Margin = 8;                 // 窗口与工作区边缘的余量，不贴死
  public const int SidebarWidth = 250;         // 展开的侧栏宽度
  public const int MinContentWidth = 320;      // 侧栏之外的最小内容宽度
  public const int MinWidth = SidebarWidth + MinContentWidth; // 570：钳制后至少留出侧栏
  public const int MinHeight = 150;
  public const int DesignWidthPhysical = 1770; // 96 DPI 下的设计尺寸 1180×780 对应的物理目标
  public const int DesignHeightPhysical = 1170;
  public static readonly Size MinimumSize = new Size(860, 560); // 设计最小尺寸（逻辑像素）

  // v20：Screen.WorkingArea 给的是物理像素，保存的 bounds 是逻辑像素；v19 把两种
  // 单位直接比（1758 宽的逻辑窗口对 2560 宽的物理工作区，以为放得下），钳制等于
  // 没做——reach.log 23:44:00：Restore 与保存值一字不差、无钳制行。调用方必须先把
  // 工作区换算成逻辑像素再交给 Pick/Clamp。DeviceDpi 异常（<96 或 >480）时退回 96。
  public static int EffectiveDpi(int dpi){ return (dpi >= 96 && dpi <= 480) ? dpi : 96; }
  public static Rectangle ToLogical(Rectangle physical, int dpi){
   double f = EffectiveDpi(dpi) / 96.0;
   return new Rectangle((int)Math.Round(physical.X / f), (int)Math.Round(physical.Y / f),
    (int)Math.Round(physical.Width / f), (int)Math.Round(physical.Height / f));
  }
  public static Rectangle[] ToLogicalAreas(Rectangle[] physical, int dpi){
   if (physical == null || physical.Length == 0) return Array.Empty<Rectangle>();
   var r = new Rectangle[physical.Length];
   for (int i = 0; i < physical.Length; i++) r[i] = ToLogical(physical[i], dpi);
   return r;
  }

  // 目标尺寸按逻辑像素算：1770×1170 是物理目标，除以缩放系数才是逻辑尺寸。
  // 150% DPI 下为 1180×780；96 DPI 下为 1770×1170。不得再乘系数（v18 的错）。
  public static Size InitialSize(int dpi){
   double f = dpi > 0 ? dpi / 96.0 : 1.0;
   return new Size((int)Math.Round(DesignWidthPhysical / f), (int)Math.Round(DesignHeightPhysical / f));
  }

  // 把窗口钳制进工作区：尺寸超大时按比例缩小（宽高同比例，不变形），
  // 再钳制位置；钳制后至少留出展开的侧栏宽度 + 内容宽（工作区允许时）。
  public static Rectangle ClampToWorkingArea(Rectangle bounds, Rectangle wa){
   int maxW = Math.Max(200, wa.Width - 2 * Margin);
   int maxH = Math.Max(MinHeight, wa.Height - 2 * Margin);
   int w = bounds.Width, h = bounds.Height;
   if (w > maxW || h > maxH){
    double scale = Math.Min((double)maxW / w, (double)maxH / h);
    w = Math.Max(200, (int)Math.Round(w * scale));
    h = Math.Max(MinHeight, (int)Math.Round(h * scale));
   }
   int floorW = Math.Min(MinWidth, maxW);
   if (w < floorW) w = floorW;
   int x = Math.Max(wa.Left + Margin, Math.Min(bounds.X, wa.Right - Margin - w));
   int y = Math.Max(wa.Top + Margin, Math.Min(bounds.Y, wa.Bottom - Margin - h));
   return new Rectangle(x, y, w, h);
  }

  // 选与保存的 bounds 交集最大的那个工作区；都没有交集时返回 fallback（主屏）。
  public static Rectangle PickWorkingArea(Rectangle bounds, Rectangle[] areas, Rectangle fallback){
   if (areas == null || areas.Length == 0) return fallback;
   Rectangle best = fallback; long bestArea = 0;
   foreach (var a in areas){
    var inter = Rectangle.Intersect(bounds, a);
    long area = (long)Math.Max(0, inter.Width) * Math.Max(0, inter.Height);
    if (area > bestArea){ best = a; bestArea = area; }
   }
   return bestArea > 0 ? best : fallback;
  }
 }
}
