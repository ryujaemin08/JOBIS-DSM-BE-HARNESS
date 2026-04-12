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
- `fix :: (#1129) ...` 같은 type 문자열 기반 커밋
