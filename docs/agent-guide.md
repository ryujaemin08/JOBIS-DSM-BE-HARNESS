# Agent Guide

## 목표

- `AGENTS.md`는 목차 역할을 한다.
- 오래 유지되어야 하는 repository guidance는 `docs/`와 `harness/runbooks/`에 둔다.
- 새로운 Codex 또는 Claude 세션이 숨은 맥락 없이도 이 문서만 읽고 작업 절차를 따라갈 수 있어야 한다.

## 사용 방법

- `docs/index.md`에서 시작한다.
- 작업에 맞는 가장 작은 문서를 먼저 읽는다.
- 긴 workflow rule을 다시 `AGENTS.md`에 몰아넣지 않는다.
- 반복적으로 중요한 규칙은 focused docs, scripts, tests, CI checks 중 하나로 옮긴다.
- Codex native subagent metadata는 `.codex/agents/*.toml`에 둔다.
- 코드 수정 작업은 `planner -> implementer -> verifier` 역할 분리를 기본 흐름으로 사용한다.

## Routing Rules

- project summary -> `docs/project-overview.md`
- architecture와 layer boundaries -> `docs/architecture.md`
- build, test, run, delivery flow -> `docs/development.md`
- reliability와 observability review -> `docs/reliability.md`
- auth, authorization, exposure review -> `docs/security.md`
- PR/release 준비도 점수화가 필요할 때만 -> `docs/quality-score.md`
- issue workflow -> `docs/issue-workflow.md`
- branch와 commit workflow -> `docs/git-workflow.md`
- PR workflow -> `docs/pr-workflow.md`
- release workflow -> `docs/release-workflow.md`
- 새 API 또는 변경 API intake, QA, SRE -> `harness/README.md`, `harness/runbooks/autopilot.md`

## 유지보수 규칙

- repository convention이 바뀌면 같은 작업에서 관련 durable doc을 수정한다.
- 자주 중요한 규칙은 prose에만 두지 말고 tooling으로 승격한다.

## Codex Native Agents

이 저장소는 Codex native subagent metadata를 `.codex/agents/`에 둔다.
새 세션의 agent는 아래 역할을 우선 사용한다.

- `planner`: read-only 계획 역할. 관련 `docs/*.md`와 `harness/runbooks/*.md`를 읽고 실행 계획만 만든다.
- `implementer`: 구현 역할. 작업에 맞는 SSOT 문서를 읽고 코드/테스트/문서 변경을 수행한다.
- `verifier`: read-only 검증 역할. implementer의 보고를 믿지 않고 diff, 문서, 명령 결과로 직접 검증한다.

## 구현자 / 검증자 분리

- 코드 수정 작업은 구현과 검증을 분리한다.
- 구현자는 작업 전 `docs/index.md`와 작업에 맞는 가장 작은 `docs/*.md` 또는 `harness/runbooks/*.md`를 읽는다.
- 구현자는 완료 보고에 읽은 guide 파일, 적용한 규칙, 실행한 검증 명령을 남긴다.
- 검증자는 production code, test code, docs, harness 파일을 수정하지 않는다.
- 검증자는 구현 diff가 관련 `docs/*.md`와 `harness/runbooks/*.md`를 충실히 지켰는지 확인한다.
- 검증자는 API 작업에서 request contract, fixture, QA, SRE runbook 증거를 확인한다.
- 검증자는 코드 변경 후 build/test/checkstyle 등 `docs/development.md`와 `harness/runbooks/07-build-before-commit.md` 기준을 확인한다.
- 검증자는 commit 작업에서 `docs/git-workflow.md` 형식을 확인한다.
- 검증자는 runtime, startup, env, external integration, cache, query performance 영향이 있으면 `docs/reliability.md`를 확인한다.
- 검증자는 SecurityConfig, JWT, authority, public exposure, secret, logging 영향이 있으면 `docs/security.md`를 확인한다.
- 검증자는 architecture, layer, QueryDSL, adapter 위치 영향이 있으면 `docs/architecture.md`와 `harness/runbooks/check-architecture.md`를 확인한다.
- 검증자가 `FAIL`을 내면 완료로 보고하지 않는다. 구현 단계로 되돌려 수정한 뒤 다시 검증한다.

## API Intake Rule

- API, request/response, runtime, latency, performance 작업의 상세 SSOT는 `harness/runbooks/autopilot.md`다.
- 이 문서는 intake 항목을 반복하지 않는다. request contract, 빠진 항목 질문, fixture, QA, SRE 순서는 `autopilot.md`와 numbered runbook을 따른다.
- 코드가 바뀌었다면 QA/SRE가 필요 없어도 커밋 전 `harness/runbooks/07-build-before-commit.md`를 따른다.

## Quality Score Rule

- `docs/quality-score.md`는 verifier의 기본 PASS/FAIL 기준이 아니다.
- PR 생성 전, release 준비도 판단, risky change review처럼 점수화가 명시적으로 필요할 때만 사용한다.
- 일반 구현 검증은 `verifier`가 관련 SSOT와 실행 증거를 기준으로 `PASS`, `FAIL`, `PARTIAL`을 반환한다.
