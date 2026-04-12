# Quality Score

## Purpose
- 이 문서는 change 가 단순히 merged 가능한지보다 실제로 healthy 한지 판단하기 위한 lightweight scorecard 다.
- completion report, PR 준비, risky change review 전에 사용한다.
- 목표는 완벽한 숫자놀음이 아니라 consistent release-readiness judgment 다.

## Scoring Model
- 각 category 를 `0` 부터 `2` 까지 채점한다.
- `0`
  - missing 하거나, risky 하거나, repository expectation 보다 분명히 낮다
- `1`
  - acceptable 하지만 incomplete 하거나 verification 이 약하다
- `2`
  - repository expectation 을 충족하고 evidence 가 분명하다

## Categories

### Architecture
- `0`
  - code placement 또는 dependency direction 이 틀리거나 불분명하다
- `1`
  - 대체로 맞지만 boundary 가 아직 흐리다
- `2`
  - use case, port, adapter, support code 가 분리되어 있고 `docs/architecture.md` 와 일치한다

### Verification
- `0`
  - meaningful verification 이 거의 없다
- `1`
  - targeted verification 은 있지만 중요한 gap 이 남아 있다
- `2`
  - verification depth 가 change scope 와 맞고 known gap 도 명시되어 있다

### Reliability
- `0`
  - runtime impact 가 불명확하거나 obvious reliability check 를 건너뛰었다
- `1`
  - basic check 는 했지만 runtime confidence 가 낮다
- `2`
  - `docs/reliability.md` 기준으로 적절한 depth 의 점검을 했다

### Security
- `0`
  - endpoint exposure, authority, secret handling risk 가 불명확하다
- `1`
  - obvious security check 는 통과했지만 deeper review 가 필요할 수 있다
- `2`
  - `docs/security.md` 기준으로 확인했고 결과가 명시적이다

### Documentation
- `0`
  - repository contract 가 바뀌었는데 durable doc 이 stale 하다
- `1`
  - doc 은 고려했지만 충분히 맞춰지지 않았다
- `2`
  - repository contract 변경이 있으면 durable doc 도 함께 갱신됐다

## How To Use The Score
- `9-10`
  - normal merge flow 에 적합한 healthy change
- `7-8`
  - acceptable 하지만 부족한 confidence 를 summary 에 명시한다
- `5-6`
  - remaining risk 를 의도적으로 수용한 것이 아니라면 revise 후 다시 본다
- `0-4`
  - ready 상태가 아니다. 낮은 category 부터 고친다

## Review Questions
- code 가 intended layer 와 domain boundary 안에 남아 있는가
- verification depth 가 blast radius 와 맞는가
- runtime confidence 를 유지하거나 개선했는가
- security posture 를 유지하거나 개선했는가
- durable docs 가 계속 truthful 한가

## Repository Rule
- 같은 category 가 반복해서 낮게 나오면 individual mistake 로만 취급하지 않는다.
- 누락된 expectation 을 reusable doc, test, CI rule, script 로 승격한다.
