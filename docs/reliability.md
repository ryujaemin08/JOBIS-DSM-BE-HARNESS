# Reliability

## Purpose
- 이 문서는 이 repository 에서 "healthy enough to trust" 가 무엇인지 정의한다.
- startup check, smoke validation, observability review, release-readiness 판단에 사용한다.
- reliability rule 은 tool-agnostic 해야 한다. 어떤 agent 나 engineer 도 현재 repo command 와 runtime surface 만으로 적용할 수 있어야 한다.

## Current Runtime Surface
- backend 는 Spring Actuator endpoint 를 노출한다.
- Prometheus metric 이 현재 application configuration 에서 활성화되어 있다.
- integration test 가 이미 존재하며, business behavior 에 대한 첫 번째 executable verification layer 로 유지해야 한다.

## Reliability Contract

### Minimum Healthy State
- application 이 intended profile 과 required dependency 로 정상 startup 한다.
- application 이 clean shutdown 할 수 있다.
- health endpoint 가 현재 run 이 의존하는 service 기준으로 expected healthy state 를 보여준다.
- critical request flow 에서 unexpected `5xx` 가 발생하지 않는다.
- normal startup 또는 smoke validation 중 repeated unhandled exception log 가 보이지 않는다.

### Minimum Observability State
- health, info, metrics, Prometheus endpoint 가 environment expectation 범위에서 접근 가능하다.
- error condition 을 log, metric, test output 중 하나로 진단할 수 있어야 하며 hidden tribal knowledge 에 의존하지 않아야 한다.
- startup, messaging, persistence, auth, external integration 에 영향을 주는 change 는 final report 에 reliability verification note 를 남긴다.

## What Counts As Reliability-Sensitive Work
- Spring configuration 변경
- startup / shutdown behavior 변경
- datasource, Redis, RabbitMQ, external service integration 변경
- async 또는 message-driven behavior 변경
- caching 변경
- traffic 를 막을 수 있는 security filter 또는 auth pipeline 변경
- performance-sensitive query 또는 mapper 변경

## Verification Ladder

### Level 1: Small Change
- 가장 작은 relevant test scope 를 실행한다.
- application build 가 유지되는지 확인한다.
- runtime configuration 또는 request handling 에 영향이 있으면 startup 과 representative request path 하나를 확인한다.

### Level 2: Shared Infrastructure Change
- targeted test 와 affected module test suite 를 실행한다.
- intended profile 로 startup 을 확인한다.
- health endpoint 와 log 를 확인해 unexpected error 가 없는지 본다.

### Level 3: High-Risk Change
- targeted test 와 broader integration coverage 를 실행한다.
- startup, health, representative critical flow end-to-end 를 확인한다.
- smoke run 이후 relevant metric 또는 log 를 검토한다.
- 무엇을 검증하지 못했는지 생략하지 않는다.

## Critical Signals To Watch
- startup failure 또는 hanging boot
- startup 중 repeated exception log
- 기존 flow 에서 unexpected `401`, `403`, `5xx`
- query shape, N+1, external call 로 인한 latency spike
- infrastructure change 이후 metric/log 가 사라지거나 과도하게 noisy 해지는 현상

## Runtime Checks
- build/test command 는 `docs/development.md` 를 따른다.
- local runtime validation 시에는 아래 checklist 를 우선 사용한다:
  1. intended profile 로 service start
  2. `/actuator/health` 확인
  3. representative API path 호출
  4. repeated failure log 확인
  5. metric 또는 exposure 관련 변경이면 `/actuator/metrics`, `/actuator/prometheus` 확인

## Logging Rules
- error 는 emitted log context 만으로도 어느 정도 진단 가능해야 한다.
- infrastructure code 에서 silent failure handling 을 피한다.
- secret, token, personal data 를 log 하지 않는다.
- 반복되는 production-class incident 가 보이면 durable check 또는 doc update 로 승격한다.

## Future Harness Direction
- 무거운 observability stack 을 붙이기 전에 작은 runnable smoke check 를 먼저 만든다.
- "looks stable" 같은 표현보다 explicit threshold 와 pass/fail criteria 를 선호한다.
- 자주 중요한 reliability rule 이면 CI, scripted smoke test, reusable local verification command 로 승격한다.
