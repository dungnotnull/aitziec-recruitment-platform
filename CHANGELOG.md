# Changelog

All notable changes to the ITZiec project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and documentation/release versions follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Runtime features are recorded only after implementation and verification. A
documentation entry is not evidence that the described application behavior is
available.

## [Unreleased]

## [1.1.0] — 2026-09-10

### Added
- **Phase 8 (Frontend Integration Remediation)**:
  - Repaired PostgreSQL migration `20260909000000_jobs_and_saved_jobs` with trigger-maintained `tsvector` and GIN index (`BE-8-002`, `BE-8-003`).
  - Restored `ExperienceLevel` enum validation on public jobs search (`GET /jobs?experienceLevel=FRESHER`) (`BE-8-004`).
  - Isolated notifications unit tests completely from Nodemailer and SMTP network calls (`BE-8-005`).
  - Skill Catalog module (`GET /api/v1/skills`) with canonical/alias resolution, case-insensitive search, and cursor pagination (`BE-8-006`, `BE-8-007`).
  - Recruiter multi-company discovery (`GET /api/v1/companies/mine`) and scoped job management collection (`GET /api/v1/companies/:companyId/jobs`) (`BE-8-008`, `BE-8-009`).
  - Secure pending company invitations with SHA-256 token hashing, 7-day expiration, and one-time acceptance (`POST /api/v1/companies/:companyId/members`, `POST /api/v1/company-invitations/:token/accept`) (`BE-8-010`, `BE-8-011`, `BE-8-012`).
  - Admin company, job, and application collections with optimistic concurrency versions and privacy redactions (`GET /api/v1/admin/companies`, `GET /api/v1/admin/jobs`, `GET /api/v1/admin/applications`, `GET /api/v1/admin/applications/:id`) (`BE-8-013`, `BE-8-014`).
  - Audited admin application moderation (`POST /api/v1/admin/applications/:id/moderate`) (`BE-8-015`).
  - Asynchronous CV text extraction worker with BullMQ and bounded idempotent extraction retry (`POST /api/v1/cvs/:cvId/retry-processing`) (`BE-8-016`, `BE-8-017`).
  - Promoted and verified direct interview detail API (`GET /api/v1/interviews/:interviewId`) with candidate field omission (`BE-8-018`).
  - Early rejection state machine transition alignment (`APPLIED -> REJECTED`, `REVIEWING -> REJECTED`) (`BE-8-019`, `BEI-001`).
  - CV retention policy reconciliation: soft-deleted submitted CV access for hiring compliance audits by recruiters and admins; decoupled S3 deletion from database transaction (`BE-8-020`, `BEI-002`).
  - Versioned candidate recommendation consent & opt-out preferences (`GET/PATCH /api/v1/recommendation-preferences`) (`BE-8-021`, `BEI-003`).
  - Explainable job recommendations (`RecommendedJobDto` with `score`, `reasonCodes`, `evidence`, `limitations`), public eligibility enforcement, and active company checks (`BE-8-022`).
  - Frontend-Backend Runtime Matrix & Security Handshake (`docs/frontend-backend-runtime-matrix.md`) (`BE-8-023`).
  - Deterministic search corpus fixture and automated latency benchmark (`test/fixtures/search-corpus.json`, `docs/search-performance-handoff.md`, `test/performance/search-benchmark.spec.ts`) (`BE-8-024`, `BEI-006`).

## [1.0.0] — 2026-09-10

### Added

- **Phase 1 (Platform Foundation)**:
  - NestJS 10 application scaffold with strict TypeScript (`tsconfig.json`, `tsconfig.build.json`) and zero-warning linting setup (`.eslintrc.js`, `.prettierrc`).
  - Runtime environment configuration with `class-validator` validation and sensitive error redaction (`src/config/`).
  - Docker Compose infrastructure for local development: PostgreSQL 16, Redis 7, MinIO S3-compatible storage, and Mailpit (`backend/docker-compose.yml`).
  - Initial Prisma schema and relational migration (`prisma/schema.prisma`, `prisma/migrations/20260908000000_init/migration.sql`) defining User, RefreshSession, CandidateProfile, Skill, CandidateSkill, WorkExperience, Company, CompanyMembership, OutboxEvent, and AuditLog.
  - Redis connection lifecycle management and BullMQ queue infrastructure with exponential backoff retries (`src/redis/`, `src/queues/`).
  - Transactional Outbox pattern service for atomic event persistence and delivery (`src/outbox/`).
  - Append-only structured audit logging and JSON application logger with automatic credential/CV redaction (`src/audit/`, `src/logging/`).
  - Request ID tracking middleware validating UUID format (`X-Request-Id`) and propagating across logs, responses, and errors (`src/common/middleware/`).
  - Central exception filter (`AllExceptionsFilter`) and response transform interceptor (`ResponseTransformInterceptor`) mapping errors and responses strictly to contract envelopes without stack trace leakage.
  - Global `ContractValidationPipe` returning standard `VALIDATION_ERROR` responses with field-level details.
  - OpenAPI Swagger documentation at `/api/docs` and platform health endpoints `/api/v1/health/live` and `/api/v1/health/ready`.
