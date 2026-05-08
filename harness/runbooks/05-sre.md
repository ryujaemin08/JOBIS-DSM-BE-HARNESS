# 05. SRE 실행

이 문서는 runtime, health, metrics, latency 요구가 있을 때 수행하는 절차입니다.

## SRE가 필요한 경우

- 사용자가 `400ms 이하` 같은 latency 기준을 제시했습니다.
- performance 개선 작업입니다.
- startup, health, metrics, prometheus, timeout, log 안정성이 요구됩니다.
- Docker/env/runtime 설정을 바꿨습니다.

SRE 조건이 없으면 이 문서는 실행하지 않습니다. 단, QA와 `07-build-before-commit.md`는 필요한 경우 계속 수행합니다.

## 사전 조건

- `03-env-up.md`에 따라 앱이 떠 있습니다.
- QA가 필요한 API면 `04-qa.md`가 먼저 통과했습니다.
- latency 기준과 sample 수가 정해져 있습니다.

## Health 확인

```powershell
curl http://localhost:18080/actuator/health
```

성공 기준:

- status code 200
- body의 `status`가 `UP`

## Metrics 확인

```powershell
curl http://localhost:18080/actuator/metrics
```

필요하면 `http.server.requests`가 있는지 확인합니다.

```powershell
curl http://localhost:18080/actuator/metrics/http.server.requests
```

## Prometheus 확인

```powershell
curl http://localhost:18080/actuator/prometheus
```

성공 기준:

- status code 200
- `jvm_` 또는 HTTP 관련 metric이 포함됩니다.

## Latency 측정

PowerShell 예시:

```powershell
$durations = @()
1..10 | ForEach-Object {
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  curl -s -H "Authorization: Bearer <token>" "http://localhost:18080/interviews?year=2026&month=3" | Out-Null
  $sw.Stop()
  $durations += $sw.ElapsedMilliseconds
}
$sorted = $durations | Sort-Object
$index = [Math]::Min($sorted.Count - 1, [Math]::Ceiling($sorted.Count * 0.95) - 1)
$p95 = $sorted[$index]
$durations
"p95=$p95 ms"
```

기준이 `400ms 이하`이면 `p95 <= 400`이어야 합니다.

## Log 확인

앱 실행 창 또는 log 파일에서 반복 exception을 확인합니다.

```powershell
Select-String -Path harness\reports\generated\app.out.log,harness\reports\generated\app.err.log -Pattern "exception|failed to start|application run failed" -CaseSensitive:$false
```

log 파일을 따로 남기지 않았다면 앱 실행 terminal 출력에서 같은 패턴을 확인합니다.

## report 작성

결과를 아래 파일에 남깁니다.

```text
harness/reports/generated/sre-manual-summary.json
```

예시:

```json
{
  "success": true,
  "health": "UP",
  "metrics_checked": true,
  "prometheus_checked": true,
  "latency": {
    "samples_ms": [120, 132, 118],
    "p95_ms": 132,
    "p95_ms_lte": 400
  },
  "log_errors": 0
}
```

## 성공 기준

- health가 UP입니다.
- metrics 또는 prometheus 확인이 통과했습니다.
- latency 기준이 있으면 p95가 기준 이하입니다.
- 반복 exception이 없습니다.
- 결과 report를 남겼습니다.

## 실패 시 처리

- health가 DOWN이면 runtime 설정과 DB 연결을 확인합니다.
- p95가 기준을 넘으면 query, index, N+1, join, DTO mapping을 확인합니다.
- metrics가 없으면 actuator 설정을 확인합니다.
- log exception이 반복되면 구현 문제로 보고 수정합니다.
