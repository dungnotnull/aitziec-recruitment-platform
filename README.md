# 💼 ITZiec AI-Powered Recruitment Platform

ITZiec is a planned recruitment and technology-job platform inspired by ITviec
and VietnamWorks. It is designed as a production-oriented backend learning
project covering recruitment workflows, PostgreSQL search, event-driven jobs,
private CV processing, and safe AI assistance.

## Current Status

**Documentation baseline only — runtime implementation has not started.**

The repository currently defines product requirements, architecture conventions,
an API contract, a backend roadmap, detailed backend tasks, and known issues. Do
not interpret a documented endpoint or command as available until its backend
task contains verification evidence.

| Area | Status |
| --- | --- |
| Documentation and architecture decisions | Verified (Phase 0) |
| Backend application | Planned |
| Frontend application | Out of the active delivery scope |
| API endpoints | Proposed baseline; not implemented |
| Local infrastructure | Planned for Phase 1; not started |

## Product Scope

The planned product connects three roles:

- **Candidates** manage profiles and PDF CVs, search and save jobs, apply, track
  application history, receive notifications, and request advisory CV/job
  analysis.
- **HR/recruiters** manage authorized companies and job posts, review applicants,
  move applications through a controlled pipeline, schedule interviews, and use
  advisory AI screening.
- **Administrators** moderate users, companies, and jobs through explicit,
  audited operations.

Core planned capabilities include:

- JWT authentication, rotating refresh sessions, RBAC, ownership, and company
  scope.
- Job lifecycle management and PostgreSQL full-text search with structured
  filters, deterministic ranking, and cursor pagination.
- Saved jobs and transactional application submission.
- Strict application state machine:
  `APPLIED -> REVIEWING -> INTERVIEWING -> PASSED | REJECTED`.
- Private PDF storage, validation, text extraction, and short-lived signed
  downloads.
- Interviews, in-app notifications, event-driven email, retries, and Mailpit
  local capture.
- Gemini-based structured CV extraction, CV/JD matching, gap analysis,
  natural-language search parsing, and recommendations.
- Append-only application history, audit logs, structured logging, health checks,
  queue monitoring, and operational hardening.

AI output is advisory. It must never independently reject, advance, or make a
final hiring decision for an application.

## Confirmed Technology Stack

| Area | Technology |
| --- | --- |
| Frontend contract consumer | React + Vite |
| Backend | NestJS + Node.js |
| ORM | Prisma |
| Database and search | PostgreSQL + Full-Text Search |
| Cache and queues | Redis + BullMQ |
| Object storage | MinIO locally; S3-compatible abstraction |
| Email | Nodemailer + Mailpit locally |
| AI provider | Gemini behind an application-owned adapter |
| API documentation | OpenAPI / Swagger |
| Authentication and authorization | JWT, rotating refresh sessions, RBAC |
| Local environment | Docker Compose |
| CI/CD target | GitHub Actions |

Frontend implementation is outside the current repository scope. React + Vite
is retained only as the confirmed future consumer of the HTTP contract.

## Planned Architecture

```text
React + Vite
     |
     | HTTPS REST /api/v1
     v
NestJS modular monolith
     |-- Prisma --------------------> PostgreSQL
     |-- cache ---------------------> Redis
     |-- transactional outbox ------> BullMQ workers
     |                                  |-- Nodemailer -> Mailpit / SMTP
     |                                  |-- PDF extraction
     |                                  `-- Gemini adapter
     `-- private object adapter ----> MinIO / S3-compatible storage
```

The API handles synchronous validation and state changes. Side effects are
recorded transactionally through an outbox and processed by retry-safe workers.
External providers stay behind application-owned adapters.

## Documentation Map

Read documents in this order when beginning backend work:

1. [Root conventions](CLAUDE.md) — repository rules, architecture, module
   communication, status, and document precedence.
2. [Project detail](PROJECT-DETAIL.md) — product scope, stable requirement IDs,
   workflows, business rules, data model, and quality targets.
