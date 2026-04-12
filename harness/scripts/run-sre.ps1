$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$reportDir = Join-Path $repoRoot "harness\reports\latest"
$appOutLog = Join-Path $reportDir "app.out.log"
$appErrLog = Join-Path $reportDir "app.err.log"
$summaryFile = Join-Path $reportDir "sre-summary.json"
$scenarioPath = "harness/scenarios/reliability/startup-health.yaml"
$gitSha = (git -C $repoRoot rev-parse --short HEAD).Trim()
$timestamp = (Get-Date).ToUniversalTime().ToString("o")

New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$health = Invoke-RestMethod -Method Get -Uri "http://localhost:18080/actuator/health" -TimeoutSec 10
if ($health.status -ne "UP") {
    throw "Health endpoint status was not UP."
}

$logText = ""
if (Test-Path $appOutLog) {
    $logText += Get-Content -Path $appOutLog -Raw
}
if (Test-Path $appErrLog) {
    $logText += "`n"
    $logText += Get-Content -Path $appErrLog -Raw
}

$startupMarker = "Started JobisApplication"
$markerIndex = $logText.LastIndexOf($startupMarker)
if ($markerIndex -ge 0) {
    $logText = $logText.Substring($markerIndex)
}

$noisePatterns = @(
    "GenerationTarget encountered exception accepting command",
    "CommandAcceptanceException",
    "Table 'jobis_harness\.[^']+' doesn't exist"
)

foreach ($pattern in $noisePatterns) {
    $logText = [regex]::Replace($logText, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

$exceptionMatches = [regex]::Matches($logText, "(?im)exception|failed to start|application run failed")
$repeatedExceptions = $exceptionMatches.Count -gt 1

if ($repeatedExceptions) {
    throw "Repeated exception-like log patterns were found in harness app logs."
}

$summary = [ordered]@{
    scenario = @{
        name = "startup-health"
        path = $scenarioPath
        git_sha = $gitSha
        generated_at = $timestamp
    }
    health = @{
        success = $true
        status = $health.status
    }
    logs = @{
        repeated_exception_patterns = $exceptionMatches.Count
        success = -not $repeatedExceptions
    }
} | ConvertTo-Json -Depth 6

$summary | Set-Content -Path $summaryFile -Encoding UTF8
Write-Output $summary
