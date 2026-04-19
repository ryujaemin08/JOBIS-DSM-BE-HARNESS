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
- For structure and placement decisions, read `docs/architecture.md`
- For runtime confidence and health checks, read `docs/reliability.md`
- For auth and exposure review, read `docs/security.md`
- For release-readiness scoring, read `docs/quality-score.md`
- For new or changed API intake and QA/SRE workflow, read `harness/README.md`

## Standard Feature Workflow
1. Add or update domain model logic in `jobis-application`
2. Add or update ports in `spi/`
3. Add or update the use case
4. Implement or extend the infrastructure adapter
5. Add or update request and response DTOs
6. Add or update tests

## New API Workflow
1. Create or update a request contract under `harness/requests/`
2. Before asking the user for a new contract, search `harness/requests/` for an existing matching contract when the request targets an existing API
3. If the task is an existing API performance improvement or response/DTO change and a matching contract already exists, reuse it and go directly to harness execution
4. Run `node harness/scripts/intake-api-request.mjs --request <path>`
5. If the contract is incomplete, ask only for the missing required information and stop
6. When complete, run `node harness/scripts/build-qa-scenario.mjs --request <path>`
7. Implement the API
8. Run `node harness/scripts/qa-loop.mjs`
9. Run `node harness/scripts/sre-loop.mjs` when the change is runtime-sensitive or API-facing

## Existing API Performance Workflow
1. Run `node harness/scripts/find-request-contract.mjs --task "<task>"`
2. Reuse the matched contract under `harness/requests/`
3. Run `node harness/scripts/autopilot-harness.mjs --task "<task>" --request <matched-request>`
4. If the target already meets the requested latency/SRE threshold, report the evidence instead of forcing a code change

## Database Workflow
- Flyway migrations live under `jobis-infrastructure/src/main/resources/db/migration`
- Naming format:
```text
V{version}__{description}.sql
```
- If schema changes, a Flyway migration is expected

## Before Finishing Work
- Run the smallest relevant verification first
- Run broader verification when shared infrastructure changed
- If Java code changed, style checks are expected
- Report what was verified and what was not verified
