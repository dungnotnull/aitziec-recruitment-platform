# ITZiec Repository Instructions

## Purpose

This file defines repository-wide conventions for human contributors and coding
agents. Read it before changing any file. When working under `backend/`, also
read `backend/CLAUDE.md`.

## Current State

- Project status: `Planned`.
- The repository currently contains a documentation baseline, not a runnable
  application.
- Do not describe a feature, endpoint, migration, worker, or test as implemented
  unless the corresponding code and verification evidence exist.
- The active and documented implementation workstream is backend. Do not create
  frontend files or tasks unless the user explicitly changes scope.

> Ghi chú: checkbox chỉ được đánh dấu hoàn thành sau khi có bằng chứng kiểm thử,
> không dùng checkbox để biểu thị task đang làm dở.

## Confirmed Technology Decisions

| Area | Decision |
| --- | --- |
| Frontend contract consumer | React + Vite |
| Backend | NestJS on Node.js |
| ORM | Prisma |
| Primary database | PostgreSQL |
| Cache and queues | Redis + BullMQ |
| Object storage | S3-compatible MinIO locally |
| Email | Nodemailer; Mailpit locally |
| AI provider | Gemini behind an application-owned adapter |
| API | Versioned REST, JSON, OpenAPI |
| Local orchestration | Docker Compose |

Do not replace a confirmed technology without an explicit architecture decision
and coordinated updates to all controlling documents.

## Source-of-Truth Order

Use each document for its stated domain:

1. `API-CONTRACT.md`: HTTP interfaces, DTOs, schemas, enums, errors, pagination,
   and application transitions.
2. `PROJECT-DETAIL.md`: product scope, actors, business rules, and quality
   requirements.
3. `backend/CLAUDE.md`: NestJS, Prisma, testing, security, and backend delivery
   conventions.
4. `docs/ROADMAP.md`: milestone order, scope, and exit criteria.
5. `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`: detailed backend
   progress and acceptance evidence.
6. `backend/ISSUES-LIST-TRACKING.md`: known backend defects, risks, and their
   verified resolution.
7. `CHANGELOG.md`: released and unreleased project history.
8. `README.md`: onboarding summary and document navigation.
9. `itziec_recruitment_platform_details.md`: preserved original brief.

If documents disagree, follow the higher-ranked document within its domain and
fix the conflicting lower-ranked document in the same change.

## Contract-First Rule

Before changing an endpoint, request or response field, shared enum, error code,
event payload, authentication behavior, or state transition:

1. Read `API-CONTRACT.md`.
2. Update the contract first in the same change set.
3. Classify the change as additive, behavioral, deprecating, or breaking.
4. Update backend validation, OpenAPI metadata, implementation, and tests.
5. Update affected trackers and `CHANGELOG.md`.
6. Notify contract consumers when the change is breaking or behavioral.

Never allow generated OpenAPI output and `API-CONTRACT.md` to drift silently.

## Planned Architecture

```text
React + Vite client
        |
        | HTTPS REST /api/v1
        v
NestJS API
  |-- identity and access
  |-- candidates and CVs
  |-- companies and jobs
  |-- search and saved jobs
  |-- applications and interviews
  |-- notifications
  |-- AI analysis and recommendations
  |-- administration and audit
  |
  |-- Prisma -> PostgreSQL
  |-- cache -> Redis
  |-- outbox -> BullMQ workers
  |-- objects -> MinIO / S3-compatible storage
  |-- email adapter -> Mailpit / production SMTP
  `-- AI adapter -> Gemini
```

The application is a modular monolith with separately runnable workers. Prefer
clear module boundaries over distributed services until measured scale or
deployment needs justify extraction.

## Module Communication

- Controllers translate HTTP into application commands and queries; they do not
  contain business rules.
- Application services orchestrate use cases and own transaction boundaries.
- Domain rules must be expressible and testable without HTTP or vendor SDKs.
- A module may use another module only through its exported application-facing
  interface. Do not query another module's Prisma model as a shortcut.
- Immediate consistency uses a direct application-service call inside a defined
  transaction.
- Side effects use a transactional outbox written with the business change, then
  dispatched to BullMQ.
- Workers must be idempotent, retry-safe, observable, and independent from HTTP
  request context.
- Gemini, SMTP, object storage, and queue clients live behind adapters owned by
  the backend application.
- Domain events use the envelope and names defined in `API-CONTRACT.md`.

## Repository Conventions

- Keep files focused on one responsibility and use feature/module boundaries.
- Prefer explicit names over abbreviations except established terms such as
  `CV`, `DTO`, `JWT`, and `RBAC`.
- Use English for code, identifiers, API fields, schemas, tests, commits, and
  formal requirements.
- Vietnamese comments are allowed when they explain intent or a non-obvious
  business constraint. Do not translate identifiers inside comments.
- Store all text files as UTF-8.
- Never commit secrets, real candidate data, production CVs, access tokens, or
  provider credentials.
- Treat uploaded CVs and extracted text as sensitive personal data.
- Use UTC in persistence and API timestamps; localize only in presentation.
- Use UUIDs for public resource identifiers and decimal-safe integer minor units
  for money as defined by the API contract.

## Status Vocabulary

- `Planned`: accepted scope without verified runtime implementation.
- `In progress`: implementation has begun but acceptance evidence is incomplete.
- `Implemented`: code, validation, authorization, OpenAPI metadata, and required
  tests exist.
- `Verified`: acceptance checks passed in the target environment.
- `Deferred`: intentionally moved out of the active milestone with a reason.

Do not infer status from file names, old comments, or an unchecked test plan.
Consult the backend tracker and verify the code.

## Security and Data Rules

- Deny access by default; enforce both role and resource ownership.
- Validate every external input at the system boundary.
- Store password hashes only; never log passwords, tokens, CV text, or secrets.
- Rotate refresh tokens and detect reuse according to `API-CONTRACT.md`.
- Validate upload size, extension, MIME signature, and PDF parseability.
- Use short-lived signed URLs for private objects.
- AI output is advisory. It cannot autonomously change application status or
  make a hiring decision.
- Record security-sensitive and recruitment-state mutations in the audit log.

## Testing and Evidence

- Business rules and state transitions require unit tests.
- Prisma queries, transactions, migrations, outbox delivery, and external
  adapters require integration tests against real local dependencies where
  practical.
- Critical user journeys require API-level end-to-end tests.
- A completed tracker item must include the relevant command, test, migration,
  OpenAPI diff, log, or manual verification reference.
- Tests must be deterministic and must not call paid or production services.

## Documentation Maintenance

- Update `docs/ROADMAP.md` per milestone, not for daily activity.
- Only the backend workstream updates the backend phase tracker and issue list.
- Keep fixed issues in the issue register with resolution and verification.
- Add a changelog entry for contract, schema, security, milestone, or user-visible
  behavior changes.
- Preserve the original requirements brief as historical input.
