using System;
using System.Drawing;
namespace MuseReach {
 // v14: 纯动画数学与状态机，不依赖 WinForms，所以设置测试程序能在 Linux 上跑它。
 // WinForms 覆盖层（AnimOverlay）只是这层状态之上的薄胶水。
 public static class AnimMath {
  // v21：缓动只从 MotionTokens 取。旧的 EaseOutCubic（1-(1-t)^3）已删：
  // 它与 Fluent 的进场曲线 cubic-bezier(0,0,0,1) 不是同一条曲线（中点 0.875
  // 对 0.8899），全应用收敛到一张 token 表后不得再留第二套缓动。
  public static Rectangle LerpRect(Rectangle a,Rectangle b,double k)=>new Rectangle(
   (int)Math.Round(a.X+(b.X-a.X)*k),(int)Math.Round(a.Y+(b.Y-a.Y)*k),
   (int)Math.Round(a.Width+(b.Width-a.Width)*k),(int)Math.Round(a.Height+(b.Height-a.Height)*k));
 }
 // 动画状态：空闲 / 跟随逐帧矩形（收起展开，矩形由 JS 每帧上报）/ 从旧矩形滑向新矩形（换边）。
 // 防抖规则：开始一个新动画时，先把当前动画收尾到它的终态，调用方读到返回的终态矩形后先把内容放到位。
 public sealed class AnimState {
  public enum Mode { None, Follow, Glide }
  public Mode Current {get;private set;}=Mode.None;
  public Rectangle CurrentRect {get;private set;}
  public Rectangle TargetRect {get;private set;}
  Rectangle glideFrom; DateTimeOffset glideStart; int glideMs;
  public bool Active=>Current!=Mode.None;
  public Rectangle? BeginFollow(Rectangle start){ Rectangle? prev=Active?(Rectangle?)TargetRect:null; Current=Mode.Follow; CurrentRect=start; TargetRect=start; return prev; }
  public Rectangle? BeginGlide(Rectangle from,Rectangle to,int durationMs,DateTimeOffset now){ Rectangle? prev=Active?(Rectangle?)TargetRect:null; Current=Mode.Glide; glideFrom=from; CurrentRect=from; TargetRect=to; glideStart=now; glideMs=Math.Max(1,durationMs); return prev; }
  public void FollowTo(Rectangle rect){ if(Current!=Mode.Follow)return; CurrentRect=rect; TargetRect=rect; }
  // 返回本帧应显示的矩形；滑完返回 null（此时状态已回到空闲）。
  public Rectangle? GlideTick(DateTimeOffset now){
   if(Current!=Mode.Glide)return null;
   double t=(now-glideStart).TotalMilliseconds/glideMs;
   if(t>=1){ CurrentRect=TargetRect; Current=Mode.None; return null; }
   CurrentRect=AnimMath.LerpRect(glideFrom,TargetRect,MotionTokens.EaseEnter(t));
   return CurrentRect;
  }
  public Rectangle CompleteNow(){ var r=TargetRect; CurrentRect=r; Current=Mode.None; return r; }
 }
}
