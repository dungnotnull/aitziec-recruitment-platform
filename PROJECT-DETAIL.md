# ITZiec Project Detail

## 1. Document Status

| Field | Value |
| --- | --- |
| Product | ITZiec AI-Powered Recruitment Platform |
| Document role | Product and business-requirement source of truth |
| Baseline status | Planned; application implementation has not started |
| Backend stack | NestJS + Prisma + PostgreSQL |
| Frontend consumer | React + Vite |
| API contract | `API-CONTRACT.md` |

This document converts the original product brief into stable, testable product
requirements. It does not assert that any capability is implemented.

## 2. Product Vision

ITZiec is an independent recruitment and technology-job platform inspired by
Vietnamese job boards. It connects candidates, recruiters, and administrators
while serving as a production-oriented learning project for backend architecture,
relational data design, search, event-driven processing, file handling, and safe
AI-assisted recruitment.

The product should help candidates discover suitable jobs and understand how
their CV aligns with a job description. It should help recruiters operate a
traceable hiring pipeline without delegating hiring decisions to AI.

## 3. Goals

- Provide a complete candidate-to-hire recruitment workflow.
- Enforce recruitment state changes transactionally and audit them.
- Support structured and full-text job discovery with predictable pagination.
- Process CV files safely through asynchronous workflows.
- Deliver reliable local email flows without sending real email.
- Add explainable, schema-validated AI assistance for matching, gap analysis,
  natural-language search, and recommendations.
- Keep local development reproducible and suitable for a portfolio project.

## 4. Non-Goals

- AI does not autonomously reject, advance, rank for final hiring decisions, or
  contact candidates.
- The initial release does not include payroll, onboarding, time tracking, video
  conferencing, or an applicant-tracking marketplace.
- The initial architecture is not a microservice estate.
- The project does not promise compatibility with arbitrary CV formats beyond
  validated PDF uploads.
- A frontend delivery backlog is outside the current backend-focused scope.

## 5. Actors and Access Boundaries

### 5.1 Guest

- Browse published, open jobs.
- Search and filter publicly visible jobs.
- Register and authenticate.

### 5.2 Candidate

- Manage only their own profile, skills, CVs, saved jobs, applications, and
  notification preferences.
- View public company and job data.
- Request AI analysis for their own CV and an eligible job.
- Never view another candidate's private data or recruiter-only notes.

### 5.3 Recruiter (`HR`)

- Manage a company only when an active company membership grants access.
- Create and manage jobs for authorized companies.
- View and process applications only for authorized company jobs.
- Schedule interviews and record recruiter-only feedback.
- Use AI screening as advisory evidence, not as an automated decision.

### 5.4 Administrator

- Moderate users, companies, jobs, and system-level resources.
- View audit information appropriate to the administrative role.
- Administrative access does not permit silent mutation; actions remain audited.

## 6. Functional Requirements

### 6.1 Identity and Access

- **AUTH-001:** A user can register with a unique normalized email and password.
- **AUTH-002:** A user can log in and receive a short-lived access token plus a
  rotatable refresh session.
- **AUTH-003:** A user can refresh a session; refresh-token reuse revokes the
  affected token family.
- **AUTH-004:** A user can log out one session or all sessions.
- **AUTH-005:** The backend enforces `CANDIDATE`, `HR`, and `ADMIN` roles plus
  resource ownership or company membership.
- **AUTH-006:** Authentication, authorization failures, and sensitive account
  changes are rate-limited and auditable.

### 6.2 Candidate Profiles

- **CAND-001:** A candidate can create and update one candidate profile.
- **CAND-002:** A candidate can maintain structured skills and work experience.
- **CAND-003:** A candidate controls profile visibility for non-application
  discovery while recruiters with an application retain necessary access.
- **CAND-004:** Profile completeness is calculated from documented fields and is
  not inferred solely by AI.

### 6.3 Companies and Membership

- **COMP-001:** Authorized HR users can create and update company profiles.
- **COMP-002:** Company membership determines which recruiters may mutate jobs,
  applications, and interviews.
