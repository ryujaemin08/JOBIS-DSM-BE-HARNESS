# Project Overview

## Service
- Repository: `Team-return/JOBIS-DSM-BE`
- Domain: DSM 학생 취업, 지원, 기업, 리뷰 관리
- Backend style: domain-centered module separation 을 가진 Spring Boot service

## Main Modules
- `jobis-application`
  - domain model, use case, DTO, event, exception, SPI port 를 둔다
  - business logic 과 contract 중심이어야 한다
- `jobis-infrastructure`
  - JPA entity, repository, persistence adapter, web adapter, config, external integration 을 둔다
  - `jobis-application` 이 선언한 port 를 구현한다

## Technology Stack
- Java 17
- Spring Boot 3.1.6
- Spring Security + JWT
- Spring Data JPA
- QueryDSL 5.0
- MySQL
- Flyway
- Redis
- RabbitMQ
- AWS S3 and SES
- Firebase Admin
- OpenFeign
- Prometheus and Spring Actuator

## Main Domain Areas
- acceptance
- application
- auth
- banner
- bookmark
- bug
- code
- company
- file
- interest
- intern
- interview
- notice
- notification
- recruitment
- review
- student
- teacher
- user

## Practical Reading Order
- 이 repository 가 처음이면 아래 순서로 읽는다:
  1. `docs/architecture.md`
  2. `docs/development.md`
  3. `docs/security.md`
  4. `docs/reliability.md`
  5. `docs/git-workflow.md`
  6. `docs/pr-workflow.md`

## What Usually Changes Together
- new feature:
  - `jobis-application/domain/...`
  - `jobis-infrastructure/domain/...`
  - `jobis-infrastructure/src/test`
- new API:
  - use case
  - SPI port
  - persistence adapter 또는 external adapter
  - web adapter
  - request/response DTO
- JPA 또는 QueryDSL work:
  - entity
  - repository
  - persistence adapter
  - mapper
