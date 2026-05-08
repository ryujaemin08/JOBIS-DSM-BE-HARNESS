# 07. 커밋 전 build/test 필수 확인

이 문서는 코드 수정 후 커밋 전에 반드시 실행해야 하는 검증 절차입니다.

QA 또는 SRE가 필요 없는 작업이어도, Java/Kotlin/Gradle 코드가 바뀌었다면 이 절차는 생략하지 않습니다.

## 언제 실행하나

- Java 코드 수정
- Kotlin 코드 수정
- Gradle 설정 수정
- resource, Flyway migration, application.yml 수정
- 테스트 코드 수정
- 하네스가 필요 없는 내부 refactor라도 코드가 바뀐 경우

문서만 바꾼 경우에는 생략할 수 있습니다. 단, 최종 답변에 문서-only라서 생략했다고 적습니다.

## 필수 명령어

테스트를 포함한 build를 실행합니다.

```powershell
./gradlew build
```

checkstyle을 실행합니다.

```powershell
./gradlew checkstyleMain checkstyleTest
```

필요하면 module 단위 테스트를 추가로 실행합니다.

```powershell
./gradlew :jobis-application:test
./gradlew :jobis-infrastructure:test
```

## 성공 기준

- `./gradlew build`가 exit code 0입니다.
- `./gradlew checkstyleMain checkstyleTest`가 exit code 0입니다.
- 실패한 테스트가 없습니다.
- 실패가 있으면 커밋하지 않고 수정 후 다시 실행합니다.

## 최종 답변에 적을 내용

```text
커밋 전 검증:
- ./gradlew build: passed
- ./gradlew checkstyleMain checkstyleTest: passed
```

실행하지 못한 경우:

```text
커밋 전 검증:
- ./gradlew build: not run
- 이유: Docker daemon 또는 로컬 JDK 문제 등 구체적 blocker
```
