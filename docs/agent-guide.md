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

## Routing Rules

- project summary -> `docs/project-overview.md`
- architecture와 layer boundaries -> `docs/architecture.md`
- build, test, run, delivery flow -> `docs/development.md`
- reliability와 observability review -> `docs/reliability.md`
- auth, authorization, exposure review -> `docs/security.md`
- release-readiness scoring -> `docs/quality-score.md`
- issue workflow -> `docs/issue-workflow.md`
- branch와 commit workflow -> `docs/git-workflow.md`
- PR workflow -> `docs/pr-workflow.md`
- release workflow -> `docs/release-workflow.md`
- 새 API 또는 변경 API intake, QA, SRE -> `harness/README.md`, `harness/runbooks/autopilot.md`

## 유지보수 규칙

- repository convention이 바뀌면 같은 작업에서 관련 durable doc을 수정한다.
- 자주 중요한 규칙은 prose에만 두지 말고 tooling으로 승격한다.

## API Intake Rule

- 새 API 또는 변경 API에서 짧은 prompt만으로는 충분하지 않다.
- 먼저 request contract를 요구한다.
- contract가 불완전하면 빠진 정보만 질문하고 멈춘다.
- intake gate가 통과되기 전에는 새 API 또는 변경 API를 구현하지 않는다.
- API, runtime, latency, performance 작업은 먼저 `harness/runbooks/autopilot.md`를 읽는다.
- 하네스는 Markdown runbook 기반이다. 기존 JavaScript 스크립트를 실행 레이어로 쓰지 않는다.
- 코드가 바뀌었다면 QA/SRE가 필요 없어도 커밋 전 `harness/runbooks/07-build-before-commit.md`를 따른다.
- 사용자가 짧은 API 요청만 줬다면 최소한 아래 항목을 직접 질문한다.
  - path
  - method
  - authority
  - request fields
  - success response
  - failure cases
  - side effects to verify
