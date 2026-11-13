using System;
using System.Runtime.InteropServices;
namespace MuseReach {
 // v36：跟随系统“减少动画”设置（设置→辅助功能→视觉效果→动画效果）。
 // 最终动效开关 = 用户开关 AND 系统开关：任一关，全部动效立即切换
 // （与应用内 animationsEnabled=false 的行为完全一致——侧栏展开/收起、
 // 翻转 glide、切页淡入、弹窗进出、标题栏 pill 淡入淡出、选中指示条滑动、
 // InfoBar 进出、加载态淡入淡出、骨架屏闪光，全都不再有过渡时间）；
 // 系统开关重新打开后，动效按应用内开关的值恢复。
 // 用户开关的值永远不被系统开关改写：本类只读、不写 AppSettings，
 // settings.json 里 animationsEnabled 一次都不动。
 // 纯逻辑＋Win32 退路，不碰 WinForms、不碰 WinRT，可进 baseline-tests 真跑；
 // WinRT 读法在 OsAnimationsWinRt.cs（要 Windows SDK 投影，baseline-tests 不含它）。
 internal static class OsAnimations {
  // 纯判定：最终动效开关 = 用户开关 AND 系统开关。
  public static bool Effective(bool userEnabled, bool osEnabled) => userEnabled && osEnabled;

  // 读系统开关：WinRT 优先（正式接口，见 OsAnimationsWinRt.cs），
  // 读不到（接口不存在/抛错/返回 null）退到 SPI_GETANIMATION，
  // 最后读不到按 true——只认应用内开关，不假装读到了系统值。
  // winRtReader 由 MainForm 传入；传 null 表示本机无 WinRT 读法（例如测试）。
  // v40：ReadWithSource 与 Read 是同一逻辑，Read 只是丢掉来源的薄壳——
  // 这样“走了哪条路径”只有一个判定点，不会与 Read 里的顺序跑偏。
  // 来源只有三种字面值：WinRT / SPI / fail-open（见 OsAnimLog 的钉子）。
  public static (bool value, string source) ReadWithSource(Func<bool?> winRtReader) {
   try { var v = winRtReader?.Invoke(); if (v.HasValue) return (v.Value, "WinRT"); } catch { }
   try { var v = ReadSpi(); if (v.HasValue) return (v.Value, "SPI"); } catch { }
   return (true, "fail-open");
  }
  public static bool Read(Func<bool?> winRtReader) => ReadWithSource(winRtReader).value;

  // SPI 退路：SPI_GETANIMATION 读 ANIMATIONINFO.iMinAnimate
  // （“最小化/最大化时动画”参数）。与 UISettings.AnimationsEnabled
  // 不是同一个 API：它反映的是旧版性能选项里的最小化动画开关，而非
  // 无障碍“动画效果”开关；两者语义不同，若系统把它们分开管理，退路
  // 可能与开关不一致——所以只在 WinRT 读不到时才用；Win11 23H2 上
  // WinRT 必然可用，退路只是最后一道保险。读不到（非 Windows、
  // P/Invoke 失败）返回 null，不抛错。
  internal const uint SPI_GETANIMATION = 0x0002;
  [StructLayout(LayoutKind.Sequential)]
  private struct ANIMATIONINFO { public uint cbSize; public int iMinAnimate; }
  [DllImport("user32.dll", SetLastError = true)]
  private static extern bool SystemParametersInfo(uint uiAction, uint uiParam, ref ANIMATIONINFO pvParam, uint fWinIni);
  internal static bool? ReadSpi() {
   try {
    var info = new ANIMATIONINFO { cbSize = (uint)Marshal.SizeOf<ANIMATIONINFO>() };
    if (!SystemParametersInfo(SPI_GETANIMATION, info.cbSize, ref info, 0)) return null;
    return info.iMinAnimate != 0;
   } catch { return null; }
  }
 }
}
