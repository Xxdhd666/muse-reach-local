using System;
using System.Drawing;
using System.IO;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
namespace MuseReach {
 // v14：内容冻结帧覆盖层。Muse 页是独立的原生 WebView2，逐帧改尺寸会反复重排而掉帧；
 // v13 的做法（动画期间不动、结束时一次性跳到位）视觉上就是一卡。
 // 改法：动画开始时抓一张当前内容截图盖在上面，动画期间只移动/拉伸这张静态图
 // （位图拉伸不触发布局重排），结束后再把真 WebView2 一次性放到位并撤掉截图。
 // 截图失败或超时时不阻塞：直接按旧方式一次到位，绝不卡住界面。
 // 所有碰控件的操作都在 UI 线程；动画回调里碰控件前一律切回 UI 线程。
 internal sealed class AnimOverlay : IDisposable {
  readonly Form host; readonly WebView2 web; readonly AnimState state=new AnimState();
  PictureBox box; Bitmap shot; bool hasImage; int gen;
  Timer glideTimer; Timer safetyTimer; int glideMs; bool disposed;
  public bool Active=>state.Active;
  public AnimOverlay(Form host,WebView2 web){ this.host=host; this.web=web; }
  void Ui(Action a){ try{ if(host.IsHandleCreated&&host.InvokeRequired)host.BeginInvoke(a); else a(); }catch{} }
  // 动画开始（UI 线程调用）。截图是异步的：先不动真控件，等截图到手再换；
  // 截图失败则什么都不做，布局按旧方式一次到位。
  public void Begin(Rectangle currentBounds,string kind,int durationMs){
   Ui(()=>{
    if(disposed)return;
    CompleteNowLocked();
    if(web==null||web.CoreWebView2==null||!web.Visible||currentBounds.Width<=0||currentBounds.Height<=0)return;
    // v20：Begin 就记下时长。之前 glideMs 只靠 GlideTo/StartGlide 赋值，首个换边
    // 动画里 ShowShot 若在任何 GlideTo 之前跑到，会用 glideMs=0 → 1ms 跑完滑条、
    // 状态提前回空闲，覆盖层就再也撤不掉（见 CompleteNowLocked 的 v20 注释）。
    glideMs=Math.Max(1,durationMs);
    if(kind=="flip")state.BeginGlide(currentBounds,currentBounds,durationMs,DateTimeOffset.Now);
    else state.BeginFollow(currentBounds);
    gen++;
    int g=gen;
    safetyTimer=new Timer{Interval=Math.Max(60,durationMs+150)};
    safetyTimer.Tick+=(s,e)=>{ try{ CompleteNow(); }catch{} };
    safetyTimer.Start();
    _ = CaptureAsync(currentBounds,g);
   });
  }
  async Task CaptureAsync(Rectangle bounds,int g){
   try{
    using var ms=new MemoryStream();
    var capture=web.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png,ms);
    var done=await Task.WhenAny(capture,Task.Delay(200)).ConfigureAwait(false);
    if(done!=capture||capture.IsFaulted||capture.IsCanceled)return;
    ms.Position=0;
    Bitmap bmp;
    try{ using var tmp=new Bitmap(ms); bmp=new Bitmap(tmp); }catch{ return; }
    Ui(()=>ShowShot(bmp,bounds,g));
   }catch{ /* 截图失败：不阻塞，布局按旧方式一次到位 */ }
  }
  void ShowShot(Bitmap bmp,Rectangle bounds,int g){
   if(disposed||g!=gen||!state.Active){ bmp.Dispose(); return; }
   try{
    shot=bmp;
    // v20：同一时刻只留一个覆盖层。旧盒子若还在（上次收尾漏掉），先拆掉再建新的，
    // 否则两个截图盒子会叠在一起。
    if(box!=null){ try{ host.Controls.Remove(box); box.Dispose(); }catch{} box=null; }
    box=new PictureBox{Bounds=state.CurrentRect,SizeMode=PictureBoxSizeMode.StretchImage,Image=shot,BackColor=Color.FromArgb(17,19,23)};
    host.Controls.Add(box);box.BringToFront();hasImage=true;
    try{ web.Visible=false; }catch{}
    if(state.Current==AnimState.Mode.Glide)StartGlide(glideMs);
   }catch{ bmp.Dispose(); }
  }
  void StartGlide(int durationMs){
   try{ glideTimer?.Stop(); glideTimer?.Dispose(); }catch{}
   glideMs=Math.Max(1,durationMs);
   glideTimer=new Timer{Interval=16};
   glideTimer.Tick+=(s,e)=>GlideTick();
   glideTimer.Start();
  }
  void GlideTick(){
   try{
    var r=state.GlideTick(DateTimeOffset.Now);
    if(r==null){ StopGlide(); return; }
    if(hasImage&&box!=null)box.Bounds=r.Value;
   }catch{ StopGlide(); }
  }
  void StopGlide(){ try{ glideTimer?.Stop(); glideTimer?.Dispose(); }catch{} glideTimer=null; }
  // 收起/展开：JS 每帧上报缓动后的矩形，覆盖层跟随。
  public void Follow(Rectangle rect){
   Ui(()=>{
    if(disposed||!state.Active)return;
    state.FollowTo(rect);
    if(hasImage&&box!=null){ try{ box.Bounds=rect; }catch{} }
   });
  }
  // 换边：内容矩形瞬间换边，覆盖层用定时器按缓出曲线从旧矩形滑向新矩形。
  public void GlideTo(Rectangle rect,int durationMs){
   Ui(()=>{
    if(disposed||!state.Active)return;
    if(state.Current==AnimState.Mode.Glide&&state.TargetRect==rect)return; // 已在滑向同一终点，不重启
    var from=hasImage&&box!=null?box.Bounds:state.CurrentRect;
    glideMs=Math.Max(1,durationMs);
    state.BeginGlide(from,rect,durationMs,DateTimeOffset.Now);
    if(hasImage)StartGlide(durationMs);
   });
  }
  // 动画结束：真控件一次性放到终态矩形并显示，撤掉覆盖层。
  // v20：Finish 后核对一次 _web.Bounds 是否等于静止时 #museHost 的矩形（日志为证），
  // 快速连点后左栏不得重影。
  public void Finish(Rectangle finalRect){
   Ui(()=>{
    if(disposed)return;
    // v20：状态已空闲但盒子还在时也要收尾（换边滑条 250ms 比 anim-end 的 330ms
    // 先跑完是常态）；只有状态空闲且无盒子时才算无事可做。
    if(!state.Active&&box==null&&!hasImage)return;
    CompleteNowLocked(finalRect);
    try{ if(web!=null)LocalOps.AppendLog("anim","动画收尾核对：web="+web.Bounds+" 目标="+finalRect+" 一致="+(web.Bounds==finalRect)); }catch{}
   });
  }
  public void CompleteNow(){ Ui(()=>{ if(!disposed)CompleteNowLocked(); }); }
  void CompleteNowLocked(){ CompleteNowLocked(null); }
  void CompleteNowLocked(Rectangle? finalRect){
   try{ StopGlide(); safetyTimer?.Stop(); safetyTimer?.Dispose(); safetyTimer=null; }catch{}
   // v20：覆盖层的拆除与动画状态脱钩——这是左栏重影的确切根因。
   // 之前这里先判 !state.Active 就直接 return，盒子原样留在界面上。换边滑条 250ms
   // 一定比 JS 的 anim-end（250+80=330ms）先跑完：GlideTick 一到 250ms 就把状态
   // 置回空闲，Finish 与安全定时器随后都撞上空闲状态直接返回，截图盒子就此失联；
   // 下次 ShowShot 还会覆盖 box 字段，让旧盒子彻底没人管。它一直盖在界面上显示
   // 旧截图，直到某次侧栏动作把真 WebView 移到别的矩形，旧截图露出来——Muse 网页
   // 的左栏就出现两份（截屏 reach-shot5.png：两份相距约 65px，正好是一次侧栏动画
   // 中途的位置差，左边那份是旧截图）。现在：只要盒子存在就拆掉；只有动画状态还
   // 活着时才取它的终态矩形。真控件只在（盒子存在 或 状态还活着）时才恢复——状态
   // 已空闲又没有盒子时不动它，避免把它从别的页面上顶出来。
   bool hadOverlay = box != null || hasImage;
   bool stateWasActive = state.Active;
   Rectangle target = stateWasActive ? state.CompleteNow() : state.TargetRect;
   if(finalRect.HasValue)target=finalRect.Value;
   gen++;
   try{
    if(box!=null){ host.Controls.Remove(box); box.Dispose(); box=null; }
    shot?.Dispose(); shot=null; hasImage=false;
    if((hadOverlay||stateWasActive)&&web!=null&&web.CoreWebView2!=null){ web.Bounds=target; web.Visible=true; web.BringToFront(); }
   }catch(Exception ex){ LocalOps.AppendLog("error","动画收尾失败："+ex.Message); }
  }
  public void Dispose(){ if(disposed)return; disposed=true; try{ Ui(()=>CompleteNowLocked()); }catch{} }
 }
}
