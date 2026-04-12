# Agent Guide

## Goal
- `AGENTS.md` 는 table of contents 역할만 유지한다.
- 오래 유지해야 하는 repository guidance 는 `docs/` 아래에 둔다.
- 새로운 Codex 세션이든, Claude 같은 다른 agent 세션이든 `docs/` 만 읽고 기본 작업을 진행할 수 있어야 한다.

## How To Use
- 항상 `docs/index.md` 에서 시작한다.
- 현재 task 에 맞는 가장 작은 문서만 연다.
- 긴 지침을 다시 `AGENTS.md` 로 밀어 넣지 않는다.
- 반복적으로 중요한 workflow 가 생기면 `docs/` 에 focused file 로 추가하거나 갱신한다.

## Routing Rules
- project summary -> `docs/project-overview.md`
- architecture, layer boundary, QueryDSL placement -> `docs/architecture.md`
- build, test, run, style -> `docs/development.md`
- reliability, health check, observability review -> `docs/reliability.md`
- auth, authorization, secret handling, exposure review -> `docs/security.md`
- quality scoring, release-readiness heuristic -> `docs/quality-score.md`
- issue creation and normalization -> `docs/issue-workflow.md`
- branch, issue, commit -> `docs/git-workflow.md`
- PR workflow -> `docs/pr-workflow.md`
- release task -> `docs/release-workflow.md`

## Maintenance Rule
- repository convention 이 바뀌면 해당 `docs/*.md` 를 함께 갱신한다.
- 반복해서 중요한 규칙이면 prose-only guidance 로만 두지 말고 test, CI, script, verification command 로 승격하는 것을 우선 검토한다.
