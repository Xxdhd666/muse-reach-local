# Journaled execution for the current Windows account. Not a sandbox.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$RequestBase64,
      [string]$DataDirectory=(Join-Path $env:LOCALAPPDATA 'MuseReach'))
$ErrorActionPreference='Stop'
$utf8=New-Object Text.UTF8Encoding($false)
$child=$null;$claim=$null;$tempScript=$null;$code=1;$started=$false
function Append-Record($value) {
 $line=($value|ConvertTo-Json -Compress -Depth 6)+"`n"
 $bytes=$utf8.GetBytes($line);$deadline=[DateTime]::UtcNow.AddSeconds(5)
 while($true) {
  $stream=$null
  try {
   $stream=[IO.File]::Open((Join-Path $DataDirectory 'ops.jsonl'),[IO.FileMode]::Append,[IO.FileAccess]::Write,[IO.FileShare]::Read)
   $stream.Write($bytes,0,$bytes.Length);$stream.Flush($true);return
  } catch [IO.IOException] {if([DateTime]::UtcNow -ge $deadline){throw};Start-Sleep -Milliseconds 50}
  finally {if($stream){$stream.Dispose()}}
 }
}
try {
 if($RequestBase64.Length -gt 90000){throw 'Request is too large'}
 $request=$utf8.GetString([Convert]::FromBase64String($RequestBase64))|ConvertFrom-Json
 if($request.id -notmatch '^[A-Za-z0-9_-]{1,64}$'){throw 'Invalid request id'}
 if($request.command -isnot [string] -or [string]::IsNullOrWhiteSpace($request.command)){throw 'Empty command'}
 $timeout=300;if($null -ne $request.timeoutSeconds){$timeout=[int]$request.timeoutSeconds}
 if($timeout -lt 1 -or $timeout -gt 900){throw 'Timeout must be 1..900 seconds'}
 $kind='exec';if($request.kind){$kind=[string]$request.kind}
 if($kind -notin @('exec','file-create','file-modify','file-delete','file-read')){throw 'Invalid operation kind'}
 $files=@();if($kind -ne 'exec'){foreach($item in $request.files){if(-not [IO.Path]::IsPathRooted($item)){throw 'Files must use absolute paths'};$files+=,[IO.Path]::GetFullPath($item)}}
 $summary='Local command';if($request.summary){$summary=[string]$request.summary};if($summary.Length -gt 500){throw 'Summary exceeds 500 characters'}
 [IO.Directory]::CreateDirectory($DataDirectory)|Out-Null
 $requests=Join-Path $DataDirectory 'requests';[IO.Directory]::CreateDirectory($requests)|Out-Null
 try {$claim=[IO.File]::Open((Join-Path $requests ($request.id+'.claim')),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)}
 catch [IO.IOException] {if(Test-Path -LiteralPath (Join-Path $requests ($request.id+'.claim'))){Write-Output 'Request id already used; inspect its journal before retrying';exit 75};throw}
 $raw='';if($request.recordCommand -eq $true){$raw=[string]$request.command}
 $record=[ordered]@{v=1;id=$request.id;ts=[DateTimeOffset]::Now.ToString('o');kind=$kind;summary=$summary;files=$files;exit=$null;result='unknown';cmd=$raw;phase='running'}
 # Failure here aborts BEFORE launching a command.
 Append-Record $record;$started=$true
 $heartbeat=Join-Path $DataDirectory ('heartbeat.'+[guid]::NewGuid().ToString('N')+'.tmp')
 [IO.File]::WriteAllText($heartbeat,(@{v=1;ts=[DateTimeOffset]::Now.ToString('o')}|ConvertTo-Json -Compress),$utf8)
 Move-Item -LiteralPath $heartbeat -Destination (Join-Path $DataDirectory 'heartbeat.json') -Force
 $tempScript=Join-Path $requests ($request.id+'.ps1')
 # Terminating PowerShell errors produce failure; native programs must exit explicitly or leave LASTEXITCODE.
 $body="$"+"ErrorActionPreference='Stop'; `$global:LASTEXITCODE=0`r`n"+$request.command+"`r`nif (`$LASTEXITCODE) { exit `$LASTEXITCODE }`r`n"
 [IO.File]::WriteAllText($tempScript,$body,(New-Object Text.UTF8Encoding($true)))
 $info=New-Object Diagnostics.ProcessStartInfo
 $info.FileName=Join-Path $PSHOME 'powershell.exe'
 $info.Arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$tempScript+'"'
 $info.UseShellExecute=$false;$info.CreateNoWindow=$true
 $child=New-Object Diagnostics.Process;$child.StartInfo=$info
 if(-not $child.Start()){throw 'Command did not start'}
 $timedOut=-not $child.WaitForExit($timeout*1000)
 if($timedOut){& taskkill.exe /PID $child.Id /T /F 2>&1|Out-Null;if(-not $child.WaitForExit(5000)){throw 'Timed out; termination could not be confirmed'};$code=124}
 else {$code=$child.ExitCode}
 $record.ts=[DateTimeOffset]::Now.ToString('o');$record.exit=$code;$record.phase=if($timedOut){'timeout'}else{'completed'}
 $record.result=if($code -eq 0){'success'}else{'failure'};Append-Record $record
} catch {
 [Console]::Error.WriteLine('Reach execution failed: '+$_.Exception.Message)
 if($started){try{$record.ts=[DateTimeOffset]::Now.ToString('o');$record.phase='incomplete';$record.result='unknown';$record.exit=$null;Append-Record $record}catch{[Console]::Error.WriteLine('Final journal write failed; inspect the running record')}}
 $code=1
} finally {
 if($child){$child.Dispose()};if($claim){$claim.Dispose()}
 if($tempScript -and (Test-Path -LiteralPath $tempScript)){Remove-Item -LiteralPath $tempScript -Force -ErrorAction SilentlyContinue}
}
exit $code
