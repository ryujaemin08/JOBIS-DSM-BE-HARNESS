# 02. Fixture 준비

이 문서는 QA와 SRE에서 사용할 synthetic fixture를 준비하는 절차입니다.

## 원칙

- 실제 사용자 데이터, 운영 데이터, 개인 로컬 데이터를 사용하지 않습니다.
- fixture는 synthetic data만 사용합니다.
- INSERT 전에 같은 ID 또는 account_id를 DELETE하여 재실행 가능하게 만듭니다.
- fixture SQL은 request contract의 `harness.fixtures.seed_script` 경로와 일치해야 합니다.

## 파일 위치

권장 위치:

```text
harness/fixtures/generated/<api-name>-seed.sql
```

## 확인할 table

API에 따라 필요한 table을 명시합니다.

면접 API 예시:

```text
tbl_user
tbl_student
tbl_teacher
tbl_company
tbl_document_number
tbl_interview
```

## SQL 작성 순서

1. 기존 synthetic row를 DELETE합니다.
2. auth bootstrap에 필요한 user/student/teacher/company row를 INSERT합니다.
3. API response를 만들기 위한 domain row를 INSERT합니다.
4. query parameter 조건에 맞는 row와 맞지 않는 row를 함께 넣습니다.
5. latency 테스트가 필요하면 충분한 row 수를 넣습니다.

## Schema 확인

fixture를 작성하기 전에 실제 column 길이와 enum 값을 확인합니다.

```powershell
docker exec jobis-harness-mysql mysql -uroot -p1234 -D jobis_harness -e "SHOW COLUMNS FROM tbl_user; SHOW COLUMNS FROM tbl_student; SHOW COLUMNS FROM tbl_interview;"
```

JOBIS의 대표 제약 예시는 아래와 같습니다.

- `tbl_student.name`은 `varchar(10)`입니다. fixture 이름은 10자 이하로 작성합니다.
- `tbl_user.account_id`는 `varchar(30)`입니다. synthetic account도 30자 이하로 작성합니다.
- `tbl_interview.company_name`은 `varchar(20)`입니다.
- enum 값은 Java enum 이름과 DB 문자열이 일치해야 합니다.

## Windows 인코딩 규칙

PowerShell pipe로 SQL을 MySQL container에 넘길 때 한글 fixture 값이 깨질 수 있습니다.
fixture seed는 기본적으로 ASCII 값을 사용합니다.
한글 값 검증이 목적이면 SQL 파일을 UTF-8로 저장하고 MySQL 실행 때 character set을 명시합니다.

```powershell
Get-Content harness\fixtures\generated\<api-name>-seed.sql -Encoding utf8 | docker exec -i jobis-harness-mysql mysql --default-character-set=utf8mb4 -uroot -p1234 -D jobis_harness
```

한글 자체가 검증 대상이 아니면 `Student1`, `Harness Labs`처럼 ASCII synthetic 값을 사용합니다.

## SQL 실행 명령어

Docker MySQL container가 떠 있는 상태에서 실행합니다.

```powershell
Get-Content harness\fixtures\generated\<api-name>-seed.sql -Encoding utf8 | docker exec -i jobis-harness-mysql mysql --default-character-set=utf8mb4 -uroot -p1234 -D jobis_harness
```

SQL 파일이 request contract 경로와 맞는지 확인합니다.

```powershell
Select-String -Path harness\requests\generated\<api-name>.json -Pattern "seed_script"
```

## 성공 기준

- seed SQL 파일이 존재합니다.
- DELETE와 INSERT가 모두 있습니다.
- API response에 필요한 row가 있습니다.
- auth에 필요한 STUDENT, TEACHER, COMPANY synthetic 계정이 준비됩니다.
- SQL을 여러 번 실행해도 중복 key 오류가 나지 않습니다.

## 실패 시 처리

- table이 없으면 앱 migration 또는 Flyway 실행 상태를 먼저 확인합니다.
- FK 오류가 나면 DELETE 순서와 INSERT 순서를 조정합니다.
- `Data too long` 오류가 나면 `SHOW COLUMNS`로 column 길이를 확인하고 fixture 값을 줄입니다.
- SQL syntax 오류가 한글 근처에서 나면 PowerShell pipe 인코딩 문제를 의심하고 ASCII fixture로 바꾸거나 `--default-character-set=utf8mb4`를 사용합니다.
- response가 비어 있으면 query 조건과 fixture 값을 비교합니다.
