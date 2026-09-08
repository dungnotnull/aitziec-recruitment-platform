# Backend Development Instructions

## Scope and Authority

This file defines conventions for the NestJS + Prisma backend. Read
`../CLAUDE.md`, `../PROJECT-DETAIL.md`, and `../API-CONTRACT.md` before changing
backend behavior.

Backend agents own these operational documents:

- `DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`
- `ISSUES-LIST-TRACKING.md`

Only backend work updates their task and issue statuses. Product, contract, and
milestone changes must also update their controlling root documents.

## Architecture

Build a modular monolith with separately runnable BullMQ workers. Organize code
by business capability rather than a global technical-layer tree.

Target modules:

- `auth`: credentials, JWT access, refresh sessions, and token-family reuse.
- `users`: user identity, status, and administrative account actions.
- `candidates`: candidate profile, skills, and experience.
- `companies`: companies and recruiter memberships.
- `jobs`: job lifecycle and public job reads.
- `search`: PostgreSQL full-text search, filters, ranking, and cache policy.
- `saved-jobs`: candidate bookmarks.
- `cvs`: upload metadata, private storage, extraction lifecycle, and retention.
- `applications`: submission, state machine, history, and concurrency.
- `interviews`: scheduling, rescheduling, completion, cancellation, and feedback.
- `notifications`: in-app notification intent and delivery orchestration.
- `ai`: provider adapters, schema validation, matching, gap analysis, parsing,
  recommendations, and evaluation metadata.
- `audit`: append-only audit records and authorized queries.
- `admin`: explicit moderation use cases.
- `outbox`: transactional event persistence and dispatch.
- `operations`: asynchronous operation status.
- `health`: liveness and readiness.

## Dependency Direction

```text
HTTP controller / queue processor
  -> application use case
  -> domain policy and ports
  -> infrastructure adapter (Prisma, Redis, MinIO, SMTP, Gemini)
```

- Controllers validate transport input and map transport output. They do not
  contain business rules or direct Prisma calls.
- Queue processors deserialize/version-check events and invoke application use
  cases. They do not duplicate domain rules.
- Application services own orchestration and transaction boundaries.
- Domain policies do not import NestJS, Prisma, BullMQ, vendor SDKs, or HTTP DTOs.
- Infrastructure adapters implement ports owned by the consuming module.
- Cross-module access goes through exported application services or typed ports.
  Never query another module's tables directly to bypass its policy.
- Avoid circular module dependencies. If two modules need a cycle, extract the
  shared policy or invert one dependency through a port.

## NestJS Conventions

- Keep feature modules explicit; avoid a global “common service” that accumulates
  business behavior.
- Use constructor injection and injection tokens for infrastructure ports.
- Use DTO classes with runtime decorators for external HTTP input.
- Enable global validation with transformation, whitelist, and rejection of
  non-whitelisted properties.
- Map domain/application errors to the stable error codes in
  `../API-CONTRACT.md` through a centralized exception layer.
- Use guards for authentication and coarse role checks; enforce resource/company
  scope inside the application use case using authoritative data.
- Do not return Prisma records directly. Map them to contract response shapes.
- Keep OpenAPI decorators/examples synchronized with the contract.

## Prisma and PostgreSQL

- Prisma schema changes require a named migration committed with the feature.
- Never use `db push` as the shared or production migration workflow.
- Use database unique, foreign-key, check, and index constraints to back critical
  invariants where Prisma/PostgreSQL support permits.
- Review generated SQL before applying a migration.
- Migrations that rewrite, drop, or make populated columns non-null require an
  expand/backfill/contract plan and representative-data verification.
- Use `Prisma.TransactionClient` explicitly in transaction-aware repositories.
- The application use case opens the transaction and passes the transaction
  context; repositories do not silently create nested transactions.
- Use optimistic `version` checks for aggregates defined by the contract.
- Application submission uniqueness is enforced by candidate/job unique index,
  not by a race-prone pre-check alone.
- Use PostgreSQL `tsvector`, GIN indexes, and deterministic tie-breakers for
  full-text search when Phase 3 begins.
- Store timestamps in UTC and use UUID public identifiers.

> Ghi chú: mọi migration có nguy cơ mất dữ liệu phải được ghi issue/risk trước
> khi chạy trên môi trường có dữ liệu; không “sửa tay” database để né migration.

## Transactions, Events, and BullMQ

- Recruitment mutations, audit records, history rows, and outbox events commit
  in one PostgreSQL transaction.
- An outbox dispatcher publishes committed events to BullMQ and records delivery
  progress without deleting historical evidence prematurely.
- Use event envelopes and versions from `../API-CONTRACT.md`.
- Consumers deduplicate by `eventId` and make external side effects idempotent.
- Configure bounded attempts, exponential backoff, timeouts, and failed-job
  retention per queue.
