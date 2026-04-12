# JOBIS Local Harness

This harness is a local-only, public-safe runtime for validating JOBIS behavior with:

- synthetic fixtures
- Docker-managed dependencies
- scenario-driven QA and SRE loops
- machine-readable reports
- API-request intake gating for underspecified prompts

It stays outside the existing `.java` product code path.

## Goal

The harness should not be just a fixed smoke script.

It should support:

- QA loop
  - validate whether an added or changed API works against explicit requirements
- SRE loop
  - collect health, log, metrics, and latency evidence
  - support checks such as "this API must stay under 400ms"
- API intake gate
  - if the request is too short, block scenario generation until required contract information exists

## Runtime Surface

- MySQL: Docker
- Redis: Docker
- RabbitMQ: Docker
- lightweight local mock endpoint: Docker
- app: host-side `bootRun`

## Cross-Platform Commands

Start dependencies, app, and seed:

```bash
node harness/scripts/up.mjs
```

Run the QA feedback loop:

```bash
node harness/scripts/qa-loop.mjs
```

Run the SRE feedback loop:

```bash
node harness/scripts/sre-loop.mjs
```

Stop app and dependencies:

```bash
node harness/scripts/down.mjs
```

Autopilot-style lifecycle orchestration:

```bash
node harness/scripts/autopilot-harness.mjs --task "면접일자 수정 API 추가"
```

This follows:
1. 요청 분석
2. 하네스 필요 여부 판단
3. 필요하면 up
4. fixture/scenario/request-contract 확인
5. 구현 이후 QA loop
6. 필요하면 SRE loop
7. 결과 정리
8. 필요하면 down

## Public-Safe Data Rule

- Never reuse real local or production JOBIS data.
- Use only synthetic fixtures.
- The current seed is in:
  - `harness/fixtures/mysql/001-login-recruitments-seed.sql`

## Scenario Model

### QA Scenario

Current default:

- `harness/scenarios/api/student-login-recruitments.json`

This file defines:

- sequential HTTP steps
- request body and headers
- dependency on prior step outputs
- expected status
- required response paths
- equality assertions
- minimum item assertions

Run directly:

```bash
node harness/scripts/run-qa.mjs --scenario harness/scenarios/api/student-login-recruitments.json
```

Or run with retry policy:

```bash
node harness/scripts/qa-loop.mjs
```

### SRE Scenario

Current default:

- `harness/scenarios/reliability/startup-health.json`

This file defines probes for:

- `/actuator/health`
- `/actuator/metrics`
- `/actuator/prometheus`
- post-startup log signal
- repeated latency sampling on a target API

Run directly:

```bash
node harness/scripts/run-sre.mjs --scenario harness/scenarios/reliability/startup-health.json
```

Or run with retry policy:

```bash
node harness/scripts/sre-loop.mjs
```

## Feedback Loop Model

### QA Loop

The QA loop does:

1. run scenario
2. classify failure
3. retry when appropriate
4. stop after repeated same-class failure
5. emit loop report

Outputs:

- `harness/reports/latest/qa-summary.json`
- `harness/reports/latest/qa-loop-summary.json`

### SRE Loop

The SRE loop does:

1. run health / metrics / latency / log probes
2. classify failure
3. retry when appropriate
4. stop after repeated same-class failure
5. emit loop report

Outputs:

- `harness/reports/latest/sre-summary.json`
- `harness/reports/latest/sre-loop-summary.json`

## API Intake Gate

If a developer gives a short request such as:

- "면접일자 수정하는 api 만들어줘"

the harness should not jump directly to QA.

It should first require a contract file under `harness/requests/`, then validate that required information exists.

Template:

- `harness/requests/templates/api-change-request.template.json`

Validate required information:

```bash
node harness/scripts/intake-api-request.mjs --request harness/requests/<your-request>.json
```

If fields are missing, this command returns the exact missing questions.

Generate a first-pass QA scenario from a complete request contract:

```bash
node harness/scripts/build-qa-scenario.mjs --request harness/requests/<your-request>.json
```

That generates a scenario under:

- `harness/scenarios/api/generated/`

So the intended flow becomes:

1. short prompt
2. request contract intake
3. missing-info questions
4. complete request contract
5. scenario generation
6. implementation
7. QA loop

If the task is short or underspecified, the intake gate is the first stop.
If the task is runtime-sensitive or API-facing, the autopilot harness wrapper should route the task into QA and optionally SRE automatically.

## Current Synthetic Test Account

- account id: `harness.student.01`
- password: `HarnessPass123!`
- authority: `STUDENT`

## Current Limitation

- `HARNESS_FCM_JSON={}` means Firebase initialization may log a harmless startup parse error.
- The SRE loop evaluates post-startup logs and ignores known schema-generation noise.
- This harness is local-only; it does not validate EC2 or deployed runtime yet.
