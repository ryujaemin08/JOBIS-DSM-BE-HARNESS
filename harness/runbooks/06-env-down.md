# 06. 로컬 환경 종료

이 문서는 하네스 실행 후 Docker 의존성과 앱을 종료하는 절차입니다.

## 앱 종료

앱을 foreground로 실행했다면 해당 terminal에서 `Ctrl+C`로 종료합니다.

`03-env-up.md`에서 background process로 실행했다면 PID 파일을 먼저 확인합니다.

```powershell
if (Test-Path harness\reports\generated\app.pid) {
  Get-Content harness\reports\generated\app.pid
}
```

PID 파일이 있고 해당 process가 살아 있으면 process tree를 종료합니다.

```powershell
if (Test-Path harness\reports\generated\app.pid) {
  $appPid = Get-Content harness\reports\generated\app.pid
  taskkill /PID $appPid /T /F
}
```

Gradle daemon을 정리합니다.

```powershell
./gradlew --stop
```

JOBIS 앱 프로세스가 남아 있는지 확인합니다.
검색 명령을 실행하는 PowerShell 자신이 결과에 섞이지 않도록 `java.exe`와 `cmd.exe`만 대상으로 합니다.

```powershell
Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq "java.exe" -or $_.Name -eq "cmd.exe") -and
  ($_.CommandLine -match "team\.retum\.jobis\.JobisApplication" -or
   $_.CommandLine -match ":jobis-infrastructure:bootRun")
} | Select-Object ProcessId,CommandLine
```

필요하면 남은 프로세스를 종료합니다.

```powershell
taskkill /PID <pid> /T /F
```

## Docker 종료

```powershell
docker compose -p jobis_harness -f harness\docker-compose.harness.yml down -v --remove-orphans
```

container가 남아 있는지 확인합니다.

```powershell
docker ps -a --filter "name=jobis-harness"
```

`docker compose down` 이후에도 `jobis-harness-*` container가 남아 있으면 이름 충돌을 막기 위해 하네스 container만 제거합니다.

```powershell
docker rm -f jobis-harness-mysql jobis-harness-redis jobis-harness-rabbitmq jobis-harness-mock-http
```

하네스 network와 volume이 남아 있는지도 확인합니다.

```powershell
docker network ls --filter "name=jobis_harness"
docker volume ls --filter "name=jobis_harness"
```

필요하면 하네스 전용 network와 volume만 제거합니다. network는 먼저 container 수가 0인지 확인합니다.

```powershell
docker network inspect jobis_harness_default --format "{{.Name}} containers={{len .Containers}}"
docker network rm jobis_harness_default
```

이전 worktree에서 생성된 `jobis_harness_*` network가 비어 있으면 같이 제거합니다.

```powershell
docker network ls --filter "name=jobis_harness" --format "{{.Name}}" | ForEach-Object {
  $networkName = $_
  $containerCount = docker network inspect $networkName --format "{{len .Containers}}"
  if ($containerCount -eq "0") {
    docker network rm $networkName
  }
}
```

포트가 비었는지 확인합니다.

```powershell
Get-NetTCPConnection -LocalPort 18080,33306,36379,35672,35673,38080 -ErrorAction SilentlyContinue
```

## 성공 기준

- JOBIS app 프로세스가 남아 있지 않습니다.
- `jobis-harness-*` container가 남아 있지 않습니다.
- 다음 하네스 실행이 같은 포트에서 시작될 수 있습니다.

## 실패 시 처리

- container가 남으면 `docker rm -f <container>`로 정리합니다.
- volume이 꼬이면 `docker volume ls`에서 `jobis_harness` 관련 volume을 확인합니다.
- 포트가 계속 사용 중이면 해당 PID를 찾아 종료합니다.
- `docker compose down`이 network만 지우고 container를 못 지웠다면 `docker rm -f jobis-harness-*` 대상 명령을 실행합니다.
- `docker network ls --filter "name=jobis_harness"`에 빈 network가 남으면 container 수가 0인지 확인한 뒤 제거합니다.