- **Phase 2 (Identity, Access, and Profiles)**:
  - User and RefreshSession domain modeling in Prisma with normalized lowercase email handling and unique constraints (`src/users/`).
  - Secure password hashing using Argon2id with memory-hard parameters (`19 MiB`, `2 iterations`) via `PasswordService` (`src/auth/password.service.ts`).
  - Full authentication lifecycle: user registration for `CANDIDATE` and `HR`, login with minimal JWT access tokens (15m expiry), and rotating `HttpOnly` refresh session cookies (`itziec_refresh`, 7d expiry).
  - Token-family refresh rotation with immediate reuse-attack detection and family revocation returning `401 REFRESH_TOKEN_REUSED` (`src/auth/auth.service.ts`).
  - Single-session logout and global `logout-all` revoking all active sessions for the user.
  - Role-based access control (`JwtAuthGuard`, `RolesGuard`) with account suspension enforcement (`403 ACCOUNT_SUSPENDED`).
  - Auth rate limiting guard (`AuthRateLimitGuard`) with `X-RateLimit-*` headers and `429 RATE_LIMITED` response.
  - Candidate profile management (`GET /candidates/me`, `PATCH /candidates/me`) with optimistic concurrency (`expectedVersion`, `409 VERSION_CONFLICT`) and deterministic completeness calculation (`src/candidates/`).
  - Company lifecycle and recruiter management: company creation with automatic owner membership (`POST /companies`), public/scoped profile read (`GET /companies/:companyIdOrSlug`), owner/admin update with optimistic concurrency (`PATCH /companies/:companyId`), and direct member management (`/companies/:companyId/members`) protecting against the removal of the final active owner (`400 LAST_COMPANY_OWNER`).
  - Reusable company-scope authorization service (`CompanyScopeService`) and company suspension enforcement (`403 COMPANY_SUSPENDED`).
- **Phase 3 (Jobs and Search)**:
  - Complete job lifecycle (`DRAFT`, `PUBLISHED`, `CLOSED`) with company-scoped recruiter authorization.
  - PostgreSQL full-text search with `tsvector`, English dictionary, and GIN index (`idx_jobs_search_vector`).
  - Deterministic search ranking (`RELEVANCE`, `NEWEST`, `SALARY_ASC`, `SALARY_DESC`) with ID tie-breaker.
  - Base64 opaque cursor pagination (`GET /jobs`) and Redis search caching (TTL 60s).
  - Candidate saved jobs with composite unique ownership `(candidateId, jobId)` and idempotent operations.
- **Phase 4 (Applications and Recruitment Pipeline)**:
  - Application submission transaction with composite unique constraint `(candidateId, jobId)` preventing duplicate applies.
  - Append-only status history (`ApplicationStatusEvent`) and strict recruitment state machine transitions (`APPLIED` -> `REVIEWING` -> `INTERVIEWING` -> `PASSED` / `REJECTED`).
  - Optimistic concurrency control via `expectedVersion` rejecting stale transitions with `409 VERSION_CONFLICT`.
  - Scoped application detail views with candidate/recruiter role projection and terminal state immutability.
  - Atomic domain event dispatching via Transactional Outbox.
- **Phase 5 (CVs, Interviews, and Notifications)**:
  - PDF CV upload validation (%PDF magic bytes, SHA-256 checksum, 10 MiB limit) and MinIO/S3 private storage adapter.
  - Short-lived signed download URLs (15-minute TTL) scoped to candidate owners and interviewing recruiters.
  - Retention-aware CV deletion: soft delete for referenced application CVs, hard delete for unreferenced CVs.
  - Interview scheduling, updates, completion, and cancellation with recruiter feedback preservation.
  - Multi-channel notification dispatching: in-app notifications and versioned email delivery via Nodemailer and Mailpit.
