$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$composeFile = Join-Path $repoRoot "harness\docker-compose.harness.yml"
$reportDir = Join-Path $repoRoot "harness\reports\latest"
$pidFile = Join-Path $reportDir "app.pid"

Get-CimInstance Win32_Process |
    Where-Object {
        ($_.Name -eq "java.exe" -or $_.Name -eq "powershell.exe") -and
        ($_.CommandLine -match "team\.retum\.jobis\.JobisApplication" -or $_.CommandLine -match "JOBIS-DSM-BE.+:jobis-infrastructure:bootRun")
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

if (Test-Path $pidFile) {
    $appPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($appPid -and (Get-Process -Id $appPid -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $appPid -Force
    }
    Remove-Item -Force $pidFile
}

docker compose -f $composeFile down -v | Out-Null
Write-Output "Harness app and dependencies stopped."
