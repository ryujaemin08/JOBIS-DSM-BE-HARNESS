# Architecture

## Purpose
- 이 문서는 repository 의 structural contract 다.
- code 가 어디에 있어야 하는지, 어떤 dependency 가 허용되는지, 어떤 shortcut 이 금지되는지를 판단할 때 사용한다.
- code 와 문서가 어긋나면 둘 중 하나를 같은 task 안에서 맞춘다. drift 를 방치하지 않는다.

## Top-Level Shape
- 이 repository 는 hexagonal style with ports and adapters 를 사용한다.
- business rule 은 domain model 과 use case 에 둔다.
- framework-heavy code, IO, persistence, transport concern 은 infrastructure 에 둔다.
- feature 는 business path, adapter path, verification path 가 함께 맞아야 complete 로 본다.

## Modules

### `jobis-application`
- business intent 를 소유한다.
- 아래 요소를 정의한다:
  - domain model
  - use case
  - DTO
  - event
  - exception
  - `QueryXxxPort`, `CommandXxxPort` 같은 SPI port
- infrastructure implementation detail 에 의존하면 안 된다.
- Spring MVC, JPA entity behavior, external SDK 지식 없이도 읽혀야 한다.

### `jobis-infrastructure`
- delivery 와 integration concern 을 소유한다.
- 아래 요소를 구현한다:
  - persistence adapter
  - web adapter
  - external service adapter
  - Spring configuration
- 아래 요소를 포함한다:
  - JPA entity
  - repository
  - mapper
  - QueryDSL query
- `jobis-application` 에 의존할 수 있다.
- framework concern 을 다시 `jobis-application` 으로 밀어 넣으면 안 된다.

## Dependency Rules

### Allowed Direction
1. `jobis-application` 이 필요한 capability 를 port 로 선언한다.
2. `jobis-infrastructure` 가 그 port 를 구현한다.
3. web adapter 와 persistence adapter 는 use case 와 domain contract 에 의존한다.

### Forbidden Direction
- `jobis-application` 이 JPA entity, repository, Spring MVC request model, external SDK client 를 import 하는 것
- web adapter 안에 business branching 이 들어가는 것
- repository 가 사실상의 business orchestration layer 가 되는 것
- 한 domain 이 다른 domain 의 persistence implementation 에 직접 기대어 shortcut 을 타는 것

## Placement Rules

### Application Domain Pattern
- `model/`
  - aggregate 와 domain state
- `usecase/`
  - business operation 과 orchestration
- `spi/`
  - infrastructure dependency contract
- `dto/`
  - application boundary 에서 쓰는 request/response object
- `event/`
  - domain event
- `exception/`
  - domain-specific exception

### Infrastructure Pattern
- `persistence/`
  - entity, repository, mapper, QueryDSL query, port implementation
- `presentation/`
  - controller, web request DTO, web response DTO
- external integration package
  - third-party client, message broker, object storage, email 같은 delivery concern

## Layer Responsibilities

### Domain Model
- business state 와 invariant 를 표현한다.
- HTTP, SQL, external API payload shape 를 알면 안 된다.

### Use Case
- business boundary 이자 transaction boundary 다.
- domain object 와 port 를 조합한다.
- business behavior 를 이해할 때 가장 먼저 보는 위치여야 한다.

### SPI Port
- infrastructure 가 제공해야 하는 capability 를 선언한다.
- storage technology 가 아니라 capability 를 표현해야 한다.

### Persistence Adapter
- persistence model 과 application contract 사이를 번역한다.
- repository, QueryDSL, mapper 를 사용할 수 있다.
- 두 번째 business service layer 처럼 비대해지면 안 된다.

### Web Adapter
- transport concern 을 use case input/output 으로 매핑한다.
- request parsing, auth-derived context handoff, response shaping 을 담당한다.
- 단순 transport validation 을 넘는 business policy 를 담으면 안 된다.

## Domain Interaction Rules
- 가능하면 각 domain 이 자기 read/write path 를 소유한다.
- 다른 domain data 가 필요하면 기존 SPI port 가 있는지 먼저 보고, 없으면 의도적으로 추가한다.
- complex read 를 위해 domain 간 repository injection 을 남발하지 않는다.
- 여러 entity 또는 domain 을 가로지르는 read 는, aggregate 여러 개를 메모리에서 합치는 것보다 owning adapter 의 QueryDSL projection 을 먼저 검토한다.

## QueryDSL And Mapper Rules
- QueryDSL 사용 대상:
  - multi-table read
  - aggregate read
  - cross-domain join
  - custom projection
- mapper behavior 를 query design 의 일부로 취급한다.
- mapper 가 lazy association 을 건드리면 query 가 필요한 fetch 또는 projection 을 보장해야 한다.
- entity 에 collection/lazy relation 이 있으면 `toDomain` 비용이 싸다고 가정하지 않는다.
- batch read 에서 mapper 가 lazy relation 을 건드리면 `findAll() + stream().map(...)` 같은 naive pattern 을 피한다.

## Naming And Annotation Conventions
- `@UseCase`
  - write use case, transactional
- `@ReadOnlyUseCase`
  - read-only use case
- `*PersistenceAdapter`
  - persistence-side port implementation
- `*WebAdapter`
  - REST controller adapter

## API Behavior Rules
- POST create: `201 CREATED`
- PATCH update: `204 NO_CONTENT`
- DELETE: `204 NO_CONTENT`
- GET: `200 OK`

## Good Signs
- 새 feature 를 설명할 때 하나의 use case, 하나 이상의 port, 하나의 adapter path 로 설명할 수 있다.
- reviewer 가 file placement 만 보고도 business logic 과 transport/persistence logic 을 구분할 수 있다.
- query code 와 mapper code 만 봐도 fetch requirement 가 드러난다.

## Warning Signs
- controller 가 business policy 를 결정한다.
- repository method 없이는 behavior 를 이해할 수 없다.
- application layer object 가 JPA behavior 나 web request structure 에 묶여 있다.
- cross-domain read 를 위해 여러 repository 를 주입받아 memory stitching 한다.

## Verification Before Merge
- 새 business behavior 가 use case 중심인지 확인한다.
- application code 가 infrastructure implementation type 을 import 하지 않는지 확인한다.
- cross-domain read 가 의도된 adapter/query design 을 따르는지 확인한다.
- 새 endpoint 가 response contract 를 따르는지 확인한다.
- 같은 architecture mistake 가 반복되면 prose 업데이트로 끝내지 말고 automated check 도 추가한다.
