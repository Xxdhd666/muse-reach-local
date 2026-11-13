using System;
namespace MuseReach {
 // v33：窄窗口自动收起（Fluent NavigationView Auto 模式）。
 // 纯逻辑：窗口逻辑宽 <1008px 时自动收起侧栏（48px 图标轨）；
 // 恢复用 16px 回滞——宽 >1024px 才恢复，1008–1024px 之间保持现状，
 // 拖动窗口在阈值附近来回时只切换一次（单子 §04 的回滞方案）。
 // 逻辑宽用 WinForms 的 ClientSize.Width（逻辑像素，与 v20 钳制单位一致）；
 // 自动收起态只活在内存里（MainForm._autoCollapsed），永不写进 settings.json；
 // 手动设置（sidebarCollapsed）与自动收起互相独立，见 shell.html 的
 // effectiveCollapsed() / narrowOverride。
 internal static class SidebarAutoCollapse {
  public const int CollapseBelowWidth = 1008;
  public const int RestoreAboveWidth = 1024;
  public static bool Next(bool autoCollapsed, int logicalWidth) {
   if (autoCollapsed) return logicalWidth <= RestoreAboveWidth;
   return logicalWidth < CollapseBelowWidth;
  }
 }
}
