# Issue Workflow

## Goal
- When work starts from an issue-driven branch request, create or reuse a GitHub issue in the repository's normal style.
- The issue should be usable as the source for branch naming, commit numbering, and PR linking.

## Required Order
1. Understand the task
2. Search for an existing matching open issue
3. Reuse it if it already covers the task
4. If not, create a new issue
5. Immediately normalize the issue metadata and body
6. Create the branch with that issue number

## Search First
- Before creating a new issue, search the repository for similar open issues.
- Reuse an existing issue when the title and intended fix clearly match.
- Do not create duplicate issues for the same bug or feature request.

Example:
```bash
gh issue list --repo Team-return/JOBIS-DSM-BE --state open --search "querydsl join bug" --limit 20
```

## Template and Shape
- Match the repository's existing issue style.
- For bug work, follow the bug issue template shape.
- The body should be short and direct, not a long incident report.
- Prefer the existing pattern:

```md
### Describe

- first point
- second point
- third point
```

## Labels
- Use the matching repository label.
- Common choices:
  - bug fix -> `버그 수정`
  - feature work -> `기능 추가`
  - behavior update -> `기능 수정`
  - structure cleanup -> `리팩토링`

## Assignee
- Assign the issue to your own GitHub account when you create or normalize it.
- In this repository, the default working assignee is `ryujaemin08`.

Example:
```bash
gh issue edit <number> --repo Team-return/JOBIS-DSM-BE --add-assignee ryujaemin08
```

## Issue Type
- This repository has GitHub issue types.
- Available types include:
  - `Task`
  - `Bug`
  - `Feature`
- For bug-fix work, the issue type should be `Bug`.
- Setting the label alone is not the same thing as setting the GitHub issue type.

## Title Style
- Keep the title concise and task-oriented.
- Titles usually do not include prefixes like `[Bug]`.
- Match the existing repository tone:
  - `모집의뢰서 등록 버그 수정`
  - `기존 지원반려, 반려사유 api 로 되돌리기`

## Body Writing Rules
- Use plain, readable Korean
- Avoid broken shell-escaped strings
- Wrap endpoint paths and field names in backticks
- Mention user-visible or data-visible impact
- Keep the body close to execution intent, not implementation trivia

Good example:
```md
### Describe

- `/recruitments/teacher/no-page` 조회에서 승인 지원자 수가 공고별로 집계되지 않는 문제 수정
- QueryDSL 조인 조건 누락으로 paged 조회와 unpaged 조회의 `application_approved_count` 값이 다르게 내려오는 문제 수정
- `/recruitments/file` 엑셀 출력이 동일 조회를 재사용하므로 함께 정합성 맞추기
```

## Normalization Checklist
- matching issue confirmed or newly created
- title follows repository style
- correct label added
- self assigned
- correct GitHub issue type set
- body uses `### Describe` and short bullet points
- endpoint names and response fields are quoted with backticks

## Useful Commands

Create:
```bash
gh issue create --repo Team-return/JOBIS-DSM-BE --title "..." --body "..." --label "버그 수정" --assignee "@me"
```

View:
```bash
gh issue view <number> --repo Team-return/JOBIS-DSM-BE
gh issue view <number> --repo Team-return/JOBIS-DSM-BE --json title,body,labels,assignees,url
```

Edit:
```bash
gh issue edit <number> --repo Team-return/JOBIS-DSM-BE --title "..."
gh issue edit <number> --repo Team-return/JOBIS-DSM-BE --body "..."
gh issue edit <number> --repo Team-return/JOBIS-DSM-BE --add-assignee ryujaemin08
```

Search:
```bash
gh issue list --repo Team-return/JOBIS-DSM-BE --state open --search "..."
```

## GitHub Issue Type Via GraphQL
- `gh issue create` and `gh issue edit` handle title/body/labels/assignees well.
- GitHub issue type may need GraphQL.
- Workflow:
  1. fetch the issue node id
  2. fetch available issue types
  3. call `updateIssue` with `issueTypeId`

Example:
```bash
gh api graphql -f query='query($owner:String!, $name:String!, $number:Int!) { repository(owner:$owner, name:$name) { issue(number:$number) { id title } issueTypes(first:20) { nodes { id name } } } }' -f owner='Team-return' -f name='JOBIS-DSM-BE' -F number=1129

gh api graphql -f query='mutation($id:ID!, $issueTypeId:ID!) { updateIssue(input:{id:$id, issueTypeId:$issueTypeId}) { issue { title issueType { name } } } }' -f id='ISSUE_NODE_ID' -f issueTypeId='BUG_TYPE_ID'
```

## Branch Relationship
- After the issue is correct, create the branch using the issue number.
- Branch naming rules are documented in `docs/git-workflow.md`.
