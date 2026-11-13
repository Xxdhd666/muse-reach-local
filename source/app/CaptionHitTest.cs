using System.Drawing;
namespace MuseReach
{
    // v38：最大化键的命中测试（纯逻辑，无 WinForms 依赖，可进 baseline-tests）。
    // 标题栏是手绘 CaptionStrip，Windows 不知道最大化键在哪：MainForm 的
    // WM_NCHITTEST 按这里的结果让最大化段返回 HTMAXBUTTON，鼠标悬停在
    // 最大化段上时系统才弹出 Snap Layouts 贴靠浮层。
    // 只认最大化段——最小化/关闭段仍返回 HTCLIENT（条自己处理鼠标，
    // v17/v18/v23 的悬停 pill、按下态、失活态原样不动），标题栏空白
    // 与边框的返回值也不动（空白仍走 DragWindow 的 ReleaseCapture +
    // SC_MOVE 拖动，不是 HTCAPTION——见 REPORT 的映射表）。
    internal static class CaptionHitTest
    {
        // 窗口客户区坐标 + 条在窗口内的矩形 → 该点落在条的哪一段；
        // 不在条上返回 None（调用方走默认处理）。条内横坐标与
        // CaptionStripMath.HitTest 的 x 同义（逻辑像素）。
        public static CaptionSegment SegmentAt(Point formClientPoint, Rectangle stripRectInForm, float scale)
        {
            if (!stripRectInForm.Contains(formClientPoint)) return CaptionSegment.None;
            return CaptionStripMath.HitTest(formClientPoint.X - stripRectInForm.Left, stripRectInForm.Width, scale);
        }
        // 条内 x（逻辑像素）→ 是不是最大化段（供 MainForm 的非客户区
        // 消息转发复用同一判断）。
        public static bool IsMaxSegment(float xInStrip, float stripWidth, float scale)
            => CaptionStripMath.HitTest(xInStrip, stripWidth, scale) == CaptionSegment.Max;
    }
}
