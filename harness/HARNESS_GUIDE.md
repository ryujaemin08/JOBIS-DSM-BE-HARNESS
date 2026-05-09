# JOBIS API/Runtime 하네스 가이드

이 문서는 에이전트와 평가자가 하네스 준수 여부를 판단할 때 쓰는 기준입니다.
이 하네스는 모든 코드 변경에 대한 범용 절차가 아니라 API, request/response, authority, runtime, latency 검증 절차입니다.

하네스는 더 이상 JavaScript 실행 스크립트를 기준으로 하지 않습니다. 기준은 `harness/runbooks/`의 Markdown 문서와 그 문서에 적힌 실제 명령어 실행 결과입니다.

## 반드시 하네스를 따라야 하는 경우

다음 작업은 하네스 대상입니다.

- 새 API 추가
- 기존 API request/response 변경
- JWT, authority, SecurityConfig, 권한 규칙 변경
- WebAdapter, DTO, query parameter, path parameter 변경
- DB query 결과가 API response에 영향을 주는 변경
- Docker, env, startup, health, metrics, latency 변경
- 사용자가 `400ms` 같은 성능 기준을 제시한 작업

문서나 주석만 바꾸는 작업은 하네스를 생략할 수 있습니다. 단, 최종 답변에 생략 이유를 명시해야 합니다.

## 필수 순서

API 또는 runtime 관련 작업은 아래 순서를 따릅니다.

1. `harness/runbooks/autopilot.md`를 읽고 QA/SRE 필요 여부를 판단한다.
2. `harness/runbooks/01-intake.md`에 따라 request contract를 만든다.
3. `harness/runbooks/02-fixture-plan.md`에 따라 synthetic fixture를 준비한다.
4. 코드를 수정한다.
5. HTTP 검증이 필요하면 `harness/runbooks/03-env-up.md`에 따라 앱을 띄운다.
6. API 검증이 필요하면 `harness/runbooks/04-qa.md`를 수행한다.
7. SRE 조건이 있으면 `harness/runbooks/05-sre.md`를 수행한다.
8. 시작한 환경은 `harness/runbooks/06-env-down.md`에 따라 종료한다.
9. 코드 수정 후 커밋 전에는 `harness/runbooks/07-build-before-commit.md`를 반드시 수행한다.

## 완료 조건

성공으로 보고하려면 다음 조건을 만족해야 합니다.

- request contract가 method, path, authority, request field, success response, failure case를 포함한다.
- fixture가 필요한 경우 synthetic fixture 경로와 seed SQL이 확인됐다.
- QA가 필요한 작업에서는 실제 HTTP 요청 결과가 있다.
- SRE가 필요한 작업에서는 health, metrics 또는 latency 증거가 있다.
- 코드 수정이 있었다면 Gradle build/test가 실행됐다.
- 실패한 명령어가 있으면 원인과 다음 조치를 적었다.

## 평가자 실패 기준

평가자는 다음 경우 실패로 판단합니다.

- API 변경인데 QA를 실행하지 않았다.
- latency 요구가 있는데 SRE를 실행하지 않았다.
- 코드 수정 후 Gradle build/test를 하지 않았다.
- request contract와 SecurityConfig 권한이 다르다.
- request contract와 WebAdapter method/path/parameter가 다르다.
- response를 눈으로만 확인하고 curl 또는 HTTP 결과를 남기지 않았다.
- `harness/reports/generated/`에 결과가 없는데 성공이라고 주장한다.
- Docker, DB, env 문제를 구현 성공처럼 보고한다.

## 환경 문제와 구현 문제 구분

환경 문제 예시:

- Docker daemon이 실행되지 않음
- MySQL, Redis, RabbitMQ container가 뜨지 않음
- 포트가 다른 프로세스에 의해 이미 사용 중
- 로컬 env 값이 없음

구현 문제 예시:

- SecurityConfig 권한 누락
- WebAdapter path 또는 query parameter 불일치
- HTTP 5xx
- response field 누락
- p95 latency 기준 초과
- health check 실패

환경 문제는 blocker로 보고합니다. 구현 문제는 코드를 수정하고 같은 runbook 단계부터 다시 확인합니다.

## 최종 답변 필수 항목

하네스 대상 작업의 최종 답변에는 다음을 포함합니다.

- 읽은 runbook 목록
- 사용한 request contract 경로
- QA 필요 여부와 실행 결과
- SRE 필요 여부와 실행 결과
- Gradle build/test 결과
- 실행하지 못한 명령과 이유
- 남은 위험

runtime, 권한, latency는 실행 증거 없이 성공이라고 말하지 않습니다.