3. [API contract](API-CONTRACT.md) — source of truth for endpoints, DTOs, enums,
   errors, pagination, application transitions, and domain events.
4. [Backend conventions](backend/CLAUDE.md) — NestJS, Prisma, transactions,
   queues, security, AI, testing, and tracker rules.
5. [Roadmap](docs/ROADMAP.md) — milestone goals, dependencies, and exit criteria.
6. [Backend phase tracker](backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md)
   — detailed checkbox tasks and required acceptance evidence.
7. [Backend issues](backend/ISSUES-LIST-TRACKING.md) — known defects, risks,
   decisions, fixes, and verification history.
8. [Changelog](CHANGELOG.md) — released/unreleased documentation and runtime
   history.
9. [Original requirements brief](itziec_recruitment_platform_details.md) —
    preserved historical input.

The approved documentation design and its implementation plan are available at:

- [Documentation baseline design](docs/superpowers/specs/2026-09-08-documentation-baseline-design.md)
- [Documentation baseline implementation plan](docs/superpowers/plans/2026-09-08-documentation-baseline.md)

## Contract-First Workflow

Before changing any endpoint, request/response field, enum, error code, event
payload, authentication behavior, or application transition:

1. Read and update `API-CONTRACT.md` first.
2. Classify the change as additive, behavioral, deprecating, or breaking.
3. Update DTO validation, authorization, implementation, OpenAPI, and tests.
4. Update the backend task or issue and add a changelog entry.

The frontend must not infer wire types from Prisma or undocumented backend code.
The backend must not alter an interface and retroactively rewrite the contract.

## Backend Delivery Phases

| Phase | Outcome |
| --- | --- |
| 0 | Documentation and architecture decisions |
| 1 | Runnable NestJS and local infrastructure foundation |
| 2 | Identity, sessions, RBAC, candidate profile, company membership |
| 3 | Jobs, PostgreSQL search, pagination, and saved jobs |
| 4 | Applications and transactional recruitment state machine |
| 5 | CV storage/extraction, interviews, notifications, and email |
| 6 | Safe AI analysis, natural-language parsing, and recommendations |
| 7 | Admin, observability, security, performance, recovery, and release |

Detailed status belongs in the backend tracker, not this summary.

## Target Local Development

The following services and commands describe the Phase 1 target. They are not
available yet because application manifests and Compose configuration have not
been implemented.

Planned local services:

| Service | Target port |
| --- | ---: |
| NestJS API | `3000` |
| PostgreSQL | `5432` |
| Redis | `6379` |
| MinIO API | `9000` |
| MinIO console | `9001` |
| Mailpit SMTP | `1025` |
| Mailpit web UI | `8025` |

Target workflow after Phase 1 verification:

```bash
docker compose up -d
npm install
npm run prisma:migrate
npm run start:dev
```

The real package manager, scripts, environment template, and teardown procedure
must be taken from verified Phase 1 files once they exist.

## Security and Privacy Principles

- Deny access by default and enforce role plus resource/company scope.
- Store private CVs outside public buckets and return only authorized,
  short-lived signed URLs.
- Never log passwords, tokens, cookies, secrets, raw CV text, signed URLs, or
  private recruiter notes.
- Validate every external input, including file bytes and AI output.
- Commit recruitment history, audit data, and outbox events atomically with the
  business state change.
- Keep AI provider interactions observable without exposing candidate data.

## Contributing to Backend Documentation

- Use English for formal requirements, identifiers, schemas, endpoints, code,
  tests, and commit messages.
- Vietnamese comments may explain non-obvious intent or business constraints.
- Keep runtime tasks unchecked until their stated evidence passes.
- Record discovered backend defects/risks in the issue register rather than
  hiding them in comments.
- Update the roadmap only for milestone changes.

## Inspiration and Independence

The product experience is inspired by
[ITviec](https://itviec.com/) and
[VietnamWorks](https://www.vietnamworks.com/). ITZiec is an independent learning
and portfolio project and is not affiliated with those services.

## License

This repository is licensed under the
[GNU General Public License v3.0](LICENSE).
