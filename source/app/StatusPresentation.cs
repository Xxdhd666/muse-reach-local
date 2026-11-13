using System;
namespace MuseReach {
 public static class StatusPresentation {
  public static string Short(ProbeResult p)=>p.error!=null?"电脑通道暂时查不了":p.tcpEstablished?"电脑通道有实时连接证据":"暂未发现电脑通道连接";
  public static string Conclusion(ProbeResult p){
   string tunnel=p.error!=null?"隧道：暂时查不了，请稍后再看":p.tcpEstablished?"隧道：通着，有实时证据":"隧道：暂未发现连接证据";
   string owner=p.identityVerified?"程序归属：已确认是既有隧道":p.tcpEstablished?"程序归属：暂时查不了，连接证据仍可查看":"程序归属：暂时查不了";
   return tunnel+"\n本机 SSH 服务："+p.service+"\n"+owner;
  }
  public static string Evidence(ProbeResult p)=>"采集时间："+p.sampledAt.ToString("yyyy-MM-dd HH:mm:ss zzz")+"\nSSH PID："+p.pid+"\n父进程 PID："+p.parent+"\n到既有服务器的 TCP："+(p.tcpEstablished?"已建立":"未发现已建立连接")+"\n脚本归属："+(p.identityVerified?"已核实":"无法核实")+"\n任务查询附证："+p.taskEvidence+(p.error!=null?"\n检查提示："+p.error:"");
 }
}
