// v34：托盘还原/带到前台的决策（纯逻辑，无 WinForms 依赖，可进 baseline-tests 真跑）。
// 托盘双击、右键“打开”、重复启动唤醒都走同一个决策：
//   NoOp              窗口可见、未最小化、已在前台——什么都不做（双击已在前台的窗口不得闪一下或重建窗口；
//                     更不能像旧 ShowReach 那样无条件 WindowState=Normal，把最大化窗口打回普通尺寸）。
//   ActivateOnly      窗口可见、未最小化、不在前台——只激活，不碰尺寸（最大化保持最大化）。
//   RestoreAndActivate 窗口隐藏（收进托盘）或最小化——先还原再激活。
// 跨进程唤醒时 Activate 可能拿不到前台（前台权限在发消息的第二个进程手里），
// ShowReach 里对 RestoreAndActivate/ActivateOnly 再补一次 TopMost 顶一下（见 MainForm.ShowReach）。
namespace MuseReach
{
    internal static class TrayRestore
    {
        internal enum Action { NoOp, ActivateOnly, RestoreAndActivate }

        internal static Action Next(bool visible, bool minimized, bool isForeground)
        {
            if (visible && !minimized && isForeground) return Action.NoOp;
            if (visible && !minimized) return Action.ActivateOnly;
            return Action.RestoreAndActivate;
        }
    }
}
