[CmdletBinding(SupportsShouldProcess=$true)]
param([Parameter(Mandatory=$true)][string]$RelayHost,
      [Parameter(Mandatory=$true)][string]$TunnelKey,
      [Parameter(Mandatory=$true)][string]$KnownHosts,
      [string]$RelayUser='reach-tunnel',[int]$RelayPort=22,[int]$ListenPort=2203,[int]$LocalPort=22,
      [ValidatePattern('^[A-Za-z0-9_-]{1,64}$')][string]$TaskName='muse-reach-tunnel')
$ErrorActionPreference='Stop'
if(-not(Test-Path -LiteralPath $TunnelKey) -or -not(Test-Path -LiteralPath $KnownHosts)){throw 'Provide an existing key and verified known_hosts file'}
if([Uri]::CheckHostName($RelayHost) -eq 'Unknown' -or $RelayHost -match 'YOUR_'){throw 'Provide a host name or IP'}
if($RelayUser -notmatch '^[A-Za-z0-9_-]+$'){throw 'Invalid relay user'}
foreach($port in @($RelayPort,$ListenPort,$LocalPort)){if($port -lt 1 -or $port -gt 65535){throw 'Invalid port'}}
$dir=Join-Path $env:LOCALAPPDATA 'MuseReach';$tunnelDir=Join-Path $dir 'tunnel';$tools=Join-Path $dir 'tools'
$scriptPath=Join-Path $tunnelDir 'reverse-tunnel.ps1'
if($PSCmdlet.ShouldProcess($dir,'Install executor and register current-user logon tunnel task')) {
 [IO.Directory]::CreateDirectory($tunnelDir)|Out-Null;[IO.Directory]::CreateDirectory($tools)|Out-Null
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'reverse-tunnel.ps1') -Destination $scriptPath -Force
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Invoke-ReachCommand.ps1') -Destination $tools -Force
 @{relayHost=$RelayHost;relayPort=$RelayPort;relayUser=$RelayUser;listenPort=$ListenPort;localPort=$LocalPort;keyFile=[IO.Path]::GetFullPath($TunnelKey);knownHosts=[IO.Path]::GetFullPath($KnownHosts)}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $tunnelDir 'relay-tunnel.json') -Encoding UTF8
 $settings=Join-Path $dir 'connection.json'
 if(Test-Path -LiteralPath $settings){Copy-Item -LiteralPath $settings -Destination ($settings+'.'+(Get-Date -Format yyyyMMddHHmmss)+'.bak')}
 @{relayHost=$RelayHost;relayPort=$RelayPort;tunnelTaskName=$TaskName;tunnelScript=$scriptPath;watchedDirectories=@()}|ConvertTo-Json|Set-Content -LiteralPath $settings -Encoding UTF8
 $action=New-ScheduledTaskAction -Execute (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "'+$scriptPath+'"')
 $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
 $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
 $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
 $taskSettings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
 Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $taskSettings -Force|Out-Null
 Write-Output 'Installed. Task is not started. Start it manually after verifying SSH configuration.'
}
