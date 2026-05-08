# 03. 로컬 환경 실행

이 문서는 Docker 의존성과 JOBIS 앱을 로컬에서 띄우는 절차입니다.

## 실행 대상

- MySQL
- Redis
- RabbitMQ
- mock-http
- JOBIS app (`:jobis-infrastructure:bootRun`)

## 환경 변수

기본값은 아래와 같이 사용합니다.

```powershell
$env:PROFILE = "harness"
$env:HARNESS_APP_PORT = "18080"
$env:HARNESS_MYSQL_PORT = "33306"
$env:HARNESS_DB_NAME = "jobis_harness"
$env:HARNESS_DB_USERNAME = "root"
$env:HARNESS_DB_PASSWORD = "1234"
$env:HARNESS_REDIS_HOST = "localhost"
$env:HARNESS_REDIS_PORT = "36379"
$env:HARNESS_REDIS_PASSWORD = "asdf"
$env:HARNESS_RABBITMQ_HOST = "localhost"
$env:HARNESS_RABBITMQ_PORT = "35672"
$env:HARNESS_RABBITMQ_USERNAME = "guest"
$env:HARNESS_RABBITMQ_PASSWORD = "guest"
$env:HARNESS_JWT_SECRET = "harness-secret-key-please-change-if-needed"
$env:HARNESS_FCM_JSON = "{}"
$env:HARNESS_SLACK_URL = "http://localhost:38080/slack/"
$env:HARNESS_SLACK_TOKEN = "noop"
$env:HARNESS_API_ACCESS_KEY = "harness-access-key"
```

## Docker 실행

이전 실행이 비정상 종료됐으면 같은 이름의 container가 남아 다음 실행을 막을 수 있습니다.
먼저 잔여 container를 확인합니다.

```powershell
docker ps -a --filter "name=jobis-harness"
```

`jobis-harness-*` container가 `Exited`, `Created`, `Restarting` 상태로 남아 있으면 하네스 container만 제거합니다.

```powershell
docker rm -f jobis-harness-mysql jobis-harness-redis jobis-harness-rabbitmq jobis-harness-mock-http
```

이 명령은 하네스 전용 container만 대상으로 합니다. 다른 프로젝트 container는 제거하지 않습니다.

```powershell
docker compose -p jobis_harness -f harness\docker-compose.harness.yml up -d mysql redis rabbitmq mock-http
```

container 상태를 확인합니다.

```powershell
docker ps --filter "name=jobis-harness"
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" jobis-harness-mysql
docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}" jobis-harness-rabbitmq
```

## 앱 실행

앱 실행 전 Gradle과 JVM 인코딩을 UTF-8로 고정합니다.
Windows 기본 인코딩이 `x-windows-949`이면 한글 문자열이 있는 Java compile이 실패할 수 있습니다.

```powershell
$env:GRADLE_OPTS = "-Dfile.encoding=UTF-8"
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8"
```

PowerShell에서 환경 변수가 앱 프로세스에 제대로 전달되지 않는 경우가 있으므로 Windows에서는 아래 `cmd /c set ... &&` 형태를 우선 사용합니다.
이 방식은 `PROFILE=harness`가 실제 `bootRun` JVM까지 전달되는 것을 확인하기 쉽습니다.

```powershell
cmd /c "set PROFILE=harness&& set SPRING_PROFILES_ACTIVE=harness&& set HARNESS_APP_PORT=18080&& set HARNESS_MYSQL_PORT=33306&& set HARNESS_DB_NAME=jobis_harness&& set HARNESS_DB_USERNAME=root&& set HARNESS_DB_PASSWORD=1234&& set HARNESS_REDIS_HOST=localhost&& set HARNESS_REDIS_PORT=36379&& set HARNESS_REDIS_PASSWORD=asdf&& set HARNESS_RABBITMQ_HOST=localhost&& set HARNESS_RABBITMQ_PORT=35672&& set HARNESS_RABBITMQ_USERNAME=guest&& set HARNESS_RABBITMQ_PASSWORD=guest&& set HARNESS_JWT_SECRET=harness-secret-key-please-change-if-needed&& set HARNESS_FCM_JSON={}&& set HARNESS_SLACK_URL=http://localhost:38080/slack/&& set HARNESS_SLACK_TOKEN=noop&& set HARNESS_API_ACCESS_KEY=harness-access-key&& set GRADLE_OPTS=-Dfile.encoding=UTF-8&& set JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8&& .\gradlew.bat :jobis-infrastructure:bootRun"
```

별도 PowerShell 창이나 background process로 실행할 때는 PID를 report에 남깁니다.

```powershell
$cmd = 'cmd /c "set PROFILE=harness&& set SPRING_PROFILES_ACTIVE=harness&& set HARNESS_APP_PORT=18080&& set HARNESS_MYSQL_PORT=33306&& set HARNESS_DB_NAME=jobis_harness&& set HARNESS_DB_USERNAME=root&& set HARNESS_DB_PASSWORD=1234&& set HARNESS_REDIS_HOST=localhost&& set HARNESS_REDIS_PORT=36379&& set HARNESS_REDIS_PASSWORD=asdf&& set HARNESS_RABBITMQ_HOST=localhost&& set HARNESS_RABBITMQ_PORT=35672&& set HARNESS_RABBITMQ_USERNAME=guest&& set HARNESS_RABBITMQ_PASSWORD=guest&& set HARNESS_JWT_SECRET=harness-secret-key-please-change-if-needed&& set HARNESS_FCM_JSON={}&& set HARNESS_SLACK_URL=http://localhost:38080/slack/&& set HARNESS_SLACK_TOKEN=noop&& set HARNESS_API_ACCESS_KEY=harness-access-key&& set GRADLE_OPTS=-Dfile.encoding=UTF-8&& set JAVA_TOOL_OPTIONS=-Dfile.encoding=UTF-8&& .\gradlew.bat :jobis-infrastructure:bootRun"'
$p = Start-Process -FilePath powershell.exe -ArgumentList @("-NoProfile", "-Command", $cmd) -WorkingDirectory (Get-Location) -WindowStyle Hidden -PassThru
$p.Id | Set-Content harness\reports\generated\app.pid
```

앱 log에서 active profile이 `harness`인지 확인합니다.
`local`로 뜨면 DB password가 달라져 `Access denied for user 'root'@'localhost'`가 발생할 수 있으므로 앱을 종료하고 위 명령으로 다시 실행합니다.

## Health check

앱이 뜬 뒤 확인합니다.

```powershell
curl http://localhost:18080/actuator/health
```

성공 예시:

```json
{
  "status": "UP"
}
```

## DB table 확인

```powershell
docker exec -i jobis-harness-mysql mysql -uroot -p1234 -D jobis_harness -e "SHOW TABLES;"
```

필요 table이 없으면 Flyway 또는 app startup log를 확인합니다.

## 성공 기준

- Docker container가 실행 중입니다.
- MySQL과 RabbitMQ health가 `healthy` 또는 `none`입니다.
- `curl /actuator/health`가 `UP`을 반환합니다.
- 필요한 DB table이 생성되어 있습니다.

## 실패 시 구분

환경 blocker:

- Docker daemon이 꺼져 있음
- 포트가 이미 사용 중
- container image pull 실패
- 이전 `jobis-harness-*` container가 남아서 container name conflict 발생
- Windows PowerShell 환경 변수가 `bootRun` JVM으로 전달되지 않음
- Windows 기본 인코딩이 `x-windows-949`로 잡혀 Java compile 실패

구현 문제:

- 앱 startup 실패
- Flyway migration 실패
- datasource 설정 오류
- actuator health가 DOWN
