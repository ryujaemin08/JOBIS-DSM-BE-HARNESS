$ErrorActionPreference = "Stop"

$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$composeFile = Join-Path $repoRoot "harness\docker-compose.harness.yml"
$reportDir = Join-Path $repoRoot "harness\reports\latest"
$appOutLog = Join-Path $reportDir "app.out.log"
$appErrLog = Join-Path $reportDir "app.err.log"
$pidFile = Join-Path $reportDir "app.pid"

Get-CimInstance Win32_Process |
    Where-Object {
        ($_.Name -eq "java.exe" -or $_.Name -eq "powershell.exe") -and
        ($_.CommandLine -match "team\.retum\.jobis\.JobisApplication" -or $_.CommandLine -match "JOBIS-DSM-BE.+:jobis-infrastructure:bootRun")
    } |
    ForEach-Object {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }

Start-Sleep -Seconds 2

New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
if (Test-Path $appOutLog) { Remove-Item -Force $appOutLog }
if (Test-Path $appErrLog) { Remove-Item -Force $appErrLog }

docker compose -f $composeFile up -d mysql redis rabbitmq mock-http | Out-Null

$dependencies = @(
    @{ Name = "jobis-harness-mysql"; Port = 33306; RequireHealth = $true },
    @{ Name = "jobis-harness-redis"; Port = 36379; RequireHealth = $true },
    @{ Name = "jobis-harness-rabbitmq"; Port = 35672; RequireHealth = $false },
    @{ Name = "jobis-harness-mock-http"; Port = 38080; RequireHealth = $false }
)

foreach ($dependency in $dependencies) {
    $ready = $false
    for ($i = 0; $i -lt 90; $i++) {
        try {
            $healthReady = $true
            if ($dependency.RequireHealth) {
                $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" $dependency.Name 2>$null
                $healthReady = $LASTEXITCODE -eq 0 -and ($health -eq "healthy" -or $health -eq "none")
            }

            if ($healthReady) {
                $client = New-Object System.Net.Sockets.TcpClient
                $iar = $client.BeginConnect("127.0.0.1", $dependency.Port, $null, $null)
                $success = $iar.AsyncWaitHandle.WaitOne(1000, $false)
                if ($success -and $client.Connected) {
                    $client.EndConnect($iar)
                    $client.Dispose()
                    $ready = $true
                    break
                }
                $client.Dispose()
            }
        } catch {
        }
        Start-Sleep -Seconds 1
    }

    if (-not $ready) {
        throw "Dependency [$($dependency.Name)] was not healthy and reachable on port $($dependency.Port)."
    }
}

if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
        Write-Output "Harness app already running with PID $existingPid"
        exit 0
    }
    Remove-Item -Force $pidFile
}

$gradle = Join-Path $repoRoot "gradlew.bat"
$bootCommand = @"
`$env:PROFILE='harness'
`$env:HARNESS_APP_PORT='18080'
`$env:HARNESS_MYSQL_PORT='33306'
`$env:HARNESS_DB_NAME='jobis_harness'
`$env:HARNESS_DB_USERNAME='root'
`$env:HARNESS_DB_PASSWORD='1234'
`$env:HARNESS_REDIS_HOST='localhost'
`$env:HARNESS_REDIS_PORT='36379'
`$env:HARNESS_REDIS_PASSWORD='asdf'
`$env:HARNESS_RABBITMQ_HOST='localhost'
`$env:HARNESS_RABBITMQ_PORT='35672'
`$env:HARNESS_RABBITMQ_USERNAME='guest'
`$env:HARNESS_RABBITMQ_PASSWORD='guest'
`$env:HARNESS_JWT_SECRET='harness-secret-key-please-change-if-needed'
`$env:HARNESS_FCM_JSON='{}'
`$env:HARNESS_SLACK_URL='http://localhost:38080/slack/'
`$env:HARNESS_SLACK_TOKEN='noop'
`$env:HARNESS_API_ACCESS_KEY='harness-access-key'
& '$gradle' :jobis-infrastructure:bootRun
"@

$process = Start-Process powershell -ArgumentList @("-NoProfile", "-Command", $bootCommand) -WorkingDirectory $repoRoot -RedirectStandardOutput $appOutLog -RedirectStandardError $appErrLog -PassThru
$process.Id | Set-Content -Path $pidFile -Encoding ascii

$healthUrl = "http://localhost:18080/actuator/health"
$healthy = $false
for ($i = 0; $i -lt 180; $i++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
        throw "Harness app exited early. Check $appOutLog and $appErrLog"
    }

    try {
        $response = Invoke-RestMethod -Method Get -Uri $healthUrl -TimeoutSec 2
        if ($response.status -eq "UP") {
            $healthy = $true
            break
        }
    } catch {
    }
}

if (-not $healthy) {
    throw "Harness app did not become healthy. Check $appOutLog and $appErrLog"
}

& (Join-Path $PSScriptRoot "seed-db.ps1")

Write-Output "Harness app is healthy on http://localhost:18080"
