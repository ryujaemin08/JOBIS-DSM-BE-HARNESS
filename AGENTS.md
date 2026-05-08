# JOBIS Agent Index

Use this file as a table of contents only.
Open the smallest matching file under `docs/` and follow that file.

## Start
- `docs/index.md`

## Docs Authoring Rule
- When creating or updating any `docs/*.md` file, write it so a fresh agent in another session can execute the same workflow correctly on the first read, without relying on hidden context, memory, or `CLAUDE.md`.
- Include exact order, decision points, required metadata, concrete commands when useful, and the expected final state.

## Backup Rule
- If `AGENTS.md` changes, back it up to `C:\Users\user\Desktop\jobis\agent-files\codex`.
- If any file under `docs/` is added, changed, or removed, back up the entire `docs/` folder to `C:\Users\user\Desktop\jobis\agent-files\codex`.
- Treat this backup step as required completion work for `AGENTS.md` and `docs/` changes.

## By Task
- project summary -> `docs/project-overview.md`
- architecture, layering, QueryDSL conventions -> `docs/architecture.md`
- build, test, run, style -> `docs/development.md`
- 새 API 또는 변경 API workflow, request contract intake, 하네스 QA/SRE -> `harness/README.md`
- issue creation and normalization -> `docs/issue-workflow.md`
- branch, issue, commit -> `docs/git-workflow.md`
- PR title, template, labels, assignee -> `docs/pr-workflow.md`
- release flow -> `docs/release-workflow.md`
- agent usage rules -> `docs/agent-guide.md`

## 하네스 진입 규칙
- API, performance, latency, runtime 관련 요청은 가장 먼저 `harness/runbooks/autopilot.md`를 읽는다.
- 하네스는 Markdown runbook 기반이다. 기존 JavaScript 스크립트를 실행 레이어로 쓰지 않는다.
- runbook이 QA 필요라고 판단하면 `harness/runbooks/01-intake.md`, `02-fixture-plan.md`, `03-env-up.md`, `04-qa.md`를 순서대로 따른다.
- runbook이 SRE 필요라고 판단하면 `harness/runbooks/05-sre.md`도 따른다.
- 코드가 바뀐 작업은 QA/SRE가 필요 없어도 커밋 전에 반드시 `harness/runbooks/07-build-before-commit.md`를 따른다.
- 새 API는 request contract가 QA 가능한 수준으로 완성되기 전까지 production code를 작성하지 않는다.

## API Intake 규칙
- 사용자가 API 생성 또는 변경을 요청했는데 request contract가 불완전하면 바로 구현하지 않는다.
- 먼저 `harness/requests/generated/` 아래에 request contract를 요구한다.
- 그 다음 `harness/runbooks/01-intake.md`를 따른다.
- contract가 불완전하면 빠진 항목만 질문하고 멈춘다.
- 새 API 또는 변경 API는 request contract가 QA 가능한 수준이 되기 전까지 production code를 작성하지 않는다.
- request contract가 완성되면 `harness/runbooks/02-fixture-plan.md`와 `harness/runbooks/04-qa.md`를 따른다.
- 사용자가 짧은 API prompt만 줬고 request contract가 없으면 최소한 아래 항목을 질문한다.
  - endpoint path
  - HTTP method
  - caller authority
  - request fields
  - success status/body
  - failure cases
  - side effects that must be verified