- **COMP-003:** Company slugs are unique and public company data excludes private
  membership and audit details.
- **COMP-004:** Administrative moderation can suspend a company or restrict job
  publication with a recorded reason.

### 6.4 Job Management

- **JOB-001:** Authorized HR users can create draft jobs containing title,
  description, requirements, technology stack, location, experience level,
  employment type, salary range, currency, and application deadline.
- **JOB-002:** Only valid jobs may transition from `DRAFT` to `PUBLISHED`.
- **JOB-003:** Published jobs may be unpublished or closed by authorized HR or an
  administrator.
- **JOB-004:** Guests and candidates see only published, open, non-expired jobs.
- **JOB-005:** Job mutations use optimistic concurrency and create audit records.
- **JOB-006:** Salary ranges require non-negative values, matching currency, and
  `salaryMin <= salaryMax` when both bounds exist.

### 6.5 Search and Saved Jobs

- **SEARCH-001:** Users can search published jobs by full-text query over title,
  description, requirements, technologies, and keywords.
- **SEARCH-002:** Search supports filters for skill/technology, salary range,
  location, experience level, employment type, company, and freshness.
- **SEARCH-003:** Search supports deterministic sorting and cursor-based
  pagination.
- **SEARCH-004:** Ranking may combine textual relevance, skill match, experience,
  salary, location, and freshness; returned results expose no private factors.
- **SAVE-001:** A candidate can save and unsave a job idempotently.
- **SAVE-002:** A candidate can list only their own saved jobs.

### 6.6 CV Files

- **CV-001:** A candidate can upload a PDF within the configured size limit.
- **CV-002:** The backend validates filename, extension, declared MIME type,
  file signature, size, and PDF parseability before accepting processing.
- **CV-003:** CV objects are private and accessed only through authorized,
  short-lived signed URLs.
- **CV-004:** Text extraction runs asynchronously with visible processing status
  and retry-safe failure handling.
- **CV-005:** A candidate may select one active/default CV while retaining prior
  CV metadata according to the retention policy.
- **CV-006:** CV deletion removes access immediately and schedules object/text
  cleanup without leaking personal data into logs.

### 6.7 Applications and Pipeline

- **APP-001:** A candidate can apply once to an open, published, non-expired job
  using a CV they own.
- **APP-002:** Submission atomically creates the application, initial event,
  audit record, and outbox event.
- **APP-003:** Application status follows this exact baseline state machine:
  `APPLIED -> REVIEWING -> INTERVIEWING -> PASSED | REJECTED`.
- **APP-004:** Any transition not listed in APP-003 is rejected.
- **APP-005:** Status updates require authorized company access, expected version,
  actor identity, timestamp, and optional reason where allowed by the contract.
- **APP-006:** Candidates can view their application history without private HR
  notes; recruiters can view applicants for authorized jobs.
- **APP-007:** Terminal statuses are immutable in the baseline contract.
- **APP-008:** Concurrent submissions and transitions cannot create duplicates or
  bypass the state machine.

### 6.8 Interviews

- **INT-001:** An authorized recruiter can schedule an interview only for an
  application in `INTERVIEWING`.
- **INT-002:** Interview time ranges are valid UTC timestamps and end after start.
- **INT-003:** Candidate-visible instructions and recruiter-private notes are
  stored and returned separately.
- **INT-004:** Rescheduling and cancellation preserve history and emit events.
- **INT-005:** Interview scheduling, rescheduling, and cancellation trigger
  asynchronous candidate notifications.

### 6.9 Notifications and Email

- **NOTIF-001:** Domain events trigger notifications for application submission,
  status changes, interview invitations/changes, and final outcomes.
- **NOTIF-002:** Email delivery occurs through BullMQ workers and a provider-neutral
  email adapter.
- **NOTIF-003:** Development email is captured by Mailpit and never sent to real
  recipients by default.
- **NOTIF-004:** Jobs use bounded retries, exponential backoff, idempotency, and a
  failed-job inspection path.
