using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;
namespace MuseReach {
 internal static class TunnelControl {
  public static int Elevated(string action,string configFile) {
   if(action!="disconnect"&&action!="reconnect")return 2;
   var config=ConnectionSettings.Load(configFile);config.Validate();if(!config.Configured)return 3;
   var processes=TunnelProbe.Processes();var handles=new System.Collections.Generic.List<Process>();
   object scheduler=null,folder=null,registered=null;
   try {
    foreach(var candidate in processes.Where(p=>TunnelProbe.IsTunnelProcess(p.pid,processes,config.tunnelScript))) {
     try {var p=Process.GetProcessById(candidate.pid);_ = p.Handle;_ = p.StartTime;handles.Add(p);}catch(ArgumentException){}
    }
    scheduler=Activator.CreateInstance(Type.GetTypeFromProgID("Schedule.Service",true));
    dynamic service=scheduler;service.Connect();folder=service.GetFolder("\\");
    registered=((dynamic)folder).GetTask(config.tunnelTaskName);dynamic task=registered;
    dynamic definition=task.Definition;
    if((int)definition.Actions.Count!=1||(int)definition.Principal.RunLevel!=0)return 4;
    dynamic actionDefinition=definition.Actions.Item(1);
    string expectedExecutable=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows),"System32","WindowsPowerShell","v1.0","powershell.exe");
    if(!TunnelProbe.TaskActionMatches((string)actionDefinition.Path,(string)actionDefinition.Arguments,config.tunnelScript,expectedExecutable))return 4;
    string principal=(string)definition.Principal.UserId;
    var sid=principal.StartsWith("S-1-",StringComparison.OrdinalIgnoreCase)?new System.Security.Principal.SecurityIdentifier(principal):(System.Security.Principal.SecurityIdentifier)new System.Security.Principal.NTAccount(principal).Translate(typeof(System.Security.Principal.SecurityIdentifier));
    if(!sid.Equals(System.Security.Principal.WindowsIdentity.GetCurrent().User))return 4;
    if((int)task.State==4)task.Stop(0);
    var deadline=DateTime.UtcNow.AddSeconds(8);
    while((int)task.State==4&&DateTime.UtcNow<deadline)System.Threading.Thread.Sleep(100);
    if((int)task.State==4)return 124;
    // Opened handles protect against PID reuse; never kill by image name.
    foreach(var p in handles)if(!p.HasExited){p.Kill(false);if(!p.WaitForExit(3000))return 124;}
    if(action=="reconnect"){object instance=task.Run(null);if(instance!=null&&Marshal.IsComObject(instance))Marshal.FinalReleaseComObject(instance);}
    return 0;
   }finally {
    foreach(var p in handles)p.Dispose();
    foreach(var item in new[]{registered,folder,scheduler})if(item!=null&&Marshal.IsComObject(item))Marshal.FinalReleaseComObject(item);
   }
  }
  public static async Task<string> RequestAsync(IWin32Window owner,string action,bool confirmedByShell=false) {
   var file=Path.Combine(LocalOps.AppDir,"connection.json");var config=ConnectionSettings.Load(file);
   if(!config.Configured)return "无法操作：请先在设置页配置连接";
   string word=action=="disconnect"?"断开":"重新连接";
   if(!confirmedByShell&&MessageBox.Show(owner,word+"需要 Windows 管理员授权，仅操作已配置的隧道任务。","Muse Reach · Windows 授权",MessageBoxButtons.OKCancel,MessageBoxIcon.Warning)!=DialogResult.OK)return "已取消，未执行隧道操作";
   try {
    var info=new ProcessStartInfo(Application.ExecutablePath){UseShellExecute=true,Verb="runas",WindowStyle=ProcessWindowStyle.Hidden};
    foreach(var arg in new[]{"--tunnel-control",action,"--connection",file})info.ArgumentList.Add(arg);
    using var p=Process.Start(info);if(p==null)return "未能启动授权操作";await p.WaitForExitAsync();
    if(p.ExitCode==4)return "无法操作：计划任务的脚本、执行器或账户与配置不匹配，已拒绝控制无关任务";
    return p.ExitCode==0?"任务控制请求已完成，正在复查实际通道；连接恢复可能需要数秒":"系统操作失败，退出码 "+p.ExitCode+"；未确认"+word;
   }catch(System.ComponentModel.Win32Exception ex) when(ex.NativeErrorCode==1223){return "Windows 授权已取消，未确认"+word;}
   catch(Exception){return "无法执行授权操作，未确认"+word;}
  }
 }
}
