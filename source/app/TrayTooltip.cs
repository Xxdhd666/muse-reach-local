namespace MuseReach
{
    // v37：托盘悬停提示里写清热键（设计参考第 19 条：热键要在界面上看得见）。
    // 开 → "Muse Reach — Ctrl+Alt+Space 随时呼出"；关 → "Muse Reach"（不写热键、
    // 不写"已关闭"之类的后缀）。纯逻辑，可进 baseline-tests；提示只由 MainForm
    // 的 ApplyHotkey() 同步（设置处理器每次保存后都调 ApplyHotkey，所以开关一改
    // 提示立即跟随，不用重启）。
    // 长度上限：NotifyIcon.Text 在 .NET 6+ 最多 127 字符（Microsoft Learn，
    // NotifyIcon.Text 属性页；Win32 底层 NOTIFYICONDATA.szTip 自 Win2000 起 128
    // 字符含结尾空字符；.NET Framework 时代是 63）。本提示 32 字符，远在上限内，
    // 不会被截断，也不会抛 ArgumentException。
    internal static class TrayTooltip
    {
        internal const string WithHotkey = "Muse Reach — Ctrl+Alt+Space 随时呼出";
        internal const string WithoutHotkey = "Muse Reach";
        internal static string For(bool hotkeyEnabled) => hotkeyEnabled ? WithHotkey : WithoutHotkey;
    }
}
