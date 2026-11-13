using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;

namespace MuseReach {
 public sealed class ProcEvidence {public int pid {get;set;} public int parent {get;set;} public string name {get;set;} public string command {get;set;} }
 public sealed class TcpEvidence {public int pid {get;set;} public bool serverMatch {get;set;} public bool established {get;set;} }
 public sealed class ProbeResult {
  public DateTimeOffset sampledAt {get;set;}=DateTimeOffset.Now; public int pid {get;set;} public int parent {get;set;}
  public bool identityVerified {get;set;} public bool tcpEstablished {get;set;} public string error {get;set;}
  public string service {get;set;}="无法检查";public string taskEvidence {get;set;}="未查询（不作为探活前提）";
  public string Summary=>error!=null?"本地通道无法检查；"+error:identityVerified&&tcpEstablished?"指定隧道 TCP 已建立；Muse 接手以回执为准":tcpEstablished?"匹配服务器的 TCP 已建立；隧道归属无法核实":"未发现已建立的指定隧道 TCP；Muse 接手待确认";
 }
 public static class TunnelProbe {
  // Task and process identity checks use a complete script argument, not a substring.
  public static bool TaskActionMatches(string executable,string arguments,string script,string expectedExecutable) {
   try {
    if(!string.Equals(System.IO.Path.GetFullPath(executable),System.IO.Path.GetFullPath(expectedExecutable),StringComparison.OrdinalIgnoreCase))return false;
    if(System.Text.RegularExpressions.Regex.IsMatch(arguments??"",@"(?:^|\s)-(?:Command|EncodedCommand|c|ec|e)\b",System.Text.RegularExpressions.RegexOptions.IgnoreCase))return false;
    var m=System.Text.RegularExpressions.Regex.Match(arguments??"",@"(?:^|\s)-File\s+(?:""([^""]+)""|(\S+))\s*$",System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    return m.Success&&string.Equals(System.IO.Path.GetFullPath(m.Groups[1].Success?m.Groups[1].Value:m.Groups[2].Value),System.IO.Path.GetFullPath(script),StringComparison.OrdinalIgnoreCase);
   }catch(ArgumentException){return false;}
  }
  public static bool IsTunnelProcess(int pid,IEnumerable<ProcEvidence> processes,string script) {
   var all=processes.GroupBy(p=>p.pid).ToDictionary(g=>g.Key,g=>g.First());
   if(!all.TryGetValue(pid,out var ssh)||!string.Equals(ssh.name,"ssh.exe",StringComparison.OrdinalIgnoreCase))return false;
   int current=ssh.parent;var visited=new HashSet<int>();
   for(int i=0;i<8&&visited.Add(current)&&all.TryGetValue(current,out var ancestor);i++) {
    if(string.Equals(ancestor.name,"powershell.exe",StringComparison.OrdinalIgnoreCase)||string.Equals(ancestor.name,"pwsh.exe",StringComparison.OrdinalIgnoreCase)) {
     var m=System.Text.RegularExpressions.Regex.Match(ancestor.command??"",@"(?:^|\s)-File\s+(?:""([^""]+)""|(\S+))\s*$",System.Text.RegularExpressions.RegexOptions.IgnoreCase);
     if(m.Success)try {if(string.Equals(System.IO.Path.GetFullPath(m.Groups[1].Success?m.Groups[1].Value:m.Groups[2].Value),System.IO.Path.GetFullPath(script),StringComparison.OrdinalIgnoreCase))return true;}catch(ArgumentException){}
    }
    current=ancestor.parent;
   }
   return false;
  }
  public static ProbeResult Evaluate(IEnumerable<ProcEvidence> processes,IEnumerable<TcpEvidence> sockets,string script=null) {
   var all=processes.ToDictionary(p=>p.pid);var tcp=sockets.Where(t=>t.established&&t.serverMatch).ToList();
   var candidates=new List<ProbeResult>();
   foreach(var ssh in all.Values.Where(p=>string.Equals(p.name,"ssh.exe",StringComparison.OrdinalIgnoreCase))) {
    if(!tcp.Any(t=>t.pid==ssh.pid))continue;
    bool verified=script!=null&&IsTunnelProcess(ssh.pid,all.Values,script);
    candidates.Add(new ProbeResult{pid=ssh.pid,parent=ssh.parent,identityVerified=verified,tcpEstablished=true});
   }
   return candidates.OrderByDescending(c=>c.identityVerified).FirstOrDefault()??new ProbeResult();
  }
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Entry {public uint size,usage,pid;public IntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string name;}
  [StructLayout(LayoutKind.Sequential)]struct UnicodeString {public ushort length,max;public IntPtr buffer;}
  [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32FirstW(IntPtr h,ref Entry e);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32NextW(IntPtr h,ref Entry e);
  [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")]static extern IntPtr OpenProcess(uint access,bool inherit,int pid);
  [DllImport("ntdll.dll")]static extern int NtQueryInformationProcess(IntPtr h,int cls,IntPtr buffer,int len,out int returned);
  [DllImport("iphlpapi.dll")]static extern uint GetExtendedTcpTable(IntPtr buffer,ref int length,bool order,int family,int table,uint reserved);
  static string Command(int pid) {
   var h=OpenProcess(0x1000,false,pid);if(h==IntPtr.Zero)return null;
   IntPtr b=IntPtr.Zero;try {NtQueryInformationProcess(h,60,IntPtr.Zero,0,out int len);if(len<=0||len>1024*1024)return null;b=Marshal.AllocHGlobal(len);if(NtQueryInformationProcess(h,60,b,len,out _)!=0)return null;var s=Marshal.PtrToStructure<UnicodeString>(b);return Marshal.PtrToStringUni(s.buffer,s.length/2);}finally{if(b!=IntPtr.Zero)Marshal.FreeHGlobal(b);CloseHandle(h);}
  }
  public static List<ProcEvidence> Processes() {
   var list=new List<ProcEvidence>();var h=CreateToolhelp32Snapshot(2,0);if(h==new IntPtr(-1))throw new InvalidOperationException("进程关系读取失败");
   try {var e=new Entry{size=(uint)Marshal.SizeOf<Entry>()};if(!Process32FirstW(h,ref e))throw new InvalidOperationException("进程关系无法读取");do{list.Add(new ProcEvidence{pid=(int)e.pid,parent=(int)e.parent,name=e.name});}while(Process32NextW(h,ref e));}finally{CloseHandle(h);}
   var parents=new HashSet<int>();foreach(var p in list.Where(p=>p.name.Equals("ssh.exe",StringComparison.OrdinalIgnoreCase))) {int n=p.parent;for(int i=0;i<8&&parents.Add(n);i++){var q=list.FirstOrDefault(x=>x.pid==n);if(q==null)break;n=q.parent;}}
   foreach(var p in list.Where(p=>parents.Contains(p.pid)))p.command=Command(p.pid);
   return list;
  }
  public static List<TcpEvidence> Sockets(ConnectionSettings config=null) {
   config??=new ConnectionSettings();config.Validate();var addresses=config.Configured?Dns.GetHostAddresses(config.relayHost).ToHashSet():new HashSet<IPAddress>();
   var result=new List<TcpEvidence>();
   foreach(int family in new[]{2,23}) {
    int len=0;uint rc=GetExtendedTcpTable(IntPtr.Zero,ref len,false,family,5,0);if(rc==232)continue;if(rc!=0&&rc!=122)throw new InvalidOperationException("TCP 表无法读取");
    var b=Marshal.AllocHGlobal(len);try {
     if(GetExtendedTcpTable(b,ref len,false,family,5,0)!=0)throw new InvalidOperationException("TCP 表读取失败");
     int count=Marshal.ReadInt32(b),stride=family==2?24:56;
     for(int i=0;i<count;i++) {
      var row=IntPtr.Add(b,4+i*stride);IPAddress addr;int state,port,pid;
      if(family==2){state=Marshal.ReadInt32(row);addr=new IPAddress(unchecked((uint)Marshal.ReadInt32(row,12)));int raw=Marshal.ReadInt32(row,16);port=((raw&255)<<8)|((raw>>8)&255);pid=Marshal.ReadInt32(row,20);}
      else {var bytes=new byte[16];Marshal.Copy(IntPtr.Add(row,24),bytes,0,16);addr=new IPAddress(bytes,unchecked((uint)Marshal.ReadInt32(row,40)));int raw=Marshal.ReadInt32(row,44);port=((raw&255)<<8)|((raw>>8)&255);state=Marshal.ReadInt32(row,48);pid=Marshal.ReadInt32(row,52);}
      result.Add(new TcpEvidence{pid=pid,serverMatch=addresses.Contains(addr)&&port==config.relayPort,established=state==5});
     }
    }finally{Marshal.FreeHGlobal(b);}
   }
   return result;
  }
  public static ProbeResult Capture(ConnectionSettings config=null) {
   config??=new ConnectionSettings();
   if(!config.Configured)return new ProbeResult{error="尚未配置连接，请在设置页填写服务器与隧道信息"};
   ProbeResult result;
   try{result=Evaluate(Processes(),Sockets(config),config.tunnelScript);}catch(Exception){result=new ProbeResult{error="隧道证据读取失败，请检查配置、域名解析和访问权限"};}
   try {
    using var sc=new Process{StartInfo=new ProcessStartInfo("sc.exe","query sshd"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true}};
    sc.Start();var output=sc.StandardOutput.ReadToEndAsync();var error=sc.StandardError.ReadToEndAsync();
    if(sc.WaitForExit(3000)){string text=output.GetAwaiter().GetResult();error.GetAwaiter().GetResult();result.service=System.Text.RegularExpressions.Regex.IsMatch(text,@"\b4\s+RUNNING\b")?"运行中":System.Text.RegularExpressions.Regex.IsMatch(text,@"\b1\s+STOPPED\b")?"已停止":"无法检查";}
    else {try{sc.Kill();}catch{}}
   }catch{result.service="无法检查";}
   return result;
  }
 }
}
