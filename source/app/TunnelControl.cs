using System;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
namespace MuseReach {
 internal static class TunnelControl {
  static int TaskCommand(string op){using var p=new Process{StartInfo=new ProcessStartInfo("schtasks.exe",op+" /TN \"muse-reach-tunnel\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true}};p.Start();var stdout=p.StandardOutput.ReadToEndAsync();var stderr=p.StandardError.ReadToEndAsync();if(!p.WaitForExit(8000)){try{p.Kill();}catch{}return 124;}Task.WaitAll(stdout,stderr);return p.ExitCode;}
  public static int Elevated(string action) {
   if(action!="disconnect"&&action!="reconnect")return 2;
   if(action=="reconnect")return TaskCommand("/Run");
   // Capture process handles and start times before ending the exact named task. Never kill by image name.
   var processes=TunnelProbe.Processes();var sockets=TunnelProbe.Sockets();
   var candidates=processes.Where(p=>p.name.Equals("ssh.exe",StringComparison.OrdinalIgnoreCase))
    .Where(p=>TunnelProbe.Evaluate(processes.Where(x=>x.name!="ssh.exe"||x.pid==p.pid),sockets).identityVerified).ToList();
   var handles=new System.Collections.Generic.List<Process>();
   try {
    foreach(var candidate in candidates){try{var p=Process.GetProcessById(candidate.pid);_ = p.Handle;_ = p.StartTime;handles.Add(p);}catch{}}
    int rc=TaskCommand("/End");if(rc!=0)return rc;
    foreach(var p in handles){try{if(!p.HasExited)p.Kill(false);}catch{ return 5; }}
    return 0;
   }finally{foreach(var p in handles)p.Dispose();}
  }
  public static async Task<string> RequestAsync(IWin32Window owner,string action,bool confirmedByShell=false) {
   string word=action=="disconnect"?"断开":"重新连接";
   if(!confirmedByShell&&MessageBox.Show(owner,word+"既有隧道需要 Windows 管理员授权。只操作 muse-reach-tunnel；不更改任务配置、sshd、钥匙或防火墙。是否继续？","Muse Reach · Windows 授权",MessageBoxButtons.OKCancel,MessageBoxIcon.Warning)!=DialogResult.OK)return "已取消，未执行隧道操作";
   try {using var p=Process.Start(new ProcessStartInfo(Application.ExecutablePath,"--tunnel-control "+action){UseShellExecute=true,Verb="runas",WindowStyle=ProcessWindowStyle.Hidden});if(p==null)return "未能启动授权操作";await p.WaitForExitAsync();return p.ExitCode==0?"系统操作命令已完成，正在复查实际通道状态":"系统操作失败，退出码 "+p.ExitCode+"；未确认"+word;}
   catch(System.ComponentModel.Win32Exception ex) when(ex.NativeErrorCode==1223){return "Windows 授权已取消，未确认"+word;}
   catch(Exception){return "无法执行授权操作，未确认"+word;}
  }
 }
}
