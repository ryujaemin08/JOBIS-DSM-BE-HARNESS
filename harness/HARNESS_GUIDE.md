# JOBIS Harness Guide

This document is the human and agent policy layer for the JOBIS harness.
The JavaScript files under `harness/scripts/` are the execution layer.

Agents must follow this guide before claiming success on API, runtime, or
performance-sensitive work.

## Separation Of Duties

- Markdown files define the required workflow, completion gates, and evaluator rules.
- JavaScript files execute deterministic checks, generate fixtures, call HTTP endpoints, and write reports.
- Agents may explain the JavaScript behavior in prose, but must not replace executable checks with prose-only claims.

## When The Harness Is Required

Run the harness when the task touches any of these surfaces:

- A new or changed API endpoint
- Request or response contract behavior
- Authorization, role access, or security routing
- Persistence query behavior that affects API responses
- Runtime configuration, startup, health, metrics, or latency
- Any user requirement with a concrete performance target such as `400ms`

If the task is purely documentation or comment-only work, the harness may be skipped, but the final answer must say why.

## Required Flow

For API or runtime-sensitive work, agents must use this sequence:

1. Create or update a request contract under `harness/requests/generated/`.
2. Run intake:

```bash
node harness/scripts/01-intake/intake-api-request.mjs --request harness/requests/generated/<request>.json
```

3. Run fixture planning:

```bash
node harness/scripts/02-fixture/build-fixture-plan.mjs --request harness/requests/generated/<request>.json
```

4. Implement the code change.
5. Start the harness runtime when HTTP verification is needed:

```bash
node harness/scripts/03-env/up.mjs
```

6. Run QA:

```bash
node harness/scripts/04-qa/qa-loop.mjs --request harness/requests/generated/<request>.json
```

7. Run SRE when the contract has latency or runtime expectations:

```bash
node harness/scripts/05-sre/sre-loop.mjs --request harness/requests/generated/<request>.json
```

8. Stop the harness runtime when it was started by the task:

```bash
node harness/scripts/03-env/down.mjs
```

The shortcut orchestrator may replace the manual sequence:

```bash
node harness/scripts/autopilot-harness.mjs --task "<user task>" --request harness/requests/generated/<request>.json
```

## Completion Gate

Agents must not report success unless all required gates are satisfied.

- `intake-api-request.mjs` exits `0` for the target request contract.
- `build-fixture-plan.mjs` exits `0` for the target request contract.
- `qa-loop.mjs` exits `0` for API work.
- `harness/reports/generated/qa-loop-summary.json` exists and has `success: true`.
- `sre-loop.mjs` exits `0` when latency or runtime expectations exist.
- `harness/reports/generated/sre-loop-summary.json` exists and has `success: true` when SRE is required.
- `node harness/scripts/check-architecture.mjs` exits `0`.
- Project verification such as Gradle build, test, or checkstyle exits `0` when it is relevant to the changed files.

Any non-zero command, missing report, or report with `success: false` means the task is not complete.

## Evaluator Rules

Evaluator agents must grade the task as failed when any of these are true:

- The agent claims success without listing the commands it ran.
- The agent skips QA for API behavior changes.
- The agent skips SRE for an explicit latency or runtime requirement.
- `./gradlew checkstyleMain`, `./gradlew test`, or equivalent project verification fails after the change.
- The request contract and implementation disagree on method, path, authorization, or response shape.
- The response is only asserted by manual inspection when a harness assertion could have been used.
- The final answer says the work is merge-ready while required harness reports are missing.

Evaluator agents should distinguish environment blockers from implementation failures.
Docker daemon unavailable, non-JOBIS port conflicts, and missing local infrastructure are environment blockers.
Contract mismatch, HTTP `5xx`, missing response fields, and latency threshold failures are implementation failures.

## Evidence Required In Final Answers

Final answers for harness-required work must include:

- The target request contract path
- Whether QA was required and the QA result
- Whether SRE was required and the SRE result
- The exact verification commands that passed
- Any command that could not be run and why
- Remaining risks, if any

Do not claim runtime behavior, authorization behavior, or latency compliance without command output or report evidence.
