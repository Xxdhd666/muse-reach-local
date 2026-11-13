using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
namespace MuseReach {
 internal static class LocalOps {
  public const string TunnelTaskName="muse-reach-tunnel";
  public static string AppDir {get {var d=Environment.GetEnvironmentVariable("MUSEREACH_TEST_HOME")??Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MuseReach");Directory.CreateDirectory(d);return d;}}
  public static string LogPath=>Path.Combine(AppDir,"reach.log");
  public static string Scrub(string s){if(string.IsNullOrEmpty(s))return "";s=Regex.Replace(s,@"(?i)(password|passwd|token|secret|api[_-]?key|密码|验证码)\s*[:=]?\s*\S+","$1=***");s=Regex.Replace(s,@"\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b","[地址已隐藏]");s=Regex.Replace(s,@"\b[A-Za-z0-9_\-]{32,}\b","***");return s.Replace("\r"," ").Replace("\n"," ");}
  public static void AppendLog(string kind,string text){try{File.AppendAllText(LogPath,DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")+" | "+Scrub(kind)+" | "+Scrub(text)+Environment.NewLine);}catch(IOException){}catch(UnauthorizedAccessException){}}
  public static string ReadLogTail(int maxLines){try {if(!File.Exists(LogPath))return "";using var stream=new FileStream(LogPath,FileMode.Open,FileAccess.Read,FileShare.ReadWrite|FileShare.Delete);using var reader=new StreamReader(stream);var lines=new System.Collections.Generic.Queue<string>();string line;while((line=reader.ReadLine())!=null){lines.Enqueue(Scrub(line));if(lines.Count>maxLines)lines.Dequeue();}return string.Join("\n",lines.Reverse());}catch(IOException){return "日志文件暂时无法读取";}catch(UnauthorizedAccessException){return "无权读取日志文件";}}
 }
}
