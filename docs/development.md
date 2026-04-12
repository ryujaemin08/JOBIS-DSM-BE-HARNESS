# Development

## Build Commands
```bash
./gradlew build
./gradlew build -x test
```

## Test Commands
```bash
./gradlew test
./gradlew :jobis-application:test
./gradlew :jobis-infrastructure:test
./gradlew test --tests "FullyQualifiedTestClassName"
./gradlew test -Dspring.profiles.active=test
```

## Run Commands
```bash
./gradlew :jobis-infrastructure:bootRun
./gradlew :jobis-infrastructure:bootJar
```

## Code Quality Commands
```bash
./gradlew checkstyleMain
./gradlew checkstyleTest
./gradlew rewriteRun
./gradlew sonarqube
```

## Harness Reading Order
- 구조와 file placement 판단이 필요하면 `docs/architecture.md`
- runtime confidence 나 health 기준이 필요하면 `docs/reliability.md`
- auth, public exposure, secret handling 검토가 필요하면 `docs/security.md`
- 최종 완료 품질을 점검하려면 `docs/quality-score.md`

## Test Environment Notes
- integration test 는 `jobis-infrastructure` 중심으로 존재한다.
- integration test base class 는 `IntegrationTest` 다.
- TestContainers MySQL 을 사용한다.
- test profile 에서는 Flyway 가 꺼지고 Hibernate DDL auto 를 사용한다.

## Style Rules
- Checkstyle 이 강제된다.
- Google Java style 에 가까운 convention 을 따른다.
- maximum line length 는 180 characters 다.
- style failure 는 build failure 로 취급한다.

## Standard Feature Workflow
1. `jobis-application` 에 domain model 을 추가 또는 수정한다.
2. 필요한 `spi/` port 를 추가 또는 수정한다.
3. use case 를 추가 또는 수정한다.
4. infrastructure adapter 를 구현하거나 확장한다.
5. request/response DTO 를 추가 또는 수정한다.
6. test 를 추가 또는 수정한다.

## Database Workflow
- Flyway migration 은 `jobis-infrastructure/src/main/resources/db/migration` 아래에 둔다.
- naming format:
```text
V{version}__{description}.sql
```
- schema change 가 있다면 Flyway migration 을 같이 만드는 것이 기본이다.

## Before Finishing Work
- 가장 작은 relevant test scope 부터 실행한다.
- shared infrastructure 가 바뀌었으면 더 넓은 verification 을 실행한다.
- Java code 를 바꿨으면 style check 를 사실상 mandatory 로 본다.
- 무엇을 검증했고 무엇을 검증하지 못했는지 final report 에 명시한다.

## Harness Verification Baseline
- architecture 영향이 있는 변경이면 `docs/architecture.md` 기준으로 layer boundary 와 dependency direction 을 점검한다.
- controller, filter, auth, public endpoint 변경이면 `docs/security.md` 를 점검한다.
- startup, config, integration, messaging, external adapter 변경이면 `docs/reliability.md` 를 점검한다.
- 완료 보고 전에는 `docs/quality-score.md` 기준으로 self-check 한다.
