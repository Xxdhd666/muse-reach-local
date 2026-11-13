param([switch]$Browser,[switch]$Publish)
$ErrorActionPreference='Stop'
Push-Location (Join-Path $PSScriptRoot '..')
function Run([string]$exe,[string[]]$arguments){& $exe @arguments;if($LASTEXITCODE -ne 0){throw "$exe failed ($LASTEXITCODE)"}}
try {
 Run 'dotnet' @('run','--project','source/tests/UiTests.csproj')
 Run 'dotnet' @('run','--project','source/baseline-tests/ConsoleTests.csproj')
 Run 'dotnet' @('run','--project','source/reliability-tests/ReliabilityTests.csproj')
 Run 'node' @('source/tests/ui-reliability.cjs')
 $python='python';if($env:REACH_PYTHON){$python=$env:REACH_PYTHON}
 Run $python @('source/tests/transport-tests.py')
 Run 'powershell.exe' @('-NoProfile','-ExecutionPolicy','Bypass','-File','source/tests/executor-tests.ps1')
 Run 'dotnet' @('build','source/app/Reach.csproj','-c','Release')
 if($Browser){Run 'node' @('source/tests/browser-smoke.cjs')}
 if($Publish){Run 'dotnet' @('publish','source/app/Reach.csproj','-c','Release','-r','win-x64','--self-contained','false','-o','out')}
}finally{Pop-Location}
