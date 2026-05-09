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
- PR/release 준비도를 점수화해야 할 때만 `docs/quality-score.md`를 읽는다.
- 새 API 또는 변경 API의 intake, QA, SRE는 `harness/README.md`와 `harness/runbooks/autopilot.md`를 읽는다.

## 일반 Feature 작업 순서

1. `jobis-application`에 domain model logic을 추가하거나 수정한다.
2. `spi/`의 port를 추가하거나 수정한다.
3. use case를 추가하거나 수정한다.
4. infrastructure adapter를 구현하거나 확장한다.
5. request DTO와 response DTO를 추가하거나 수정한다.
6. 테스트를 추가하거나 수정한다.
7. 코드가 바뀌었다면 커밋 전 `harness/runbooks/07-build-before-commit.md`를 따른다.

## API 또는 Runtime 작업

- 새 API, 변경 API, request/response 변경, 권한 변경, latency/performance/runtime 요구는 `harness/runbooks/autopilot.md`를 따른다.
- `docs/development.md`는 Gradle 명령어와 일반 개발 절차의 SSOT다.
- request contract, fixture, env, QA, SRE, cleanup 순서는 하네스 runbook에만 둔다.
- 코드가 바뀌었다면 커밋 전 `harness/runbooks/07-build-before-commit.md`를 반드시 따른다.

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