- **NOTIF-005:** Notification delivery failure does not roll back an already
  committed recruitment-state change.

### 6.10 AI Assistance

- **AI-001:** Gemini access is isolated behind an adapter with timeout, retry,
  rate-limit, and provider-error handling.
- **AI-002:** CV extraction and CV-to-JD analysis return schema-validated,
  versioned structured output.
- **AI-003:** Matching explains component scores, matched evidence, missing skills,
  unmet requirements, and confidence or limitation information.
- **AI-004:** Gap analysis offers practical improvements without inventing skills
  or experience for the candidate.
- **AI-005:** Natural-language search produces validated structured filters; the
  search engine, not the model, executes the query.
- **AI-006:** Recommendations may use profile, skills, saved jobs, searches, and
  application history with documented scoring and privacy controls.
- **AI-007:** AI runs asynchronously when latency exceeds normal API bounds and
  exposes operation status.
- **AI-008:** Prompts, model identifiers, schema versions, latency, token usage,
  and validation outcome are observable without logging raw sensitive CV text.
- **AI-009:** Evaluation datasets cover accuracy, consistency, safety, and known
  failure modes before an AI capability is marked verified.

### 6.11 Administration and Audit

- **ADMIN-001:** Administrators can list and moderate users, companies, jobs, and
  applications through explicitly authorized operations.
- **ADMIN-002:** Moderation requires a reason and records actor, target, action,
  request ID, timestamp, and non-sensitive change metadata.
- **AUDIT-001:** The system records job lifecycle changes, application submissions
  and transitions, interview changes, CV analysis completion, role changes, and
  administrative actions.
- **AUDIT-002:** Audit records are append-only to application code and support
  authorized filtering and pagination.
- **AUDIT-003:** Audit metadata must not contain passwords, access/refresh tokens,
  provider secrets, raw CV text, or signed object URLs.

## 7. Core Workflows

### 7.1 Application Submission

```text
Candidate selects owned CV
  -> API validates identity, job eligibility, deadline, and uniqueness
  -> transaction creates application + initial history + audit + outbox
  -> response returns APPLIED application
  -> dispatcher publishes ApplicationSubmitted
  -> notification worker sends through email adapter
  -> local delivery appears in Mailpit
```

### 7.2 Application Transition

```text
Authorized HR submits targetStatus + expectedVersion
  -> backend locks/checks the current application version
  -> state machine validates the exact transition
  -> transaction updates status/version + history + audit + outbox
  -> event notifies the candidate asynchronously
```

### 7.3 CV Processing and AI Match

```text
Validated PDF upload
  -> private MinIO object + CV metadata
  -> extraction job
  -> sanitized extracted text
  -> schema-versioned Gemini request
  -> validated analysis result with provenance
  -> candidate/recruiter receives authorized advisory result
```

### 7.4 Natural-Language Search

```text
Natural-language query
  -> Gemini parser returns candidate filter object
  -> DTO/schema validation discards unsupported values
  -> PostgreSQL search executes structured filters and ranking
  -> API returns deterministic paginated results
```

## 8. Conceptual Data Model

| Aggregate or entity | Key relationships and constraints |
| --- | --- |
| User | Unique email; role; status; owns refresh sessions |
| CandidateProfile | One per candidate user; owns experience and skill links |
| Company | Has memberships and jobs; moderation state |
| CompanyMembership | Unique user/company membership; grants recruiter access |
| Job | Belongs to company; versioned lifecycle; searchable content |
| Skill | Canonical normalized skill; many-to-many with candidates and jobs |
| Cv | Owned by candidate; private object; extraction status and checksum |
| SavedJob | Unique candidate/job pair |
| Application | Unique candidate/job pair; references submission CV snapshot |
| ApplicationEvent | Append-only status history |
| Interview | Belongs to application; scheduled interval and lifecycle |
| Notification | User-facing delivery intent and read state |
| OutboxEvent | Transactionally created event awaiting dispatch |
| AiAnalysis | Versioned input references, structured output, provider provenance |
| AuditLog | Append-only actor/action/target metadata |
| RefreshSession | Hashed rotating refresh token family and revocation state |

