using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;
namespace MuseReach {
 // 补记机制：记录层上线前如有旧交付当时没记账，可在这里加条目，
 // 首次启动时以追加方式补进 ops.jsonl：只追加，绝不改写旧记录；
 // 已补过的靠固定 id 去重，二次启动为无操作。
 // 默认是空模板，不补记任何内容。
 public static class Backfill {
  public sealed class Entry { public int v {get;set;}=1; public string id {get;set;} public string ts {get;set;} public string kind {get;set;} public string summary {get;set;} public string[] files {get;set;} public int? exit {get;set;} public string result {get;set;}="success"; public string cmd {get;set;}=""; }
  static string Desktop()=>Environment.GetFolderPath(Environment.SpecialFolder.Desktop);
  // 空模板：需要补记旧交付时，按下面格式自行添加条目。
  // id 固定（用于去重）、ts 用原交付时间、summary 以“补记：”开头。
  // 例：
  //  new Entry{id="backfill-example",ts="2026-01-01T00:00:00+08:00",kind="file-create",
  //    summary="补记：示例文件",files=new[]{Path.Combine(Desktop(),"Example.txt")}},
  public static IReadOnlyList<Entry> Entries()=>System.Array.Empty<Entry>();
  public static int Ensure(string appDir){
   string file=Path.Combine(appDir,"ops.jsonl");
   var seen=new HashSet<string>(StringComparer.Ordinal);
   if(File.Exists(file)){
    try{using var stream=new FileStream(file,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete);using var reader=new StreamReader(stream);string line;while((line=reader.ReadLine())!=null){try{using var doc=JsonDocument.Parse(line);if(doc.RootElement.ValueKind==JsonValueKind.Object&&doc.RootElement.TryGetProperty("id",out var id)&&id.ValueKind==JsonValueKind.String)seen.Add(id.GetString());}catch(JsonException){}}}catch(IOException){}catch(UnauthorizedAccessException){}
   }
   int added=0;var sb=new StringBuilder();
   foreach(var e in Entries()){if(seen.Contains(e.id))continue;sb.Append(JsonSerializer.Serialize(e,new JsonSerializerOptions{Encoder=System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping})).Append('\n');added++;}
   if(added>0){Directory.CreateDirectory(appDir);File.AppendAllText(file,sb.ToString(),new UTF8Encoding(false));}
   return added;
  }
 }
}
