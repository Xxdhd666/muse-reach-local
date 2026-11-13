namespace MuseReach {
 // v40：动画设置读取路径的日志决策（纯逻辑，无 WinForms/WinRT 依赖，
 // 可进 baseline-tests 真跑）。决定每次重读系统开关后要不要往 reach.log
 // 写一行、写什么——补 v36 留下的缺口：到底走了 WinRT / SPI / fail-open
 // 哪条路径，以前没写日志；系统开关关了动效没停时，查问题第一个要看
 // 的就是这一行。
 // 规则（与任务书 §01–§03 一字对应）：
 //   启动（第一次调用）：一定写一行，含读取路径、系统开关值、
 //     应用内开关值、最终生效的动效开关值。
 //   之后：系统开关值变了 → 写一行（含新值与生效值；路径变了也写新路径）；
 //         读取路径变了、值没变 → 也写一行（含新路径）；
 //         值和路径都没变 → 不写（每秒轮询不再刷日志）。
 // 行文案只含路径与开关值（开/关），不含用户名、路径、机器名等个人信息；
 // 格式与 reach.log 现有行一致（时间戳 | app | 内容），类别固定为 app。
 internal sealed class OsAnimLog {
  private string _lastSource;
  private bool? _lastOsValue;
  private bool _started;
  // 返回要写的行文本；null 表示这一次不写。
  // source 只能是 ReadWithSource 的三种字面值：WinRT / SPI / fail-open。
  public string Next(string source, bool osValue, bool userEnabled) {
   bool effective = userEnabled && osValue;
   bool first = !_started;
   bool sourceChanged = _lastSource != source;
   bool valueChanged = _lastOsValue != osValue;
   if (!first && !sourceChanged && !valueChanged) return null;
   _started = true; _lastSource = source; _lastOsValue = osValue;
   string onOff = osValue ? "开" : "关";
   string eff = effective ? "开" : "关";
   if (first)
    return "动画设置：读取路径=" + source + "，系统开关=" + onOff + "，应用内开关=" + (userEnabled ? "开" : "关") + "，生效动效=" + eff;
   string line = "动画设置变化：";
   if (sourceChanged) line += "读取路径=" + source + "，";
   return line + "系统开关=" + onOff + "，生效动效=" + eff;
  }
 }
}
