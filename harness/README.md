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
node harness/scripts/autopilot-harness.mjs --task "add interview query api"
```

This follows:
1. analyze request
2. decide whether harness is required
3. run `up` when needed
4. check request contract / fixture / scenario inputs
5. implement
6. run `qa-loop`
7. run `sre-loop` when needed
8. summarize result
9. run `down` when needed

## Public-Safe Data Rule

- Never reuse real local or production JOBIS data.
- Use only synthetic fixtures.
- Request-driven runs use:
  - base fixture identities
  - dynamic scenario inserts generated from the request contract
  - optional dataset scaling for latency/performance work

## API Intake Gate

If a developer gives a short request such as:

- `면접일정 조회 api 작성해봐`

the harness should not jump directly to implementation.

It should first require a contract file under `harness/requests/`, then validate that required information exists.

If the task targets an existing API path or resource family, first search for an already-matching request contract under `harness/requests/` and reuse it before asking the developer for more detail.

Template:

- `harness/requests/templates/api-change-request.template.json`

Validate required information:

```bash
node harness/scripts/intake-api-request.mjs --request harness/requests/<your-request>.json
```

If fields are missing, this command returns the exact missing questions.

Try to discover an existing matching request contract first:

```bash
node harness/scripts/find-request-contract.mjs --task "GET /interviews 응답시간을 400ms 이하로 개선해줘"
```

For an existing API performance task, the preferred flow is:

```bash
node harness/scripts/find-request-contract.mjs --task "GET /interviews 응답시간을 400ms 이하로 개선해줘"
node harness/scripts/autopilot-harness.mjs --task "GET /interviews 응답시간을 400ms 이하로 개선해줘" --request harness/requests/query-interviews.json
```

If the API already satisfies the requested threshold, the harness should return the evidence and stop without forcing a code change.

Generate a first-pass QA scenario from a complete request contract:

```bash
node harness/scripts/build-qa-scenario.mjs --request harness/requests/<your-request>.json
```

That generates a scenario under:

- `harness/scenarios/api/generated/`

Generate the request-driven fixture plan:

```bash
node harness/scripts/build-fixture-plan.mjs --request harness/requests/<your-request>.json --task "improve interview query latency under 400ms"
```

This generates:

- `harness/reports/generated/fixture-plan.json`
- `harness/reports/generated/generated-fixture.sql`

The generated SQL is synthetic and built from the request contract. The planner can:

- insert only the minimum tables needed for the API family
- create target rows that match the request query/body examples
- create distractor rows for authorization and filtering checks
- scale dataset size upward for performance-oriented tasks

The runtime supports seed priority:

1. base seed
2. API bootstrap steps from `harness.bootstrap.steps`
3. direct SQL fallback when bootstrap is absent or fails

If the request contract contains:

```json
"harness": {
  "bootstrap": {
    "mode": "prefer_api",
    "fallback_allowed": true,
    "steps": [
      {
        "id": "create_notice",
        "request": {
          "method": "POST",
          "path": "/notices",
          "headers": {
            "Authorization": "Bearer {{steps.login_teacher.body.access_token}}",
            "content-type": "application/json"
          },
          "body": {
            "title": "Harness Notice",
            "content": "Synthetic bootstrap notice"
          }
        },
        "expect": {
          "status": 201
        }
      }
    ]
  }
}
```

then `up.mjs` will try those API bootstrap steps first and only use direct SQL fallback when needed.

So the intended flow becomes:

1. short prompt
2. request contract intake
3. missing-info questions
4. complete request contract
5. scenario generation
6. implementation
7. QA loop

## Hard Rule

- If the request contract is incomplete, ask only for the missing required information and stop.
- Do not implement a new or changed API before the intake gate passes.
- Do not skip directly to QA or production-code changes when the API contract is underspecified.
- If no request contract exists yet, the agent must ask for the minimum contract fields explicitly:
  - path
  - method
  - authority
  - request fields
  - success response
  - failure cases
  - side effects to verify

## QA Scenario Model

Current default:

- `harness/scenarios/api/student-login-recruitments.json`

Run directly:

```bash
node harness/scripts/run-qa.mjs --scenario harness/scenarios/api/student-login-recruitments.json
```

Or run with retry policy:

```bash
node harness/scripts/qa-loop.mjs
```

## SRE Scenario Model

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

## Current Synthetic Test Account

- account id: `harness.student.01`
- password: `HarnessPass123!`
- authority: `STUDENT`

## Current Limitation

- `HARNESS_FCM_JSON={}` means Firebase initialization may log a harmless startup parse error.
- The SRE loop evaluates post-startup logs and ignores known schema-generation noise.
- This harness is local-only; it does not validate EC2 or deployed runtime yet.
