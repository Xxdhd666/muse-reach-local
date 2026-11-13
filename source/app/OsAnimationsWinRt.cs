using System;
using Windows.UI.ViewManagement;
namespace MuseReach {
 // v36：读系统“动画效果”开关的正式接口（WinRT UISettings.AnimationsEnabled，
 // 对应“设置→辅助功能→视觉效果→动画效果”）。只在 app 工程里编译
 // （要 net8.0-windows10.0.19041.0 的 Windows SDK 投影）；baseline-tests
 // 是 net8.0、不含本文件。UISettings 只建一次复用（COM 激活一次），
 // 每次读属性即可；创建或读取抛错就锁死失败、以后都返回 null，
 // 由 OsAnimations.Read 退到 SPI_GETANIMATION。
 internal static class OsAnimationsWinRt {
  private static UISettings _settings;
  private static bool _failed;
  internal static bool? Read() {
   if (_failed) return null;
   try { _settings ??= new UISettings(); return _settings.AnimationsEnabled; }
   catch { _failed = true; return null; }
  }
 }
}
