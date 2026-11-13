using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace MuseReach {
 public sealed class ConnectionSettings {
  public string relayHost {get;set;}="";
  public int relayPort {get;set;}=22;
  public string tunnelTaskName {get;set;}="muse-reach-tunnel";
  public string tunnelScript {get;set;}=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"MuseReach","tunnel","reverse-tunnel.ps1");
  public string[] watchedDirectories {get;set;}=Array.Empty<string>();
  public bool Configured=>!string.IsNullOrWhiteSpace(relayHost);
  public void Validate() {
   relayHost=(relayHost??"").Trim();
   if(relayHost.Length>253||relayHost.Contains("YOUR_",StringComparison.OrdinalIgnoreCase)||
      (Configured&&!IPAddress.TryParse(relayHost,out _)&&Uri.CheckHostName(relayHost)!=UriHostNameType.Dns))
    throw new ArgumentException("服务器请填写 IP 或域名，不含协议、用户名或端口");
   if(relayPort<1||relayPort>65535)throw new ArgumentException("SSH 端口须为 1 到 65535");
   if(!Regex.IsMatch(tunnelTaskName??"",@"^[A-Za-z0-9_-]{1,64}$"))throw new ArgumentException("任务名只允许字母、数字、下划线和短横线，最多64字符");
   if(string.IsNullOrWhiteSpace(tunnelScript)||!Path.IsPathFullyQualified(tunnelScript)||!tunnelScript.EndsWith(".ps1",StringComparison.OrdinalIgnoreCase))throw new ArgumentException("隧道脚本须为 .ps1 文件的完整路径");
   tunnelScript=Path.GetFullPath(tunnelScript);
   if(watchedDirectories==null||watchedDirectories.Length>20)throw new ArgumentException("监听目录最多20个");
   if(watchedDirectories.Any(d=>string.IsNullOrWhiteSpace(d)||!Path.IsPathFullyQualified(d)))throw new ArgumentException("监听目录须填写完整路径，每行一个");
   watchedDirectories=watchedDirectories.Select(Path.GetFullPath).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
  }
  public static ConnectionSettings Load(string file) {
   if(!File.Exists(file))return new ConnectionSettings();
   var value=JsonSerializer.Deserialize<ConnectionSettings>(File.ReadAllText(file))??throw new InvalidDataException("连接配置为空");
   value.Validate();return value;
  }
  public void Save(string file) {
   Validate();var tmp=file+"."+Guid.NewGuid().ToString("N")+".tmp";
   try {File.WriteAllText(tmp,JsonSerializer.Serialize(this,new JsonSerializerOptions{WriteIndented=true}));File.Move(tmp,file,true);}
   finally {if(File.Exists(tmp))File.Delete(tmp);}
  }
 }
}
