# Git Workflow

## Branch Creation Rule
- When the user asks to create a branch, do not create the branch immediately.
- First search for a matching GitHub issue.
- If there is no matching issue, create one.
- Then create the branch using that issue number.
- In this repository, a feature/fix/refactor branch without an issue number is considered wrong.

## Required Order
1. Understand the task
2. Search existing issues
3. Create issue if needed
4. Create branch from issue number
5. Start implementation

## Branch Naming
```text
feat/{issue}-description
fix/{issue}-description
refactor/{issue}-description
```

## Examples
```text
feat/1082-interview-document-number-crud
fix/1129-recruitment-approved-count-join-bug
refactor/1015-review-option-api
```

## Commit Rules
- Use a single-line commit message only
- Do not write a commit body
- The issue number in the commit message must match the issue number in the current branch name
- Do not add `Co-Authored-By`
- Do not add `Generated with Claude Code`
- Use the repository emoji-based commit prefix format

## Commit Format
```text
emoji :: (#issue) title
```

## Commit Emoji Meanings
- `✨`
  - new capability or feature work
- `🐛`
  - bug fix or correctness repair
- `🛠`
  - refactor or structural cleanup without intended behavior change
- `📦`
  - build or dependency change
- `🔥`
  - removal work
- `📝`
  - documentation-only change
- `🎨`
  - formatting-only or stylistic cleanup

## Valid Examples
```text
✨ :: (#1082) 면접 일정 조회 API 추가
🐛 :: (#1129) 선생님 모집의뢰 무페이징 승인 지원자 수 집계 오류 수정
🛠 :: (#1015) review option API 구조 단순화
```

## Invalid Examples
- branch without issue number
- commit with a body
- commit using an issue number that does not match the current branch

## Push Remote Routing
- Never push unless the user explicitly asks you to push.
- Before every push, read this file and follow the remote routing rules.
- Inspect the branch commits before pushing.
- If the branch commits contain harness-related changes, push to the `harness` remote.
- Harness-related changes include files under `harness/`, `.codex/`, `.omx/`, `AGENTS.md`, `docs/git-workflow.md`, or docs that describe harness behavior.
- If the branch commits do not contain harness-related changes, push to the `origin` remote.
- Do not push harness-related changes to `origin`.
- Do not push normal upstream repository work to `harness`.

## Push Commands
```text
git push harness <branch-name>
git push origin <branch-name>
```

## Pre-push Hook Requirement
- A local `pre-push` hook must enforce this workflow before allowing push.
- If harness-related changes are being pushed to a remote other than `harness`, the hook must fail.
- If the `harness` remote is missing, add it before pushing harness-related work:

```text
git remote add harness https://github.com/ryujaemin08/JOBIS-DSM-BE-HARNESS.git
```
- `fix :: (#1129) ...` 같은 type 문자열 기반 커밋
