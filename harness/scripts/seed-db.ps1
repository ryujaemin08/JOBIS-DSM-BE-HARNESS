$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$seedFile = Join-Path $repoRoot "harness\fixtures\mysql\001-login-recruitments-seed.sql"

if (-not (Test-Path $seedFile)) {
    throw "Seed file not found: $seedFile"
}

Get-Content -Raw -Path $seedFile |
    docker exec -i jobis-harness-mysql mysql -uroot -p1234 -D jobis_harness

if ($LASTEXITCODE -ne 0) {
    throw "Failed to seed harness database."
}

Write-Output "Harness DB seed applied."
