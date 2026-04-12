$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$reportDir = Join-Path $repoRoot "harness\reports\latest"
$summaryFile = Join-Path $reportDir "qa-summary.json"
$scenarioPath = "harness/scenarios/api/student-login-recruitments.yaml"
$gitSha = (git -C $repoRoot rev-parse --short HEAD).Trim()
$timestamp = (Get-Date).ToUniversalTime().ToString("o")

New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

$loginBody = @{
    account_id = "harness.student.01"
    password = "HarnessPass123!"
    platform_type = "WEB"
    device_token = "harness-device-token"
} | ConvertTo-Json

$loginResponse = Invoke-RestMethod -Method Post -Uri "http://localhost:18080/users/login" -ContentType "application/json" -Body $loginBody -TimeoutSec 10

if (-not $loginResponse.access_token) {
    throw "Login response did not contain access_token."
}

$headers = @{
    Authorization = "Bearer $($loginResponse.access_token)"
}

$recruitmentsResponse = Invoke-RestMethod -Method Get -Uri "http://localhost:18080/recruitments/student" -Headers $headers -TimeoutSec 10

if (-not $recruitmentsResponse.recruitments) {
    throw "Recruitments response did not contain recruitments."
}

if ($recruitmentsResponse.recruitments.Count -lt 1) {
    throw "Recruitments response contained no items."
}

$summary = [ordered]@{
    scenario = @{
        name = "student-login-recruitments"
        path = $scenarioPath
        git_sha = $gitSha
        generated_at = $timestamp
    }
    login = @{
        success = $true
        authority = $loginResponse.authority
        platform_type = $loginResponse.platform_type
    }
    recruitments = @{
        success = $true
        count = $recruitmentsResponse.recruitments.Count
        first_company_name = $recruitmentsResponse.recruitments[0].company_name
        first_status = $recruitmentsResponse.recruitments[0].status
    }
} | ConvertTo-Json -Depth 6

$summary | Set-Content -Path $summaryFile -Encoding UTF8
Write-Output $summary
