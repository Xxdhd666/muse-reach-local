using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;
namespace MuseReach {
 // 目录盯梢：只看文件的新建/修改/删除，不读内容；事件先节流、再过“最近已记账”检查，最后才交给界面。
 // 监听目录由 ConnectionSettings 配置；程序关闭即停止监听，启动时不阻塞界面。
 public sealed class ChangeWatcher : IDisposable {
  readonly List<FileSystemWatcher> watchers=new();
  readonly System.Collections.Concurrent.ConcurrentDictionary<string,string> status=new(StringComparer.OrdinalIgnoreCase);
  public object Status=>status.ToDictionary(x=>x.Key,x=>x.Value);
  readonly Dictionary<string,DateTimeOffset> last=new(StringComparer.OrdinalIgnoreCase);
  readonly object gate=new();
  public ChangeWatcher(IEnumerable<string> dirs,Action<string,string> onChange,Func<string,bool> recentlyRecorded){
   foreach(var dir in dirs){
    if(string.IsNullOrWhiteSpace(dir))continue;
    try{
     if(!Directory.Exists(dir)){status[dir]="目录不存在或不可访问";continue;}
     var w=new FileSystemWatcher(dir){NotifyFilter=NotifyFilters.FileName|NotifyFilters.LastWrite,IncludeSubdirectories=true,EnableRaisingEvents=false};
     FileSystemEventHandler h=(s,e)=>Fire(e.FullPath,ChangeOf(e.ChangeType),onChange,recentlyRecorded);
     RenamedEventHandler r=(s,e)=>{Fire(e.OldFullPath,"deleted",onChange,recentlyRecorded);Fire(e.FullPath,"created",onChange,recentlyRecorded);};
     w.Error+=(sender,args)=>status[dir]="监听发生错误，可能遗漏变化；请重新保存配置启动监听";
     w.Created+=h;w.Changed+=h;w.Deleted+=h;w.Renamed+=r;watchers.Add(w);w.EnableRaisingEvents=true;status[dir]="监听中";
    }catch{status[dir]="无法启动监听，请检查权限";}
   }
  }
  static string ChangeOf(WatcherChangeTypes t)=>t==WatcherChangeTypes.Created?"created":t==WatcherChangeTypes.Deleted?"deleted":"modified";
  static bool Ignored(string path){var n=Path.GetFileName(path);return n.StartsWith("~$",StringComparison.Ordinal)||n.EndsWith(".tmp",StringComparison.OrdinalIgnoreCase)||n.EndsWith(".crdownload",StringComparison.OrdinalIgnoreCase)||string.Equals(n,"desktop.ini",StringComparison.OrdinalIgnoreCase)||string.Equals(n,"thumbs.db",StringComparison.OrdinalIgnoreCase);}
  void Fire(string path,string change,Action<string,string> onChange,Func<string,bool> recentlyRecorded){
   if(Ignored(path))return;
   lock(gate){
    if(last.Count>2000)last.Clear();
    var key=path+"\n"+change;
    var now=DateTimeOffset.Now;
    if(last.TryGetValue(key,out var t)&&(now-t).TotalSeconds<2)return;
    last[key]=now;
    if(change=="modified"&&last.TryGetValue(path+"\ncreated",out var c)&&(now-c).TotalSeconds<10)return;
   }
   try{if(recentlyRecorded!=null&&recentlyRecorded(path))return;}catch{}
   try{onChange(path,change);}catch{}
  }
  public void Dispose(){foreach(var w in watchers){try{w.EnableRaisingEvents=false;w.Dispose();}catch{}}watchers.Clear();}
 }
}
