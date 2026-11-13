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
  // Existing endpoint from the handoff. Used only for comparison; never displayed or logged.
  const string ExpectedServer="YOUR_SERVER_IP";
  public static ProbeResult Evaluate(IEnumerable<ProcEvidence> processes,IEnumerable<TcpEvidence> sockets) {
   var all=processes.ToDictionary(p=>p.pid);var tcp=sockets.Where(t=>t.established&&t.serverMatch).ToList();
   var candidates=new List<ProbeResult>();
   foreach(var ssh in all.Values.Where(p=>string.Equals(p.name,"ssh.exe",StringComparison.OrdinalIgnoreCase))) {
    if(!tcp.Any(t=>t.pid==ssh.pid))continue;
    bool verified=false;int current=ssh.parent;var visited=new HashSet<int>();
    for(int depth=0;depth<8&&visited.Add(current)&&all.TryGetValue(current,out var ancestor);depth++) {
     string c=(ancestor.command??"").Replace('/','\\');
     if(c.Contains(@"\muse-reach-tunnel\tunnel.ps1",StringComparison.OrdinalIgnoreCase)) {verified=true;break;}current=ancestor.parent;
    }
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
  public static List<TcpEvidence> Sockets() {
   var result=new List<TcpEvidence>();int len=0;uint rc=GetExtendedTcpTable(IntPtr.Zero,ref len,false,2,5,0);if(rc!=0&&rc!=122)throw new InvalidOperationException("TCP 表无法读取");
   var b=Marshal.AllocHGlobal(len);try {if(GetExtendedTcpTable(b,ref len,false,2,5,0)!=0)throw new InvalidOperationException("TCP 表读取失败");int count=Marshal.ReadInt32(b);for(int i=0;i<count;i++){var row=IntPtr.Add(b,4+i*24);int state=Marshal.ReadInt32(row);uint addr=unchecked((uint)Marshal.ReadInt32(row,12));int port=((Marshal.ReadInt32(row,16)&255)<<8)|((Marshal.ReadInt32(row,16)>>8)&255);result.Add(new TcpEvidence{pid=Marshal.ReadInt32(row,20),serverMatch=new IPAddress(addr).ToString()==ExpectedServer&&port==22,established=state==5});}}finally{Marshal.FreeHGlobal(b);}return result;
  }
  public static ProbeResult Capture() {
   ProbeResult result;try{result=Evaluate(Processes(),Sockets());}catch(Exception ex){result=new ProbeResult{error=ex.Message};}
   try {using var sc=new Process{StartInfo=new ProcessStartInfo("sc.exe","query sshd"){UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true}};sc.Start();var output=sc.StandardOutput.ReadToEndAsync();if(sc.WaitForExit(3000)){string text=output.GetAwaiter().GetResult();result.service=System.Text.RegularExpressions.Regex.IsMatch(text,@"\b4\s+RUNNING\b")?"运行中":System.Text.RegularExpressions.Regex.IsMatch(text,@"\b1\s+STOPPED\b")?"已停止":"无法检查";}else{try{sc.Kill();}catch{}}}catch{result.service="无法检查";}
   return result;
  }
 }
}
