# JOBIS Agent Index

Use this file as a table of contents only.
The Markdown files under `docs/` are the SSOT for repository workflow, conventions, git rules, and review criteria.
Open the smallest matching file under `docs/` and follow that file before acting.
If this file summarizes a rule and a `docs/*.md` file gives the detailed rule, the `docs/*.md` file is authoritative.

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
- Codex native agent metadata -> `.codex/agents/*.toml`

## 구현자 / 검증자 분리 규칙
- 자세한 규칙의 SSOT는 `docs/agent-guide.md`이다.
- 코드 수정 작업은 `implementer` 역할과 `verifier` 역할을 분리한다.
- Codex native subagent를 사용할 수 있으면 `.codex/agents/implementer.toml`과 `.codex/agents/verifier.toml`을 사용한다.
- verifier가 `FAIL`을 내면 완료로 보고하지 않는다. implementer로 되돌려 수정한 뒤 다시 verifier 검증을 받는다.

## 하네스 진입 규칙
- API, request/response, authority, runtime, performance, latency 관련 요청은 `harness/runbooks/autopilot.md`가 SSOT다.
- `AGENTS.md`에는 상세 실행 순서를 반복하지 않는다. QA/SRE 여부, intake gate, fixture, env, curl, latency, cleanup 순서는 runbook을 따른다.
- 코드가 바뀐 작업은 QA/SRE 대상이 아니어도 커밋 전 `harness/runbooks/07-build-before-commit.md`를 따른다.
- 하네스 대상이 아닌 문서-only 작업이면 최종 답변에 생략 이유를 명시한다.
