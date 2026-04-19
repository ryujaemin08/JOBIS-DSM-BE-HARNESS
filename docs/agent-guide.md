# Agent Guide

## Goal
- `AGENTS.md` stays a table of contents.
- Durable repository guidance lives in `docs/`.
- A fresh Codex or Claude session should be able to follow the repository workflow from these files alone.

## How To Use
- Start from `docs/index.md`.
- Read the smallest relevant file first.
- Do not move long workflow rules back into `AGENTS.md`.
- If a workflow matters repeatedly, encode it in focused docs, scripts, tests, or CI checks.

## Routing Rules
- project summary -> `docs/project-overview.md`
- architecture and layer boundaries -> `docs/architecture.md`
- build, test, run, and delivery flow -> `docs/development.md`
- reliability and observability review -> `docs/reliability.md`
- auth, authorization, and exposure review -> `docs/security.md`
- release-readiness scoring -> `docs/quality-score.md`
- issue workflow -> `docs/issue-workflow.md`
- branch and commit workflow -> `docs/git-workflow.md`
- PR workflow -> `docs/pr-workflow.md`
- release workflow -> `docs/release-workflow.md`
- new or changed API intake plus harness workflow -> `harness/README.md`

## Maintenance Rule
- If repository conventions change, update the matching durable doc in the same task.
- If a rule matters often, promote it from prose into tooling.

## API Intake Rule
- For any new or changed API, a short prompt is not enough by itself.
- Require a request contract first.
- If the contract is incomplete, ask only for the missing required information and stop.
- Do not implement a new or changed API until the intake gate passes.
- If the user provided only a short API request, ask for the minimum contract directly:
  - path
  - method
  - authority
  - request fields
  - success response
  - failure cases
  - side effects to verify
