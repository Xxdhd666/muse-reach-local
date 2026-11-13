// v35：托盘隐藏时连接事件的系统通知决策（纯逻辑，无 WinForms 依赖，可进 baseline-tests 真跑）。
// 只覆盖连接事件：断开（通道中断、疑似假死）与重连成功；其他事件（文件变化、
// 执行记录新增、设置变化）一律不发通知——本类只认 HealthKind，不认别的事件。
// 决策只看两件事：窗口此刻看不看得见、健康状态处于哪一轮。
//   断开（通道中断/疑似假死）：窗口可见 → 不发（v27 InfoBar 已在窗内呈现，同一件事
//     绝不两边都弹）；窗口不可见 → 发一条，级别按当时原因走（通道中断/疑似假死
//     各自的文案，见 MainForm.NotifyHidden）；同一轮断开只发一条——级别在轮内
//     变了（通道中断↔疑似假死）也不重发，InfoBar 同样是就地更新、不叠加。
//   重连成功：上一轮是断开 → 窗口可见不发（InfoBar 出绿色成功条），窗口不可见
//     发一条；不是上一轮断开（例如启动后一直正常）→ 不发。
//   状态待确认（Neutral：本机检查未完成、心跳缺失、时钟异常）：不发——InfoBar
//     也不弹它；轮次状态不动，上一轮断开被 Neutral 打断也不算恢复（Neutral 之后
//     再回到断开，仍是同一轮，不重发）。
// 窗口在断开轮内由可见变隐藏（例如断开时正看着 InfoBar，之后收进托盘），不补发：
// 这一轮已经以 InfoBar 的形式呈现过一次，补发就是同一件事发两次。
// 反过来也一样：断开时在托盘里发过通知，之后窗口打开、再重连——重连的呈现走
// InfoBar 绿色条，不再补发一条重连通知。
namespace MuseReach
{
    internal sealed class HiddenNotify
    {
        internal enum HealthKind { Neutral, Interrupted, SuspectedStuck, Healthy }
        internal enum Decision { None, NotifyInterrupted, NotifySuspectedStuck, NotifyReconnect }

        private enum Round { None, Bad, Reconnected }
        private Round _last = Round.None;

        internal Decision Next(bool windowVisible, HealthKind kind)
        {
            switch (kind)
            {
                case HealthKind.Neutral:
                    return Decision.None;
                case HealthKind.Healthy:
                    if (_last == Round.Bad)
                    {
                        _last = Round.Reconnected;
                        return windowVisible ? Decision.None : Decision.NotifyReconnect;
                    }
                    _last = Round.Reconnected;
                    return Decision.None;
                default: // Interrupted / SuspectedStuck：同一轮断开只发一条
                    if (_last == Round.Bad) return Decision.None;
                    _last = Round.Bad;
                    if (windowVisible) return Decision.None;
                    return kind == HealthKind.Interrupted ? Decision.NotifyInterrupted : Decision.NotifySuspectedStuck;
            }
        }
    }
}
