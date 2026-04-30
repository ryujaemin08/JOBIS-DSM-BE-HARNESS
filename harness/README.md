# JOBIS Local Harness

This harness is a local-only, public-safe runtime for validating JOBIS behavior with:

- synthetic fixtures
- Docker-managed dependencies
- request-contract-driven QA and SRE loops
- machine-readable reports
- intake gating for underspecified API requests

It is designed so a fresh agent can start from repo root, read this file plus `docs/architecture.md` and `docs/development.md`, and execute the same flow without hidden session context.

For agent completion rules and evaluator pass/fail criteria, read `harness/HARNESS_GUIDE.md` before changing API, runtime, or performance-sensitive behavior.

## Goal

The harness must not default to fixed smoke scenarios.

It must:

- decide whether harness validation is required
- validate request contract completeness before implementation
- fail fast when request contract, `SecurityConfig`, `WebAdapter`, or fixture are inconsistent
- generate QA and SRE scenarios dynamically from the target request contract
- use real HTTP calls for validation
- record endpoint, authority, token bootstrap path, and assertion results in reports

## Runtime Surface

- MySQL: Docker
- Redis: Docker
- RabbitMQ: Docker
- lightweight local mock endpoint: Docker
- app: host-side `bootRun`

## Canonical Flow

1. analyze request
2. decide whether harness is required
3. run `node harness/scripts/03-env/up.mjs` when needed
4. check request contract / fixture / scenario inputs
5. implement
6. run `node harness/scripts/04-qa/qa-loop.mjs --request <path>`  
   If `--request` is omitted, the loop auto-selects changed request contracts under `harness/requests/generated/`.
7. run `node harness/scripts/05-sre/sre-loop.mjs --request <path>` only when the request is runtime-sensitive or has explicit SRE expectations
8. summarize result
9. run `node harness/scripts/03-env/down.mjs` when needed

Once intake passes and the request contract is complete, the agent must continue through steps 4-7 without asking the user for more prompts unless there is an environment blocker that prevents the harness from running at all.

## Public-Safe Data Rule

- Never reuse real local or production JOBIS data.
- Use only synthetic fixtures.
- Harness seed data is generated dynamically per request contract and written to `harness/fixtures/generated/`.

## Request Contract

Every new or changed API must have a contract file under `harness/requests/generated/`.

Format reference: `harness/requests/sample-short-request.json`

Minimum required sections:

- `name`
- `summary`
- `method`
- `path`
- `purpose`
- `authority`
- `request`
- `responses`
- `qa_expectations`
- `harness.fixtures.seed_script`

Validate completeness:

```bash
node harness/scripts/01-intake/intake-api-request.mjs --request harness/requests/generated/<your-request>.json
```

If this fails, stop and ask only for the missing required information.

## Dynamic QA Generation

Generate a QA scenario skeleton from a complete contract:

```bash
node harness/scripts/04-qa/build-qa-scenario.mjs --request harness/requests/generated/<your-request>.json
```

Generated scenarios are written under:

- `harness/scenarios/generated/api/`

The generator checks only implementation-independent prerequisites:

1. request contract completeness
2. fixture metadata
3. auth bootstrap feasibility

It does not require the API to already exist in Java code.

Implementation-dependent checks are deferred to `qa-loop`.

Examples of automatic failure during generation:

- `fixture_failure:*`
- `intake_failure:*`

## Dynamic SRE Generation

SRE is not the default for every API.

It should run only when:

- the request is performance-sensitive
- the request explicitly declares SRE expectations

Generate an SRE scenario skeleton from a request contract:

```bash
node harness/scripts/05-sre/build-sre-scenario.mjs --request harness/requests/generated/<your-request>.json
```

Generated scenarios are written under:

- `harness/scenarios/generated/reliability/`

SRE generation checks only implementation-independent prerequisites.  
Runtime contract mismatch checks happen in `sre-loop`.

SRE validation uses:

- `/actuator/health`
- `/actuator/metrics`
- `/actuator/prometheus`
- startup logs
- latency samples and p95 threshold

If the latency target is missing or not met, SRE must fail.

## QA Loop

Run:

```bash
node harness/scripts/04-qa/qa-loop.mjs --request harness/requests/generated/<your-request>.json
```

Behavior:

- dynamically generates a scenario skeleton from the request contract
- runs architecture guard derived from `docs/architecture.md`
- before making HTTP calls, verifies request contract vs `SecurityConfig`
- before making HTTP calls, verifies request contract vs `WebAdapter`
- executes real HTTP calls
- auto-builds auth bootstrap only when `Authorization` is required
- supports `STUDENT`, `TEACHER`, `COMPANY` bootstrap through `/users/login`
- records per-step endpoint, authority, token source, status, and duration

The QA loop must not rely on a fixed scenario such as `student-login-recruitments`.

## SRE Loop

Run:

```bash
node harness/scripts/05-sre/sre-loop.mjs --request harness/requests/generated/<your-request>.json
```

Behavior:

- dynamically generates a scenario skeleton only for runtime-sensitive contracts
- runs architecture guard derived from `docs/architecture.md`
- before probing runtime, verifies request contract vs `SecurityConfig`
- before probing runtime, verifies request contract vs `WebAdapter`
- uses the same authority-aware auth bootstrap when needed
- records metrics/health/prometheus/latency/log evidence
- fails when p95 exceeds the request contract target

## Failure Rules

The harness must fail instead of silently passing when any of these happen:

- request contract is incomplete
- request contract does not match `SecurityConfig` during QA/SRE execution
- request contract does not match `WebAdapter` during QA/SRE execution
- fixture metadata is missing
- required fixture fragments are absent
- the contract requires real data but the response is empty
- SRE target is missing or not met

Mismatch handling rule:

- implementation-independent failures such as intake, fixture, and scenario generation stop immediately
- implementation-dependent failures such as `contract_security_mismatch`, `contract_web_mismatch`, startup/configuration errors, or `5xx` responses must fail fast, write a machine-readable recovery block, and continue the same stage after code fixes
- recoverable failures must include `continue_without_user: true`, `failed_stage`, `next_action`, and an exact `rerun_command`
- only environment blockers such as missing Docker, unreachable Docker daemon, or non-JOBIS process port conflicts may stop the workflow without automatic continuation

## Reports

Latest reports are written under:

- `harness/reports/generated/qa-summary.json`
- `harness/reports/generated/qa-loop-summary.json`
- `harness/reports/generated/sre-summary.json`
- `harness/reports/generated/sre-loop-summary.json`

These reports should include:

- request contract path
- called endpoint
- used authority
- token acquisition endpoint
- assertion/probe result
- latency evidence when applicable

## Current Limitation

- If the request contract describes an API that does not exist in current Java code yet, preflight generation still succeeds but QA/SRE runtime validation fails fast with a contract mismatch.
- `HARNESS_FCM_JSON={}` may still emit harmless startup noise.
- This harness is local-only; it does not validate deployed infrastructure.
