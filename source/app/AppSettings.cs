using System;
using System.IO;
using System.Text.Json;
namespace MuseReach {
 public sealed partial class AppSettings {
  public string museStartUrl {get;set;}="https://muse.ai/";
  public void SetMuseUrl(string value){if(!Uri.TryCreate(value,UriKind.Absolute,out var u)||u.Scheme!="https"||u.Host!="muse.ai"||!u.IsDefaultPort||!string.IsNullOrEmpty(u.UserInfo))throw new ArgumentException("请先在 Muse 网页打开你要保存的对话");museStartUrl=u.AbsoluteUri;}
  public bool minimizeToTray {get;set;}=true;public bool startWithWindows {get;set;}=false;public bool hotkeyEnabled {get;set;}=true;public string theme {get;set;}="dark";
  public static AppSettings Load(string file){if(!File.Exists(file))return new AppSettings();try{return JsonSerializer.Deserialize<AppSettings>(File.ReadAllText(file))??new AppSettings();}catch(JsonException){throw new InvalidDataException("设置文件损坏，未覆盖原文件");}}
  public void Save(string file){string tmp=file+".tmp";try{File.WriteAllText(tmp,JsonSerializer.Serialize(this));File.Move(tmp,file,true);}finally{if(File.Exists(tmp))File.Delete(tmp);}}
  public void Set(string key,bool value,Action<bool> startup){switch(key){case "sidebarCollapsed":sidebarCollapsed=value;break;case "minimizeToTray":minimizeToTray=value;break;case "hotkeyEnabled":hotkeyEnabled=value;break;case "animationsEnabled":animationsEnabled=value;break;case "recentChangesCollapsed":recentChangesCollapsed=value;break;case "recentFilesCollapsed":recentFilesCollapsed=value;break;case "startWithWindows":startup(value);startWithWindows=value;break;default:throw new ArgumentException("此开关尚未接入实际功能");}}
  public void SetTheme(string value){if(value!="dark"&&value!="midnight"&&value!="light"&&value!="pink"&&value!="purple"&&value!="ocean"&&value!="forest"&&value!="amber"&&value!="obsidian")throw new ArgumentException("未知主题");theme=value;}
  public void SetSidebarSide(string value){if(value!="left"&&value!="right")throw new ArgumentException("侧栏只能在左侧或右侧");sidebarSide=value;}
  public static bool ClearLegacyRecents(string file){try{if(File.Exists(file)&&File.ReadAllText(file).Contains("\"recents\"")){Load(file).Save(file);return true;}}catch{}return false;}
 }
}
