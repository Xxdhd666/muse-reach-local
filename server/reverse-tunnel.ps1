# Installed next to relay-tunnel.json by Install-Reach.ps1; current user, not SYSTEM.
$ErrorActionPreference='Stop'
$config=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'relay-tunnel.json') -Raw|ConvertFrom-Json
if($config.relayHost -match '[\s@/;]' -or $config.relayHost -match 'YOUR_' -or -not $config.relayHost){throw 'Configure a relay host first'}
if($config.relayUser -notmatch '^[a-zA-Z0-9_-]+$'){throw 'Invalid relay user'}
foreach($port in @($config.relayPort,$config.listenPort,$config.localPort)){if([int]$port -lt 1 -or [int]$port -gt 65535){throw 'Invalid port'}}
if(-not(Test-Path -LiteralPath $config.keyFile) -or -not(Test-Path -LiteralPath $config.knownHosts)){throw 'Missing private key or pinned known_hosts'}
$ssh=Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
while($true) {
 & $ssh -N -T -p $config.relayPort -i $config.keyFile `
  -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes `
  -o "UserKnownHostsFile=$($config.knownHosts)" -o ExitOnForwardFailure=yes `
  -o ServerAliveInterval=15 -o ServerAliveCountMax=2 `
  -R "127.0.0.1:$($config.listenPort):127.0.0.1:$($config.localPort)" "$($config.relayUser)@$($config.relayHost)"
 Start-Sleep -Seconds 10
}
