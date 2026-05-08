# 01. Request Contract 확인

이 문서는 API 작업을 시작하기 전에 request contract가 충분한지 확인하는 절차입니다.

## 언제 실행하나

- 새 API를 만들 때
- 기존 API의 request 또는 response를 바꿀 때
- authority, JWT, SecurityConfig, WebAdapter가 바뀔 때
- 성능 개선 대상 API를 특정해야 할 때

## 준비할 파일

request contract는 아래 위치에 둡니다.

```text
harness/requests/generated/<api-name>.json
```

참고 파일:

```text
harness/requests/sample-short-request.json
```

## 필수 항목

아래 항목이 없으면 구현을 시작하지 않습니다.

- `name`
- `summary`
- `method`
- `path`
- `purpose`
- `authority`
- `request.headers`
- `request.query_params`
- `request.path_params`
- `request.body.fields`
- `responses.success.status`
- `responses.success.body`
- `responses.failures`
- `qa_expectations.success_assertions`
- `qa_expectations.negative_assertions`
- `harness.fixtures.seed_script`

빈 배열이 가능한 항목도 있습니다. 예를 들어 query parameter가 없는 API는 `request.query_params: []`처럼 명시합니다.

## 수동 확인 순서

1. 사용자 요청에서 endpoint, method, authority를 확인합니다.
2. request field와 response field를 contract에 적습니다.
3. 실패 case를 적습니다.
4. QA에서 검증할 assertion을 구조화합니다.
5. fixture가 필요하면 seed SQL 경로를 적습니다.
6. 누락된 항목이 있으면 구현하지 말고 사용자에게 누락 항목만 질문합니다.

## 확인 명령어

request contract 파일 목록을 확인합니다.

```powershell
Get-ChildItem harness\requests\generated
```

특정 contract 내용을 확인합니다.

```powershell
Get-Content harness\requests\generated\<api-name>.json
```

JSON 문법을 확인합니다.

```powershell
python -m json.tool harness\requests\generated\<api-name>.json
```

Python이 없으면 PowerShell로 확인합니다.

```powershell
Get-Content harness\requests\generated\<api-name>.json -Raw | ConvertFrom-Json | Out-Null
```

## 성공 기준

- JSON 문법 오류가 없습니다.
- 필수 항목이 모두 있습니다.
- API 검증에 필요한 query, body, authority, success response가 예시와 함께 있습니다.
- 실패 case가 최소 1개 이상 있거나, 실패 case가 없다는 이유가 contract에 적혀 있습니다.

## 실패 시 처리

- contract가 없으면 새로 만듭니다.
- 필수 항목이 빠졌으면 구현하지 않고 누락 항목만 질문합니다.
- API가 이미 존재하면 먼저 `harness/requests/`에서 기존 contract를 찾고 재사용합니다.
