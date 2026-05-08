# JOBIS 로컬 하네스

이 하네스는 JOBIS API 변경을 로컬에서 확인하기 위한 문서 기반 실행 절차입니다.

이전 구조처럼 JavaScript 스크립트를 실행하지 않습니다. 에이전트와 개발자는 `harness/runbooks/`의 Markdown 문서를 읽고, 문서에 적힌 순서와 명령어를 직접 실행합니다.

## 목표

- 새 API 또는 변경된 API가 request contract와 맞는지 확인한다.
- 실제 앱을 Docker 의존성과 함께 띄운 뒤 HTTP 요청으로 QA를 수행한다.
- latency, health, metrics 같은 runtime 요구가 있을 때만 SRE 절차를 수행한다.
- 실제 데이터나 운영 데이터를 쓰지 않고 synthetic fixture만 사용한다.
- 결과는 `harness/reports/generated/` 아래에 JSON 또는 실행 로그로 남긴다.
- 코드 수정 후 커밋 전에는 QA/SRE 필요 여부와 관계없이 Gradle build/test를 반드시 수행한다.

## 폴더 역할

```text
harness/
  README.md
  HARNESS_GUIDE.md
  runbooks/
    01-intake.md
    02-fixture-plan.md
    03-env-up.md
    04-qa.md
    05-sre.md
    06-env-down.md
    07-build-before-commit.md
    autopilot.md
    check-architecture.md
  requests/
  fixtures/
  scenarios/
  reports/
```

## 기본 실행 순서

1. `harness/runbooks/autopilot.md`를 읽고 하네스가 필요한 작업인지 판단한다.
2. API 작업이면 `harness/runbooks/01-intake.md`에 따라 request contract를 준비한다.
3. fixture가 필요하면 `harness/runbooks/02-fixture-plan.md`에 따라 synthetic fixture를 준비한다.
4. HTTP 검증이 필요하면 `harness/runbooks/03-env-up.md`에 따라 Docker 의존성과 앱을 띄운다.
5. API 동작 검증은 `harness/runbooks/04-qa.md`에 따라 수행한다.
6. latency 또는 runtime 요구가 있을 때만 `harness/runbooks/05-sre.md`를 수행한다.
7. 시작한 환경은 `harness/runbooks/06-env-down.md`에 따라 종료한다.
8. 코드 변경 후 커밋 전에는 항상 `harness/runbooks/07-build-before-commit.md`를 수행한다.

## QA 실행 조건

QA는 다음 작업에서 필요합니다.

- 새 API 추가
- 기존 API request/response 변경
- 권한, JWT, SecurityConfig 변경
- WebAdapter, DTO, query parameter, path parameter 변경
- DB query 결과가 API response에 영향을 주는 변경

문서 수정만 한 경우 QA는 생략할 수 있습니다. 단, 최종 보고에 생략 이유를 적어야 합니다.

## SRE 실행 조건

SRE는 기본값이 아닙니다. 다음 조건에서만 실행합니다.

- 사용자가 `400ms` 같은 latency 기준을 제시한 경우
- health, metrics, prometheus, startup, log, timeout 요구가 있는 경우
- performance 개선 작업인 경우
- runtime 설정이나 Docker/env 변경이 있는 경우

SRE가 필요 없는 API 작업이면 `04-qa.md`까지만 수행하고, `07-build-before-commit.md`는 여전히 수행합니다.

## 데이터 규칙

- 운영 DB, 로컬 개인 DB, 실제 사용자 데이터를 사용하지 않습니다.
- fixture는 synthetic data만 사용합니다.
- seed SQL은 `harness/fixtures/generated/` 또는 request contract에 명시된 경로에 둡니다.
- fixture를 넣기 전에는 삭제 대상 ID와 INSERT 대상 table을 문서로 확인합니다.

## 완료 증거

최종 답변에는 다음을 포함해야 합니다.

- 사용한 request contract 경로
- QA 필요 여부와 결과
- SRE 필요 여부와 결과
- 앱을 띄운 명령어와 health check 결과
- 실행한 curl 또는 HTTP 요청
- 실행한 Gradle build/test 명령어
- 실패했거나 실행하지 못한 명령어와 이유
- 남은 위험

## 한계

- 이 구조는 문서 기반 runbook입니다. 자동 스크립트처럼 pass/fail을 계산하지 않습니다.
- 강제성은 에이전트가 문서를 따르는 것과 Git hook/CI 검증에 의존합니다.
- 문서 절차를 따르지 않은 수동 주장만으로는 QA, SRE, latency 충족을 인정하지 않습니다.
