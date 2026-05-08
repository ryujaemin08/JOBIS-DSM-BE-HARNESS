# Architecture 확인

이 문서는 하네스 실행 전후로 JOBIS architecture 규칙을 수동 확인하는 절차입니다.

## 기본 규칙

- `jobis-application`은 infrastructure 구현 세부사항에 의존하지 않습니다.
- WebAdapter는 infrastructure presentation package 아래에 둡니다.
- PersistenceAdapter는 infrastructure persistence package 아래에 둡니다.
- application layer에서 JPA, Spring Web, infrastructure package를 직접 import하지 않습니다.

## 확인 명령어

application layer의 금지 import를 확인합니다.

```powershell
Get-ChildItem jobis-application\src\main\java -Recurse -Filter *.java | Select-String -Pattern "import jakarta.persistence|import org.springframework.web|import org.springframework.data.jpa|import team.retum.jobis.global.security|\.persistence\.|\.presentation\."
```

WebAdapter 위치를 확인합니다.

```powershell
Get-ChildItem jobis-infrastructure\src\main\java -Recurse -Filter *WebAdapter.java | Select-Object FullName
```

PersistenceAdapter 위치를 확인합니다.

```powershell
Get-ChildItem jobis-infrastructure\src\main\java -Recurse -Filter *PersistenceAdapter.java | Select-Object FullName
```

## 성공 기준

- application layer에 infrastructure import가 없습니다.
- WebAdapter 경로에 `presentation`이 포함됩니다.
- PersistenceAdapter 경로에 `persistence`가 포함됩니다.

## 실패 시 처리

- use case 또는 port를 application layer로 분리합니다.
- WebAdapter와 DTO는 infrastructure presentation 쪽으로 옮깁니다.
- PersistenceAdapter와 JPA entity는 infrastructure persistence 쪽에 둡니다.
