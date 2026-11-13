using System;
namespace MuseReach {
 // v32：Muse 页加载态分档（Fluent 2 Wait UX，任务书 §1）。
 // 阈值是 Wait UX 的档位数字，不是动效 token：
 //   <1000ms 什么都不显示（太快，闪一下反而碍眼）；
 //   1000–3000ms spinner；
 //   >3000ms 进度条＋一句安抚文案。
 // spinner 转速与出现/消失的时长走 MotionTokens（见 WebLoadingOverlay）；
 // 60 秒内没有任何被追踪的导航完成，就按失败处理（见 MainForm 的兜底注释）。
 // 本文件不碰任何 WinForms 类型，所以能进 baseline-tests 真跑时序断言。
 internal static class WebLoadingTiers {
  public const int SpinnerAfterMs = 1000;
  public const int ProgressAfterMs = 3000;
  public const int WatchdogMs = 60000;
  public enum Tier { Hidden, Spinner, Progress }
  public static Tier TierFor(int elapsedMs) {
   if (elapsedMs < 0) elapsedMs = 0;
   if (elapsedMs < SpinnerAfterMs) return Tier.Hidden;
   if (elapsedMs < ProgressAfterMs) return Tier.Spinner;
   return Tier.Progress;
  }
 }
}