The physical Prisma schema may split supporting tables, but it must preserve
these ownership, uniqueness, privacy, and lifecycle rules.

## 9. Non-Functional Requirements

### 9.1 Security and Privacy

- **NFR-SEC-001:** All non-public endpoints require authenticated authorization
  checks at both role and resource scope.
- **NFR-SEC-002:** Secrets are supplied through validated environment variables
  or a secret manager and never committed.
- **NFR-SEC-003:** Sensitive data is encrypted in transit; production persistence
  and object storage use platform encryption controls.
- **NFR-SEC-004:** Logs and traces apply field-level redaction.
- **NFR-SEC-005:** Dependency, authentication, upload, and authorization abuse
  paths are covered by security tests before release.

### 9.2 Reliability and Data Integrity

- **NFR-REL-001:** Database constraints back application-level uniqueness and
  state invariants where possible.
- **NFR-REL-002:** Business changes and their outbox events commit atomically.
- **NFR-REL-003:** Workers tolerate duplicate delivery without duplicate user
  effects.
- **NFR-REL-004:** Migrations are reviewed, tested on representative data, and
  include a safe deployment or rollback strategy.

### 9.3 Performance Targets

These are initial acceptance targets under documented local/staging load, not
current measurements:

- **NFR-PERF-001:** Non-AI read APIs target p95 latency below 500 ms.
- **NFR-PERF-002:** Job search targets p95 latency below 1,000 ms for the agreed
  representative dataset and query mix.
- **NFR-PERF-003:** Non-AI write APIs target p95 latency below 1,000 ms excluding
  asynchronous side effects.
- **NFR-PERF-004:** Large or provider-bound work returns an asynchronous operation
  rather than holding an HTTP request indefinitely.

### 9.4 Observability

- **NFR-OBS-001:** Every request has a propagated `X-Request-Id`.
- **NFR-OBS-002:** Structured logs include service, environment, request/job ID,
  severity, event, duration, and safe error metadata.
- **NFR-OBS-003:** Health checks distinguish liveness from dependency readiness.
- **NFR-OBS-004:** Queue depth, failure count, retries, latency, and AI provider
  failures are measurable.

### 9.5 Testing

- **NFR-TEST-001:** Unit tests cover state machines, authorization policies,
  ranking/scoring rules, validation, and AI schema parsing.
- **NFR-TEST-002:** Integration tests cover PostgreSQL/Prisma, Redis/BullMQ,
  MinIO, Mailpit/email, and adapter failure paths.
- **NFR-TEST-003:** End-to-end tests cover registration through application,
  recruiter transition, interview notification, and terminal outcome.
- **NFR-TEST-004:** CI runs formatting, linting, type checks, tests, build, and
  migration validation.

## 10. Product-Wide Business Rules

- Public reads never expose email addresses, CV objects, extracted text, private
  notes, membership details, audit metadata, or AI provider internals.
- All list endpoints have bounded pagination and deterministic ordering.
- Deletion behavior is explicit per resource; audit and legally required history
  are not silently erased by a generic delete endpoint.
- Expired or closed jobs reject new applications even if a client displays stale
  job data.
- Client-provided role, ownership, score, audit, or lifecycle fields are ignored
  or rejected unless the contract explicitly allows them.
- AI evidence never overrides deterministic eligibility, authorization, or state
  transition rules.

## 11. Delivery and Acceptance

A roadmap phase is complete only when its exit criteria in `docs/ROADMAP.md` are
met and the backend tracker contains acceptance evidence. A product capability
may be labeled `Implemented` only when its code, validation, authorization,
OpenAPI representation, and required automated tests exist. `Verified` further
requires the documented environment-level acceptance checks to pass.

Changes to this document that affect HTTP behavior must update
`API-CONTRACT.md` first or in the same atomic change. Historical scope and status
changes must also be recorded in `CHANGELOG.md`.

