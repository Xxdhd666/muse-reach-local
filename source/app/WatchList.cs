using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
namespace MuseReach {
 // 最近变化清单：与 ops.jsonl 分开存放（watch.json），按时间倒序；
 // 用户什么都不用点：条目只是列出来，随时可以一键清空已看过的；
 // 程序重启后仍在，直到清空。
 public sealed class WatchEntry { public string id {get;set;} public DateTimeOffset ts {get;set;} public string path {get;set;} public string change {get;set;} public string status {get;set;}="pending"; }
 public sealed class WatchList {
  readonly string file; List<WatchEntry> entries=new();
  public WatchList(string file){this.file=file;Load();}
  void Load(){entries=new List<WatchEntry>();try{if(!File.Exists(file))return;using var doc=JsonDocument.Parse(File.ReadAllText(file));if(doc.RootElement.ValueKind!=JsonValueKind.Object||!doc.RootElement.TryGetProperty("entries",out var arr)||arr.ValueKind!=JsonValueKind.Array)return;foreach(var x in arr.EnumerateArray()){try{entries.Add(new WatchEntry{id=x.GetProperty("id").GetString(),ts=x.GetProperty("ts").GetDateTimeOffset(),path=x.GetProperty("path").GetString(),change=x.GetProperty("change").GetString(),status="pending"});}catch{}}}catch{entries=new List<WatchEntry>();}}
  public void Save(){try{Directory.CreateDirectory(Path.GetDirectoryName(file));var tmp=file+".tmp";File.WriteAllText(tmp,JsonSerializer.Serialize(new{v=1,entries=entries.Where(e=>e.status=="pending").ToArray()}),new UTF8Encoding(false));File.Move(tmp,file,true);}catch{}}
  public IReadOnlyList<WatchEntry> Pending()=>entries.Where(e=>e.status=="pending").OrderByDescending(e=>e.ts).ToList();
  public bool Add(string path,string change,DateTimeOffset now){
   if(string.IsNullOrWhiteSpace(path)||(change!="created"&&change!="modified"&&change!="deleted"))return false;
   var pending=entries.Where(e=>e.status=="pending"&&string.Equals(e.path,path,StringComparison.OrdinalIgnoreCase));
   if(change=="deleted"){if(pending.Any(e=>e.change=="deleted"))return false;}
   else if(pending.Any(e=>e.change==change&&(now-e.ts).TotalSeconds<120))return false;
   if(change=="modified"&&pending.Any(e=>e.change=="created"&&(now-e.ts).TotalSeconds<10))return false;
   entries.Add(new WatchEntry{id="watch-"+now.ToString("yyyyMMddHHmmss")+"-"+Guid.NewGuid().ToString("N").Substring(0,6),ts=now,path=path,change=change,status="pending"});
   Save();return true;
  }
  public void Clear(){ entries.Clear(); Save(); }
 }
}
