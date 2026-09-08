# ITZiec Backend Roadmap

## Roadmap Policy

This file tracks milestone-level backend progress. Update it when a phase starts,
completes, or materially changes scope. Daily and task-level activity belongs in
`../backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`.

**Current milestone:** Phase 3 — Companies, jobs, and search (planned; Phase 1 and Phase 2 verified)  
**Current product state:** Phase 1 (Platform Foundation) and Phase 2 (Identity, Access, and Profiles) implemented and verified. 15 test suites and 62 tests passing.  
**Delivery focus:** Backend only. No frontend file or task is included.

| Phase | Milestone | Status | Depends on |
| --- | --- | --- | --- |
| 0 | Documentation and decisions | Verified | None |
| 1 | Platform foundation | Verified | Phase 0 |
| 2 | Identity, access, and profiles | Verified | Phase 1 |
| 3 | Companies, jobs, and search | Planned | Phase 2 |
| 4 | Applications and recruitment pipeline | Planned | Phase 3 |
| 5 | CVs, interviews, and notifications | Planned | Phase 4 |
| 6 | AI recruitment capabilities | Planned | Phases 3 and 5 |
| 7 | Administration, observability, and release hardening | Planned | Phases 1–6 |

## Phase 0 — Documentation and Architecture Decisions

**Goal:** establish stable product language, shared contracts, backend
conventions, and honest progress tracking before implementation.

**Status:** Verified on 2026-09-08.

**Scope:** project detail, API contract, root/backend agent conventions, backend
task tracker, backend issue register, changelog, onboarding README, and confirmed
React + Vite / NestJS / Prisma / PostgreSQL decisions.

**Exit criteria:**

- Every controlling document exists and passes cross-document checks.
- `API-CONTRACT.md` defines envelopes, errors, auth, pagination, shared enums,
  core endpoint shapes, events, and the application state machine.
- Planned and implemented states are clearly distinguishable.
- Known decisions that block later endpoints are in the backend issue register.
- No frontend file or task exists in the active documentation scope.

## Phase 1 — Platform Foundation

**Goal:** provide a reproducible NestJS backend and local dependency stack.

**Status:** Verified on 2026-09-08.

**Scope:** Node/package baseline, NestJS bootstrap, validated configuration,
Docker Compose, PostgreSQL, Prisma migrations, Redis, BullMQ, MinIO, Mailpit,
logging/request IDs, standard errors, OpenAPI, health checks, test harnesses, and
CI quality gates.

**Exit criteria:**

- A clean checkout can install dependencies, start infrastructure, migrate the
  database, and run the API through documented commands.
- Liveness and readiness behave correctly during dependency success and failure.
- Format, lint, type-check, unit/integration test, build, and migration checks
  pass in CI.
- API error and request-ID behavior matches `API-CONTRACT.md`.

## Phase 2 — Identity, Access, and Profiles

**Goal:** establish secure user sessions, RBAC, resource scope, candidate
profiles, and company membership foundations.

**Status:** Verified on 2026-09-08.

**Scope:** registration, login, access JWTs, rotating refresh sessions, token
reuse detection, logout, user status, candidate profile/skills/experience,
company creation and membership, role/scope guards, rate limiting, and auth
audit records.

**Exit criteria:**

- Session rotation and reuse detection pass integration and API tests.
- Candidate ownership and recruiter company scope deny unauthorized access.
- Candidate and company resources match contract DTOs and concurrency rules.
- Security-sensitive operations emit safe audit records.

## Phase 3 — Companies, Jobs, Search, and Saved Jobs

**Goal:** allow authorized recruiters to publish jobs and candidates to discover
them efficiently.

**Scope:** company profile completion, job CRUD/lifecycle, optimistic concurrency,
PostgreSQL full-text search, structured filters, deterministic cursor pagination,
ranking, indexes, saved jobs, cache policy, and moderation hooks.

**Exit criteria:**

- Authorized HR can create and publish a valid job; unauthorized users cannot.
- Public reads expose only published, open, non-expired jobs.
- Search/filter/sort/cursor behavior matches the contract and passes the agreed
  representative-data performance target.
- Saved-job operations are idempotent and ownership-safe.

## Phase 4 — Applications and Recruitment Pipeline

**Goal:** implement the core hiring workflow with transactional integrity.

**Scope:** application submission, deadline and duplicate rules, CV ownership,
strict application state machine, optimistic concurrency, status history, HR and
candidate views, audit records, transactional outbox, and domain events.

**Exit criteria:**

- Submission atomically creates application, history, audit, and outbox records.
- Duplicate and concurrent submissions cannot create multiple applications.
- Every allowed transition succeeds and every unlisted transition fails.
- Terminal states are immutable and candidate/private recruiter views remain
  separated.

## Phase 5 — CVs, Interviews, and Notifications

**Goal:** support private document processing and operational recruiter/candidate
communication.

**Scope:** validated PDF upload, MinIO private storage, signed downloads, text
extraction, retention/deletion, interview lifecycle and feedback, outbox
dispatch, BullMQ notification workers, templates, Nodemailer/Mailpit, retry,
idempotency, and failed-job operations.

**Exit criteria:**

- Invalid or oversized files are rejected and private objects cannot be fetched
  without authorized short-lived access.
- CV extraction status and failure recovery are observable and retry-safe.
- Interview changes preserve history and protect recruiter-private fields.
- A local application/interview event produces exactly one intended email in
  Mailpit under duplicate event delivery.

## Phase 6 — AI Recruitment Capabilities

**Goal:** add safe, explainable, and measurable AI assistance.

**Scope:** Gemini adapter, structured CV profile extraction, CV/JD matching, gap
analysis, natural-language filter parsing, recommendations, operation status,
schema validation, provider resilience, privacy-safe observability, and
evaluation datasets.

**Exit criteria:**

- Every AI response is schema-validated and stored with model/prompt/schema
  provenance.
- Failure, timeout, invalid output, and rate-limit paths are deterministic and
  retry-safe.
- AI cannot call or bypass application transition rules.
- Evaluation results meet documented acceptance thresholds before capabilities
  are marked verified.

## Phase 7 — Administration, Observability, and Release Hardening

**Goal:** make the backend secure, operable, testable, and deployable.

**Scope:** admin moderation, audit queries, metrics/tracing, queue operations,
error tracking, performance/load tests, security review, retention/backup and
restore, complete E2E coverage, CI/CD, deployment/runbooks, and release checks.

**Exit criteria:**

- Administrative actions require explicit authorization/reason and are audited.
- Dashboards and alerts cover API, database, queues, storage, email, and AI
  failure modes without leaking sensitive data.
- Backup restore and critical incident runbooks are exercised.
- Security, performance, migration, E2E, and deployment release gates pass.

## Milestone Change Rules

- A phase becomes `In progress` when its first implementation task begins.
- A phase becomes `Implemented` only when all scoped deliverables exist.
- A phase becomes `Verified` only when every exit criterion has evidence in the
  backend tracker.
- Incomplete work remains unchecked and is never hidden by changing phase text.
- Moving scope between phases requires an explanation here and an entry in
  `../CHANGELOG.md`.
- Contract changes follow `../API-CONTRACT.md` before roadmap/tracker updates.