- Retry only classified transient failures. Validation and permanent provider
  errors fail without wasteful retry.
- Queue payloads contain identifiers and minimum routing data, not raw CV text,
  access tokens, signed URLs, or secrets.
- Propagate `requestId`, `eventId`, `operationId`, and safe correlation metadata.
- Notification failure never rolls back an already committed application or
  interview mutation.

## Authentication and Authorization

- Hash passwords with a current memory-hard algorithm and versioned parameters.
- Store only hashes of refresh tokens; rotate tokens and detect family reuse.
- Access JWTs contain minimal stable claims: subject, role, session ID, issued
  time, and expiry.
- Never accept user, candidate, company, role, ownership, score, or audit fields
  from the client when they must come from authenticated or persisted context.
- Enforce candidate ownership, recruiter company membership, and administrator
  permissions independently for every use case.
- Return `404` instead of revealing inaccessible private resource existence when
  required by the API contract.
- Rate-limit auth, upload, AI, natural-language parsing, and admin mutations.

## CV and Object Storage

- Accept only a single validated PDF within the contract size limit.
- Verify extension, declared MIME, magic bytes, checksum, and parseability.
- Generate storage keys server-side; never use the raw filename as a key.
- Keep buckets private and issue short-lived signed download URLs only after
  authorization.
- Stream uploads and downloads; do not buffer unbounded files in memory.
- Extract text asynchronously and store only the minimum necessary representation.
- Redact filenames, extracted text, and signed URLs from logs.
- Resolve the documented CV retention issue before implementing deletion of a CV
  referenced by an application.

## AI Integration

- Gemini is accessed only through an application-owned port and adapter.
- Prompts and response schemas are versioned.
- Validate provider JSON at runtime before persistence or use.
- Store model, prompt version, schema version, timestamps, latency, token usage,
  validation result, and safe failure classification.
- Use timeouts, concurrency limits, provider rate limiting, and bounded retry.
- Tests use deterministic fakes or recorded sanitized fixtures, never paid live
  calls by default.
- Do not log raw CV/JD prompt bodies in normal application logs.
- AI output is advisory and cannot invoke the application-transition use case.

## Logging, Errors, and Health

- Use structured JSON logs outside local pretty-print development.
- Include request/job/event/operation IDs, module, action, duration, result, and
  safe error classification.
- Never log passwords, tokens, cookies, provider keys, raw CV text, signed URLs,
  or private recruiter notes.
- Return only registered API error codes and safe messages.
- Keep internal exception detail in restricted logs with redaction.
- `/health/live` checks process liveness only.
- `/health/ready` checks required dependencies with short timeouts and no secret
  or topology disclosure.

## Testing Strategy

- Unit tests: domain policies, application transitions, validation helpers,
  authorization decisions, ranking/scoring, and AI schema handling.
- Integration tests: Prisma repositories and migrations against PostgreSQL,
  Redis/BullMQ behavior, MinIO access, Mailpit/Nodemailer, outbox dispatch, and
  provider adapters with controlled doubles.
- API end-to-end tests: auth/session rotation, ownership/RBAC, jobs/search,
  duplicate application protection, state transitions, interviews, upload, and
  standardized errors.
- Contract tests: response envelopes, enum values, error codes, OpenAPI paths,
  nullable/optional behavior, and access rules.
- Tests must prove both allowed and denied paths. A success-only authorization
  test is incomplete.
- CI must run format, lint, type checks, unit/integration tests, build, and
  migration validation before release.

## Implementation Workflow

1. Read the active phase and task in the backend tracking log.
2. Read referenced requirement IDs in `../PROJECT-DETAIL.md`.
3. Read and, when necessary, update `../API-CONTRACT.md` first.
4. Add a failing test for the rule or contract behavior.
5. Implement the minimum complete use case through the proper module boundary.
6. Run focused tests, then the relevant broader suite.
7. Verify OpenAPI and migration output when affected.
8. Update the backend task with evidence; check it only when acceptance is met.
9. Record discovered defects/risks in `ISSUES-LIST-TRACKING.md`.
10. Update `../CHANGELOG.md` for user-visible, contract, security, or schema
    changes.

## Tracker Rules

- Task IDs are immutable once referenced by a commit or issue.
- Use `[ ]` for planned/incomplete and `[x]` only for verified completion.
- Partial work remains unchecked and receives an `In progress` note with date,
  owner, and next action.
- Never delete a completed task or fixed issue to make the tracker look clean.
- Every completion includes evidence such as test command, migration name,
  OpenAPI comparison, or verification reference.
- Newly discovered scope becomes a task in the correct phase; defects and risks
  become issues. Do not hide them in code comments.

