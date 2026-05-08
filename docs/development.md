# 개발 절차

## Build 명령어

```bash
./gradlew build
./gradlew build -x test
```

## Test 명령어

```bash
./gradlew test
./gradlew :jobis-application:test
./gradlew :jobis-infrastructure:test
./gradlew test --tests "FullyQualifiedTestClassName"
./gradlew test -Dspring.profiles.active=test
```

## Run 명령어

```bash
./gradlew :jobis-infrastructure:bootRun
./gradlew :jobis-infrastructure:bootJar
```

## Code Quality 명령어

```bash
./gradlew checkstyleMain
./gradlew checkstyleTest
./gradlew rewriteRun
./gradlew sonarqube
```

## 하네스 읽는 순서

- 구조와 위치 결정을 할 때는 `docs/architecture.md`를 읽는다.
- runtime 신뢰성과 health check가 필요하면 `docs/reliability.md`를 읽는다.
- auth, authorization, exposure 검토가 필요하면 `docs/security.md`를 읽는다.
- release 준비 상태를 점검할 때는 `docs/quality-score.md`를 읽는다.
- 새 API 또는 변경 API의 intake, QA, SRE는 `harness/README.md`와 `harness/runbooks/autopilot.md`를 읽는다.

## 일반 Feature 작업 순서

1. `jobis-application`에 domain model logic을 추가하거나 수정한다.
2. `spi/`의 port를 추가하거나 수정한다.
3. use case를 추가하거나 수정한다.
4. infrastructure adapter를 구현하거나 확장한다.
5. request DTO와 response DTO를 추가하거나 수정한다.
6. 테스트를 추가하거나 수정한다.
7. 코드가 바뀌었다면 커밋 전 `harness/runbooks/07-build-before-commit.md`를 따른다.

## 새 API 작업 순서

1. `harness/requests/generated/` 아래에 request contract를 만들거나 수정한다.
2. 기존 API를 대상으로 한다면 먼저 `harness/requests/`에서 matching contract를 찾는다.
3. 기존 API performance 개선 또는 response/DTO 변경이고 matching contract가 있으면 재사용한다.
4. `harness/runbooks/01-intake.md`를 따른다.
5. contract가 불완전하면 빠진 정보만 질문하고 멈춘다.
6. `harness/runbooks/02-fixture-plan.md`를 따른다.
7. API를 구현한다.
8. `harness/runbooks/03-env-up.md`와 `harness/runbooks/04-qa.md`를 따른다.
9. latency, performance, health, metrics, runtime 요구가 있으면 `harness/runbooks/05-sre.md`를 따른다.
10. 로컬 하네스 환경을 띄웠다면 `harness/runbooks/06-env-down.md`를 따른다.
11. 코드가 바뀌었다면 커밋 전 `harness/runbooks/07-build-before-commit.md`를 반드시 따른다.

## 기존 API Performance 작업 순서

1. `harness/runbooks/autopilot.md`를 읽는다.
2. `harness/requests/`에서 matching request contract를 찾는다.
3. matching contract가 있으면 재사용하고, 없으면 `harness/requests/generated/` 아래에 만든다.
4. `harness/runbooks/03-env-up.md`, `harness/runbooks/04-qa.md`, `harness/runbooks/05-sre.md`를 따른다.
5. 대상 API가 이미 latency/SRE 기준을 만족하면 억지로 코드를 바꾸지 말고 증거를 보고한다.
6. 코드가 바뀌었다면 커밋 전 `harness/runbooks/07-build-before-commit.md`를 반드시 따른다.

## Database 작업

- Flyway migration은 `jobis-infrastructure/src/main/resources/db/migration` 아래에 둔다.
- 파일 이름 형식은 다음과 같다.

```text
V{version}__{description}.sql
```

- schema가 바뀌면 Flyway migration이 필요하다.

## 작업 종료 전 확인

- 가장 작은 관련 검증을 먼저 실행한다.
- shared infrastructure가 바뀌었다면 더 넓은 검증을 실행한다.
- Java 코드가 바뀌었다면 style check가 필요하다.
- 코드가 바뀌었다면 `harness/runbooks/07-build-before-commit.md`가 필수다.
- 무엇을 검증했고 무엇을 검증하지 못했는지 보고한다.
