# PR Workflow

## PR Title Format
Use the repository emoji-based title style.

```text
emoji :: (#issue) title
```

The issue number in the PR title must match the branch issue number.

## Required Order
1. Check current branch and working tree
2. Confirm the branch has been pushed to origin
3. Confirm there is no existing PR for the same head branch
4. Prepare PR title in repository style
5. Prepare PR body using the repository template sections
6. Create the PR against `develop`
7. Set assignee and label during creation when possible

## Base and Head
- Base branch: `develop`
- Head branch: current working branch for the issue

Example:
```text
base: develop
head: fix/1129-recruitment-approved-count-join-bug
```

## PR Body Sections
Use the repository PR template and fill these sections:
- work summary
- results or screenshots when applicable
- checklist
- related issue

## PR Checklist Expectations
- the application was run, or there is a concrete reason it was not
- if schema changed, a Flyway migration exists
- if behavior changed, tests were added or updated when appropriate

## Related Issue
- The PR should resolve the issue using the repository's usual `resolved #...` form in the PR body.

## Assignee
- Default assignee: `ryujaemin08`

## Labels
- `기능 추가`
- `기능 수정`
- `리팩토링`
- `버그 수정`
- `프로젝트 세팅`

## Label Selection Guide
- new feature -> `기능 추가`
- change or improve existing behavior -> `기능 수정`
- fix broken behavior -> `버그 수정`
- restructure without intended behavior change -> `리팩토링`
- repository or initial setup -> `프로젝트 세팅`

## Pre-Create Checks
Check branch status:
```bash
git status --short --branch
git log --oneline --decorate -n 5
```

Push the branch:
```bash
git push -u origin <branch-name>
```

Check for an existing PR from the same branch:
```bash
gh pr list --repo Team-return/JOBIS-DSM-BE --head <branch-name> --state all
```

## PR Creation Command
Example:
```bash
gh pr create \
  --repo Team-return/JOBIS-DSM-BE \
  --base develop \
  --head fix/1129-recruitment-approved-count-join-bug \
  --title "🔗 :: (#1129) 선생님 모집의뢰 무페이징 승인 지원자 수 집계 오류 수정" \
  --body "<prepared body>" \
  --assignee ryujaemin08 \
  --label "버그 수정"
```

## Body Example
```md
## 작업 내용 설명
- [x] 핵심 변경 1
- [x] 핵심 변경 2

## 결과물 있으면

## 체크리스트
- [ ] 애플리케이션 구동 여부
- [ ] DDL 변경 시 Flyway 필요 여부
- [ ] 테스트 코드 추가 여부

## 관련 이슈
- resolved #1129
```

## Practical Rule
- A dirty working tree does not block PR creation if the intended changes are already committed.
- Uncommitted local files are not included in the PR unless they are committed.
