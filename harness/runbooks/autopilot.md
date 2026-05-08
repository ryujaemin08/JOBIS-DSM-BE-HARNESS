# 하네스 자동 판단 Runbook

이 문서는 에이전트가 작업 시작 시 어떤 하네스 절차를 따라야 하는지 판단하는 기준입니다.

이 문서는 기존 자동 실행기를 대체합니다. 에이전트는 이 문서를 읽고 필요한 runbook을 직접 수행합니다.

## 1단계: 작업 분류

다음 중 하나라도 해당하면 하네스 대상입니다.

- API 추가 또는 변경
- request/response 변경
- authority, JWT, SecurityConfig 변경
- WebAdapter, DTO, query parameter, path parameter 변경
- DB query 결과가 API response에 영향을 줌
- runtime, Docker, env, health, metrics 변경
- latency 또는 performance 요구가 있음

해당하지 않는 예:

- 오타 수정
- 주석 수정
- 문서만 수정

## 2단계: QA 필요 여부

QA가 필요한 경우:

- API 동작이 바뀜
- 권한이 바뀜
- response shape이 바뀜
- query 조건이 바뀜

QA가 필요 없을 수 있는 경우:

- 문서만 수정
- build 설정 설명만 수정
- 코드 동작과 무관한 formatting

## 3단계: SRE 필요 여부

SRE가 필요한 경우:

- 사용자가 `400ms 이하`, `1초 이하` 같은 기준을 줌
- performance 작업
- startup, health, metrics, prometheus, timeout, log 변경
- Docker/env/runtime 변경

SRE가 필요 없는 경우:

- 단순 CRUD response field 추가
- 문서 수정
- test-only 수정

## 4단계: 실행 경로

API 작업:

```text
01-intake.md
02-fixture-plan.md
03-env-up.md
04-qa.md
06-env-down.md
07-build-before-commit.md
```

API + latency 작업:

```text
01-intake.md
02-fixture-plan.md
03-env-up.md
04-qa.md
05-sre.md
06-env-down.md
07-build-before-commit.md
```

runtime-only 작업:

```text
03-env-up.md
05-sre.md
06-env-down.md
07-build-before-commit.md
```

문서-only 작업:

```text
07-build-before-commit.md 생략 가능
```

단, 문서-only라고 최종 답변에 명시합니다.

## 5단계: 중단 기준

다음 경우에는 사용자에게 blocker를 보고합니다.

- Docker daemon이 없음
- 필수 env를 알 수 없음
- 포트 충돌을 안전하게 해결할 수 없음
- request contract 필수 정보가 없음

그 외 구현 문제는 수정 후 같은 runbook 단계부터 다시 실행합니다.
