# Security

## Purpose
- 이 문서는 authentication, authorization, secret handling, logging, exposure review 에 대한 repository security contract 를 정의한다.
- endpoint, filter, auth logic, external integration, configuration 을 바꿀 때 사용한다.

## Security Priorities
1. authorization boundary 보호
2. secret 과 sensitive user data 유출 방지
3. public exposure 를 deliberate 하고 reviewable 하게 유지
4. security-sensitive behavior 를 검증 가능하게 유지

## Authentication And Authorization Contract
- `SecurityConfig` 와 그 주변 auth component 를 protected boundary 로 본다.
- endpoint exposure, `permitAll`, role mapping, token parsing, exception handling 변경은 모두 security-sensitive 하다.
- public endpoint 는 명시적으로 justified 되어야 한다.
- protected endpoint 는 intended authority 가 분명해야 한다.
- endpoint 가 authenticated 에서 public 으로 바뀌거나 authority 가 바뀌면 task report 와 verification note 에 반드시 명시한다.

## Endpoint Exposure Rules
- `permitAll` 은 default 가 아니라 exception 이다.
- actuator exposure 는 environment 에 맞게 deliberate 하고 minimal 해야 한다.
- new endpoint 는 아래 항목을 검토한다:
  - public vs authenticated access
  - required authority
  - data sensitivity
  - abuse potential

## Secret And Configuration Rules
- real secret 을 code, test, docs, example 에 hardcode 하지 않는다.
- JWT secret, SMTP credential, AWS credential, webhook token 같은 값은 protected configuration 으로 취급한다.
- example placeholder 는 clearly non-production 일 때만 허용한다.
- configuration change 가 exposure 를 넓히거나 default 를 약하게 만들 수 있다면, safe configuration expectation 을 같은 task 안에 남긴다.

## Logging And Error Handling Rules
- password, JWT, refresh token, access key, 불필요한 personal data 를 log 하지 않는다.
- error response 가 internal implementation detail 을 과하게 노출하면 안 된다.
- exception handling 은 operator 진단 가능성을 유지하되 client 에게 과한 정보를 주지 않아야 ㅠㅠ 한다.

## External Integration Rules
- external service 에 대해 authentication, timeout, retry, failure behavior 를 검토한다.
- secure default 를 우선한다.
- external integration 을 바꾸면 success path 와 failure path 를 모두 확인한다.

## Common Security Review Triggers
- `SecurityConfig` 변경
- JWT 또는 session 관련 변경
- new public endpoint
- authority mapping 변경
- file upload / download 변경
- email, storage, messaging, webhook integration 변경
- actuator 또는 monitoring exposure 변경

## Verification Checklist
- touched endpoint 마다 intended authority 가 맞는지 확인한다.
- unauthorized access 가 거절되는지 확인한다.
- public endpoint 가 정말 의도된 public 인지 확인한다.
- secret 이 계속 configuration 에서만 오고 hardcoded 되지 않았는지 확인한다.
- log 와 error path 에 sensitive data leak 이 없는지 확인한다.
- actuator 와 operational endpoint exposure 가 의도치 않게 넓어지지 않았는지 확인한다.

## Escalation Rule
- real user-facing security tradeoff 가 생기면 normal refactor 로 취급하지 않는다.
- 그 tradeoff 를 issue, PR, task summary 에 명시적으로 남긴다.
