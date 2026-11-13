using MuseReach;
using System.Text.Json;

int passed=0, failed=0;
void Test(string name, Action run) { try { run(); passed++; Console.WriteLine("PASS "+name); } catch(Exception ex) { failed++; Console.WriteLine("FAIL "+name+": "+ex.Message); } }
void Require(bool value) { if(!value) throw new Exception("assertion failed"); }
var dir=Path.Combine(Path.GetTempPath(),"reach-reliability-"+Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(dir);
try {
 Test("connection configuration rejects unsafe and incomplete endpoints",()=>{
  foreach(var host in new[]{"https://relay.example", "user@relay", "relay;echo", "YOUR_SERVER_IP"}) {
   bool threw=false; try { new ConnectionSettings{relayHost=host}.Validate(); } catch(ArgumentException) {threw=true;} Require(threw);
  }
  var c=new ConnectionSettings{relayHost="relay.example",relayPort=2222,tunnelScript=Path.Combine(dir,"reverse-tunnel.ps1")}; c.Validate();
  c.relayPort=0; bool invalid=false;try{c.Validate();}catch(ArgumentException){invalid=true;}Require(invalid);
 });
 Test("configuration is atomic, round trips, and does not overwrite corruption",()=>{
  var file=Path.Combine(dir,"connection.json"); var c=new ConnectionSettings{relayHost="::1",watchedDirectories=new[]{dir}};
  c.Save(file);Require(ConnectionSettings.Load(file).relayHost=="::1");
  File.WriteAllText(file,"{"); bool threw=false;try{ConnectionSettings.Load(file);}catch(Exception){threw=true;}Require(threw&&File.ReadAllText(file)=="{");
 });
 Test("tunnel ownership matches the complete configured File argument",()=>{
  var script=Path.Combine(dir,"reverse-tunnel.ps1");
  bool Owned(string command)=>TunnelProbe.IsTunnelProcess(42,new[]{new ProcEvidence{pid=42,parent=7,name="ssh.exe"},new ProcEvidence{pid=7,name="powershell.exe",command=command}},script);
  Require(Owned("powershell.exe -NoProfile -File \""+script+"\""));
  Require(!Owned("powershell.exe -File \""+script+".evil.ps1\""));
  Require(!Owned("powershell.exe -Command 'echo \""+script+"\"'"));
 });
 Test("task control rejects unrelated executable or script",()=>{
  string exe=Path.Combine(dir,"powershell.exe"),script=Path.Combine(dir,"reverse-tunnel.ps1");
  Require(TunnelProbe.TaskActionMatches(exe,"-NoProfile -File \""+script+"\"",script,exe));
  Require(!TunnelProbe.TaskActionMatches(Path.Combine(dir,"other.exe"),"-File \""+script+"\"",script,exe));
  Require(!TunnelProbe.TaskActionMatches(exe,"-Command 'echo test' -File \""+script+"\"",script,exe));
  Require(!TunnelProbe.TaskActionMatches(exe,"-File \""+script+".evil.ps1\"",script,exe));
 });
 Test("invalid heartbeat schemas recover without throwing",()=>{
  foreach(var json in new[]{"[]","{}","{\"v\":2}","{\"v\":1,\"ts\":\"yesterday\"}"}) {
   File.WriteAllText(Path.Combine(dir,"heartbeat.json"),json);
   var data=new ConsoleData(dir); Require(data.ReadHeartbeat()==null); Require(data.heartbeatError!=null);
  }
 });
 Test("external journal attribution is not presented as verified Muse identity",()=>Require(ConsoleData.SourceOf(new Operation{summary="ordinary"})=="操作记录（来源未核验）"));
 Test("journal write failure is observable",()=>{
  bool threw=false;
  try { ConsoleData.AppendOperation(Path.Combine(dir,"missing","child"),new Operation{id="a"}); } catch(IOException) { threw=true; }
  Require(threw);
 });
 Test("future heartbeat cannot be healthy",()=>Require(ConsoleData.Health(new ProbeResult{tcpEstablished=true,service="运行中"},DateTimeOffset.Now.AddMinutes(1),DateTimeOffset.Now).label!="通道正常"));
 Test("unowned SSH socket cannot prove the configured tunnel is healthy",()=>Require(ConsoleData.Health(new ProbeResult{tcpEstablished=true,service="运行中"},DateTimeOffset.Now,DateTimeOffset.Now).label!="通道正常"));
 Test("idle arrival heartbeat expiry does not claim a stuck tunnel",()=>{
  var h=ConsoleData.Health(new ProbeResult{identityVerified=true,tcpEstablished=true,service="运行中"},DateTimeOffset.Now.AddMinutes(-5),DateTimeOffset.Now);
  Require(!h.reconnect&&h.label!="疑似假死");
 });
 Test("equal timestamps prefer the last appended outcome",()=>{
  var file=Path.Combine(dir,"ops.jsonl");var ts=DateTimeOffset.Now;
  File.WriteAllText(file,JsonSerializer.Serialize(new{v=1,id="same",ts,result="unknown"})+"\n"+JsonSerializer.Serialize(new{v=1,id="same",ts,result="success"})+"\n");
  Require(new ConsoleData(dir).ReadOperations().Single().result=="success");
 });
 Test("program event identity stays stable when a newer line arrives",()=>{
  const string old="2026-11-13 10:00:00 | app | ready";
  var data=new ConsoleData(dir);var before=data.ProgramEvents(old).Single().id;
  Require(data.ProgramEvents("2026-11-13 10:01:00 | app | later\n"+old).Last().id==before);
 });
} finally { Directory.Delete(dir,true); }
Console.WriteLine($"Reliability: {passed} passed, {failed} failed");
return failed==0?0:1;
