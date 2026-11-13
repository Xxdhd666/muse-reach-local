$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('reach-executor-'+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($root) | Out-Null
$executor=Join-Path $PSScriptRoot '..\..\server\Invoke-ReachCommand.ps1'
$script:n=0
function Check($ok,$name){if(-not $ok){throw $name};$script:n++;Write-Output "PASS $name"}
function Run($request,$dataDir=$root) {
 $json=$request|ConvertTo-Json -Compress -Depth 5
 $b64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
 $previous=$ErrorActionPreference;$ErrorActionPreference='Continue'
 try {$output=& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $executor -RequestBase64 $b64 -DataDirectory $dataDir 2>&1;$exit=$LASTEXITCODE}
 finally {$ErrorActionPreference=$previous}
 return @{code=$exit;output=($output -join "`n")}
}
try {
 $file=Join-Path $root 'unicode.txt'
 $r=Run @{id='quotes';command="[IO.File]::WriteAllText('$file', 'a `"quote`" and ''single'''); Write-Output 'hello'";summary='quote test';kind='file-create';files=@($file);timeoutSeconds=10}
 Check ($r.code -eq 0 -and [IO.File]::ReadAllText($file) -eq 'a "quote" and ''single''') 'quotes survive without shell interpolation'
 $rows=@(Get-Content (Join-Path $root 'ops.jsonl') | ForEach-Object{$_|ConvertFrom-Json})
 Check ($rows.Count -eq 2 -and $rows[0].phase -eq 'running' -and $rows[1].result -eq 'success' -and $rows[1].id -eq 'quotes') 'started and completed records share an id'
 Check ($rows[1].cmd -eq '' -and $rows[1].files[0] -eq $file) 'raw command is private by default; declared files are recorded'
 $r=Run @{id='quotes';command="Remove-Item '$file'"}
 Check ($r.code -eq 75 -and (Test-Path $file)) 'duplicate request id cannot execute twice'
 $r=Run @{id='bad-exit';command='exit 7';timeoutSeconds=10}
 Check ($r.code -eq 7) 'nonzero process exit is preserved'
 $r=Run @{id='timeout';command='Start-Sleep -Seconds 30';timeoutSeconds=1}
 Check ($r.code -eq 124) 'timeout terminates the command and returns 124'
 $r=Run @{id='malformed';command='Write-Output ok';timeoutSeconds=0}
 Check ($r.code -ne 0) 'invalid timeout is rejected before execution'
 $blocked=Join-Path $root 'blocked';[IO.Directory]::CreateDirectory($blocked)|Out-Null
 [IO.Directory]::CreateDirectory((Join-Path $blocked 'ops.jsonl'))|Out-Null
 $sentinel=Join-Path $root 'must-not-exist'
 $r=Run @{id='no-journal';command="Set-Content '$sentinel' x"} $blocked
 Check ($r.code -ne 0 -and -not(Test-Path $sentinel)) 'unavailable journal prevents execution'
 Check ((Get-Content (Join-Path $root 'heartbeat.json') -Raw|ConvertFrom-Json).v -eq 1) 'arrival heartbeat is valid'
 Write-Output "Executor: $script:n passed"
} catch {Write-Error $_ -ErrorAction Continue;exit 1}
finally {Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue}