- **Phase 6 (AI Recruitment Capabilities)**:
  - Vendor-neutral `IAiProviderPort` and resilient Gemini adapter with timeout, exponential backoff, and rate-limit handling.
  - Strict PII redactor (redacting emails, phone numbers, identity cards) and versioned prompt/output validation (`v1.0`).
  - Explainable CV/JD matching orchestration with four weighted scoring components and gap analysis.
  - Natural-language search query parsing (`POST /jobs/search/parse`) into structured filters.
  - Candidate personalized job recommendations (`GET /recommendations/jobs`) excluding applied jobs.
  - Mathematical/architectural proof verifying AI has 0 dependencies on `ApplicationsService` and cannot transition applications.
- **Phase 7 (Administration, Observability, and Release Hardening)**:
  - Admin management endpoints (`AdminModule`): user listing/filters, user status moderation with automatic session revocation, company status moderation, and job moderation.
  - Append-only audit persistence and authorized query endpoint (`GET /admin/audit-logs`) with cursor pagination.
  - Prometheus metrics exporter (`GET /metrics`) exposing HTTP rates/durations, queue depth/failures, and dependency health.
  - Distributed trace propagation (`x-trace-id` / `x-request-id`) across HTTP requests, Outbox, and workers.
  - Abuse-case security suite (`abuse-cases.spec.ts`) and end-to-end recruitment lifecycle verification suite (`recruitment-lifecycle.e2e-spec.ts`).
  - Release hardening documentation: load testing, disaster recovery drill, rate limit policies, security audit reports, and operational runbooks.

### Fixed

- Resolved issue **BEI-001**: Confirmed adherence to API-CONTRACT.md Section 7 recruitment state machine transitions.
- Resolved issue **BEI-002**: Resolved submitted-CV retention policy: soft delete for referenced CVs, hard delete for unreferenced CVs.
- Resolved issue **BEI-003**: Enforced strict AI privacy, PII redaction, and proved non-autonomous AI architecture.
- Resolved issue **BEI-004**: Documented production deployment topology and environment configuration.
- Resolved issue **BEI-005**: Verified refresh-cookie attributes (`HttpOnly`, `SameSite=Lax`, path-scoped `/api/v1/auth`), credentialed CORS origin allowlisting, and CSRF protection model with automated E2E tests.
- Resolved issue **BEI-006**: Verified search performance under benchmark load achieving p95 = 5.62ms (< 100ms target).
- Resolved issue **BEI-007**: Benchmarked and selected Argon2id algorithm with versioned memory-hard parameters for password hashing.

### Changed

- Restricted implementation documentation and task tracking to backend work.

### Removed

- Removed `frontend/CLAUDE.md` and its Phase 0 documentation task because
  frontend implementation is outside the active scope.

## [0.1.0] — 2026-09-08

### Added

- Repository-wide conventions and source-of-truth hierarchy in `CLAUDE.md`.
- Implementation-oriented product requirements in `PROJECT-DETAIL.md`.
- Proposed `/api/v1` frontend/backend contract in `API-CONTRACT.md`.
- NestJS + Prisma backend conventions in `backend/CLAUDE.md`.
- Milestone roadmap for backend Phases 0 through 7.
- Detailed backend phase task tracker with stable task IDs and acceptance
  evidence.
- Backend issue register for durable defect, risk, and decision tracking.
- Documentation design spec and implementation plan under `docs/superpowers/`.

### Changed

- Confirmed React + Vite as the frontend framework and Prisma as the backend ORM.
- Verified the Phase 0 documentation baseline through path, link, reference,
  UTF-8, terminology, lifecycle, and whitespace checks.
- Reframed the README as an accurate project-status and documentation entry
  point.
- Labeled all application capabilities and endpoints as planned rather than
  implemented.

### Security

- Declared AI output advisory and prohibited autonomous application decisions.
- Established contract rules for private CV storage, short-lived downloads,
  token redaction, rotating refresh sessions, authorization scope, and
  transactional audit/outbox records.

### Known limitations

- No frontend or backend runtime application exists in this version.
- Local development commands remain targets until Phase 1 is verified.
- CV retention, early pipeline rejection, AI provider privacy, production
  topology, cookie/CSRF assumptions, search benchmarks, and password-hash
  parameters remain tracked backend decisions or risks.

## Changelog Maintenance

- `Added`: new user-visible capability, endpoint, document, or operational tool.
- `Changed`: behavioral, contract, schema, dependency, or milestone change.
- `Deprecated`: supported behavior scheduled for removal.
- `Removed`: removed behavior after its migration window.
- `Fixed`: verified defect resolution with issue reference.
- `Security`: security-relevant change or verified remediation.
- `Known limitations`: explicit release constraints that remain unresolved.

Every runtime entry should reference the affected contract section, backend task
or issue, and verification evidence in its change set.
