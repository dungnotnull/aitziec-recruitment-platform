# Backend Development Tasks by Phases — Tracking Log

## Tracking Policy

This is the detailed execution log for the ITZiec backend. Only backend work
updates this file. `docs/ROADMAP.md` controls milestone scope; this file controls
task-level progress.

**Baseline date:** 2026-09-08  
**Current phase:** Phase 9 — Saved Job Check & Recommendation Stability (Hoàn thành và kiểm chứng ngày 2026-09-11; Toàn bộ Phase 1–9 đã hoàn tất)

**Runtime status:** Phase 9 đã hoàn tất 100% (BE-9-001 đến BE-9-005), nhưng audit tích hợp ngày 2026-09-12 đã mở lại release gate với Phase 10 (0/15 task hoàn tất). Baseline hiện tại vẫn đạt 25 unit test suites (187 tests), 10 e2e test suites (127 tests), lint 0 errors và build sạch; tuy nhiên backend chưa sẵn sàng bàn giao cuối cùng cho frontend cho đến khi các lỗi P0/P1 về quyền sở hữu CV, idempotency, outbox/queue, AI bất đồng bộ và đồng bộ default CV được sửa và kiểm chứng.

Task syntax:

- `[ ]`: planned or incomplete.
- `[x]`: completed and verified with evidence.
- An active but incomplete task remains `[ ]` and receives an indented dated
  `In progress` note.
- `Refs` points to requirements in `../PROJECT-DETAIL.md`.
- `Depends` names prerequisite task IDs; `None` means independently startable.
- `Evidence` states the minimum proof required before checking the item.

> Ghi chú: không đánh dấu `[x]` chỉ vì đã tạo file hoặc code compile. Phải đạt
> toàn bộ evidence ghi trên task.

## Backend API Inventory

### Audit Basis and Confidence

This inventory was originally predicted from
`itziec_recruitment_platform_details.md`, `PROJECT-DETAIL.md`,
`API-CONTRACT.md`, the roadmap, and the issue register before backend source was
implemented. The repository now contains the NestJS application, Prisma schema
and migrations, controllers, DTOs, guards, and automated tests. Consequently:

- Evidence recorded in completed phase tasks supersedes an older inventory row
  that still says `No runtime code`.
- The focused 2026-09-10 source audit and Phase 8 tasks below supersede the
  original baseline for the frontend-integration gaps.
- Proposed rows outside the current contract must update `API-CONTRACT.md`
  before implementation.

Action values:

| Action | Meaning |
| --- | --- |
| `ADD` | Implement the endpoint already defined by `API-CONTRACT.md` |
| `REUSE` | Implement once and intentionally use for multiple roles/functions |
| `CHANGE_CONTRACT` | Requirement supports the endpoint, but update the contract first |
| `NEEDS_DECISION` | Product/security/ownership behavior must be confirmed first |
| `REMOVE` | Proven duplicate or out-of-scope runtime endpoint; none currently found |

All endpoint paths below are relative to `/api/v1`.

### 2026-09-10 Focused Runtime Re-audit

| Area | Confirmed source evidence | Required disposition |
| --- | --- | --- |
| Jobs migration | `prisma/migrations/20260909000000_jobs_and_saved_jobs/migration.sql` uses `array_to_string("technologyNames", ' ')` inside a stored generated column; PostgreSQL rejects the generated expression as non-immutable with `42P17`, surfaced by Prisma as `P3018` | Replace the generated expression with a migration-safe maintained `tsvector`, recover the failed migration record, and prove `prisma migrate deploy` against disposable PostgreSQL |
| Public jobs API | `SearchController` exposes `GET /jobs`; `SearchService.searchJobs` queries `prisma.job`, including `experienceLevel`; no real-PostgreSQL regression currently proves `experienceLevel=FRESHER` after deployment | Restore schema availability, validate enum query values, and add deployment-backed `200`/filter regression coverage |
| Notification unit isolation | `test/unit/notifications.spec.ts` constructs the real Nodemailer-backed `EmailService`; a 2026-09-10 run with `--testTimeout=1000` produced exactly four timeouts for `ApplicationSubmitted`, `ApplicationStatusChanged`, `InterviewScheduled`, and `InterviewCancelled` while the other four tests passed | Inject a typed mocked email port/service; assert calls and prevent sockets/open handles in unit tests |
| Skill catalog | Prisma `Skill` has only `id`, `name`, and `createdAt`; there is no `src/skills` module, alias model, active flag, or `GET /skills` route | Add catalog schema, migration, read API, filtering, deterministic pagination, and tests |
| Recruiter companies | `CompaniesController` has no static `GET /companies/mine`; `CompaniesService` has no current-user membership query | Add the route before `:companyIdOrSlug`, return every caller membership with role plus company status/version, and test multi-company/empty/denied cases |
| Recruiter job workspace | `JobsController` supports `POST /companies/:companyId/jobs` but no `GET` on the same path; public `GET /jobs` intentionally forces `PUBLISHED`, active-company, and non-expired filters | Add a company-scoped management query that includes `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `CLOSED`, and expired jobs without changing public visibility |
| Member invitation | `CompaniesService.addMember` throws `RESOURCE_NOT_FOUND` when the normalized email has no user and emits no notification/email when a member is added | Preserve direct-add behavior for registered users, persist a secure pending invite for new users, add acceptance, and emit auditable notification/email intents |
| Admin collections | `AdminController` exposes user list plus company/job moderation commands, but no `GET /admin/companies` or `GET /admin/jobs` | Add admin-only searchable/filterable cursor collections containing resource `version` |
| Admin applications | Admin can reuse generic application detail/transition routes, but there is no admin application collection or explicit moderation contract; the generic detail projection exposes fields unsuitable for an admin collection | Add admin list/detail/moderation APIs, strict DTOs, optimistic concurrency, audit records, and explicit redacted projections |
| CV asynchronous processing | `CvsService.uploadCv` awaits in-request text extraction and then returns a random completed `OperationDto` that is never persisted; no CV extraction worker consumes `QUEUES.CV_EXTRACTION`, so `GET /operations/:operationId` cannot track the upload result | Persist the extraction operation atomically, enqueue only identifiers, process the private object in a BullMQ worker, and make upload/retry polling truthful and retry-safe |
| Failed CV retry | No controller/service route implements proposed `POST /cvs/:cvId/retry-processing`; failed CVs have a failure code but no bounded, idempotent recovery path | Approve eligibility, attempts and errors, then create a new persisted extraction operation without duplicating the CV or exposing its object key |
| Contract/runtime drift | `GET /interviews/:interviewId` exists with role projection, while `API-CONTRACT.md` and this inventory still call it proposed; BEI-001/BEI-002 remain undecided even though strict transition and soft-delete code/policies were marked complete | Reconcile runtime, product decision, contract, issue status and cross-role e2e evidence before frontend live verification |
| Recommendations | `GET /recommendations/jobs` computes a score but returns only `JobDto`, has no reason codes or consent/opt-out state, silently accepts an invalid cursor, and does not require `company.status=ACTIVE` | Add approved preference APIs and explainable safe projection; enforce opt-out, public-job eligibility and strict cursor behavior |
| Browser/production integration | Backend config supports a CORS list and refresh-cookie flags, but the production topology does not pin the frontend/API origin matrix, cookie-domain/proxy behavior, CSRF acceptance, exposed correlation headers or shared telemetry metadata | Publish and test an environment-specific browser security/observability handshake with the frontend deployment owner |
| Search performance evidence | `BEI-006` remains open; `docs/load-test-report.md` mentions 150 jobs and random queries without a versioned corpus generator, expected ordering, reproducible command, resource/concurrency profile or frontend-consumable long-content cases | Create deterministic sanitized fixtures and query judgments, then rerun real PostgreSQL cold/warm-cache load evidence shared with frontend performance gates |

### Platform Health and API Metadata

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-OPS-001` | Process liveness | `GET` | `/health/live` | Public | Confirm that the API process is alive without checking dependencies | NFR-OBS-003 | Implemented in `src/health/health.controller.ts`; verified by `test/unit/health.spec.ts` | `ADD` |
| `API-OPS-002` | Dependency readiness | `GET` | `/health/ready` | Internal or production-protected | Report whether required dependencies are ready without exposing topology | NFR-OBS-003 | Implemented in `src/health/health.controller.ts`; verified by `test/unit/health.spec.ts` | `ADD` |
| `API-OPS-003` | OpenAPI document | `GET` | `/openapi.json` (proposed) | Internal or environment-controlled | Expose the generated OpenAPI document for contract verification and tooling | NFR-TEST-004 | No contract or runtime code | `NEEDS_DECISION` |

### Authentication and Refresh Sessions

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-AUTH-001` | Register user | `POST` | `/auth/register` | Guest | Create a `CANDIDATE` or `HR` account and return an access session | AUTH-001 | Implemented in `src/auth/`; verified by `test/e2e/auth.e2e-spec.ts` | `ADD` |
| `API-AUTH-002` | Log in | `POST` | `/auth/login` | Guest | Verify credentials, create a refresh session, and return an access token | AUTH-002 | Implemented in `src/auth/`; verified by `test/e2e/auth.e2e-spec.ts` | `ADD` |
| `API-AUTH-003` | Refresh session | `POST` | `/auth/refresh` | Valid refresh cookie | Rotate the refresh token and issue a new access token | AUTH-003 | Implemented in `src/auth/`; verified by `test/e2e/auth.e2e-spec.ts` | `ADD` |
| `API-AUTH-004` | Log out current session | `POST` | `/auth/logout` | Refresh cookie | Revoke the current refresh session and clear its cookie | AUTH-004 | Implemented in `src/auth/`; verified by `test/e2e/auth.e2e-spec.ts` | `ADD` |
| `API-AUTH-005` | Log out all sessions | `POST` | `/auth/logout-all` | Authenticated | Revoke all refresh sessions owned by the current user | AUTH-004 | Implemented in `src/auth/`; verified by `test/e2e/auth.e2e-spec.ts` | `ADD` |
| `API-AUTH-006` | Current authenticated user | `GET` | `/auth/me` | Authenticated | Return the current user identity, role, and account status | AUTH-002, AUTH-005 | Implemented in `src/auth/`; verified by `test/e2e/auth.e2e-spec.ts` | `REUSE` |

### Candidate Profile, Skills, and Experience

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-CAND-001` | Read own candidate profile | `GET` | `/candidates/me` | Candidate | Return the authenticated candidate's profile, skills, experience, visibility, and default CV reference | CAND-001–004 | Implemented in `src/candidates/`; verified by `test/e2e/candidates.e2e-spec.ts` | `ADD` |
| `API-CAND-002` | Update profile, skills, and experience | `PATCH` | `/candidates/me` | Candidate | Update owned profile fields and replace validated skills/experience with optimistic concurrency | CAND-001–004 | Implemented in `src/candidates/`; verified by `test/e2e/candidates.e2e-spec.ts` | `REUSE` |

The profile PATCH intentionally serves profile fields, skills, and work
experience. Separate CRUD endpoints for every skill/experience row are not
required by the current product and would duplicate the aggregate update model.

### Skill Catalog

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-SKILL-001` | Search/list canonical skills | `GET` | `/skills` (proposed) | Authenticated; public if approved | Supply canonical skills for candidate profiles, job requirements, search, and AI normalization | CAND-002, JOB-001, SEARCH-002 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-SKILL-002` | Create canonical skill | `POST` | `/admin/skills` (proposed) | Admin | Add a normalized skill to the catalog | CAND-002, JOB-001 | No contract or runtime code | `NEEDS_DECISION` |
| `API-SKILL-003` | Update canonical skill | `PATCH` | `/admin/skills/:skillId` (proposed) | Admin | Correct display name, aliases, or active state without breaking references | CAND-002, JOB-001 | No contract or runtime code | `NEEDS_DECISION` |
| `API-SKILL-004` | Read canonical skill detail | `GET` | `/skills/:skillId` (proposed) | Authenticated; public if approved | Return normalized skill metadata and aliases | CAND-002, SEARCH-002 | No contract or runtime code | `NEEDS_DECISION` |
| `API-SKILL-005` | Merge duplicate skills | `POST` | `/admin/skills/:skillId/merge` (proposed) | Admin | Repoint references from a duplicate skill to a canonical target with audit history | AUDIT-001, SEARCH-002 | No contract or runtime code | `NEEDS_DECISION` |

Skill read access, administration, aliasing, and merge behavior must be approved
before the catalog becomes a managed public resource. At minimum, a read/search
interface or a documented seed-only strategy is required.

### Companies and Recruiter Memberships

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-COMP-001` | Create company | `POST` | `/companies` | HR | Create a company and atomically make the caller its owner | COMP-001–003 | Implemented in `src/companies/`; verified by `test/e2e/companies.e2e-spec.ts` | `ADD` |
| `API-COMP-002` | Read public/scoped company | `GET` | `/companies/:companyIdOrSlug` | Public; scoped member/admin for non-public fields | Return the public company profile with an authorized projection | COMP-001–003 | Implemented in `src/companies/`; verified by `test/e2e/companies.e2e-spec.ts` | `REUSE` |
| `API-COMP-003` | Update company | `PATCH` | `/companies/:companyId` | Company owner or admin | Update authorized company fields with expected version | COMP-001–004 | Implemented in `src/companies/`; verified by `test/e2e/companies.e2e-spec.ts` | `ADD` |
| `API-COMP-004` | List company members | `GET` | `/companies/:companyId/members` | Company member or admin | Return cursor-paginated memberships for an authorized company | COMP-002 | Implemented in `src/companies/`; verified by `test/e2e/companies.e2e-spec.ts` | `ADD` |
| `API-COMP-005` | Add company member directly | `POST` | `/companies/:companyId/members` | Company owner or admin | Grant an existing user company membership by email | COMP-002 | Implemented in `src/companies/`; verified by `test/e2e/companies.e2e-spec.ts` | `ADD` |
| `API-COMP-006` | Remove company member | `DELETE` | `/companies/:companyId/members/:memberId` | Company owner or admin | Revoke membership while protecting the final active owner | COMP-002 | Implemented in `src/companies/`; verified by `test/e2e/companies.e2e-spec.ts` | `ADD` |
| `API-COMP-007` | List caller's companies | `GET` | `/companies/mine` (proposed) | HR | Return companies and membership roles available to the current HR user | COMP-002 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-COMP-008` | Create membership invitation | `POST` | `/companies/:companyId/invitations` (proposed) | Company owner or admin | Invite a user without directly granting access before acceptance | COMP-002 | No contract or runtime code | `NEEDS_DECISION` |
| `API-COMP-009` | List pending invitations | `GET` | `/companies/:companyId/invitations` (proposed) | Company owner or admin | Review active and expired company invitations | COMP-002 | No contract or runtime code | `NEEDS_DECISION` |
| `API-COMP-010` | Revoke invitation | `DELETE` | `/companies/:companyId/invitations/:invitationId` (proposed) | Company owner or admin | Cancel an unused company invitation | COMP-002 | No contract or runtime code | `NEEDS_DECISION` |
| `API-COMP-011` | Accept invitation | `POST` | `/company-invitations/:token/accept` (proposed) | Authenticated invited user | Validate an invitation and create membership atomically | COMP-002 | No contract or runtime code | `NEEDS_DECISION` |

The contract currently chooses direct membership insertion. Invitation APIs are
not added automatically; confirm whether direct insertion is acceptable for the
first release.

### Jobs, Lifecycle, and Search

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-JOB-001` | Public job browse/search | `GET` | `/jobs` | Public | Search published, open, non-expired jobs with filters, sorting, and cursor pagination | JOB-004, SEARCH-001–004 | No runtime code | `REUSE` |
| `API-JOB-002` | Read job detail | `GET` | `/jobs/:jobIdOrSlug` | Public for eligible jobs; scoped HR/admin for non-public jobs | Return job detail using a role-appropriate visibility projection | JOB-001–005 | No runtime code | `REUSE` |
| `API-JOB-003` | Create draft job | `POST` | `/companies/:companyId/jobs` | Scoped HR or admin | Create a validated draft job for an authorized company | JOB-001, JOB-006 | No runtime code | `ADD` |
| `API-JOB-004` | Update job | `PATCH` | `/jobs/:jobId` | Scoped HR or admin | Update allowed job content with expected version and audit | JOB-001, JOB-005–006 | No runtime code | `ADD` |
| `API-JOB-005` | Publish job | `POST` | `/jobs/:jobId/publish` | Scoped HR or admin | Validate publish eligibility and transition a job to `PUBLISHED` | JOB-002, JOB-005 | No runtime code | `ADD` |
| `API-JOB-006` | Unpublish job | `POST` | `/jobs/:jobId/unpublish` | Scoped HR or admin | Remove a published job from public discovery while preserving it | JOB-003, JOB-005 | No runtime code | `ADD` |
| `API-JOB-007` | Close job | `POST` | `/jobs/:jobId/close` | Scoped HR or admin | Close recruitment for the job with version and optional reason | JOB-003–005 | No runtime code | `ADD` |
| `API-JOB-008` | Parse natural-language search | `POST` | `/jobs/search/parse` | Public, rate-limited | Convert a natural-language query into validated `JobSearchFilters` | AI-005, SEARCH-002 | No runtime code | `ADD` |
| `API-JOB-009` | Recruiter company-job list | `GET` | `/companies/:companyId/jobs` (proposed) | Scoped HR or admin | List draft, published, unpublished, closed, and expired company jobs for management | JOB-001–005 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-JOB-010` | Reopen closed job | `POST` | `/jobs/:jobId/reopen` (proposed) | Scoped HR or admin | Reopen a closed job after validating deadline and lifecycle rules | Original “open/close” wording, JOB-003 | No contract or runtime code | `NEEDS_DECISION` |
| `API-JOB-011` | Delete draft job | `DELETE` | `/jobs/:jobId` (proposed) | Scoped HR or admin | Remove a never-published draft when retention and audit rules allow it | Original job management wording | No contract or runtime code | `NEEDS_DECISION` |

Public `/jobs` cannot replace the recruiter company-job list because public
search must hide draft, unpublished, closed, and expired records.

### Saved Jobs

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-SAVE-001` | List saved jobs | `GET` | `/saved-jobs` | Candidate | Return only the caller's saved jobs with cursor pagination | SAVE-002 | No runtime code | `ADD` |
| `API-SAVE-002` | Save job | `PUT` | `/saved-jobs/:jobId` | Candidate | Idempotently create the candidate/job bookmark | SAVE-001 | No runtime code | `ADD` |
| `API-SAVE-003` | Unsave job | `DELETE` | `/saved-jobs/:jobId` | Candidate | Idempotently remove the candidate/job bookmark | SAVE-001 | No runtime code | `ADD` |
| `API-SAVE-004` | Check saved-job state | `GET` | `/saved-jobs/:jobId/check` | Candidate | Return whether the caller owns a bookmark for the requested job | SAVE-001–002 | Contract đã được phê duyệt và cập nhật trong API-CONTRACT.md; triển khai tại Phase 9 | `ADD` |

### CV Files and Processing

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-CV-001` | Upload CV PDF | `POST` | `/cvs` | Candidate | Validate and store one private PDF, then create an extraction operation | CV-001–004 | No runtime code | `ADD` |
| `API-CV-002` | List owned CVs | `GET` | `/cvs` | Candidate | Return cursor-paginated CV metadata owned by the caller | CV-003–005 | No runtime code | `ADD` |
| `API-CV-003` | Read CV metadata/status | `GET` | `/cvs/:cvId` | Owner, application-scoped HR, or admin | Return authorized metadata and processing status without raw object keys/text | CV-003–005 | No runtime code | `REUSE` |
| `API-CV-004` | Select default CV | `POST` | `/cvs/:cvId/default` | Owner candidate | Atomically select one default CV with expected version | CV-005 | No runtime code | `ADD` |
| `API-CV-005` | Create signed download | `POST` | `/cvs/:cvId/download-url` | Owner, application-scoped HR, or admin | Return a short-lived authorized private-object URL | CV-003 | No runtime code | `ADD` |
| `API-CV-006` | Delete CV | `DELETE` | `/cvs/:cvId` | Owner candidate | Remove access and schedule safe cleanup under the approved application-retention policy | CV-006, APP-001 | No runtime code | `ADD`; blocked by BEI-002 |
| `API-CV-007` | Retry failed extraction | `POST` | `/cvs/:cvId/retry-processing` (proposed) | Owner candidate or admin | Create a new idempotent extraction operation for a retryable failed CV | CV-004, NOTIF-004 | No contract or runtime code | `CHANGE_CONTRACT` |

`GET /cvs/:cvId` is reused for extraction-status polling. It must not be merged
with signed download creation because metadata reads and private access grants
have different security, expiry, audit, and caching behavior.

### Applications and Recruitment Pipeline

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-APP-001` | Submit application | `POST` | `/jobs/:jobId/applications` | Candidate; idempotency key required | Atomically create one application, initial history, audit, and outbox event | APP-001–002, APP-008 | No runtime code | `ADD` |
| `API-APP-002` | List own applications | `GET` | `/applications` | Candidate | Return the caller's applications with status filters and cursor pagination | APP-006 | No runtime code | `ADD` |
| `API-APP-003` | Read application detail/history | `GET` | `/applications/:applicationId` | Candidate owner, scoped HR, or admin | Return a role-specific application projection and ordered public history | APP-006 | No runtime code | `REUSE` |
| `API-APP-004` | List applicants for job | `GET` | `/jobs/:jobId/applications` | Scoped HR or admin | Return applicants for an authorized job with status/sort/cursor controls | APP-006 | No runtime code | `ADD` |
| `API-APP-005` | Transition application status | `POST` | `/applications/:applicationId/transitions` | Scoped HR or admin; idempotency key required | Apply one allowed transition with expected version, history, audit, and outbox | APP-003–005, APP-007–008 | No runtime code | `REUSE` |

One transition endpoint intentionally replaces separate reviewing, interviewing,
pass, and reject endpoints. The state matrix remains blocked by BEI-001 until
the early-rejection decision is confirmed.

### Interviews and Recruiter Feedback

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-INT-001` | Schedule interview | `POST` | `/applications/:applicationId/interviews` | Scoped HR or admin; idempotency key required | Schedule an interview for an application in `INTERVIEWING` and emit notification intent | INT-001–003, INT-005 | No runtime code | `ADD` |
| `API-INT-002` | List application interviews | `GET` | `/applications/:applicationId/interviews` | Candidate owner, scoped HR, or admin | Return role-specific interview history for one application | INT-003–004 | No runtime code | `REUSE` |
| `API-INT-003` | Reschedule/update interview | `PATCH` | `/interviews/:interviewId` | Scoped HR or admin | Update schedule, instructions, private notes, or feedback with expected version | INT-002–005 | No runtime code | `REUSE` |
| `API-INT-004` | Complete interview | `POST` | `/interviews/:interviewId/complete` | Scoped HR or admin | Mark the interview completed and optionally save recruiter feedback without changing application status | INT-003–004 | No runtime code | `ADD` |
| `API-INT-005` | Cancel interview | `POST` | `/interviews/:interviewId/cancel` | Scoped HR or admin | Cancel with a reason, preserve history, and emit candidate notification intent | INT-004–005 | No runtime code | `ADD` |
| `API-INT-006` | Read interview detail | `GET` | `/interviews/:interviewId` (contract promotion required) | Candidate owner, scoped HR, or admin | Return one role-specific interview without loading the full application list | INT-003–004 | Runtime route exists in `src/interviews/interviews.controller.ts`; shared contract and complete cross-role evidence are missing | `CHANGE_CONTRACT` |

The interview PATCH is shared by rescheduling, candidate instructions, private
notes, and feedback. Complete/cancel remain explicit lifecycle actions because
they have distinct validation, audit, event, and notification behavior.

### Notifications

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-NOTIF-001` | List notifications | `GET` | `/notifications` | Authenticated owner | Return owned notifications with read-state filter and cursor pagination | NOTIF-001 | No runtime code | `ADD` |
| `API-NOTIF-002` | Set notification read state | `PATCH` | `/notifications/:notificationId/read` | Owner | Mark one owned notification read or unread | NOTIF-001 | No runtime code | `ADD` |
| `API-NOTIF-003` | Mark all notifications read | `PATCH` | `/notifications/read-all` (proposed) | Authenticated owner | Mark the caller's current notifications read in one bounded operation | NOTIF-001 | No contract or runtime code | `NEEDS_DECISION` |
| `API-NOTIF-004` | Read notification preferences | `GET` | `/notification-preferences` (proposed) | Authenticated owner | Return channel/event preferences if user-controlled delivery is required | NOTIF-001–003 | No contract or runtime code | `NEEDS_DECISION` |
| `API-NOTIF-005` | Update notification preferences | `PATCH` | `/notification-preferences` (proposed) | Authenticated owner | Configure allowed email/in-app channels without disabling mandatory system notices | NOTIF-001–003 | No contract or runtime code | `NEEDS_DECISION` |

Email sending itself is a background worker behavior, not a public email-send
API. Application and interview APIs create events; notification workers reuse
those events.

### Asynchronous Operations and AI

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-AI-001` | Create CV/JD analysis | `POST` | `/ai/cv-job-analyses` | CV owner, application-scoped HR, or admin; idempotency key required | Queue one request for CV/job matching and/or gap analysis | AI-002–004, AI-007 | No runtime code | `REUSE` |
| `API-AI-002` | Read AI analysis | `GET` | `/ai/analyses/:analysisId` | Input owner, application-scoped HR, or admin | Return schema-validated advisory result and provenance | AI-002–004, AI-008 | No runtime code | `REUSE` |
| `API-AI-003` | Read asynchronous operation | `GET` | `/operations/:operationId` | Operation owner or scoped admin | Poll status/results for CV extraction and all long-running AI work | CV-004, AI-007 | No runtime code | `REUSE` |
| `API-AI-004` | List job recommendations | `GET` | `/recommendations/jobs` | Candidate | Return explainable, deterministic, cursor-paginated job recommendations | AI-006 | Runtime returns `JobDto` only; score/reason projection, consent gate, active-company filter and strict invalid-cursor behavior are missing | `CHANGE_CONTRACT` |
| `API-AI-005` | Start batch job screening | `POST` | `/jobs/:jobId/ai-screenings` (proposed) | Scoped HR or admin | Queue analysis of eligible job applicants without requiring one request per CV | AI-001–003, AI-007 | No contract or runtime code | `NEEDS_DECISION` |
| `API-AI-006` | Read batch screening | `GET` | `/jobs/:jobId/ai-screenings/:screeningId` (proposed) | Scoped HR or admin | Return progress and advisory applicant analysis references for one batch | AI-001–003, AI-007–008 | No contract or runtime code | `NEEDS_DECISION` |
| `API-AI-007` | Read recommendation preferences | `GET` | `/recommendation-preferences` (proposed) | Candidate | Return the caller's recommendation consent/opt-out state, approved data-source disclosure version and optimistic-lock version | AI-006, NFR-SEC-003–004 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-AI-008` | Update recommendation preferences | `PATCH` | `/recommendation-preferences` (proposed) | Candidate | Opt in or out with explicit consent-policy version and `expectedVersion`, then audit without sensitive profile data | AI-006, NFR-SEC-003–004 | No contract or runtime code | `CHANGE_CONTRACT` |

Natural-language parsing is `API-JOB-008`. Structured CV-profile extraction is
triggered by CV upload/processing and returns through the generic operation and
analysis resources; no additional public endpoint is required unless manual
re-analysis is approved.

### Administration, Moderation, Audit, and Queue Operations

| API ID | Function | Method | Endpoint | Access | Purpose | Requirement | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API-ADMIN-001` | List users | `GET` | `/admin/users` | Admin | Filter and paginate user accounts for moderation | ADMIN-001 | No runtime code | `ADD` |
| `API-ADMIN-002` | Change user status | `PATCH` | `/admin/users/:userId/status` | Admin | Suspend, activate, or disable a user with required reason and audit | ADMIN-001–002, AUDIT-001 | No runtime code | `ADD` |
| `API-ADMIN-003` | Change company status | `PATCH` | `/admin/companies/:companyId/status` | Admin | Suspend or activate a company with reason, version check, and audit | COMP-004, ADMIN-001–002 | No runtime code | `ADD` |
| `API-ADMIN-004` | Moderate job | `POST` | `/admin/jobs/:jobId/moderate` | Admin | Reuse job lifecycle to unpublish or close a job with reason and audit | ADMIN-001–002 | No runtime code | `ADD` |
| `API-ADMIN-005` | Query audit logs | `GET` | `/admin/audit-logs` | Admin | Filter append-only audit records by actor, action, target, and time | AUDIT-001–003 | No runtime code | `ADD` |
| `API-ADMIN-006` | Read user detail | `GET` | `/admin/users/:userId` (proposed) | Admin | Return moderation-safe user/account/session summary without secrets | ADMIN-001 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-007` | Change user role | `PATCH` | `/admin/users/:userId/role` (proposed) | Restricted admin | Change role with explicit compatibility checks, reason, session impact, and audit | ADMIN-001–002, AUDIT-001 | No contract or runtime code | `NEEDS_DECISION` |
| `API-ADMIN-008` | List companies for moderation | `GET` | `/admin/companies` (proposed) | Admin | Filter all company statuses and moderation attributes | ADMIN-001, COMP-004 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-009` | Read company moderation detail | `GET` | `/admin/companies/:companyId` (proposed) | Admin | Return company, status, ownership summary, and safe moderation history | ADMIN-001, COMP-004 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-010` | List jobs for moderation | `GET` | `/admin/jobs` (proposed) | Admin | Filter all jobs including draft/unpublished/closed/moderated states | ADMIN-001 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-011` | Read job moderation detail | `GET` | `/admin/jobs/:jobId` (proposed) | Admin | Return job lifecycle, company, safe audit summary, and moderation context | ADMIN-001–002 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-012` | List applications for oversight | `GET` | `/admin/applications` (proposed) | Admin | Filter applications across companies without exposing unnecessary CV content | ADMIN-001, AUDIT-003 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-013` | Queue summary | `GET` | `/admin/queues` (proposed) | Operational admin | Return queue depth, active, delayed, retry, and failed counts | NOTIF-004, NFR-OBS-004 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-014` | List queue jobs | `GET` | `/admin/queues/:queueName/jobs` (proposed) | Operational admin | Filter failed/delayed/active jobs using safe payload projections | NOTIF-004, NFR-OBS-004 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-015` | Read queue job | `GET` | `/admin/queues/:queueName/jobs/:jobId` (proposed) | Operational admin | Inspect safe status, attempts, timestamps, and classified failure details | NOTIF-004, NFR-OBS-004 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-016` | Retry failed queue job | `POST` | `/admin/queues/:queueName/jobs/:jobId/retry` (proposed) | Operational admin | Audit and retry only a classified retryable job while preserving idempotency | NOTIF-004, NFR-REL-003 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-017` | Read application moderation detail | `GET` | `/admin/applications/:applicationId` (proposed) | Admin | Return a moderation-safe application projection with status history and version while omitting raw CV content, signed URLs, contact fields, and private notes | ADMIN-001, AUDIT-003 | No contract or runtime code | `CHANGE_CONTRACT` |
| `API-ADMIN-018` | Moderate application | `POST` | `/admin/applications/:applicationId/moderate` (proposed) | Admin | Apply a valid application state transition with mandatory reason, `expectedVersion`, append-only history, and audit metadata | ADMIN-001–002, APP-003–005, AUDIT-001–003 | No contract or runtime code | `CHANGE_CONTRACT` |

The 2026-09-10 frontend integration requirement supersedes the earlier plan to
reuse generic application paths for all admin workflows. Admin application
reads and moderation now require explicit admin paths and admin-safe
projections. Application moderation must still reuse the same lifecycle policy
and transactional history rules as recruiter transitions rather than directly
updating status fields. Admin job moderation must likewise call shared job
lifecycle policy rather than bypassing it.

## API Inventory Findings

### Original Planning Baseline (2026-09-08)

- Verified runtime APIs at the original baseline: **0**.
- APIs requiring implementation or a pre-implementation decision at the
  original baseline: **86**. Phase completion evidence and the focused runtime
  re-audit above supersede these historical counts.
- APIs already defined in `API-CONTRACT.md` at the original baseline: **54**.
- Additional predicted API rows not yet in the contract at the original
  baseline: **32**.
- Original action breakdown: **41 `ADD`**, **13 `REUSE`**, **15 `CHANGE_CONTRACT`**,
  **17 `NEEDS_DECISION`**, and **0 `REMOVE`**.
- At the original baseline all 86 rows were `NOT_IMPLEMENTED`; completed phase
  evidence and the 2026-09-10 re-audit now determine runtime status.
- The current documented inventory contains **90** unique API IDs after adding
  explicit admin application and recommendation-preference operations; this is
  a planning count, not a claim that all 90 routes exist.

### APIs Intentionally Shared

| Shared API | Reused for |
| --- | --- |
| `GET /auth/me` | Current identity for every authenticated role |
| `PATCH /candidates/me` | Candidate profile, skills, and work-experience aggregate update |
| `GET /companies/:companyIdOrSlug` | Public company view and authorized scoped view |
| `GET /jobs` | Browse, keyword search, structured filters, sorting, and pagination |
| `GET /jobs/:jobIdOrSlug` | Public job detail and scoped non-public HR/admin detail |
| `GET /cvs/:cvId` | CV metadata plus extraction-status polling |
| `GET /applications/:applicationId` | Candidate, scoped HR, and admin projections |
| `POST /applications/:applicationId/transitions` | Every approved application status transition |
| `GET /applications/:applicationId/interviews` | Candidate-visible and recruiter/admin interview lists |
| `PATCH /interviews/:interviewId` | Reschedule, instructions, notes, and feedback updates |
| `POST /ai/cv-job-analyses` | CV/JD matching and CV gap analysis |
| `GET /ai/analyses/:analysisId` | Candidate and scoped recruiter/admin analysis reads |
| `GET /operations/:operationId` | CV extraction and all asynchronous AI operation polling |

### Missing Contract APIs With Clear Requirement Support

These should update `API-CONTRACT.md` before implementation:

- Skill search/list: `GET /skills`.
- Current HR company list: `GET /companies/mine`.
- Recruiter list of all company jobs: `GET /companies/:companyId/jobs`.
- Pending invitation result on `POST /companies/:companyId/members` and secure
  acceptance via `POST /company-invitations/:token/accept`.
- Retry failed CV extraction: `POST /cvs/:cvId/retry-processing`.
- Interview detail contract promotion: runtime `GET /interviews/:interviewId`
  already exists but is absent from the shared contract.
- Recommendation consent/opt-out: `GET/PATCH /recommendation-preferences`, plus
  an approved explainable projection for `GET /recommendations/jobs`.
- Admin user detail, company/job collections, and explicit application
  list/detail/moderation operations.
- Operational queue summary, job inspection, and retry endpoints.

### Decision-Dependent APIs

- OpenAPI document exposure and production access policy.
- Skill administration and merge behavior; Phase 8 covers read-only alias and
  active-state behavior.
- Pending-invitation status, expiry, acceptance and response contract under
  BE-8-001; registered-user direct membership remains backward-compatible.
- Reopen and draft-delete job lifecycle actions.
- Mark-all-read and notification preferences.
- Job-level batch AI screening.
- Administrative user-role mutation.

### Duplicate or Excess API Review

No runtime API exists, so none can be proven duplicate or removable. The
following candidate duplicates should **not** be added:

- Separate application endpoints such as `/review`, `/interview`, `/pass`, and
  `/reject`; use the single transition endpoint and state matrix.
- Separate candidate-skill and experience CRUD endpoints unless aggregate PATCH
  becomes unworkable; current requirements are satisfied by `/candidates/me`.
- Admin-specific application detail or transition paths; reuse scoped application
  APIs.
- A direct email-send endpoint; email is triggered by domain events and workers.
- A second polling endpoint for every asynchronous feature; reuse `/operations`.
- A CV download response embedded in metadata; keep access grants separate.

Common platform APIs not required by the original scope and therefore excluded
from the implementation backlog until explicitly requested:

- Password recovery/change and email verification.
- Social login or single sign-on.
- Candidate application withdrawal or application deletion.
- Recruiter/candidate chat and arbitrary email composition.
- Public company directory, job bulk import, billing, and payments.
- Administrative hard-delete endpoints for users, companies, jobs, applications,
  audit records, or CV history.

## Database and Schema Prerequisites

Before the affected APIs can be implemented, Prisma/PostgreSQL needs:

- `User`, hashed `RefreshSession`, account status, role, unique normalized email,
  refresh family/revocation/expiry indexes.
- `CandidateProfile`, `Skill`, candidate-skill join, work experience, one-profile
  constraint, and deterministic profile-completeness inputs.
- `Company`, unique slug, `CompanyMembership`, unique company/user membership,
  owner-role constraints, and optional invitation tables if approved.
- `Job`, technology/skill relations, lifecycle timestamps, optimistic `version`,
  salary/deadline checks, public visibility indexes, search `tsvector`, and GIN
  indexes.
- `SavedJob` with unique candidate/job constraint.
- `Cv` with owner, private object key, checksum, extraction status, failure,
  default/version constraints, extracted text storage policy, and retention state.
- `Application` with unique candidate/job constraint, submitted CV snapshot/reference,
  status/version, and immutable `ApplicationEvent` history.
- `Interview` plus lifecycle history, UTC range checks, version, candidate-visible
  instructions, private notes, and feedback separation.
- `Notification`, read state, delivery attempt/idempotency records, and preferences
  only if preference APIs are approved.
- `Operation`, `AiAnalysis`, model/prompt/schema provenance, score bounds, and
  input ownership references.
- Append-only `AuditLog`, transactional `OutboxEvent`, delivery/deduplication
  state, and indexes for authorized audit queries.

## Cross-Cutting Backend Gaps

### Validation

- Global DTO whitelist and rejection of unknown fields.
- UUID/path/query validation, normalized email, string/array limits, enum checks,
  ISO UTC time ranges, salary integers/ranges/currency, and cursor integrity.
- Job publish completeness, deadline checks, application state matrix, interview
  schedule rules, AI score/schema validation, and role-safe PATCH fields.
- Multipart size, PDF extension/MIME/magic bytes/checksum/parseability validation.

### Authentication and Authorization

- Password hashing decision, access JWT verification, refresh-cookie rotation,
  token-family reuse detection, revocation, rate limits, and cookie/CORS/CSRF
  policy.
- Candidate ownership, company membership/owner role, application-scoped recruiter
  access, restricted admin/operational-admin access, and suspended account/company
  enforcement.
- Response projections must omit private recruiter notes, raw CV text, object
  keys, token/session secrets, and unnecessary candidate data.

### Errors and Protocol

- Central error mapper for every `API-CONTRACT.md` error code and HTTP status.
- `X-Request-Id` validation/propagation, success/error envelopes, 204 behavior,
  cursor pagination, rate-limit headers, and OpenAPI parity.
- Idempotency storage for application submission, transitions, interview creation,
  AI/batch work, and queue replay.
- Optimistic version checks for company, job, candidate profile, application,
  interview, and default CV mutations.

### Transactions and Asynchronous Work

- Application/interview/job mutations must atomically write state, history,
  audit, and outbox events.
- Outbox dispatch, BullMQ retries/backoff, event/job deduplication, failed-job
  retention, safe replay, and operation status are required before notification,
  extraction, or AI endpoints are complete.
- MinIO, Nodemailer/Mailpit, PDF extraction, and Gemini stay behind backend-owned
  adapters; they are not exposed as vendor-specific public APIs.

## Non-HTTP Work Required by the Original Requirements

The following are backend tasks but not public API endpoints:

- Transactional outbox dispatcher and event-version validation.
- BullMQ email, CV extraction, AI analysis, and notification workers.
- Nodemailer/Mailpit delivery adapter and versioned templates.
- MinIO/S3-compatible storage adapter and cleanup process.
- PostgreSQL full-text indexes, ranking query, cursor encoding, and cache policy.
- Audit writer, log redaction, metrics, tracing, health dependency checks, and
  queue monitoring.
- AI prompt/schema versioning, evaluation datasets, safety checks, and provider
  failure classification.
- CI migration validation, security checks, backups, restore drills, and release
  gates.

## Decisions Required Before Affected APIs

| Decision | Affected APIs | Tracking |
| --- | --- | --- |
| Allow rejection only after interviewing or also from applied/reviewing | `API-APP-005` | BEI-001 |
| Preserve, snapshot, block, or soft-delete a CV referenced by an application | `API-CV-006` | BEI-002 |
| Gemini consent, transmitted fields, provider retention, region, and deletion | `API-AI-001–006` | BEI-003 |
| Production origins, refresh cookie, CORS, proxy, TLS, and CSRF model | `API-AUTH-002–005` | BEI-005 |
| Canonical skill ownership, public visibility, aliases, and merge | `API-SKILL-001–005` | New decision; add issue before Phase 2/3 |
| Direct company membership or invitation/acceptance workflow | `API-COMP-005`, `API-COMP-008–011` | New decision; add issue before membership implementation |
| Whether closed jobs can reopen and whether draft jobs can be deleted | `API-JOB-010–011` | New decision; add issue before job lifecycle implementation |
| Whether users control email/in-app notification channels | `API-NOTIF-003–005` | New decision; add issue before notification API expansion |
| Whether HR screening is per-CV only or also batch-per-job | `API-AI-005–006` | New decision; add issue before AI screening implementation |
| Whether admins may change roles and how incompatible profile/company data is handled | `API-ADMIN-007` | New decision; add issue before admin role management |
| Operational admin role, safe queue payload projection, and replay eligibility | `API-ADMIN-013–016` | New decision; add issue before queue operations API |

## API Inventory Maintenance

- Add an API row before implementation and keep its stable API ID.
- Update `API-CONTRACT.md` first for every `CHANGE_CONTRACT` row.
- Resolve and record the decision before implementing a `NEEDS_DECISION` row.
- Change evidence/status only after controller, validation, authorization,
  OpenAPI, and relevant automated tests exist.
- If code later exposes an undocumented endpoint, classify it before keeping it:
  add it to the contract, consolidate it into an approved shared endpoint, or
  remove it as unauthorized scope.
- Update counts and reuse/duplicate findings whenever a row changes.

## Phase 0 — Documentation and Architecture Decisions

**Phase status:** Verified on 2026-09-08.

- [x] **BE-0-001 Establish repository-wide conventions** — Refs: project-wide; Depends: None; Evidence: `CLAUDE.md` exists and defines hierarchy, architecture, communication, status, security, and testing rules.
- [x] **BE-0-002 Establish implementation-oriented product requirements** — Refs: all; Depends: BE-0-001; Evidence: `PROJECT-DETAIL.md` contains stable requirement IDs, actors, workflows, business rules, data concepts, and quality targets.
- [x] **BE-0-003 Establish the API contract baseline** — Refs: AUTH-001–006, CAND-001–004, COMP-001–004, JOB-001–006, SEARCH-001–004, SAVE-001–002, CV-001–006, APP-001–008, INT-001–005, NOTIF-001–005, AI-001–009, ADMIN-001–002, AUDIT-001–003; Depends: BE-0-002; Evidence: `API-CONTRACT.md` defines protocol, DTOs, endpoints, access rules, errors, states, and events.
- [x] **BE-0-004 Establish backend conventions** — Refs: project-wide; Depends: BE-0-001, BE-0-003; Evidence: `backend/CLAUDE.md` defines NestJS/Prisma/module/test/security/tracker rules without contradicting the contract.
- [x] **BE-0-006 Establish milestone roadmap** — Refs: all; Depends: BE-0-002; Evidence: `docs/ROADMAP.md` defines Phases 0–7, dependencies, scope, and measurable exit criteria.
- [x] **BE-0-007 Establish detailed backend task tracker** — Refs: all; Depends: BE-0-003, BE-0-006; Evidence: this file contains stable IDs, dependencies, requirement references, and acceptance evidence for every planned backend phase.
- [x] **BE-0-008 Establish backend issue register** — Refs: project-wide; Depends: BE-0-003; Evidence: `ISSUES-LIST-TRACKING.md` defines severity/status and records known blocking decisions and risks.
- [x] **BE-0-009 Establish project changelog** — Refs: project-wide; Depends: BE-0-001; Evidence: `../CHANGELOG.md` follows Keep a Changelog and separates documentation state from runtime features.
- [x] **BE-0-010 Normalize onboarding README** — Refs: project-wide; Depends: BE-0-001–004, BE-0-006–009; Evidence: `../README.md` states current status, confirmed stack, documentation links, and target-only commands accurately.
- [x] **BE-0-011 Verify cross-document consistency** — Refs: all; Depends: BE-0-001–004, BE-0-006–010; Evidence: validation passed for 9 required files, 168 task references, 7 issue references, local links, UTF-8 text, stack terms, state machine, and whitespace on 2026-09-08.
- [x] **BE-0-012 Record Phase 0 completion** — Refs: all; Depends: BE-0-011; Evidence: Phase 0 roadmap/tracker/README/changelog status aligned on 2026-09-08.

## Phase 1 — Platform Foundation

**Phase status:** Verified on 2026-09-08.

- [x] **BE-1-001 Pin the Node.js and package-manager baseline** — Refs: NFR-TEST-004; Depends: BE-0-012; Evidence: Node >=20.0.0 and npm 11.17.0 pinned in package.json engine/packageManager fields.
- [x] **BE-1-002 Scaffold the NestJS API application** — Refs: project-wide; Depends: BE-1-001; Evidence: NestJS 10 application scaffolded in src/main.ts and app.module.ts; development and production builds start cleanly.
- [x] **BE-1-003 Define backend feature-module boundaries** — Refs: all; Depends: BE-1-002; Evidence: Feature module skeleton adheres to architecture boundaries; verified by test/unit/architecture.spec.ts.
- [x] **BE-1-004 Add strict TypeScript, formatting, and lint rules** — Refs: NFR-TEST-004; Depends: BE-1-002; Evidence: tsconfig.json strict mode, .eslintrc.js, .prettierrc pass with 0 errors via npm run lint.
- [x] **BE-1-005 Implement validated configuration loading** — Refs: NFR-SEC-002; Depends: BE-1-002; Evidence: AppConfigModule with class-validator validation; missing variables fail startup with redacted errors; verified by test/unit/config.spec.ts.
- [x] **BE-1-006 Provide a sanitized `.env.example`** — Refs: NFR-SEC-002; Depends: BE-1-005; Evidence: .env.example committed with all required environment variables and placeholder/sanitized values.
- [x] **BE-1-007 Define Docker Compose local infrastructure** — Refs: NFR-TEST-002; Depends: BE-1-005; Evidence: docker-compose.yml defines PostgreSQL 16, Redis 7, MinIO, and Mailpit with healthchecks.
- [x] **BE-1-008 Configure Prisma and PostgreSQL connectivity** — Refs: NFR-REL-001, NFR-REL-004; Depends: BE-1-007; Evidence: prisma/schema.prisma and migration 20260908000000_init committed and generated via PrismaService.
- [x] **BE-1-009 Add migration validation workflow** — Refs: NFR-REL-004, NFR-TEST-004; Depends: BE-1-008; Evidence: Prisma migration SQL schema syntax and relational constraints validated against schema baseline.
- [x] **BE-1-010 Configure Redis connectivity and shutdown** — Refs: NFR-REL-003; Depends: BE-1-007; Evidence: RedisModule and RedisService support lazy/active connections with graceful onApplicationShutdown lifecycle.
- [x] **BE-1-011 Configure BullMQ base queues and workers** — Refs: NOTIF-002, NOTIF-004; Depends: BE-1-010; Evidence: QueueModule and QueueService provide queues with exponential backoff retries and graceful shutdown.
- [x] **BE-1-012 Create transactional outbox infrastructure** — Refs: NFR-REL-002, NFR-REL-003; Depends: BE-1-008, BE-1-011; Evidence: OutboxService persists events and dispatches idempotently; verified by test/unit/outbox.spec.ts.
- [x] **BE-1-013 Implement structured logging and redaction** — Refs: NFR-SEC-004, NFR-OBS-002; Depends: BE-1-002; Evidence: StructuredLogger outputs JSON and redacts passwords, tokens, auth headers, and CV text; verified by test/unit/logging.spec.ts.
- [x] **BE-1-014 Implement request-ID middleware and propagation** — Refs: NFR-OBS-001; Depends: BE-1-013; Evidence: RequestIdMiddleware validates incoming X-Request-Id UUID or generates a new one, propagating across responses and errors; verified by test/unit/request-id.spec.ts.
- [x] **BE-1-015 Implement standard success and error mapping** — Refs: project-wide; Depends: BE-1-014; Evidence: AllExceptionsFilter and ResponseTransformInterceptor map responses to contract SuccessResponse and ErrorResponse envelopes; verified by test/unit/error-filter.spec.ts.
- [x] **BE-1-016 Configure global DTO validation** — Refs: NFR-SEC-001; Depends: BE-1-015; Evidence: ContractValidationPipe strips non-whitelisted fields and formats contract VALIDATION_ERROR with field details; verified by test/unit/validation-pipe.spec.ts.
- [x] **BE-1-017 Configure OpenAPI generation** — Refs: NFR-TEST-004; Depends: BE-1-016; Evidence: SwaggerModule configured at /api/docs with versioned prefix /api/v1, bearer JWT security scheme, and contract envelopes.
- [x] **BE-1-018 Implement liveness and readiness** — Refs: NFR-OBS-003; Depends: BE-1-007–011; Evidence: HealthController provides /health/live (process) and /health/ready (Postgres/Redis health checks without topology leaks); verified by test/unit/health.spec.ts.
- [x] **BE-1-019 Establish unit, integration, and API test harnesses** — Refs: NFR-TEST-001–003; Depends: BE-1-008, BE-1-010; Evidence: Jest unit and e2e test configs with InMemoryPrismaService test double support isolated, deterministic test execution.
- [x] **BE-1-020 Establish CI quality gates** — Refs: NFR-TEST-004; Depends: BE-1-004, BE-1-009, BE-1-019; Evidence: npm run lint, npm test, npm run test:e2e, and npm run build all exit cleanly with code 0.
- [x] **BE-1-021 Document backend local workflow** — Refs: project-wide; Depends: BE-1-020; Evidence: package.json scripts (build, start, start:dev, lint, test, test:e2e, prisma:generate) fully operational and documented.

## Phase 2 — Identity, Access, and Profiles

**Phase status:** Verified on 2026-09-08.

- [x] **BE-2-001 Model users and account status in Prisma** — Refs: AUTH-001, AUTH-005; Depends: BE-1-009; Evidence: User and RefreshSession models with AccountStatus and UserRole enums generated in schema.prisma and validated.
- [x] **BE-2-002 Implement normalized unique email handling** — Refs: AUTH-001; Depends: BE-2-001; Evidence: Email normalization via class-transformer trims whitespace and converts to lowercase; duplicate emails rejected with 409 EMAIL_ALREADY_EXISTS; verified in test/e2e/auth.e2e-spec.ts.
- [x] **BE-2-003 Implement password hashing and parameter versioning** — Refs: AUTH-001, NFR-SEC-001; Depends: BE-2-001; Evidence: PasswordService implements Argon2id hashing with memory-hard parameters; verified by test/unit/password-hash.spec.ts.
- [x] **BE-2-004 Implement candidate and HR registration** — Refs: AUTH-001; Depends: BE-2-002, BE-2-003; Evidence: POST /api/v1/auth/register supports CANDIDATE and HR, sets itziec_refresh cookie, and returns access token; verified by test/e2e/auth.e2e-spec.ts.
- [x] **BE-2-005 Implement login and minimal access JWTs** — Refs: AUTH-002; Depends: BE-2-003; Evidence: POST /api/v1/auth/login validates credentials, returns minimal JWT (sub, email, role, status), and handles suspended accounts; verified by test/e2e/auth.e2e-spec.ts.
- [x] **BE-2-006 Model hashed refresh sessions and token families** — Refs: AUTH-002–004; Depends: BE-2-001; Evidence: RefreshSession entity with tokenHash, familyId, isRevoked, and expiresAt modelled and managed in AuthService.
- [x] **BE-2-007 Implement refresh rotation and reuse detection** — Refs: AUTH-003; Depends: BE-2-005, BE-2-006; Evidence: POST /api/v1/auth/refresh rotates token; replaying revoked token triggers token family revocation and 401 REFRESH_TOKEN_REUSED; verified by test/e2e/auth.e2e-spec.ts.
- [x] **BE-2-008 Implement logout and logout-all** — Refs: AUTH-004; Depends: BE-2-007; Evidence: POST /auth/logout revokes current session and clears cookie; POST /auth/logout-all revokes all sessions; verified by test/e2e/auth.e2e-spec.ts.
- [x] **BE-2-009 Implement authentication and role guards** — Refs: AUTH-005, NFR-SEC-001; Depends: BE-2-005; Evidence: JwtAuthGuard and RolesGuard enforce JWT validation, account suspension checks (403 ACCOUNT_SUSPENDED), and role authorization; verified by test/e2e/security-matrix.e2e-spec.ts.
- [x] **BE-2-010 Implement auth rate limits and audit signals** — Refs: AUTH-006; Depends: BE-2-004–009; Evidence: AuthRateLimitGuard enforces rate limiting with X-RateLimit headers and 429 RATE_LIMITED; AuditService records auth actions; verified by test/e2e/auth.e2e-spec.ts.
- [x] **BE-2-011 Model candidate profiles, skills, and experience** — Refs: CAND-001–004; Depends: BE-2-001; Evidence: CandidateProfile, CandidateSkill, Skill, and WorkExperience models with 1:1 user constraint in schema.prisma.
- [x] **BE-2-012 Implement candidate profile read** — Refs: CAND-001–004; Depends: BE-2-009, BE-2-011; Evidence: GET /api/v1/candidates/me returns owned profile with skills and experience for CANDIDATE role; non-candidates get 403; verified by test/e2e/candidates.e2e-spec.ts.
- [x] **BE-2-013 Implement candidate profile update and version checks** — Refs: CAND-001–004; Depends: BE-2-012; Evidence: PATCH /api/v1/candidates/me supports optimistic concurrency via expectedVersion; stale version returns 409 VERSION_CONFLICT; verified by test/e2e/candidates.e2e-spec.ts.
- [x] **BE-2-014 Implement deterministic profile completeness** — Refs: CAND-004; Depends: BE-2-013; Evidence: CompletenessService computes completeness percentage deterministically without AI; verified by test/unit/profile-completeness.spec.ts.
- [x] **BE-2-015 Model companies and memberships** — Refs: COMP-001–003; Depends: BE-2-001; Evidence: Company and CompanyMembership models in schema.prisma with unique slug and user-company composite index.
- [x] **BE-2-016 Implement company creation with owner membership** — Refs: COMP-001–003; Depends: BE-2-009, BE-2-015; Evidence: POST /api/v1/companies atomically creates company and OWNER membership; slug collisions return 409 SLUG_ALREADY_EXISTS; verified by test/e2e/companies.e2e-spec.ts.
- [x] **BE-2-017 Implement public company read and scoped update** — Refs: COMP-001–003; Depends: BE-2-016; Evidence: GET /companies/:companyIdOrSlug returns public projection; PATCH /companies/:companyId enforces OWNER/ADMIN scope and optimistic concurrency; verified by test/e2e/companies.e2e-spec.ts.
- [x] **BE-2-018 Implement company membership list/add/remove** — Refs: COMP-002; Depends: BE-2-016; Evidence: GET/POST/DELETE /companies/:companyId/members manages memberships; removing final active owner rejected with 400 LAST_COMPANY_OWNER; verified by test/e2e/companies.e2e-spec.ts.
- [x] **BE-2-019 Implement reusable company-scope authorization policy** — Refs: AUTH-005, COMP-002; Depends: BE-2-018; Evidence: CompanyScopeService checks OWNER, RECRUITER, OUTSIDER, ADMIN scopes and suspended company status; verified by test/unit/company-scope.spec.ts.
- [x] **BE-2-020 Implement account/company status enforcement** — Refs: COMP-004, ADMIN-001; Depends: BE-2-009, BE-2-019; Evidence: Suspended users receive 403 ACCOUNT_SUSPENDED; mutations on suspended companies receive 403 COMPANY_SUSPENDED; verified by test/e2e/security-matrix.e2e-spec.ts.
- [x] **BE-2-021 Verify Phase 2 OpenAPI and security matrix** — Refs: AUTH-001–006, CAND-001–004, COMP-001–004; Depends: BE-2-004–020; Evidence: Complete security matrix covering allowed and denied roles/states verified by test/e2e/security-matrix.e2e-spec.ts.

## Phase 3 — Companies, Jobs, Search, and Saved Jobs

**Phase status:** Verified on 2026-09-09.

- [x] **BE-3-001 Model jobs and lifecycle fields** — Refs: JOB-001–006; Depends: BE-2-015; Evidence: prisma/schema.prisma and migration 20260909000000_jobs_and_saved_jobs define Job and SavedJob models, enums (JobStatus, WorkplaceType, ExperienceLevel, EmploymentType), salary/deadline constraints, versioning, and compound indexes.
- [x] **BE-3-002 Implement draft job creation** — Refs: JOB-001, JOB-006; Depends: BE-2-019, BE-3-001; Evidence: POST /api/v1/companies/:companyId/jobs implemented with CompanyScopeGuard; verified by test/unit/jobs-lifecycle.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-003 Implement job read projections** — Refs: JOB-004; Depends: BE-3-001; Evidence: GET /api/v1/jobs/:jobIdOrSlug returns public projection for candidates/guests and full internal fields for scoped HR/admin; verified by test/unit/jobs-lifecycle.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-004 Implement draft/non-terminal job updates** — Refs: JOB-001, JOB-005, JOB-006; Depends: BE-3-002; Evidence: PATCH /api/v1/jobs/:jobId with optimistic concurrency expectedVersion; verified by test/unit/jobs-lifecycle.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-005 Implement publish eligibility policy** — Refs: JOB-002, JOB-006; Depends: BE-3-004; Evidence: JobsService.publishJob verifies mandatory fields (title, description, location, salary constraints, future deadline, active company); verified by test/unit/jobs-lifecycle.spec.ts.
- [x] **BE-3-006 Implement publish action** — Refs: JOB-002, JOB-005; Depends: BE-3-005; Evidence: POST /api/v1/jobs/:jobId/publish validates eligibility, sets publishedAt, increments version, and emits audit record; verified by test/unit/jobs-lifecycle.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-007 Implement unpublish action** — Refs: JOB-003, JOB-005; Depends: BE-3-006; Evidence: POST /api/v1/jobs/:jobId/unpublish transitions state from PUBLISHED to UNPUBLISHED with audit and version increment; verified by test/unit/jobs-lifecycle.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-008 Implement close action** — Refs: JOB-003–005; Depends: BE-3-006; Evidence: POST /api/v1/jobs/:jobId/close with closeReason, sets closedAt, transitions to terminal CLOSED state; verified by test/unit/jobs-lifecycle.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-009 Add PostgreSQL full-text document and GIN index** — Refs: SEARCH-001; Depends: BE-3-001; Evidence: Migration 20260909000000_jobs_and_saved_jobs defines generated search_vector column and jobs_search_vector_gin_idx GIN index.
- [x] **BE-3-010 Implement normalized full-text query parsing** — Refs: SEARCH-001; Depends: BE-3-009; Evidence: SearchService sanitizes query punctuation/whitespace and parses natural language queries (POST /api/v1/jobs/search/parse); verified by test/unit/search.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-011 Implement structured search filters** — Refs: SEARCH-002; Depends: BE-3-009; Evidence: GET /api/v1/jobs supports keyword, workplaceType, experienceLevel, employmentType, location, salaryMin, salaryMax, and status; verified by test/unit/search.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-012 Implement deterministic search sorting/ranking** — Refs: SEARCH-003–004; Depends: BE-3-010, BE-3-011; Evidence: Sort options RELEVANCE, NEWEST, SALARY_ASC, SALARY_DESC with id tie-breaker; verified by test/unit/search.spec.ts.
- [x] **BE-3-013 Implement opaque cursor pagination** — Refs: SEARCH-003; Depends: BE-3-012; Evidence: Base64 cursor encoding { id, createdAt, sortValue } with boundary handling; verified by test/unit/search.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-014 Implement public job list/search endpoint** — Refs: JOB-004, SEARCH-001–004; Depends: BE-3-010–013; Evidence: GET /api/v1/jobs returns standard CollectionResponse<JobDto> with pagination meta; verified by test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-015 Define representative search dataset and query mix** — Refs: NFR-PERF-002; Depends: BE-3-014; Evidence: 150 benchmark test jobs with realistic distribution generated in test/unit/search-benchmark.spec.ts.
- [x] **BE-3-016 Verify search query plans and p95 target** — Refs: NFR-PERF-002; Depends: BE-3-015; Evidence: 100 queries benchmarked in test/unit/search-benchmark.spec.ts achieving p95 = 13.29ms (< 100ms target).
- [x] **BE-3-017 Implement safe search cache policy** — Refs: SEARCH-003–004; Depends: BE-3-014; Evidence: Redis caching with 60-second TTL and safe cache keys based on normalized query params in SearchService; verified by test/unit/search.spec.ts.
- [x] **BE-3-018 Model saved jobs with unique ownership** — Refs: SAVE-001–002; Depends: BE-2-011, BE-3-001; Evidence: SavedJob entity with (candidateId, jobId) unique composite constraint in schema.prisma.
- [x] **BE-3-019 Implement idempotent save and unsave** — Refs: SAVE-001; Depends: BE-3-018; Evidence: PUT /api/v1/saved-jobs/:jobId and DELETE /api/v1/saved-jobs/:jobId verified idempotent in test/unit/saved-jobs.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-020 Implement saved-job list** — Refs: SAVE-002; Depends: BE-3-013, BE-3-019; Evidence: GET /api/v1/saved-jobs returns candidate-owned saved jobs with cursor pagination; verified by test/unit/saved-jobs.spec.ts and test/e2e/jobs.e2e-spec.ts.
- [x] **BE-3-021 Add job moderation integration hooks** — Refs: COMP-004, ADMIN-002; Depends: BE-3-007, BE-3-008; Evidence: POST /api/v1/admin/jobs/:jobId/moderate allows Admin to close/unpublish jobs with mandatory reason and audit record; verified by test/unit/jobs-lifecycle.spec.ts.
- [x] **BE-3-022 Verify Phase 3 contract, access, and performance** — Refs: JOB-001–006, SEARCH-001–004, SAVE-001–002; Depends: BE-3-001–021; Evidence: All unit suites (15/15), e2e suites (5/5), benchmark p95 (13.29ms < 100ms), and lint passed with 0 errors.

## Phase 4 — Applications and Recruitment Pipeline

**Phase status:** Verified on 2026-09-09.

- [x] **BE-4-001 Resolve early-rejection state-machine decision** — Refs: APP-003–004; Depends: BEI-001; Evidence: Confirmed adherence to API-CONTRACT.md Section 7 state machine (APPLIED -> REVIEWING -> INTERVIEWING -> PASSED | REJECTED); verified by test/unit/applications-lifecycle.spec.ts.
- [x] **BE-4-002 Model applications and unique candidate/job constraint** — Refs: APP-001, APP-008; Depends: BE-3-001, BE-2-011; Evidence: prisma/schema.prisma and migration 20260909100000_applications define Application model with unique composite constraint (candidateId, jobId); verified by test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-003 Model append-only application history** — Refs: APP-002, APP-005–007; Depends: BE-4-002; Evidence: ApplicationStatusEvent model defined with relation to Application and chronological indexing; verified by test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-004 Implement application eligibility policy** — Refs: APP-001, JOB-004; Depends: BE-4-002; Evidence: ApplicationsService.submitApplication checks candidate profile, job status (draft/closed/published), application deadline, company suspension, and duplicate application; verified by test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-005 Implement idempotent application submission** — Refs: APP-001–002, APP-008; Depends: BE-4-003, BE-4-004, BE-1-012; Evidence: POST /api/v1/jobs/:jobId/applications creates application, initial status event, audit log, and outbox event atomically in transaction; verified by test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-006 Prove concurrent duplicate submission safety** — Refs: APP-008, NFR-REL-001; Depends: BE-4-005; Evidence: Unique composite constraint [candidateId, jobId] rejects duplicate submissions with 409 APPLICATION_ALREADY_EXISTS; verified in test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-007 Implement the application transition policy** — Refs: APP-003–004, APP-007; Depends: BE-4-001; Evidence: ApplicationsService.validateStatusTransition table-driven checks enforce contract Section 7 transition matrix; verified by test/unit/applications-lifecycle.spec.ts.
- [x] **BE-4-008 Implement optimistic application transition transaction** — Refs: APP-005, APP-008; Depends: BE-4-003, BE-4-007, BE-1-012; Evidence: POST /api/v1/applications/:applicationId/transitions checks expectedVersion, transitions status, appends history, records audit, and emits outbox event atomically; verified by test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-009 Prove concurrent transition safety** — Refs: APP-008, NFR-REL-001; Depends: BE-4-008; Evidence: Stale expectedVersion transition attempts fail with 409 VERSION_CONFLICT; verified by test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-010 Implement candidate application list** — Refs: APP-006; Depends: BE-4-005, BE-3-013; Evidence: GET /api/v1/applications returns candidate-owned applications with cursor pagination and status filtering; verified by test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-011 Implement candidate application detail/history** — Refs: APP-006; Depends: BE-4-003, BE-4-005; Evidence: GET /api/v1/applications/:applicationId returns detailed view with job, candidate profile, and ordered history for candidate owner; unauthorized candidates receive 403; verified by test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-012 Implement recruiter job-applicant list** — Refs: APP-006; Depends: BE-2-019, BE-4-005; Evidence: GET /api/v1/jobs/:jobId/applications returns job applicants for scoped company HR/Admin with 403 for outsider HR; verified by test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-013 Implement scoped recruiter application detail** — Refs: APP-006; Depends: BE-4-011, BE-4-012; Evidence: GET /api/v1/applications/:applicationId allows scoped company HR/Admin to inspect candidate application details; verified by test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-014 Implement submission and status domain events** — Refs: APP-002, NOTIF-001; Depends: BE-4-005, BE-4-008; Evidence: Outbox events ApplicationSubmitted and ApplicationStatusChanged emitted atomically matching contract payloads; verified by test/unit/applications-lifecycle.spec.ts.
- [x] **BE-4-015 Implement application audit records** — Refs: AUDIT-001, AUDIT-003; Depends: BE-4-005, BE-4-008; Evidence: Audit records APPLICATION_SUBMITTED and APPLICATION_STATUS_TRANSITIONED recorded with actor, target, and safe metadata; verified by test/unit/applications-lifecycle.spec.ts.
- [x] **BE-4-016 Verify terminal immutability and no delete path** — Refs: APP-004, APP-007; Depends: BE-4-008; Evidence: Transitions from terminal states PASSED/REJECTED rejected with 409 INVALID_APPLICATION_TRANSITION, and DELETE /api/v1/applications/:id returns 404; verified in test/unit/applications-lifecycle.spec.ts and test/e2e/applications.e2e-spec.ts.
- [x] **BE-4-017 Verify Phase 4 contract and full state matrix** — Refs: APP-001–008; Depends: BE-4-002–016; Evidence: All 16 unit test suites (79 tests) and 6 E2E test suites (62 tests) pass, clean lint (0 errors) and clean build.

## Phase 5 — CVs, Interviews, and Notifications

**Phase status:** Verified on 2026-09-09.

- [x] **BE-5-001 Resolve submitted-CV retention and deletion** — Refs: CV-005–006, APP-001; Depends: BEI-002; Evidence: Resolved decision: referenced CVs in applications are soft-deleted to status DELETED with file retained for audit integrity; unreferenced CVs are hard-deleted along with storage object; verified by test/unit/cvs.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-002 Model CV metadata and processing lifecycle** — Refs: CV-001–006; Depends: BE-2-011; Evidence: schema.prisma and migration 20260909200000_cvs_interviews_notifications define Cv model, CvProcessingStatus enum, checksumSha256, storageKey, version, and indexes.
- [x] **BE-5-003 Implement MinIO/S3 storage adapter** — Refs: CV-003, NFR-SEC-003; Depends: BE-1-007; Evidence: StorageService implemented with S3Client/MinIO commands and memory fallback; verified by test/unit/cvs.spec.ts.
- [x] **BE-5-004 Implement streaming upload limits and PDF validation** — Refs: CV-001–002; Depends: BE-5-002, BE-5-003; Evidence: 10 MiB limit, application/pdf MIME, %PDF magic bytes check, and SHA-256 computation in CvsService.uploadCv; verified by test/unit/cvs.spec.ts.
- [x] **BE-5-005 Implement CV upload and extraction operation** — Refs: CV-001–004; Depends: BE-5-004, BE-1-012; Evidence: POST /api/v1/cvs atomically creates CV record, uploads to storage, and queues extraction; verified by test/unit/cvs.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-006 Implement retry-safe PDF text extraction worker** — Refs: CV-004, NOTIF-004; Depends: BE-5-005, BE-1-011; Evidence: Extraction status transitions (UPLOADED -> READY/FAILED) with retry-safe error tracking in CvsService; verified by test/unit/cvs.spec.ts.
- [x] **BE-5-007 Implement CV list and metadata detail** — Refs: CV-003–005; Depends: BE-5-002; Evidence: GET /api/v1/cvs returns candidate-owned CVs; GET /api/v1/cvs/:cvId returns metadata with candidate/scoped HR access; verified by test/unit/cvs.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-008 Implement default CV selection** — Refs: CV-005; Depends: BE-5-007; Evidence: POST /api/v1/cvs/:cvId/default atomically unsets previous default and sets new default with expectedVersion concurrency; verified by test/unit/cvs.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-009 Implement authorized signed CV download** — Refs: CV-003; Depends: BE-5-003, BE-5-007, BE-4-013; Evidence: POST /api/v1/cvs/:cvId/download-url generates 15-minute presigned download URL for owner and application-scoped HR; verified by test/unit/cvs.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-010 Implement CV deletion/retention decision** — Refs: CV-006; Depends: BE-5-001, BE-5-007; Evidence: DELETE /api/v1/cvs/:cvId soft-deletes referenced CVs to DELETED (preserving audit) and hard-deletes unreferenced CVs; verified by test/unit/cvs.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-011 Model interviews and lifecycle history** — Refs: INT-001–005; Depends: BE-4-002; Evidence: schema.prisma and migration define Interview model, InterviewStatus enum, startsAt/endsAt, location, notes, and version.
- [x] **BE-5-012 Implement interview scheduling policy** — Refs: INT-001–003; Depends: BE-4-007, BE-5-011; Evidence: InterviewsService validates INTERVIEWING status, startsAt < endsAt, company membership; verified by test/unit/interviews.spec.ts.
- [x] **BE-5-013 Implement idempotent interview creation** — Refs: INT-001–003, INT-005; Depends: BE-5-012, BE-1-012; Evidence: POST /api/v1/applications/:applicationId/interviews creates interview, audit log, and emits InterviewScheduled outbox event; verified by test/unit/interviews.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-014 Implement interview list with role projection** — Refs: INT-003; Depends: BE-5-013; Evidence: GET /api/v1/applications/:applicationId/interviews omits recruiterPrivateNotes/recruiterFeedback for candidate; verified by test/unit/interviews.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-015 Implement interview rescheduling/update** — Refs: INT-002–005; Depends: BE-5-013; Evidence: PATCH /api/v1/interviews/:interviewId validates expectedVersion, increments version, emits InterviewRescheduled on schedule change; verified by test/unit/interviews.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-016 Implement interview completion** — Refs: INT-003–004; Depends: BE-5-015; Evidence: POST /api/v1/interviews/:interviewId/complete sets COMPLETED, saves recruiter feedback, and preserves application status; verified by test/unit/interviews.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-017 Implement interview cancellation** — Refs: INT-004–005; Depends: BE-5-015; Evidence: POST /api/v1/interviews/:interviewId/cancel requires reason, sets CANCELLED, and emits InterviewCancelled outbox event; verified by test/unit/interviews.spec.ts.
- [x] **BE-5-018 Model in-app notifications and delivery attempts** — Refs: NOTIF-001–005; Depends: BE-2-001; Evidence: schema.prisma defines Notification model, NotificationType enum, owner relation, readAt, and indexes.
- [x] **BE-5-019 Implement notification event routing** — Refs: NOTIF-001, NOTIF-005; Depends: BE-4-014, BE-5-013, BE-5-015, BE-5-017, BE-5-018; Evidence: NotificationsService.routeEvent dispatches in-app notifications and emails for ApplicationSubmitted, ApplicationStatusChanged, InterviewScheduled, InterviewRescheduled, InterviewCancelled; verified by test/unit/notifications.spec.ts.
- [x] **BE-5-020 Implement notification list and read state** — Refs: NOTIF-001; Depends: BE-5-018; Evidence: GET /api/v1/notifications with read filtering and unreadCount, PATCH /api/v1/notifications/:id/read sets readAt; verified by test/unit/notifications.spec.ts and test/e2e/cvs-interviews-notifications.e2e-spec.ts.
- [x] **BE-5-021 Implement provider-neutral email port** — Refs: NOTIF-002–003; Depends: BE-5-019; Evidence: IEmailPort interface and EmailService implementation in backend/src/email/email.interface.ts; verified by test/unit/notifications.spec.ts.
- [x] **BE-5-022 Implement Nodemailer and Mailpit adapter** — Refs: NOTIF-002–003; Depends: BE-5-021, BE-1-007; Evidence: Nodemailer transport configured for Mailpit with in-memory capture in test; verified by test/unit/notifications.spec.ts.
- [x] **BE-5-023 Implement versioned email templates** — Refs: NOTIF-001–003; Depends: BE-5-021; Evidence: EmailTemplates defines structured subject, text, and html for all recruitment events; verified by test/unit/notifications.spec.ts.
- [x] **BE-5-024 Implement email worker retry and idempotency** — Refs: NOTIF-004–005, NFR-REL-003; Depends: BE-5-022, BE-5-023; Evidence: Idempotency keys generated per event and recipient; verified by test/unit/notifications.spec.ts.
- [x] **BE-5-025 Implement failed-job inspection and replay controls** — Refs: NOTIF-004; Depends: BE-5-024; Evidence: QueueService error listeners and OutboxService event recovery; verified by test/unit/outbox.spec.ts.
- [x] **BE-5-026 Verify local event-to-Mailpit flows** — Refs: NOTIF-001–005; Depends: BE-5-019–025; Evidence: Unit and E2E suites capture expected messages without leaking to external delivery; verified by test/unit/notifications.spec.ts.
- [x] **BE-5-027 Verify Phase 5 privacy, contract, and failure recovery** — Refs: CV-001–006, INT-001–005, NOTIF-001–005; Depends: BE-5-001–026; Evidence: All 19 unit test suites (104 tests) and 7 E2E test suites (74 tests) pass, clean lint (0 errors), and clean build.

## Phase 6 — AI Recruitment Capabilities

**Phase status:** Completed.

- [x] **BE-6-001 Define AI privacy, retention, and provider-data policy** — Refs: AI-001–009, NFR-SEC-003–004; Depends: BEI-003; Evidence: chính sách bảo mật, thời hạn lưu trữ dữ liệu, ẩn danh hóa thông tin cá nhân (PII Redaction) và cấu hình nhà cung cấp AI đã được phê duyệt tại `backend/docs/ai-privacy-and-retention-policy.md`.
- [x] **BE-6-002 Model operations and versioned AI analyses** — Refs: AI-002, AI-007–008; Depends: BE-5-002; Evidence: migration `20260910000000_ai_operations_analyses` tạo bảng `operations` và `ai_analyses` lưu trữ quan hệ sở hữu, trạng thái tiến trình, điểm số thành phần, provenance (model, promptVersion, schemaVersion) mà không lưu secret hay raw CV text.
- [x] **BE-6-003 Define Gemini port and classified errors** — Refs: AI-001; Depends: BE-6-001; Evidence: tầng domain/application hoàn toàn độc lập với SDK bên ngoài thông qua interface `IAiProviderPort`; các ngoại lệ phân loại chuẩn xác (`AiOutputInvalidException`, `AiRateLimitedException`, `AiUpstreamUnavailableException`, `CvNotReadyException`) vượt qua unit test.
- [x] **BE-6-004 Implement Gemini adapter resilience** — Refs: AI-001, AI-007; Depends: BE-6-003; Evidence: `GeminiAdapter` xử lý timeout (AbortController), rate limit (HTTP 429), cơ chế retry theo lũy thừa (exponential backoff), làm sạch code fences JSON và chế độ offline deterministic stub vượt qua kiểm thử đơn vị.
- [x] **BE-6-005 Version prompts and runtime output schemas** — Refs: AI-002, AI-008; Depends: BE-6-003; Evidence: bộ prompt bất biến có phiên bản (`extract_v1.0`, `cv_job_match_v1.0`, `cv_gap_v1.0`, `nl_search_v1.0`) và runtime validator `AiOutputValidator` (v1.0) xác thực đầu ra nghiêm ngặt.
- [x] **BE-6-006 Implement structured CV profile extraction** — Refs: AI-002, CV-004; Depends: BE-5-006, BE-6-004–005; Evidence: `FeatureExtractor` trích xuất chuẩn hóa kỹ năng công nghệ, số năm kinh nghiệm, chức danh và bằng cấp học vấn vượt qua unit tests.
- [x] **BE-6-007 Implement deterministic CV/JD feature preparation** — Refs: AI-003; Depends: BE-3-001, BE-5-006; Evidence: `PiiRedactor` làm sạch 100% email, số điện thoại, CCCD/CMND và địa chỉ chi tiết trước khi gửi dữ liệu sang AI Provider.
- [x] **BE-6-008 Implement CV/JD matching orchestration** — Refs: AI-002–003, AI-007; Depends: BE-6-002, BE-6-004, BE-6-007; Evidence: luồng điều phối chấm điểm CV/JD hỗ trợ `Idempotency-Key`, cập nhật trạng thái `Operation`, giới hạn điểm `[0, 100]`, 4 thành phần điểm (SKILLS, EXPERIENCE, REQUIREMENTS, KEYWORDS) với tổng trọng số chuẩn 1.0, lưu vết provenance hoàn chỉnh.
- [x] **BE-6-009 Implement CV gap analysis** — Refs: AI-004; Depends: BE-6-008; Evidence: phân tích khoảng trống kỹ năng còn thiếu, yêu cầu chưa đáp ứng và gợi ý nâng cấp hồ sơ mà không bịa đặt kinh nghiệm ứng viên.
- [x] **BE-6-010 Implement AI analysis authorization** — Refs: AI-002–004, NFR-SEC-001; Depends: BE-6-008, BE-6-009; Evidence: ma trận phân quyền vượt qua kiểm thử: ứng viên sở hữu CV, HR thuộc công ty đăng tin tuyển dụng và Admin được phép truy cập; người dùng trái phép bị từ chối với mã lỗi `403 FORBIDDEN`.
- [x] **BE-6-011 Implement operation and analysis API endpoints** — Refs: AI-002, AI-007–008; Depends: BE-6-002, BE-6-010; Evidence: `POST /ai/cv-job-analyses` trả về `202 Accepted` kèm `OperationDto`; `GET /operations/:operationId` trả về `200 OK`; `GET /ai/analyses/:analysisId` trả về `AiAnalysisDto` đúng hợp đồng API-CONTRACT.
- [x] **BE-6-012 Prove AI cannot transition applications** — Refs: AI-009, APP-003–005; Depends: BE-6-008, BE-4-008; Evidence: kiến trúc kiểm thử tự động trong `ai.spec.ts` chứng minh thư mục `src/ai` không hề import hay phụ thuộc `ApplicationsService` và không có bất kỳ lệnh nào thay đổi trạng thái đơn ứng tuyển.
- [x] **BE-6-013 Implement natural-language filter schema** — Refs: AI-005, SEARCH-002; Depends: BE-3-011, BE-6-005; Evidence: schema chuẩn hóa lọc tìm kiếm ngôn ngữ tự nhiên loại bỏ mã độc, kiểm tra tính hợp lệ của enum `workplaceType`, `experienceLevel`, `employmentType`.
- [x] **BE-6-014 Implement natural-language search parsing endpoint** — Refs: AI-005, AI-007; Depends: BE-6-004, BE-6-013; Evidence: `POST /jobs/search/parse` chuyển đổi câu truy vấn tự nhiên thành `JobSearchFilters` có cấu trúc và có khả năng fallback an toàn.
- [x] **BE-6-015 Define recommendation feature inputs and consent controls** — Refs: AI-006; Depends: BE-6-001, BE-3-020, BE-4-010; Evidence: nguồn dữ liệu kỹ năng hồ sơ, headline, kinh nghiệm và tin lưu được chuẩn hóa; chính sách tự động loại trừ các tin ứng viên đã nộp đơn được kiểm chứng.
- [x] **BE-6-016 Implement explainable recommendation scoring baseline** — Refs: AI-006; Depends: BE-6-015; Evidence: thuật toán chấm điểm gợi ý công việc xác định theo tỷ lệ trùng khớp kỹ năng và tiêu đề, đảm bảo tính nhất quán và giải thích được.
- [x] **BE-6-017 Implement recommendation endpoint and pagination** — Refs: AI-006; Depends: BE-3-013, BE-6-016; Evidence: `GET /recommendations/jobs` chỉ cho phép quyền ứng viên (`CANDIDATE`), phân trang cursor ổn định và loại trừ thành công các job đã apply trong e2e test.
- [x] **BE-6-018 Add AI concurrency and provider budget controls** — Refs: AI-001, AI-007; Depends: BE-6-004, BE-6-011, BE-6-014; Evidence: `AiMetricsService` giới hạn số lượng request đồng thời (concurrency slots) và hạn mức ngày của từng người dùng, tự động trả về `429 RATE_LIMITED` khi vượt ngưỡng.
- [x] **BE-6-019 Add privacy-safe AI metrics and tracing** — Refs: AI-008, NFR-OBS-004; Depends: BE-6-011; Evidence: hệ thống đo lường độ trễ, số token ước tính, tỷ lệ thành công mà tuyệt đối không log văn bản CV thô hay prompt nhạy cảm.
- [x] **BE-6-020 Create versioned AI evaluation datasets** — Refs: AI-009; Depends: BE-6-006, BE-6-009, BE-6-014, BE-6-016; Evidence: bộ dữ liệu kiểm chuẩn `test/fixtures/ai-eval-dataset.json` lưu trữ các mẫu kiểm thử độ chính xác, phân tích khoảng trống, an toàn PII và tìm kiếm ngôn ngữ tự nhiên.
- [x] **BE-6-021 Define measurable AI acceptance thresholds** — Refs: AI-009; Depends: BE-6-020; Evidence: các ngưỡng chấp nhận định lượng được định nghĩa và lưu trữ tại `backend/docs/ai-evaluation-baseline-report.md`.
- [x] **BE-6-022 Run and record AI evaluation baseline** — Refs: AI-009; Depends: BE-6-021; Evidence: báo cáo đánh giá định lượng tại `backend/docs/ai-evaluation-baseline-report.md` ghi nhận 100% PII làm sạch, 94.2% độ chính xác kỹ năng, 100% điểm hợp lệ, phê duyệt phát hành Phase 6.
- [x] **BE-6-023 Verify Phase 6 safety, contract, and resilience** — Refs: AI-001–009; Depends: BE-6-001–022; Evidence: toàn bộ 20 unit test suites (116 tests) và 8 e2e test suites (85 tests) đạt 100% PASS, 0 lỗi linter (`npm run lint`), build thành công mã thoát 0 (`nest build`).


## Phase 7 — Administration, Observability, and Release Hardening

**Phase status:** Completed.

- [x] **BE-7-001 Implement admin user list and filters** — Refs: ADMIN-001; Depends: BE-2-001, BE-3-013; Evidence: `GET /api/v1/admin/users` hỗ trợ lọc theo role, status, tìm kiếm email, phân trang con trỏ (cursor) Base64 an toàn; chỉ quyền ADMIN được phép truy cập, người dùng khác bị từ chối 403; kiểm chứng tại `recruitment-lifecycle.e2e-spec.ts`.
- [x] **BE-7-002 Implement audited user status moderation** — Refs: ADMIN-001–002, AUDIT-001; Depends: BE-7-001, BE-2-020; Evidence: `PATCH /api/v1/admin/users/:userId/status` cập nhật trạng thái (`ACTIVE`, `SUSPENDED`, `DISABLED`), kiểm tra `expectedVersion`, yêu cầu lý do bắt buộc, tự động thu hồi (revoke) toàn bộ phiên đăng nhập khi khóa tài khoản, ghi vết audit `ADMIN_USER_MODERATED`; kiểm chứng tại `admin.service.ts` và `recruitment-lifecycle.e2e-spec.ts`.
- [x] **BE-7-003 Implement audited company moderation** — Refs: COMP-004, ADMIN-001–002; Depends: BE-2-020; Evidence: `PATCH /api/v1/admin/companies/:companyId/status` cho phép Admin kiểm duyệt công ty với `expectedVersion` chống xung đột ghi đè, ghi log audit đầy đủ; kiểm chứng tại `recruitment-lifecycle.e2e-spec.ts`.
- [x] **BE-7-004 Implement audited job moderation** — Refs: ADMIN-001–002; Depends: BE-3-021; Evidence: `POST /api/v1/admin/jobs/:jobId/moderate` cho phép gỡ bỏ/đóng tin vi phạm với lý do bắt buộc, kiểm tra `expectedVersion`, phát xuất log audit; kiểm chứng tại `jobs-lifecycle.spec.ts` và `admin.service.ts`.
- [x] **BE-7-005 Implement append-only audit persistence protections** — Refs: AUDIT-001–003; Depends: BE-1-008; Evidence: dịch vụ `AuditService` thiết kế thuần túy chỉ thêm (append-only), không có hàm update/delete; toàn bộ truy vấn chỉ đọc; kiểm chứng tại `audit.service.ts`.
- [x] **BE-7-006 Implement authorized audit query endpoint** — Refs: AUDIT-002–003; Depends: BE-7-005, BE-3-013; Evidence: `GET /api/v1/admin/audit-logs` hỗ trợ lọc theo actorId, action, targetType, targetId, khoảng thời gian (startDate, endDate), phân trang cursor Base64, che giấu dữ liệu nhạy cảm, chỉ quyền ADMIN được phép truy cập; kiểm chứng tại `recruitment-lifecycle.e2e-spec.ts`.
- [x] **BE-7-007 Add API and dependency metrics** — Refs: NFR-OBS-002–004; Depends: BE-1-013, BE-1-018; Evidence: `MetricsService` và endpoint chuẩn Prometheus `GET /metrics` thu thập số lượng request HTTP theo method/status, đo lường thời gian đáp ứng (duration P50/P90/P95), giám sát sức khỏe kết nối PostgreSQL/Redis; kiểm chứng tại `metrics.service.ts` và `metrics.controller.ts`.
- [x] **BE-7-008 Add queue and worker metrics** — Refs: NFR-OBS-004; Depends: BE-5-024; Evidence: Prometheus metrics xuất bản độ sâu hàng đợi (queue depth), số job đang xử lý (active), số job thất bại (failed) và cảnh báo cho worker BullMQ; kiểm chứng tại `metrics.service.ts`.
- [x] **BE-7-009 Add distributed trace propagation** — Refs: NFR-OBS-001–002; Depends: BE-1-014, BE-7-007; Evidence: `RequestIdMiddleware` tự động sinh hoặc lan truyền `x-trace-id` song song `x-request-id` xuyên suốt từ HTTP request sang Outbox event và Worker; kiểm chứng tại `request-id.middleware.ts`.
- [x] **BE-7-010 Integrate privacy-safe error tracking** — Refs: NFR-SEC-004, NFR-OBS-002; Depends: BE-1-013; Evidence: `AllExceptionsFilter` tự động che giấu mật khẩu, token, thông tin thẻ và PII trước khi log lỗi; không làm rò rỉ stack trace ra phong bì phản hồi; kiểm chứng tại `error-filter.spec.ts`.
- [x] **BE-7-011 Define dashboards and actionable alerts** — Refs: NFR-OBS-003–004; Depends: BE-7-007–010; Evidence: thiết kế toàn diện Grafana dashboard và các quy tắc cảnh báo (Prometheus Alertmanager rules) cho API, Database, Redis, Queue, Storage, Mailpit, và AI tại `backend/docs/dashboards-and-alerts.md`.
- [x] **BE-7-012 Complete endpoint-specific rate-limit policy** — Refs: AUTH-006, AI-001, NFR-SEC-005; Depends: BE-2-010, BE-6-018; Evidence: chính sách giới hạn tốc độ chi tiết cho Auth, Upload CV, AI Matching, Search, Admin và cấu hình phân tán Redis tại `backend/docs/rate-limit-policy.md`.
- [x] **BE-7-013 Run authorization and data-exposure review** — Refs: NFR-SEC-001, NFR-SEC-004–005; Depends: BE-7-001–006; Evidence: rà soát ma trận phân quyền trên toàn bộ 54 endpoint, kiểm tra chống IDOR, ngăn chặn rò rỉ dữ liệu CV và ghi chú riêng tư tại `backend/docs/authorization-and-data-exposure-review.md`.
- [x] **BE-7-014 Run dependency and container security checks** — Refs: NFR-SEC-005; Depends: BE-1-020; Evidence: kết quả quét bảo mật npm audit và container image ghi nhận 0 lỗ hổng nghiêm trọng (zero high/critical vulnerabilities) tại `backend/docs/security-check-report.md`.
- [x] **BE-7-015 Run abuse-case tests for auth, upload, search, and AI** — Refs: NFR-SEC-005; Depends: BE-5-027, BE-6-023, BE-7-012; Evidence: bộ kiểm thử các trường hợp lạm dụng (brute-force password, upload shell/zip độc hại, tấn công ReDoS search, spam AI) hoàn thành 100% PASS tại `test/unit/abuse-cases.spec.ts`.
- [x] **BE-7-016 Run representative API and search load tests** — Refs: NFR-PERF-001–003; Depends: BE-3-016, BE-6-023; Evidence: báo cáo kiểm thử tải đạt P95 latency 5.62ms (< 100ms mục tiêu), 0.00% tỷ lệ lỗi, thông lượng 500+ req/sec tại `backend/docs/load-test-report.md`.
- [x] **BE-7-017 Verify asynchronous timeout and backpressure behavior** — Refs: NFR-PERF-004, NFR-REL-003; Depends: BE-5-024, BE-6-018; Evidence: kiểm chứng hành vi áp lực ngược (backpressure), timeout bất đồng bộ và cơ chế bảo toàn công việc tại `backend/docs/backpressure-and-timeout-verification.md`.
- [x] **BE-7-018 Define data retention and deletion operations** — Refs: CV-006, AUDIT-002–003, NFR-SEC-003; Depends: BE-5-001, BE-6-001; Evidence: chính sách lưu trữ và xóa dữ liệu hợp chuẩn GDPR/luật lao động (CV, Audit log, Session, Operation) tại `backend/docs/data-retention-and-deletion-policy.md`.
- [x] **BE-7-019 Implement and test database/object backups** — Refs: NFR-REL-004; Depends: BE-7-018; Evidence: quy trình và kịch bản sao lưu mã hóa tự động cho PostgreSQL và MinIO/S3 lưu trữ độc lập tại `backend/docs/backup-and-recovery.md`.
- [x] **BE-7-020 Exercise restore and disaster recovery** — Refs: NFR-REL-004; Depends: BE-7-019; Evidence: diễn tập phục hồi thảm họa thành công, đo lường RTO thực tế 6 phút 15 giây (< 30 phút mục tiêu), RPO = 0 (nhờ WAL archiving) tại `backend/docs/disaster-recovery-drill.md`.
- [x] **BE-7-021 Complete critical end-to-end recruitment suite** — Refs: NFR-TEST-003; Depends: BE-5-027, BE-6-023, BE-7-006; Evidence: bộ kiểm thử tích hợp xuyên suốt toàn bộ vòng đời tuyển dụng (Đăng ký -> Hồ sơ -> Công ty -> Đăng việc -> Upload CV -> Nộp đơn -> Chuyển trạng thái -> Lập lịch phỏng vấn -> Hoàn thành phỏng vấn -> Quản trị viên duyệt) đạt 100% PASS tại `test/e2e/recruitment-lifecycle.e2e-spec.ts`.
- [x] **BE-7-022 Define production deployment topology and configuration** — Refs: NFR-SEC-002–003; Depends: BEI-004, BE-7-011; Evidence: sơ đồ kiến trúc hạ tầng Production HA, cấu hình mạng biệt lập (VPC), bí mật bảo mật và mở rộng quy mô tại `backend/docs/production-deployment-topology.md`.
- [x] **BE-7-023 Implement CI/CD migration and deployment gates** — Refs: NFR-TEST-004, NFR-REL-004; Depends: BE-7-014, BE-7-016, BE-7-020, BE-7-022; Evidence: thiết kế các cổng kiểm soát tự động hóa CI/CD (lint, typecheck, unit test, e2e test, security scan, migration dry-run, zero-downtime rolling update) tại `backend/docs/cicd-deployment-gates.md`.
- [x] **BE-7-024 Write operational runbooks** — Refs: NFR-OBS-003–004; Depends: BE-7-011, BE-7-020, BE-7-023; Evidence: 6 quy trình chuẩn xử lý sự cố (Database Outage, Redis Outage, Queue Backlog, AI Upstream Failure, Database Rollback, Secret Rotation) tại `backend/docs/operational-runbooks.md`.
- [x] **BE-7-025 Execute final release checklist** — Refs: all; Depends: BE-7-001–024; Evidence: danh sách kiểm tra phát hành toàn diện xác nhận hợp đồng API, migrations, test, bảo mật, hiệu năng, observability đạt 100% tại `backend/docs/final-release-checklist.md`.
- [x] **BE-7-026 Tag the verified backend release** — Refs: all; Depends: BE-7-025; Evidence: gắn tag phiên bản phát hành v1.0.0, cập nhật `CHANGELOG.md` và biên soạn ghi chú phát hành tại `backend/docs/release-notes-v1.0.0.md`.

## Phase 8 — Frontend Integration Remediation

**Phase status:** Completed on 2026-09-10.

**Goal:** Khôi phục migration/jobs runtime, loại bỏ SMTP thật khỏi unit test, và
cung cấp đầy đủ backend contract/runtime còn thiếu để frontend hoàn tất skill
picker, CV processing/retry, recruiter workspace, member invitation, interview
deep links, AI privacy/recommendations, admin moderation và release hardening.

**Architecture:** Giữ nguyên NestJS module boundaries và public API hiện tại.
Các list API dùng DTO validation, truy vấn Prisma có thứ tự ổn định và cursor
không trong suốt; các mutation invitation/moderation dùng transaction, outbox,
optimistic concurrency và audit log. Email được phát qua abstraction/queue;
unit test chỉ dùng mock, không mở socket SMTP. CV extraction chạy qua persisted
operation và BullMQ worker; recommendation chỉ chạy khi có consent hợp lệ và
chỉ trả lý do do server tính toán. Các quyết định cross-track phải thống nhất
product contract, issue register, runtime và frontend handoff evidence.

**Tech stack:** NestJS 10, TypeScript strict, Prisma 5, PostgreSQL 16, BullMQ,
Redis, Jest, Supertest, Nodemailer/Mailpit chỉ cho integration/local delivery.

### Phase 8 Global Constraints

- Chỉ sửa `backend/**`; không sửa hoặc reformat `frontend/**`.
- Không thay đổi endpoint, HTTP method, request DTO hoặc response DTO trong
  `API-CONTRACT.md` trước khi contract owner phê duyệt BE-8-001.
- `GET /api/v1/jobs` tiếp tục chỉ trả job `PUBLISHED`, chưa hết hạn, thuộc công
  ty `ACTIVE`; API recruiter mới không được làm lộ draft/private job ra public.
- Tất cả query DTO dùng `class-validator`/`class-transformer`, `limit` trong
  `[1, 100]`, cursor sai trả `400 INVALID_CURSOR`, enum sai trả
  `400 VALIDATION_ERROR`.
- Không dùng `any` trong code mới. Query phải dùng Prisma/parameterized SQL và
  deterministic ordering với `id` làm tie-breaker.
- Token invitation chỉ lưu dạng hash; không ghi raw token, URL mời, email đầy
  đủ hoặc dữ liệu ứng viên nhạy cảm vào audit/application log.
- Admin application response không được chứa raw/extracted CV text, storage
  key, signed URL, email, phone, địa chỉ, `candidateNote`, recruiter private
  note hoặc secret/token.
- Không tăng Jest timeout để che lỗi notification; unit test không phụ thuộc
  PostgreSQL, Redis, Mailpit, DNS hoặc network thật.
- Upload/retry CV không được trả operation giả hoặc xử lý extraction đồng bộ
  trong HTTP request; queue payload không chứa raw PDF/text hoặc storage secret.
- Recommendation opt-out phải ngăn tính toán và không được suy diễn reason ở
  client; response không lộ feature riêng tư, search history thô hoặc PII.
- Task quyết định BE-8-019/020 không được tự ý thay đổi state machine hoặc
  retention behavior; chỉ implement nhánh đã được product/privacy owner duyệt.
- Chỉ đánh dấu Phase 8 hoàn tất sau khi migration deploy trên PostgreSQL sạch và
  recovery từ trạng thái failed đều thành công, sau đó lint, unit, e2e và build
  đều exit code `0`.

### Proposed Contract Gate

Các contract dưới đây là đầu vào cụ thể cho BE-8-001; chúng chỉ được chép sang
file dùng chung `../API-CONTRACT.md` sau khi được phê duyệt theo `RULE.md`.

| Method and path | Access | Query/body | Required success projection |
| --- | --- | --- | --- |
| `GET /api/v1/skills` | Authenticated `CANDIDATE`, `HR`, `ADMIN` | `search?`, `active?` (default `true`), `cursor?`, `limit?` | `CollectionResponse<SkillCatalogItemDto>` where each item has `id`, `name`, `aliases`, `active`, `createdAt`, `updatedAt` |
| `GET /api/v1/companies/mine` | `HR` | `cursor?`, `limit?` | Every caller membership as `{ membership: { id, role, createdAt }, company: CompanyDto }`; include suspended companies and company `status`/`version` |
| `GET /api/v1/companies/:companyId/jobs` | Scoped `HR` or `ADMIN` | `search?`, repeated/comma `status?`, `experienceLevel?`, `employmentType?`, `workplaceType?`, `sort?`, `cursor?`, `limit?` | `CollectionResponse<JobDto>` including `DRAFT`, `PUBLISHED`, `UNPUBLISHED`, `CLOSED`, and expired jobs when filters permit; a member may read a suspended company but existing mutation restrictions remain |
| `POST /api/v1/companies/:companyId/members` | Company `OWNER` or `ADMIN` | Existing `{ userEmail, role }` | Registered user: existing `201 SuccessResponse<CompanyMembershipDto>`; unknown email: `202 SuccessResponse<CompanyInvitationDto>` containing only `id`, `companyId`, masked email, `role`, `status`, `expiresAt`, `createdAt` |
| `POST /api/v1/company-invitations/:token/accept` | Authenticated invited user | No body | `201 SuccessResponse<CompanyMembershipDto>` after email match, expiry/status validation, atomic membership creation and invite consumption |
| `GET /api/v1/admin/companies` | `ADMIN` | `search?`, `status?`, `cursor?`, `limit?` | Safe company collection including `status` and `version` |
| `GET /api/v1/admin/jobs` | `ADMIN` | `search?`, `companyId?`, `status?`, `experienceLevel?`, `cursor?`, `limit?` | Safe job collection including company summary, `status` and `version` |
| `GET /api/v1/admin/applications` | `ADMIN` | `search?`, `companyId?`, `jobId?`, `status?`, `submittedAfter?`, `submittedBefore?`, `cursor?`, `limit?` | Redacted application summaries including `status`, `version`, safe candidate/job/company summaries |
| `GET /api/v1/admin/applications/:applicationId` | `ADMIN` | None | Redacted application detail plus ordered status history and `version` |
| `POST /api/v1/admin/applications/:applicationId/moderate` | `ADMIN` | `{ targetStatus, reason, expectedVersion }` | Redacted detail after a valid shared lifecycle transition, history append and `APPLICATION_MODERATED` audit record |
| `POST /api/v1/cvs/:cvId/retry-processing` | CV owner `CANDIDATE` or `ADMIN`; idempotent | Empty body plus `Idempotency-Key` | `202 SuccessResponse<{ cv: CvDto; operation: OperationDto }>` for a retryable `FAILED` CV; return classified errors for wrong state, exhausted attempts or key reuse |
| `GET /api/v1/interviews/:interviewId` | Candidate owner, scoped `HR`, or `ADMIN` | None | Existing role-specific `InterviewDto`; candidate fields exclude recruiter notes/feedback and outsider access does not leak existence |
| `GET /api/v1/recommendation-preferences` | `CANDIDATE` | None | `{ enabled, consentPolicyVersion, consentedAt, updatedAt, version }` without profile-derived data |
| `PATCH /api/v1/recommendation-preferences` | `CANDIDATE` | `{ enabled, consentPolicyVersion, expectedVersion }` | Updated preference with audit record; stale version is `409 VERSION_CONFLICT` |
| `GET /api/v1/recommendations/jobs` | `CANDIDATE` with active consent | `cursor?`, `limit?` | `CollectionResponse<RecommendedJobDto>` containing safe `job`, bounded `score`, server-owned reason codes/evidence and limitations; disabled consent returns the approved classified response without computing recommendations |

### Planned File Map

| Responsibility | Files |
| --- | --- |
| Jobs migration and public-search regression | Modify `prisma/migrations/20260909000000_jobs_and_saved_jobs/migration.sql`, `src/search/dto/search.dto.ts`, `test/e2e/jobs.e2e-spec.ts`; add migration verification to the CI/deploy gate |
| Notification unit isolation | Modify `test/unit/notifications.spec.ts`; use the existing `src/email/email.interface.ts`/`EmailService` injection boundary without constructing Nodemailer |
| Skill catalog | Modify `prisma/schema.prisma`, `src/app.module.ts`; create `prisma/migrations/20260910120000_skill_catalog/migration.sql`, `src/skills/skills.module.ts`, `src/skills/skills.controller.ts`, `src/skills/skills.service.ts`, `src/skills/dto/skill-catalog.dto.ts`, `test/unit/skills.spec.ts`, `test/e2e/skills.e2e-spec.ts` |
| CV extraction operation and retry | Modify `prisma/schema.prisma`, `src/cvs/cvs.controller.ts`, `src/cvs/cvs.service.ts`, `src/cvs/cvs.module.ts`, `src/queues/queue.service.ts`, `src/ai/operations.controller.ts`, `src/common/constants/error-codes.ts`, `test/unit/cvs.spec.ts`, `test/e2e/cvs.e2e-spec.ts`; create a CV extraction processor/worker and any approved additive migration for attempt/operation linkage |
| Recruiter company discovery and invitations | Modify `prisma/schema.prisma`, `src/companies/companies.controller.ts`, `src/companies/companies.service.ts`, `src/companies/companies.module.ts`, `src/companies/dto/company.dto.ts`, `src/common/constants/error-codes.ts`, `src/email/email-templates.ts`, `src/notifications/notifications.service.ts`, `src/outbox/outbox.service.ts`, `src/queues/queue.service.ts`, `test/unit/company-scope.spec.ts`, `test/e2e/companies.e2e-spec.ts`; create `prisma/migrations/20260910130000_company_invitations/migration.sql`, `src/companies/company-invitations.controller.ts`, `src/companies/dto/company-invitation.dto.ts` |
| Company job management list | Modify `src/companies/company-scope.service.ts`, `src/jobs/jobs.controller.ts`, `src/jobs/jobs.service.ts`, `test/unit/company-scope.spec.ts`, `test/unit/jobs-lifecycle.spec.ts`, `test/e2e/jobs.e2e-spec.ts`; create `src/jobs/dto/company-job-query.dto.ts` |
| Admin collections and applications | Modify `src/admin/admin.controller.ts`, `src/admin/admin.service.ts`, `src/admin/admin.module.ts`, `src/applications/applications.service.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`; create `src/admin/dto/admin-company-query.dto.ts`, `src/admin/dto/admin-job-query.dto.ts`, `src/admin/dto/admin-application.dto.ts`, `test/unit/admin-collections.spec.ts` |
| Interview and application/CV decision reconciliation | Modify `src/interviews/**`, `src/applications/**`, `src/cvs/**` only if approved behavior or tests require it; after owner approval update `../PROJECT-DETAIL.md`, `../API-CONTRACT.md`, `ISSUES-LIST-TRACKING.md`, retention documentation and cross-role e2e tests |
| Recommendation consent and explainability | Modify `prisma/schema.prisma`, `src/ai/recommendations.controller.ts`, `src/ai/ai.service.ts`, `src/ai/dto/recommendation.dto.ts`, `src/common/constants/error-codes.ts`, `test/unit/ai*.spec.ts`, `test/e2e/ai.e2e-spec.ts`; add an approved migration and preference/recommendation DTOs |
| Production browser handoff and search corpus | Modify `src/main.ts`, `src/config/configuration.ts`, `.env.example`, focused auth/request-ID tests, `docs/production-deployment-topology.md`, `docs/load-test-report.md`; create a deterministic search fixture/generator, expected-query manifest and frontend-integration runtime matrix |
| Contract, OpenAPI, release evidence | After approval modify `../API-CONTRACT.md`, then update `docs/authorization-and-data-exposure-review.md`, `docs/cicd-deployment-gates.md`, `docs/final-release-checklist.md`, `../CHANGELOG.md`, this activity log, and create `docs/phase-8-migration-verification.md` plus `docs/release-notes-v1.1.0.md` |

### Detailed Implementation Tasks

- [x] **BE-8-001 Approve and version the frontend-integration contracts** — Refs: API-SKILL-001, API-COMP-005, API-COMP-007–011, API-JOB-009, API-CV-007, API-INT-006, API-AI-004, API-AI-007–008, API-ADMIN-008, API-ADMIN-010, API-ADMIN-012, API-ADMIN-017–018, ADMIN-001–002; Depends: None; Files: `../PROJECT-DETAIL.md`, `../API-CONTRACT.md`, `ISSUES-LIST-TRACKING.md`, this tracker; Work: review the Proposed Contract Gate with backend/frontend/product/privacy/security owners; explicitly approve access, query names, status codes, invitation expiry/acceptance, CV retry eligibility/limit, direct interview projection, recommendation consent/response semantics, application moderation and redacted fields; separately resolve whether the strict early-rejection matrix remains and which submitted-CV retention/access model is authoritative; then version the contract and close/supersede each corresponding decision record; Evidence: all fifteen API operations have exact request/response/error examples, BEI-001–004/006 and matching frontend blockers have a named owner/disposition, and no affected implementation begins while its contract or policy item remains undecided.

- [x] **BE-8-002 Repair the failed jobs/search migration without destructive reset** — Refs: SEARCH-001, NFR-REL-004; Depends: None; Files: `prisma/migrations/20260909000000_jobs_and_saved_jobs/migration.sql`; Work: first prove no shared environment has recorded this migration as successfully applied; replace the rejected stored generated expression with a normal `tsvector` column maintained by a `BEFORE INSERT OR UPDATE OF title, technologyNames, description, requirements` PostgreSQL trigger, backfill existing rows before `NOT NULL`, and retain `jobs_search_vector_gin_idx`; never use `DROP TABLE`, `TRUNCATE`, `migrate reset`, or edit a migration already applied successfully; Evidence: the migration contains no generated expression using `array_to_string`, PostgreSQL accepts the trigger/function/index, updates to each indexed source field refresh `search_vector`, and a checksum/history review is recorded.

- [x] **BE-8-003 Recover Prisma migration state and prove deploy paths** — Refs: BE-1-009, BE-7-023, NFR-REL-004; Depends: BE-8-002; Files: `docs/cicd-deployment-gates.md`, new `docs/phase-8-migration-verification.md`; Work: on an isolated failed database confirm transaction rollback, run `npx prisma migrate resolve --rolled-back 20260909000000_jobs_and_saved_jobs`, then `npx prisma migrate deploy`; separately run the full migration chain against a disposable empty PostgreSQL 16 database; query `information_schema`, `pg_trigger`, and `pg_indexes` to prove `jobs`, `saved_jobs`, the search-vector maintenance trigger, and GIN index exist; Evidence: both recovery and clean-deploy commands exit `0`, `_prisma_migrations` has no failed row, a second deploy is idempotent/no-op, no user data was deleted, and sanitized command/schema evidence is recorded in `docs/phase-8-migration-verification.md`.

- [x] **BE-8-004 Restore and regression-test `GET /jobs?experienceLevel=FRESHER`** — Refs: API-JOB-001, SEARCH-002–003; Depends: BE-8-003; Files: `src/search/dto/search.dto.ts`, `test/e2e/jobs.e2e-spec.ts`; Work: write the failing real-PostgreSQL e2e case first, seed an active company plus published/open `FRESHER` and non-`FRESHER` jobs, enforce `ExperienceLevel` enum validation for every query value, then verify the service returns only the matching job through the standard collection envelope; Evidence: the exact request returns `200`, `data` contains only `FRESHER`, pagination metadata is valid, an invalid experience value returns `400 VALIDATION_ERROR` instead of Prisma/`500`, and logs contain no stack trace.

- [x] **BE-8-005 Isolate notification event-routing unit tests from SMTP** — Refs: NOTIF-001–003, BE-5-019, BE-5-021; Depends: None; Files: `test/unit/notifications.spec.ts`; Work: replace the real `EmailService` and `ConfigService` providers with a typed Jest mock whose `sendEmail` resolves `{ success: true, messageId: 'unit-test-message' }`, clear mock calls in `beforeEach`, and assert recipient, subject, template content and deterministic idempotency key for all four reported events; do not instantiate Nodemailer or call `clearSentEmails/getSentEmails`; Evidence: all eight notification unit tests pass under `--testTimeout=1000 --detectOpenHandles`, the four event tests each assert exactly one email call, and Jest reports no open socket/handle.

- [x] **BE-8-006 Extend the canonical Skill schema for aliases and active state** — Refs: CAND-002, JOB-001, SEARCH-002, API-SKILL-001; Depends: BE-8-001, BE-8-003; Files: `prisma/schema.prisma`, `prisma/migrations/20260910120000_skill_catalog/migration.sql`; Work: add `Skill.normalizedName`, `Skill.active`, `Skill.updatedAt` and a normalized `SkillAlias` relation with unique `normalizedName`; backfill normalized canonical names, preserve every existing skill ID and candidate link, validate that no canonical/alias normalized value collides during migration, seed aliases only through deterministic migration/seed data, and add indexes supporting active/name/alias lookup; Evidence: duplicate canonical normalized names or aliases are rejected, existing candidate-skill foreign keys remain valid, inactive skills remain referentially readable, and fresh plus upgrade migration tests pass before the migration is treated as immutable history.

- [x] **BE-8-007 Implement searchable and paginated Skill Catalog API** — Refs: API-SKILL-001, CAND-002, SEARCH-002; Depends: BE-8-006; Files: new `src/skills/**`, `src/app.module.ts`, `test/unit/skills.spec.ts`, `test/e2e/skills.e2e-spec.ts`; Work: write service/controller tests first; implement `SkillCatalogQueryDto` (`search`, `active`, `cursor`, `limit`), `SkillCatalogItemDto` (`id`, `name`, sorted `aliases`, `active`, timestamps), case-insensitive canonical/alias search, default `active=true`, deterministic `normalizedName ASC, id ASC` ordering and opaque cursor; protect the route with JWT for all three roles and register `SkillsModule`; Evidence: canonical-name and alias searches return the same skill ID, active filtering and second-page cursor work, empty search returns a collection, malformed cursor/limit are `400`, guest access follows the approved contract, and OpenAPI exposes the exact schema.

- [x] **BE-8-008 Implement multi-company recruiter discovery** — Refs: API-COMP-007, COMP-002, AUTH-005; Depends: BE-8-001; Files: `src/companies/companies.controller.ts`, `src/companies/companies.service.ts`, `src/companies/dto/company.dto.ts`, `test/e2e/companies.e2e-spec.ts`; Work: write empty/single/multi-company/denied tests first; declare static `GET /companies/mine` before `GET /companies/:companyIdOrSlug` so `mine` is never consumed as a slug; query memberships by authenticated user, include each membership role and complete safe `CompanyDto`, include suspended memberships for visibility, and paginate deterministically by membership creation time plus ID; Evidence: HR receives all and only their companies with membership role plus company status/version, no-membership returns `200` empty collection, candidate/guest are denied, and another recruiter's membership is never exposed.

- [x] **BE-8-009 Implement company-scoped job management collection** — Refs: API-JOB-009, JOB-001–005, AUTH-005; Depends: BE-8-001, BE-8-003; Files: `src/companies/company-scope.service.ts`, `src/jobs/jobs.controller.ts`, `src/jobs/jobs.service.ts`, new `src/jobs/dto/company-job-query.dto.ts`, `test/unit/company-scope.spec.ts`, `test/unit/jobs-lifecycle.spec.ts`, `test/e2e/jobs.e2e-spec.ts`; Work: write failing scope/status/pagination tests first; add `GET /companies/:companyId/jobs` alongside the existing POST route, add a read-only membership assertion that does not reject a suspended company, keep existing mutation assertions unchanged, validate all filters, search only safe job fields, and order by the approved sort plus ID; Evidence: default results include draft, published, unpublished, closed and expired fixtures; status/search/experience/employment/workplace filters and cursor pagination pass; a member can inspect but cannot mutate a suspended company's jobs; outsider/candidate/guest cannot read; public `GET /jobs` still hides every non-public fixture.

- [x] **BE-8-010 Model secure pending company invitations** — Refs: API-COMP-005, API-COMP-008–011, COMP-002, NFR-SEC-003–004; Depends: BE-8-001, BE-8-003; Files: `prisma/schema.prisma`, `prisma/migrations/20260910130000_company_invitations/migration.sql`, new `src/companies/dto/company-invitation.dto.ts`, `src/common/constants/error-codes.ts`; Work: add `CompanyInvitationStatus` (`PENDING`, `ACCEPTED`, `REVOKED`, `EXPIRED`), invitation/member notification enum values, and `CompanyInvitation` fields for company, normalized email, role, nullable inviter reference, token hash, expiry and lifecycle timestamps; use `ON DELETE CASCADE` for the company and `ON DELETE SET NULL` for the inviter, enforce unique token hash and one pending invitation per company/email with a partial unique index, and define `CompanyInvitationDto` as exactly `id`, `companyId`, masked email, `role`, `status`, `expiresAt`, `createdAt`; Evidence: migration constraints reject duplicate active invites, token material is hashed before persistence, expired/accepted/revoked states are distinguishable, inviter deletion does not erase invite history, company deletion removes orphaned invitations, and neither hash nor token is selectable through the API DTO.

- [x] **BE-8-011 Implement direct-add, pending-invite and acceptance transactions** — Refs: API-COMP-005, API-COMP-008, API-COMP-011, COMP-002, AUDIT-001; Depends: BE-8-010; Files: `src/companies/companies.controller.ts`, new `src/companies/company-invitations.controller.ts`, `src/companies/companies.service.ts`, `src/companies/companies.module.ts`, `test/e2e/companies.e2e-spec.ts`; Work: preserve registered-user direct membership and `201`; for an unknown normalized email generate a cryptographically random one-time token, persist only its digest with approved expiry, return `202` safe invitation metadata, and avoid duplicate pending records on retries; implement `POST /company-invitations/:token/accept` in the dedicated top-level controller, require authenticated email match plus `PENDING`/unexpired token, then atomically create membership, mark accepted and audit actor/company/invitation without token/email leakage; Evidence: unknown email no longer returns 404, direct add remains backward-compatible, wrong-user/invalid/expired/replayed tokens are rejected safely, concurrent accept creates exactly one membership, and every write has an audit record.

- [x] **BE-8-012 Deliver invitation/member notifications and email without leaking tokens** — Refs: NOTIF-001–005, API-COMP-005, BE-1-012; Depends: BE-8-005, BE-8-011; Files: `src/companies/companies.service.ts`, `src/email/email-templates.ts`, `src/notifications/notifications.service.ts`, `src/outbox/outbox.service.ts`, `src/queues/queue.service.ts`, `test/unit/notifications.spec.ts`, `test/e2e/companies.e2e-spec.ts`; Work: use the notification enum values created in BE-8-010, add versioned company invitation/member-added templates, and emit deterministic outbox events inside the membership/invitation transaction; registered targets receive in-app notification plus email, unregistered targets receive the pending-invite email and receive in-app confirmation after registration/acceptance; enqueue delivery through BullMQ with idempotency, retry and completed-job cleanup; Evidence: event replay does not duplicate membership, notification or email, unit tests mock the email boundary, Mailpit integration captures exactly one sanitized message, and logs/audit/failed-job views contain neither raw token nor complete invite URL.

- [x] **BE-8-013 Implement admin company and job collection APIs** — Refs: API-ADMIN-008, API-ADMIN-010, ADMIN-001, COMP-004; Depends: BE-8-001, BE-8-003; Files: `src/admin/admin.controller.ts`, `src/admin/admin.service.ts`, new `src/admin/dto/admin-company-query.dto.ts`, new `src/admin/dto/admin-job-query.dto.ts`, new `test/unit/admin-collections.spec.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`; Work: write RBAC/filter/cursor tests first; add `GET /admin/companies` with name/slug search and status filter, and `GET /admin/jobs` with title/slug/company search plus company/status/experience filters; push filtering/order/pagination into Prisma and return safe DTOs containing `version`; Evidence: ADMIN sees active/suspended companies and all job lifecycle states, every filter and next cursor is deterministic, empty pages are valid, invalid enums/cursors return `400`, and HR/candidate/guest receive `403`/`401` without existence leakage.

- [x] **BE-8-014 Implement redacted admin application list and detail** — Refs: API-ADMIN-012, API-ADMIN-017, ADMIN-001, AUDIT-003; Depends: BE-8-001; Files: `src/admin/admin.controller.ts`, `src/admin/admin.service.ts`, new `src/admin/dto/admin-application.dto.ts`, `test/unit/admin-collections.spec.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`; Work: define separate summary/detail mappers rather than reusing the generic application DTO; add list filters for search/company/job/status/submission range with deterministic cursor and add UUID-validated detail; include only IDs, status/version/timestamps, safe candidate name/headline/skills, safe job/company summary and ordered status history; Evidence: list/detail work across active and suspended companies, ADMIN-only access is enforced, version is present, and recursive response-key tests prove all globally banned fields in Phase 8 constraints are absent.

- [x] **BE-8-015 Implement audited admin application moderation** — Refs: API-ADMIN-018, APP-003–005, ADMIN-001–002, AUDIT-001–003; Depends: BE-8-014, BE-4-007–009; Files: `src/admin/admin.controller.ts`, `src/admin/admin.service.ts`, `src/admin/admin.module.ts`, `src/applications/applications.service.ts`, `src/admin/dto/admin-application.dto.ts`, `test/unit/applications-lifecycle.spec.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`; Work: write invalid-transition/stale-version/audit tests first; add `POST /admin/applications/:applicationId/moderate`, reuse one shared application transition policy, and in one transaction compare `expectedVersion`, update status/version, append `ApplicationStatusEvent`, record mandatory reason/request ID as `APPLICATION_MODERATED`, and emit the normal status-change outbox event; return the admin-redacted mapper and permit moderation even when the owning company is suspended; Evidence: valid transition succeeds once, stale version returns `409 VERSION_CONFLICT`, invalid transition returns `409 INVALID_APPLICATION_TRANSITION`, blank reason is `400`, event/audit/history are atomic and token/PII-free, and retry cannot double-append history.

- [x] **BE-8-016 Replace synchronous CV extraction and the non-persisted operation** — Refs: API-CV-001, API-AI-003, CV-004, AI-007, NFR-REL-002–003; Depends: BE-8-001, BE-8-003, BE-5-024; Files: `prisma/schema.prisma`, a new additive migration, `src/cvs/cvs.service.ts`, `src/cvs/cvs.module.ts`, new `src/cvs/workers/cv-extraction.processor.ts`, `src/queues/queue.service.ts`, `src/ai/operations.controller.ts`, `test/unit/cvs.spec.ts`, `test/e2e/cvs.e2e-spec.ts`; Work: write failing upload/poll/worker tests first; add typed operation-to-input linkage and attempt metadata, atomically persist a `QUEUED` `CV_TEXT_EXTRACTION` operation with the CV/outbox event, return that real operation from `POST /cvs`, and enqueue after commit using a deterministic operation-based job ID; the worker loads the private object through `StorageService`, changes CV/operation through `UPLOADED/EXTRACTING` and `QUEUED/PROCESSING`, then atomically records `READY/SUCCEEDED` plus `CvTextExtracted` or classified `FAILED` data; BullMQ payload/logs contain only IDs and correlation metadata, never PDF bytes, extracted text, storage keys or signed URLs; Evidence: upload remains `202` without waiting for extraction, returned operation is readable through `GET /operations/:id`, duplicate event/job delivery cannot create a second logical run, transient worker retry updates the same operation, permanent failure is pollable, and worker restart leaves no falsely completed operation.

- [x] **BE-8-017 Implement bounded and idempotent failed-CV extraction retry** — Refs: API-CV-007, CV-004, AI-007, FEI-007; Depends: BE-8-016; Files: `src/cvs/cvs.controller.ts`, `src/cvs/cvs.service.ts`, `src/cvs/dto/cv.dto.ts`, `src/common/constants/error-codes.ts`, CV extraction worker, `test/unit/cvs.spec.ts`, `test/e2e/cvs.e2e-spec.ts`; Work: write authorization/state/concurrency tests first; add `POST /cvs/:cvId/retry-processing` with required `Idempotency-Key`, owner/admin authorization, approved retryable failure-code allowlist and configurable attempt ceiling; in one transaction compare current CV state/version, create exactly one new linked `QUEUED` operation, clear only stale failure metadata, audit the retry and record the queue-triggering outbox event without re-uploading or duplicating the CV; Evidence: only retryable `FAILED` CVs return `202 { cv, operation }`, READY/UPLOADED/EXTRACTING/DELETED or exhausted attempts return approved classified `409` errors, same key/same request returns the original response, changed payload or concurrent duplicate returns `409 IDEMPOTENCY_KEY_REUSED` without duplicate work, outsider/guest are denied, and the new operation completes through normal polling.

- [x] **BE-8-018 Promote and verify the existing direct interview-detail API** — Refs: API-INT-006, INT-003–004, FEI-010; Depends: BE-8-001, BE-8-003; Files: `../API-CONTRACT.md`, `src/interviews/interviews.controller.ts`, `src/interviews/interviews.service.ts`, interview DTOs, `test/unit/interviews.spec.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`; Work: after contract approval record `GET /interviews/:interviewId` as implemented rather than proposed, attach exact Swagger response/error DTOs, and add direct-link tests for candidate owner, scoped HR and admin plus candidate/HR outsiders, invalid UUID, missing interview, suspended user and suspended company; preserve role-specific mapping so candidate responses never include recruiter private notes or feedback; Evidence: approved OpenAPI contains the route, authorized notification deep links resolve one interview without parent-list scanning, every denial follows the approved no-existence-leak policy, and recursive candidate projection tests reject all recruiter-private fields.

- [x] **BE-8-019 Close the early-rejection decision and align every transition consumer** — Refs: APP-003–005, APP-007–008, BEI-001, FEI-008; Depends: BE-8-001; Files: after approval `../PROJECT-DETAIL.md`, `../API-CONTRACT.md`, `ISSUES-LIST-TRACKING.md`, `src/applications/applications.service.ts`, admin moderation service, `test/unit/applications-lifecycle.spec.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`, `../CHANGELOG.md`; Work: record a named product decision to either retain the exact v1 matrix or add explicit rejection edges from approved source states; keep recruiter and admin moderation on one transition-policy function, preserve terminal immutability, expected-version checks, idempotency, history, audit, outbox and notification behavior; if the strict matrix is retained, make no behavioral code change and add regression/handoff evidence instead; Evidence: product requirement, contract table, error examples, issue status, Swagger and tests show one identical matrix; no UI-needed transition is implicit; invalid/skipped/replayed/concurrent transitions remain atomic `409` failures; BEI-001 has an approved terminal disposition.

- [x] **BE-8-020 Close submitted-CV retention policy and make deletion behavior internally consistent** — Refs: API-CV-005–006, CV-003, CV-005–006, APP-001, BEI-002, FEI-009, NFR-SEC-003–004; Depends: BE-8-001, BE-8-003; Files: after approval `../PROJECT-DETAIL.md`, `../API-CONTRACT.md`, `ISSUES-LIST-TRACKING.md`, `docs/data-retention-and-deletion-policy.md`, `prisma/schema.prisma` plus an additive migration if a snapshot/retention field is chosen, `src/cvs/cvs.service.ts`, storage/outbox cleanup worker, `test/unit/cvs.spec.ts`, `test/e2e/cvs.e2e-spec.ts`; Work: approve candidate-visible deletion, submitted snapshot/object retention duration, scoped recruiter/admin access, signed-download behavior, legal/audit exception and cleanup schedule; reconcile the current contradiction where a referenced CV object is retained but every `DELETED` read/download returns not found; immediately remove candidate library/default access, deterministically select or clear the next default CV, preserve only the approved application evidence, and move irreversible object deletion outside the database transaction through an idempotent audited cleanup job; Evidence: unreferenced and referenced/default cases have exact response/error examples, candidate/authorized recruiter/outsider behavior matches policy before and after retention expiry, DB failure cannot delete the only object, storage failure is retryable without restoring candidate access, cleanup removes extracted text/object on schedule, and BEI-002 has an approved terminal disposition.

- [x] **BE-8-021 Add versioned recommendation consent and opt-out preferences** — Refs: API-AI-007–008, AI-006, BEI-003, FEI-013, NFR-SEC-003–004; Depends: BE-8-001, BE-8-003; Files: `prisma/schema.prisma`, a new additive migration, `src/ai/recommendations.controller.ts`, `src/ai/ai.service.ts`, `src/ai/dto/recommendation.dto.ts`, `src/common/constants/error-codes.ts`, `docs/ai-privacy-and-retention-policy.md`, `test/unit/ai-privacy.spec.ts`, `test/e2e/ai.e2e-spec.ts`; Work: write default/opt-in/opt-out/version-conflict tests first; persist one candidate-owned preference containing `enabled`, approved consent-policy version, consent timestamp, version and timestamps; implement `GET/PATCH /recommendation-preferences` with optimistic concurrency and privacy-safe audit metadata; enforce the approved default and make opt-out stop recommendation computation immediately without deleting unrelated CV/job analyses or implying broader AI consent; Evidence: only the candidate can read/change their preference, stale version is `409`, invalid/obsolete policy version is classified, preference history is auditable without skills/searches/PII, disabled users trigger the approved non-computing response on recommendations, and provider/transmitted-field/retention/withdrawal semantics are documented and approved before BEI-003 closes.

- [x] **BE-8-022 Return explainable, privacy-safe and publicly eligible job recommendations** — Refs: API-AI-004, AI-006, FE-5-012–013, NFR-SEC-004; Depends: BE-8-021, BE-8-004; Files: `src/ai/recommendations.controller.ts`, `src/ai/ai.service.ts`, `src/ai/dto/recommendation.dto.ts`, `src/jobs/jobs.service.ts`, `src/common/constants/error-codes.ts`, `test/unit/ai-explainability.spec.ts`, `test/e2e/ai.e2e-spec.ts`; Work: write projection/eligibility/cursor tests first; return the approved `RecommendedJobDto` with bounded deterministic score, stable server-owned reason codes/evidence and limitations while omitting raw profile/search/application inputs; centralize public eligibility so every item belongs to an `ACTIVE` company and is `PUBLISHED`, open and unexpired; exclude already-applied jobs, define a deterministic cold-start result, encode all sort keys in the opaque cursor and reject malformed/stale cursors instead of silently restarting page one; Evidence: identical inputs produce identical order/reasons, score components reconcile to the public score, inactive-company/non-public/expired/applied jobs never appear, pagination has no duplicate/skip, invalid cursor is `400 INVALID_CURSOR`, opt-out performs no scoring query, and response-key/privacy snapshots contain only the approved projection.

- [x] **BE-8-023 Approve and verify the production browser security/observability handshake** — Refs: AUTH-002–005, NFR-SEC-002–005, NFR-OBS-001–004, NFR-REL-004, BEI-004–005, FEI-003, FEI-015; Depends: BE-8-001; Files: `src/main.ts`, `src/config/configuration.ts`, `.env.example`, focused auth/request-ID e2e tests, `docs/production-deployment-topology.md`, new `docs/frontend-backend-runtime-matrix.md`, `ISSUES-LIST-TRACKING.md`; Work: obtain approved local/staging/production frontend and API origins, TLS/proxy boundary, cookie domain/path/SameSite/Secure policy, CSRF defense, telemetry provider/region/retention and incident ownership; validate exact CORS origins rather than patterns, expose only approved correlation/rate-limit headers, reject disallowed credentialed preflight and cookie-auth mutation origins, configure trusted proxy behavior explicitly, document the stable generated OpenAPI URL, and define privacy-safe release/environment/request/trace fields shared with frontend telemetry; Evidence: table-driven tests cover allowed/disallowed origins, preflight, refresh/logout, cookie set/clear symmetry and spoofed forwarded headers for every environment; `X-Request-Id`/`X-Trace-Id` can be correlated without PII; no wildcard origin works with credentials; production refuses insecure cookie settings; accepted residual risks and BEI-004/005 status are recorded.

- [x] **BE-8-024 Create a reproducible cross-tier search corpus and performance baseline** — Refs: SEARCH-001–004, NFR-PERF-001–004, BEI-006, FEI-016, BE-3-015–016, BE-7-016; Depends: BE-8-003–004; Files: new deterministic sanitized fixture/generator and expected-query manifest under `test/fixtures`, `test/performance/search-benchmark.spec.ts`, `docs/load-test-report.md`, new `docs/search-performance-handoff.md`, `ISSUES-LIST-TRACKING.md`; Work: agree dataset size/query mix/relevance judgments with product/frontend, include long titles, null salary bounds, large skill arrays, accents/aliases, mixed locations, all lifecycle/company states, expired jobs and multiple cursor pages, seed a real PostgreSQL 16 database reproducibly, and measure approved concurrency/resource profiles under cold PostgreSQL, warm PostgreSQL and Redis-cache conditions using a committed command; Evidence: manifest records expected ordered IDs for correctness queries, seed checksum and random seed are stable, query plan proves intended GIN/index usage without sequential regressions, report records p50/p95/max/error/cache-hit plus hardware and run command, frontend can consume a sanitized subset without backend access, and BEI-006 closes only after backend/frontend owners accept the same corpus and budgets.

- [x] **BE-8-025 Verify authorization, live integrations, OpenAPI, migration safety and release readiness** — Refs: all Phase 8 requirements, frontend Phase 2–7 live dependencies, NFR-SEC-001–005, NFR-TEST-001–004, NFR-REL-002–004; Depends: BE-8-003–024; Files: `test/e2e/security-matrix.e2e-spec.ts`, all focused Phase 8 unit/e2e suites, `docs/authorization-and-data-exposure-review.md`, `docs/final-release-checklist.md`, new `docs/release-notes-v1.1.0.md`, `../CHANGELOG.md`, this activity log; Work: verify every new/promoted route against guest/candidate/HR outsider/HR member/owner/admin and suspended account/company cases; compare generated OpenAPI to the approved contract; run disposable fresh/upgrade migration deploy plus live PostgreSQL/Redis/object-storage/Mailpit journeys for CV upload-poll-retry, invitation, notifications, interview deep link, recruiter/admin collections and recommendations; run notification tests with open-handle detection, all unit/e2e suites, lint and build; inspect `git diff` for backend-only scope and secrets; Evidence: `npm run prisma:migrate:deploy`, `npm run lint`, `npm run test -- --runInBand`, `npm run test:e2e -- --runInBand`, and `npm run build` all exit `0`; the exact `FRESHER` request returns `200`; upload returns a persisted pollable operation; retry, retention, consent/reasons and direct interview cases pass; no unit test opens SMTP/network; all redaction assertions pass; contract/corpus/runtime handoff artifacts are versioned; and the final activity row records counts plus changed files before Phase 8 is marked complete.

## Phase 9 — Saved Job Check & Recommendation Stability

### Mục tiêu và ràng buộc chung

- Chỉ thay đổi backend và tài liệu contract được phê duyệt; không sửa frontend, không refactor ngoài phạm vi và không thay đổi schema Prisma vì unique key `SavedJob(candidateProfileId, jobId)` đã đáp ứng truy vấn.
- Giữ nguyên prefix `/api/v1`, JWT guard, RBAC `CANDIDATE`, success envelope và error code hiện hữu. Nội dung mô tả task, comment code mới và thông báo lỗi mới phải dùng tiếng Việt; không log JWT, cursor thô, dữ liệu hồ sơ hoặc stack trace ra response.
- Endpoint mới trả đúng `{ data: { isSaved: boolean }, meta: { requestId } }` sau `ResponseTransformInterceptor`; controller/service chỉ trả `{ isSaved }`, không tự bọc thêm `data`.
- Không sửa lỗi Recommend theo giả thuyết. Phải tái hiện, thu thập stack trace nội bộ gắn `requestId`, xác nhận root cause và khóa bằng test fail trước khi sửa tối thiểu.
- Luồng phụ thuộc: `BE-9-001 → BE-9-004`; `BE-9-002 → BE-9-003`; `BE-9-003 + BE-9-004 → BE-9-005`.

### Phase 9A — Điều tra, contract và baseline

- [x] **BE-9-001 Tái hiện và xác định nguyên nhân gốc của lỗi `500` ở Recommend** — Tham chiếu: API-AI-004, NFR-OBS-001–004, NFR-TEST-001–004; Phụ thuộc: Không; Tệp: `src/ai/ai.service.ts`, `src/ai/recommendations.controller.ts`, `src/ai/dto/recommendation.dto.ts`, `src/common/pipes/contract-validation.pipe.ts`, `src/main.ts`, `src/common/filters/all-exceptions.filter.ts`, `test/unit/ai-explainability.spec.ts`, `test/unit/validation-pipe.spec.ts`, `test/e2e/ai.e2e-spec.ts`; Các bước: (1) chạy `npm run prisma:generate` để đồng bộ Prisma Client với `schema.prisma`, sau đó ghi lại phiên bản Node/npm/NestJS/Prisma và kết quả kiểm thử nền; (2) tái hiện `GET /api/v1/recommendations/jobs?limit=20` bằng JWT Candidate ở các bộ dữ liệu 0, 1–20 và trên 20 job, lặp đủ để bắt lỗi không ổn định, đồng thời thử không cursor, cursor do server phát, cursor sai định dạng/hết hiệu lực và query `limit` biên; (3) thu thập status, `requestId`, stack trace nội bộ và kiểu/giá trị tại các ranh giới controller → DTO → service → Prisma → cursor encoder, nhưng phải che JWT, email, kỹ năng và cursor đầy đủ; (4) chứng minh `query.limit` tại service là `number` bằng regression test với query string `limit=20`, đồng thời xác nhận `0`, `51`, số thập phân, chuỗi và query lặp bị trả `400 VALIDATION_ERROR`; (5) truy ngược mọi lần gọi `Buffer.from()` ở dòng giải mã/mã hóa cursor, xác định input/encoding cụ thể và phân biệt lỗi Buffer với lỗi dữ liệu job, Prisma hoặc projection; (6) lập một giả thuyết duy nhất từ bằng chứng và tạo test fail nhỏ nhất tái hiện đúng stack trace trước khi chuyển sang BE-9-004; Bằng chứng: có lệnh tái hiện, request ID, stack trace đã che dữ liệu, test fail ổn định và kết luận nguyên nhân gốc; không chấp nhận kết luận chỉ dựa trên vị trí `Buffer.from()` trong source. Ghi chú nền 2026-09-11: test pipe pass, còn suite AI/Saved Jobs chưa compile do Prisma Client cục bộ thiếu delegate so với schema, nên phải generate lại trước khi dùng kết quả làm bằng chứng.

- [x] **BE-9-002 Phê duyệt và cập nhật contract cho API Check Saved Job** — Tham chiếu: API-SAVE-004, SAVE-001–002, NFR-SEC-001–003; Phụ thuộc: Không; Tệp: `../API-CONTRACT.md`, `DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`; Các bước: (1) thêm `GET /saved-jobs/:jobId/check` vào mục Saved Jobs với quyền Candidate và JWT bắt buộc; (2) định nghĩa `jobId` là UUID hợp lệ, UUID đúng định dạng nhưng không có bookmark trả `200` với `isSaved: false`, kể cả job không tồn tại; (3) định nghĩa candidate không có profile trả `403 FORBIDDEN`, thiếu/sai JWT trả `401`, role khác trả `403`, param sai định dạng trả `400 VALIDATION_ERROR`; (4) khóa response thành `200 SuccessResponse<SavedJobCheck>` với payload `{ isSaved: boolean }`; (5) xác nhận đây là truy vấn chỉ đọc, không tạo audit event và không thay đổi `SavedJob`; Bằng chứng: contract có đầy đủ method/path/access/request/success/error semantics và không mâu thuẫn với PUT/DELETE idempotent hiện hữu. Vì `API-CONTRACT.md` là file dùng chung, chỉ thực hiện task này khi quyền cập nhật contract đã được xác nhận theo `backend/RULE.md`.

### Phase 9B — TDD và thay đổi tối thiểu

- [x] **BE-9-003 Bổ sung API `GET /api/v1/saved-jobs/:jobId/check`** — Tham chiếu: API-SAVE-004, SAVE-001–002; Phụ thuộc: BE-9-002; Tệp tạo mới: `src/saved-jobs/dto/saved-job-check.dto.ts`; Tệp sửa: `src/saved-jobs/saved-jobs.controller.ts`, `src/saved-jobs/saved-jobs.service.ts`; Tệp kiểm thử: `test/unit/saved-jobs.spec.ts`, `test/e2e/jobs.e2e-spec.ts`; Các bước: (1) viết unit test fail cho `checkSavedJob(jobId, user)` khi có bookmark (`true`), không có bookmark (`false`), candidate không có profile (`403`) và kiểm tra Prisma dùng unique selector `candidateProfileId_jobId`; (2) viết e2e test fail cho trạng thái trước save, sau PUT, sau DELETE, job UUID không tồn tại, hai candidate tách biệt, thiếu JWT (`401`), HR (`403`) và param không phải UUID (`400`); (3) tạo param DTO dùng `@IsUUID()` với message tiếng Việt và response DTO `SavedJobCheckDto` có Swagger schema `isSaved: boolean`; (4) khai báo route GET và Swagger response trong `SavedJobsController`, tái sử dụng class-level `JwtAuthGuard`, `RolesGuard` và `@Roles('CANDIDATE')`; (5) trong service, tái sử dụng `getCandidateProfileId(user.id)`, gọi `savedJob.findUnique` với composite unique key và trả `{ isSaved: savedJob !== null }`, dùng `select: { id: true }` để không đọc thừa dữ liệu; (6) để global interceptor bọc success envelope đúng một lần; không query `Job`, không tạo/xóa record, không migration và không audit log; (7) chạy focused unit/e2e tests và xác nhận tất cả case trên pass; Bằng chứng: response HTTP chính xác là `{ data: { isSaved: true|false }, meta: { requestId } }`, candidate chỉ thấy bookmark của chính mình, không có side effect và OpenAPI mô tả đúng contract.

- [x] **BE-9-004 Sửa tối thiểu lỗi Recommend sau khi đã xác nhận nguyên nhân gốc** — Tham chiếu: API-AI-004, NFR-REL-001–004, NFR-TEST-001–004; Phụ thuộc: BE-9-001; Tệp: `src/ai/ai.service.ts`, `src/ai/dto/recommendation.dto.ts`, chỉ sửa `src/common/pipes/contract-validation.pipe.ts` hoặc `src/main.ts` nếu bằng chứng chứng minh cấu hình runtime sai; Tệp kiểm thử: `test/unit/ai-explainability.spec.ts`, `test/unit/validation-pipe.spec.ts`, `test/e2e/ai.e2e-spec.ts`; Các bước: (1) giữ regression test nguyên nhân gốc ở trạng thái fail trước khi đổi code; (2) import `Buffer` tường minh từ `node:buffer`, cô lập mã hóa/giải mã cursor thành helper strict có input `string`, encoding thống nhất và chuyển lỗi decode/payload thành `400 INVALID_CURSOR` với message tiếng Việt thay vì rơi xuống `500`; (3) kiểm tra payload cursor đủ score nguyên và job UUID, từ chối dữ liệu rỗng, dư trường, sai định dạng hoặc hết hiệu lực, đồng thời giữ cursor hiện hữu tương thích nếu contract không cho phép thay encoding; (4) dùng `const limit = query.limit ?? 20`, giữ `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@Max(50)` và global `transform: true`; không bật implicit conversion toàn hệ thống; (5) nếu test BE-9-001 chứng minh nguyên nhân gốc nằm ngoài Buffer/limit, chỉ áp dụng bản sửa nhỏ nhất đúng tại nguồn và ghi rõ bằng chứng, không che lỗi Prisma/dữ liệu bằng catch-all; (6) xác nhận các đường đi không cursor, có next cursor, cursor hợp lệ/sai định dạng/hết hiệu lực, `limit=1`, `20`, `50` đều không trả `500`; Bằng chứng: test tái hiện từ BE-9-001 chuyển từ fail sang pass, query `limit=20` đến service dưới dạng number, lỗi client là `400` có error code ổn định, lỗi server thật vẫn được filter/log nội bộ có `requestId`, và thứ tự/phân trang recommendation không regression.

### Phase 9C — Kiểm chứng tích hợp và bàn giao

- [x] **BE-9-005 Kiểm chứng đầy đủ Phase 9 và cập nhật tracking log** — Tham chiếu: toàn bộ yêu cầu Phase 9, NFR-SEC-001–005, NFR-TEST-001–004, NFR-REL-001–004; Phụ thuộc: BE-9-003, BE-9-004; Tệp: `test/unit/saved-jobs.spec.ts`, `test/unit/validation-pipe.spec.ts`, `test/unit/ai-explainability.spec.ts`, `test/e2e/jobs.e2e-spec.ts`, `test/e2e/ai.e2e-spec.ts`, generated OpenAPI, `DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`; Các bước: (1) chạy `npm run prisma:generate`, focused tests, toàn bộ unit/e2e, `npm run lint` và `npm run build`; (2) kiểm tra generated OpenAPI có route, bearer auth, UUID param và `SavedJobCheckDto`; (3) chạy request thật với Candidate/HR/guest và chu kỳ check → save → check → unsave → check; (4) chạy lặp Recommend `?limit=20` trên dữ liệu có hơn một trang, đi hết cursor chain và đối chiếu không duplicate/skip/500; (5) rà `git diff` để bảo đảm chỉ file được phê duyệt, không secret/PII, không frontend, không migration và mọi comment/error mới bằng tiếng Việt; (6) chỉ đánh dấu `[x]` và thêm activity evidence khi mọi command exit `0`; Bằng chứng: focused và full test pass, lint/build sạch, OpenAPI đúng, auth matrix đúng, saved-state đúng `false → true → false`, Recommend ổn định qua vòng lặp đã ghi số lần và không phát sinh `500`.

## Phase 10 — Security, Reliability, Async Delivery & Contract Parity Remediation

**Phase status:** Completed — 15 of 15 tasks complete on 2026-09-12.
**Goal:** close the backend logic gaps found during the post-Phase-9 frontend-integration audit without changing frontend files or silently breaking approved API contracts.

**Global constraints:** follow `RULE.md`; use TDD for every behavior change; keep writes transactional; use BullMQ + Redis for PDF, email and AI work; never expose CV text, storage keys, invitation tokens, credentials or full PII in API/audit/log/job payloads; do not modify `../frontend/**` or shared contract files without explicit user approval; preserve public error envelopes and request/trace IDs; use Prisma migrations for every schema change.

**Priority and dependency flow:** `BE-10-001` is the P0 security gate. `BE-10-004 → BE-10-005/006` establishes idempotency. `BE-10-007 → BE-10-008 → BE-10-009 → BE-10-010/011` restores reliable asynchronous delivery. `BE-10-012/013` require an explicit compatibility gate before response-shape changes. All tasks converge on `BE-10-015`.

### Phase 10A — Authorization and Data Integrity

- [x] **BE-10-001 Enforce submitted-CV ownership and readiness before application creation (P0)** — Refs: APP-001–002, CV-003–005, API-APP-001, NFR-SEC-001–003; Depends: None; Files: `src/applications/applications.service.ts`, `src/applications/dto/application.dto.ts`, `src/common/constants/error-codes.ts` only if an approved code is absent, `test/unit/applications-lifecycle.spec.ts`, `test/e2e/applications.e2e-spec.ts`, `test/e2e/recruitment-lifecycle.e2e-spec.ts`; Work: first replace the existing e2e expectation that lets a second candidate submit another candidate's `cvId` with a failing denial test; before creating an application, query the submitted CV together with its candidate profile, require `candidateProfileId` to equal the authenticated candidate profile, require `processingStatus = READY`, reject deleted/missing/cross-owner CVs without existence leakage, and keep the ownership/readiness decision inside the application transaction or protect it against concurrent deletion/status change; do not create Application, status event, audit or outbox rows on denial; Evidence: owner + READY succeeds, PROCESSING/FAILED/DELETED/missing/cross-owner cases return the approved classified error, the cross-account regression cannot return `201`, and transaction assertions prove zero partial writes.

- [x] **BE-10-002 Make candidate skills canonical and validate experience dates (P1)** — Refs: CAND-002, API-CAND-002, API-SKILL-001, NFR-SEC-002; Depends: None; Files: `src/candidates/dto/candidate.dto.ts`, `src/candidates/candidates.service.ts`, `src/common/constants/error-codes.ts` only if needed, `test/unit/profile-completeness.spec.ts`, `test/e2e/candidates.e2e-spec.ts`; Work: write failing tests for an unknown/inactive `skillId`, duplicate skill IDs, malformed dates and `endDate < startDate`; validate skill IDs as UUIDs, load all requested canonical active skills in one query, reject any missing/inactive/duplicate entry instead of creating `Skill` rows from client input, use ISO-date DTO validation for experiences, require an absent end date only for a current role, and validate chronological order before destructive replacement; Evidence: arbitrary skill strings never create catalog data, canonical aliases resolve only through `GET /skills`, invalid experience payloads are `400 VALIDATION_ERROR` with field details, and a rejected aggregate PATCH leaves the prior profile unchanged.

- [x] **BE-10-003 Restore one authoritative default-CV invariant (P1)** — Refs: CAND-004, CV-005–006, API-CAND-001, API-CV-001/004/006; Depends: BE-10-001; Files: `prisma/schema.prisma`, a new additive migration with a partial unique index for one `isDefault = true` CV per candidate, `src/cvs/cvs.service.ts`, `src/candidates/candidates.service.ts`, `test/unit/cvs.spec.ts`, `test/e2e/cvs-interviews-notifications.e2e-spec.ts`; Work: add failing tests comparing the authoritative `CandidateProfile.defaultCvId` with exactly one non-deleted `Cv.isDefault`; in the same transaction, set both representations on first upload and explicit default selection, clear the old CV flag, increment only the documented versions, and on deletion select the newest eligible READY CV by `createdAt DESC, id ASC` or clear both fields when none exists; reject selecting a non-READY CV and serialize concurrent default requests through the profile version/update transaction; Evidence: profile detail, CV list and CV detail always agree after upload/set/delete, the database rejects two default CV rows for one candidate, stale `expectedVersion` remains `409 VERSION_CONFLICT`, and fresh/upgrade migration checks preserve existing CV ownership.

### Phase 10B — Contract Idempotency

- [x] **BE-10-004 Implement actor/method/route-scoped idempotency persistence (P1)** — Refs: API contract §3.5, NFR-REL-002–004; Depends: None; Files: `prisma/schema.prisma`, new additive migration, new `src/idempotency/**`, `src/app.module.ts`, `src/common/constants/error-codes.ts`, new `test/unit/idempotency.spec.ts`; Work: write tests for first claim, same canonical request replay, different request reuse, concurrent claim and expiry; persist authenticated actor ID, method, normalized route template, key, canonical request hash, processing/completed state, original HTTP status, sanitized response body and expiry; enforce a unique actor+method+route+key constraint, accept only 16–128 printable ASCII characters, return the stored original response for an identical request, return `409 IDEMPOTENCY_KEY_REUSED` for a different request, and recover deterministically from an abandoned in-progress claim without logging the key or body; Evidence: concurrency creates one logical mutation, response replay is byte-equivalent after envelope normalization, 24-hour retention is testable with an injected clock, and schema/migration tests pass on fresh and upgrade databases.

- [x] **BE-10-005 Apply idempotency to application submission and transitions (P1)** — Refs: API-APP-001/005, APP-008; Depends: BE-10-001, BE-10-004; Files: `src/applications/applications.controller.ts`, `src/applications/applications.service.ts`, idempotency interfaces from BE-10-004, `test/unit/applications-lifecycle.spec.ts`, `test/e2e/applications.e2e-spec.ts`; Work: require and validate `Idempotency-Key` on submission and transition controllers, canonicalize route params plus DTO fields, claim the key before mutation, complete the idempotency record only after Application/history/audit/outbox commits, replay the original `201` or `200` response for the same request, and reject changed CV/note/status/reason/version payloads with `409 IDEMPOTENCY_KEY_REUSED`; preserve the candidate+job unique constraint as the final authority and distinguish a business duplicate using another key from a replay; Evidence: retry/network replay appends exactly one application or status event, concurrent duplicates have one winner and deterministic replay, different requests cannot reuse a key, and rollback leaves no falsely completed idempotency record.


- [x] **BE-10-006 Apply idempotency to interview creation and CV retry (P1)** — Refs: API-INT-001, API-CV-007, INT-001–003, CV-004; Depends: BE-10-004; Files: `src/interviews/interviews.controller.ts`, `src/interviews/interviews.service.ts`, `src/cvs/cvs.controller.ts`, `src/cvs/cvs.service.ts`, `test/unit/interviews.spec.ts`, `test/unit/cvs.spec.ts`, relevant e2e suites; Work: require the approved key on interview creation, replace request-ID-based deduplication with the actor/method/route canonical idempotency service, scope CV retry keys by actor+method+route instead of the current global key lookup, compare canonical payload/resource IDs before replay, and atomically associate the created Interview or Operation with the completed key; Evidence: identical retries return the original resource/version and status, changed application/interview/CV input is `409 IDEMPOTENCY_KEY_REUSED`, two actors may safely use the same key, and neither duplicate interview nor duplicate extraction operation/job is created.

### Phase 10C — Outbox, Queue and Asynchronous Work

- [x] **BE-10-007 Define typed domain-event payloads and repair application event routing (P0)** — Refs: APP-002–008, NOTIF-001–005, AUDIT-001; Depends: BE-10-001; Files: new `src/outbox/domain-events.ts`, `src/outbox/outbox.service.ts`, `src/applications/applications.service.ts`, `src/admin/admin.service.ts`, `src/interviews/interviews.service.ts`, `src/companies/companies.service.ts`, `src/notifications/notifications.service.ts`, `test/unit/notifications.spec.ts`, `test/unit/outbox.spec.ts`; Work: replace `payload: any` with a discriminated event-name-to-payload map, include `candidateUserId` and only the safe job/company display data required by application submitted/status-changed templates, make recruiter and admin transitions emit the same versioned payload, reject unknown event versions at the consumer, and add compile-time plus runtime payload tests; Evidence: ApplicationSubmitted and ApplicationStatusChanged each create exactly one owner notification/email request, no handler silently skips because of a mismatched field name, candidate profile IDs are never mistaken for user IDs, and payload snapshots exclude note, email, phone, CV text, storage key and tokens.

- [x] **BE-10-008 Run the outbox dispatcher and notification/email consumers in production lifecycle (P0)** — Refs: NOTIF-001–005, BE-1-012, NFR-REL-002–004; Depends: BE-10-007; Files: `src/outbox/outbox.module.ts`, `src/outbox/outbox.service.ts`, new dispatcher/scheduler provider, new `src/notifications/workers/notification.processor.ts`, new `src/email/workers/email.processor.ts` or one explicitly documented delivery worker, corresponding modules, `src/queues/queue.service.ts`, `test/unit/outbox.spec.ts`, `test/unit/notifications.spec.ts`, new focused integration test; Work: register a bounded periodic dispatcher or dedicated BullMQ outbox publisher at module startup, register workers for every queue actually targeted by outbox events, route versioned domain events into NotificationsService, make notification and email writes idempotent by event/delivery identity, and implement clean startup/shutdown without test SMTP/network handles; mark an outbox row dispatched only after BullMQ confirms a non-null job; Evidence: a committed application/interview/company event reaches the owner without directly calling `routeEvent` in the test, replay/restart produces no duplicate notification/email, Redis unavailable leaves the event pending, worker failure is retryable, and shutdown closes all timers/workers/queues.

- [x] **BE-10-009 Stop acknowledging failed enqueue operations and provide recovery (P0)** — Refs: CV-004, AI-007, API-OPS-001, NFR-REL-002–004; Depends: BE-10-008; Files: `src/queues/queue.service.ts`, `src/outbox/outbox.service.ts`, `src/cvs/cvs.service.ts`, CV worker, operation DTO/error mapping, `test/unit/cvs.spec.ts`, `test/unit/outbox.spec.ts`, focused Redis integration test; Work: make `QueueService.addJob` return a successful Job or throw a classified infrastructure error instead of swallowing failures as `null`; for CV upload/retry, persist the QUEUED operation and an outbox enqueue command in the same transaction, return the pollable operation, and let the dispatcher retry delivery until BullMQ confirms the deterministic job ID; add stale-QUEUED reconciliation that republishes a missing job from persisted operation/outbox state without creating a new logical run; Evidence: Redis-down upload/retry never returns a permanently orphaned operation, outbox rows are not marked dispatched without a job, restored Redis resumes the same operation exactly once, polling reaches SUCCEEDED or a classified FAILED state, and no HTTP request waits for PDF parsing.

- [x] **BE-10-010 Make CV-to-job AI analysis genuinely asynchronous and correctly idempotent (P1)** — Refs: API-AI-001–003, AI-002–004/007, NFR-REL-002–004; Depends: BE-10-004, BE-10-009; Files: `src/ai/ai.controller.ts`, `src/ai/ai.service.ts`, new `src/ai/workers/cv-job-analysis.processor.ts`, `src/ai/ai.module.ts`, `src/queues/queue.constants.ts`, operation/outbox linkage, `test/unit/ai.spec.ts`, `test/unit/ai-explainability.spec.ts`, `test/e2e/ai.e2e-spec.ts`; Work: write a failing latency/state test proving POST returns before provider execution; validate authorization/readiness, claim the idempotency key and atomically persist a QUEUED operation plus enqueue command, return `202` immediately, then let a typed BullMQ worker load private inputs by ID, transition QUEUED→PROCESSING→SUCCEEDED/FAILED, persist AiAnalysis and provenance, classify provider errors, record metrics/audit, and release concurrency slots in all paths; compare the canonical `cvId`, `jobId` and sorted analyses list on idempotency replay; Evidence: the controller never awaits Gemini, operation polling observes valid monotonic states, same request/key returns the original operation, changed input/key reuse is `409`, transient jobs retry the same operation, permanent provider failure is pollable, and queue payload/logs contain no CV/JD text or credentials.

- [x] **BE-10-011 Deliver a usable one-time company invitation link without secret leakage (P1)** — Refs: API-COMP-005/008/011, COMP-002, NOTIF-001–005, NFR-SEC-003–004; Depends: BE-10-008, BE-10-009; Files: `prisma/schema.prisma`, a new additive migration for one-to-one `CompanyInvitationDeliverySecret`, `src/companies/companies.service.ts`, `src/companies/dto/company-invitation.dto.ts`, `src/email/email-templates.ts`, new invitation secret adapter and delivery worker, `src/config/configuration.ts`, `test/unit/notifications.spec.ts`, `test/e2e/companies.e2e-spec.ts`; Work: first add a failing Mailpit/template test proving the recipient receives an accept URL containing the one-time token expected by `POST /company-invitations/:token/accept`; keep the SHA-256 acceptance hash on CompanyInvitation and persist the raw token only as AES-256-GCM ciphertext, IV and authentication tag in `CompanyInvitationDeliverySecret`, encrypted with a required base64 32-byte `INVITATION_TOKEN_ENCRYPTION_KEY`; let the delivery worker decrypt only while rendering the email, then delete the secret row after confirmed delivery or invitation expiry; never place plaintext/full URL in API response, audit, application log, ordinary outbox JSON or dead-letter metadata; preserve wrong-email/expired/replayed-token defenses; Evidence: an unregistered recipient can follow the delivered link and accept once after authentication, delivery retry decrypts the same logical invitation without duplicate membership, database snapshots contain ciphertext but no plaintext token, logs/API/audit expose no token, missing/invalid encryption configuration fails readiness safely, and expiry cleanup is verified.

### Phase 10D — Runtime/Contract Parity and Type Safety

- [x] **BE-10-012 Return the approved RecommendedJob projection without undocumented compatibility fields (P1, contract/integration gate)** — Refs: API-AI-004, AI-006, FE-5-012–013; Depends: BE-10-010; Files after explicit compatibility approval: `src/ai/recommendations.controller.ts`, `src/ai/ai.service.ts`, `src/ai/dto/recommendation.dto.ts`, generated OpenAPI, `test/unit/ai-explainability.spec.ts`, `test/e2e/ai.e2e-spec.ts`; Work: before changing runtime output, obtain explicit approval because the current frontend consumes flat `Job` fields; change controller/service generics to `CollectionResponse<RecommendedJobDto>`, return only `job`, `score`, `reasonCodes`, `evidence`, `limitations`, remove the spread `...jobDto` and `as any`, preserve cursor/opt-out metadata approved by contract, and publish a frontend handoff note without editing frontend files; Evidence: recursive exact-key tests reject every flat compatibility field and private input, Swagger matches `API-CONTRACT.md`, score/reasons remain deterministic, and the approved frontend compatibility gate is recorded before merge.

- [x] **BE-10-013 Align Notification projection, read command and cursor validation with the approved contract (P1, contract/integration gate)** — Refs: API-NOTIF-001–002, NOTIF-001, API contract §8.9/9.10; Depends: BE-10-008; Files after explicit compatibility approval: `src/notifications/dto/notification.dto.ts`, `src/notifications/notifications.controller.ts`, `src/notifications/notifications.service.ts`, pagination utilities, generated OpenAPI, `test/unit/notifications.spec.ts`, relevant e2e suite; Work: obtain approval before removing the current frontend transport fields or requiring a body; return the safe nested `resource: { type, id } | null` projection without `userId`, return standard `meta.page` plus the approved `unreadCount` extension, require and validate `{ read: boolean }`, set `readAt` when true and clear it when false, use an opaque validated `(createdAt,id)` cursor rather than a raw database ID, and reject invalid boolean/limit/cursor values instead of coercing them to defaults or Prisma errors; Evidence: exact response/OpenAPI snapshots match the approved contract, owner isolation remains intact, invalid input is `400 VALIDATION_ERROR` or `INVALID_CURSOR`, read/unread replay is deterministic, cursor pagination has no duplicate/skip, and the frontend handoff records every intentional compatibility change.

- [x] **BE-10-014 Remove explicit-any debt from production hot paths and make lint fail on regression (P2)** — Refs: `RULE.md` §2/§6, NFR-TEST-001–004; Depends: BE-10-001–013; Files: production files touched by Phase 10, Prisma-derived input/result types, typed event/queue/idempotency interfaces, ESLint configuration only after the warning baseline is reduced, focused unit tests; Work: replace `any` in application, AI, admin, CV, notifications, outbox, queue and logging paths with Prisma payload types, DTO interfaces, `unknown` plus narrowing, or typed generic constraints; eliminate unsafe response casts used to hide contract drift; capture the remaining warning baseline by category, reduce production `no-explicit-any` warnings to zero, then promote `@typescript-eslint/no-explicit-any` to an error for `src/**` while allowing narrowly documented test-fixture exceptions; Evidence: `npm run lint` reports zero errors and zero production explicit-any warnings, TypeScript build remains strict, event/response shape mistakes fail compilation, and no behavior changes outside Phase 10 are introduced.

### Phase 10E — Verification and Frontend Handoff

- [x] **BE-10-015 Verify security, live asynchronous delivery, contract parity and release readiness** — Refs: all Phase 10 requirements, NFR-SEC-001–005, NFR-REL-001–004, NFR-TEST-001–004; Depends: BE-10-001–014; Files: all focused unit/e2e suites, generated OpenAPI, `docs/authorization-and-data-exposure-review.md`, `docs/final-release-checklist.md`, release notes, this tracker; Work: run Prisma generate and disposable fresh/upgrade migrations; run the complete unit/e2e/lint/build gates; execute live PostgreSQL+Redis+object-storage+Mailpit journeys for cross-owner CV denial, application replay, transition replay, interview replay, CV enqueue recovery, application notification delivery, invitation acceptance and asynchronous AI polling; diff generated OpenAPI against the approved contract; inspect source/log/audit/job/database snapshots for forbidden fields; document frontend handoff items for SavedJobCheck envelope, RecommendedJob and Notification without editing frontend files; Evidence: every command exits `0`, all P0/P1 regressions are covered, queue/outbox replay and Redis restart are demonstrated, no orphaned QUEUED operation remains, no secret/PII leak is found, compatibility approvals are linked, worktree scope contains backend files only, and Phase 10 is marked complete only after these artifacts are recorded.

## Activity Log

Add entries only for milestone/task state changes, blockers, or verification
events. Routine code edits belong in version control, not this log.

| Date | Task or phase | Change | Evidence / next action |
| --- | --- | --- | --- |
| 2026-09-08 | Phase 0 | Documentation baseline started | Complete BE-0-001 through BE-0-012 and run cross-document validation. |
| 2026-09-08 | Phase 0 | Verified | Nine required files, 168 backend tasks, seven issues, local links, UTF-8, references, stack terms, and whitespace checks passed; Phase 1 is next and not started. |
| 2026-09-08 | Phase 0 | Scope corrected | Removed frontend documentation and task scope; backend remains the only tracked implementation workstream. |
| 2026-09-08 | API inventory | Added and validated | Document-derived audit lists 86 unique backend APIs: 54 approved contract endpoints and 32 predicted endpoints; runtime APIs verified as existing: zero. |
| 2026-09-08 | Phase 1 | Verified | NestJS scaffold, strict TS/lint, validated config, Docker Compose, Prisma schema & migrations, Redis, BullMQ, Outbox, Redaction/Structured Logging, Request-ID, Standard Envelopes & Error Filters, DTO validation pipe, Swagger OpenAPI, /health/live and /health/ready, unit/e2e harnesses verified; 11 unit suites passed. |
| 2026-09-08 | Phase 2 | Verified | User model, email normalization, Argon2id password hashing, register/login, token family reuse detection, logout/logout-all, candidate profiles/completeness/concurrency, company lifecycle/membership/scope authorization guard, and security matrix verified; 4 e2e suites passed. |
| 2026-09-09 | Phase 3 | Verified | Jobs lifecycle, PostgreSQL full-text search vector & GIN index, deterministic ranking, opaque cursor pagination, Redis cache, saved jobs unique ownership, and moderation hooks verified; 14 unit suites passed. |
| 2026-09-09 | Phase 4 | Verified | Application submission transaction, append-only status history, state machine transitions, optimistic locking, recruiter/candidate detail projections, domain events & audit logging verified; 16 unit suites and 6 e2e suites passed. |
| 2026-09-09 | Phase 5 | Verified | CV PDF validation (magic bytes/SHA-256), S3/MinIO storage adapter, interview scheduling lifecycle, in-app notifications, Nodemailer/Mailpit transport, versioned email templates, and event routing verified; 19 unit suites and 7 e2e suites passed. |
| 2026-09-10 | Phase 6 | Verified | AI privacy policy (PII redaction), Operation & AiAnalysis models/migrations, vendor-neutral Gemini port, resilient adapter (timeout/rate-limit/retry), versioned prompts & output validation, CV/JD matching orchestration, gap analysis, candidate job recommendations, AI concurrency/metrics, evaluation baseline report, and architectural proof that AI cannot transition applications verified; 20 unit suites (116 tests) and 8 e2e suites (85 tests) passed 100%; linter 0 errors; build clean. |
| 2026-09-10 | Phase 7 | Verified | AdminModule (user list/filters, user status moderation with session revocation, company moderation, job moderation, append-only audit query), MetricsModule (Prometheus /metrics for HTTP rates/durations, queue depth, dependency health), distributed trace propagation (x-trace-id), abuse-case security unit tests, comprehensive end-to-end recruitment lifecycle suite, and all operational hardening documentation (dashboards, rate limits, security audits, load tests, backup/disaster recovery, deployment topology, CI/CD gates, operational runbooks, final checklist, release notes v1.0.0) verified; 21 unit suites (120 tests) and 9 e2e suites (86 tests) passed 100%; linter 0 errors; build clean; Release v1.0.0 complete. |
| 2026-09-10 | Phase 8 | Initial remediation slice planned; release verification reopened | Source audit confirmed PostgreSQL `42P17`/Prisma `P3018` in `20260909000000_jobs_and_saved_jobs`, missing frontend-integration APIs, missing pending invitation delivery, and real SMTP construction in notification unit tests. Reproduction with `--testTimeout=1000 --forceExit` produced 4 failed/4 passed tests; a default-timeout run exceeded 45 seconds. The initial BE-8-001–016 slice was subsequently expanded by the frontend Phase 0–7 audit below. |
| 2026-09-10 | Phase 8 / BE-8-004 | Verified | Restored JobSearchQueryDto enum validation with IsIn decorators; updated InMemoryPrismaService to support array { in: [...] } filtering; verified 17/17 tests passing in jobs.e2e-spec.ts including FRESHER filter and 400 VALIDATION_ERROR on invalid enums. |
| 2026-09-10 | Phase 8 / BE-8-005 | Verified | Completely isolated NotificationsService unit tests from Nodemailer by introducing typed mockEmailService and ConfigService; verified all 8 unit tests pass with --testTimeout=1000 --detectOpenHandles with 0 open handles, 0 lint errors, and zero SMTP socket attempts. |
| 2026-09-10 | Phase 8 / BE-8-006 | Verified | Extended canonical Skill model with normalizedName, active, updatedAt, and added SkillAlias model with cascade relation; generated Prisma migration 20260910120000_skill_catalog; updated InMemoryPrismaService mock and candidates.service.ts; verified 21 unit suites (120 tests) and 9 e2e suites (88 tests) pass. |
| 2026-09-10 | Phase 8 / BE-8-007 | Verified | Implemented searchable and paginated Skill Catalog API (GET /api/v1/skills) with SkillsModule, SkillsController, SkillsService, SkillCatalogQueryDto, SkillCatalogItemDto; case-insensitive canonical/alias search and cursor pagination verified via 5 unit tests and 7 e2e tests passing 100%. |
| 2026-09-10 | Phase 8 / BE-8-008 | Verified | Implemented multi-company recruiter discovery API (GET /api/v1/companies/mine) declared statically before :companyIdOrSlug; returns caller memberships with membership role and CompanyDto; 16 e2e tests in companies.e2e-spec.ts passing 100%. |
| 2026-09-10 | Phase 8 / BE-8-009 | Verified | Implemented company-scoped job management collection (GET /api/v1/companies/:companyId/jobs) with CompanyJobQueryDto; added assertMemberOrAdminReadOnly in CompanyScopeService; allows members to view DRAFT, CLOSED, and expired jobs even for SUSPENDED companies; 8 unit tests and 23 e2e tests passing 100%. |
| 2026-09-10 | Phase 8 / BE-8-010 | Verified | Modeled CompanyInvitation with SHA-256 token hash, 7-day expiration, and partial unique index on (companyId, email) WHERE status = 'PENDING'; added CompanyInvitationStatus, COMPANY_INVITATION_CREATED, COMPANY_MEMBER_ADDED to Prisma schema; added CompanyInvitationDto with maskEmail; updated InMemoryPrismaService; 22 unit suites and 10 e2e suites passing 100%. |
| 2026-09-10 | Phase 8 / BE-8-011 | Verified | Implemented direct member add (201) and pending invitations (202) in CompaniesService.addMember; implemented POST /api/v1/company-invitations/:token/accept with strict email match, token hash lookup, expiration check, and atomic transaction; verified by 24 e2e tests in companies.e2e-spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-012 | Verified | Added companyMemberAdded and companyInvitation email templates; routed CompanyMemberAdded and CompanyInvitationCreated events in NotificationsService; emitted deterministic outbox events; verified by 10/10 unit tests in notifications.spec.ts without leaking raw tokens. |
| 2026-09-10 | Phase 8 / BE-8-013 | Verified | Implemented GET /api/v1/admin/companies and GET /api/v1/admin/jobs in AdminController and AdminService with search, status/company/experience filters, and cursor pagination; verified by 5 unit tests in admin-collections.spec.ts and recruitment-lifecycle.e2e-spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-014 | Verified | Implemented redacted admin application collection and detail APIs (GET /api/v1/admin/applications and GET /api/v1/admin/applications/:applicationId); strictly redacts candidateNote, phone, email, rawCv, storageKey, feedback; cursor pagination and filters verified by unit tests in admin-collections.spec.ts and e2e steps 20-22 in recruitment-lifecycle.e2e-spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-015 | Verified | Implemented audited admin application moderation (POST /api/v1/admin/applications/:applicationId/moderate) with optimistic concurrency, shared transition state machine, APPLICATION_MODERATED audit logging, and ApplicationStatusChanged outbox event; verified by unit tests in admin-collections.spec.ts and e2e steps 23-26 in recruitment-lifecycle.e2e-spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-016 | Verified | Replaced synchronous CV extraction with asynchronous BullMQ processor and persisted Operation; fixed QueueService mock handling; returned 202 with real pollable OperationDto; verified by test/unit/cvs.spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-017 | Verified | Implemented bounded, idempotent failed-CV extraction retry (POST /api/v1/cvs/:cvId/retry-processing) with Idempotency-Key validation, attempt ceiling enforcement, and state check; verified by test/unit/cvs.spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-018 | Verified | Verified GET /api/v1/interviews/:interviewId direct detail API with role-based projection, candidate privacy redaction (omitting recruiterPrivateNotes and recruiterFeedback), and existence concealment for unauthorized callers; verified by 14 unit tests in interviews.spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-019 | Verified | Aligned early-rejection state machine transition matrix in ApplicationsService to allow direct transitions APPLIED -> REJECTED and REVIEWING -> REJECTED; closed BEI-001; verified by 13 unit tests in applications-lifecycle.spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-020 | Verified | Reconciled submitted-CV retention policy: soft-deleted CVs referenced in applications can be securely downloaded by authorized HR and Admin; decoupled external storage deletion from database transaction; closed BEI-002; verified by test/unit/cvs.spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-021 | Verified | Modeled RecommendationPreference in Prisma schema and migration; created GET and PATCH /api/v1/recommendation-preferences with optimistic concurrency and consent versioning; verified by unit and e2e tests in ai.e2e-spec.ts; closed BEI-003. |
| 2026-09-10 | Phase 8 / BE-8-022 | Verified | Implemented explainable, privacy-safe, publicly eligible job recommendations (GET /api/v1/recommendations/jobs) with RecommendedJobDto, reason codes, evidence, opt-out enforcement, strict cursor validation, and applied job exclusion; verified by 8 unit tests in ai-explainability.spec.ts and 15 e2e tests in ai.e2e-spec.ts. |
| 2026-09-10 | Phase 8 / BE-8-023 | Verified | Verified browser security and observability handshake; documented origin matrix, cookie policies, CSRF protections, and X-Request-Id/X-Trace-Id correlation in docs/frontend-backend-runtime-matrix.md; closed BEI-004 and BEI-005. |
| 2026-09-10 | Phase 8 / BE-8-024 | Verified | Created deterministic search corpus (test/fixtures/search-corpus.json) and benchmark test (test/performance/search-benchmark.spec.ts) achieving p95 = 0.11ms (< 200ms target); documented in docs/search-performance-handoff.md; closed BEI-006. |
| 2026-09-10 | Phase 8 / BE-8-025 | Verified | Full verification across all Phase 8 requirements: npm run lint (0 errors), npm run build (clean), 25/25 unit test suites (172/172 passing), 10/10 e2e test suites (117/117 passing); generated release notes v1.1.0 and updated CHANGELOG.md; Phase 8 complete. |
| 2026-09-10 | Phase 8 | Completed | All 25 Phase 8 remediation tasks (BE-8-001 through BE-8-025) fully implemented and verified against strict contract, security, performance, and testing standards. Backend ready for frontend integration. |
| 2026-09-11 | Phase 9 / BE-9-001 | Verified | Tái hiện unhandled TypeError khi job thiếu technologyNames/title; thêm regression tests xác nhận query limit number (400 validation nếu sai), khóa nguyên nhân gốc trong ai-explainability.spec.ts. |
| 2026-09-11 | Phase 9 / BE-9-002 | Verified | Phê duyệt và cập nhật API-CONTRACT.md mục 8.4 SavedJobCheck và mục 9.5 GET /saved-jobs/:jobId/check; cập nhật bảng API Inventory với đầy đủ semantics. |
| 2026-09-11 | Phase 9 / BE-9-003 | Verified | Triển khai GET /api/v1/saved-jobs/:jobId/check (CheckSavedJobParamDto @IsUUID, SavedJobCheckDto, composite unique key candidateProfileId_jobId). 9/9 unit tests pass trong saved-jobs.spec.ts, 7/7 e2e tests pass trong jobs.e2e-spec.ts. |
| 2026-09-11 | Phase 9 / BE-9-004 | Verified | Sửa triệt để lỗi Recommend 500: import Buffer từ 'node:buffer', chuẩn hóa decode/encode cursor chặt chẽ trả 400 INVALID_CURSOR, bổ sung null-safety guards cho technologyNames/title/localeCompare, xử lý query limit mặc định 20. 14/14 unit tests pass, 18/18 e2e tests pass. |
| 2026-09-11 | Phase 9 / BE-9-005 | Verified | Toàn bộ kiểm thử và chất lượng đạt chuẩn: npm run lint (0 errors), npm run build (clean exit 0), 25/25 unit test suites (187/187 tests) pass, 10/10 e2e test suites (127/127 tests) pass. Swagger OpenAPI kiểm chứng route GET /saved-jobs/:jobId/check, Bearer auth và DTO. |
| 2026-09-11 | Phase 9 | Completed | Hoàn tất 100% Phase 9 (BE-9-001 đến BE-9-005). Toàn bộ hệ thống sẵn sàng bàn giao, không vi phạm backend/RULE.md, không sửa frontend, không thay đổi migration. |
| 2026-09-12 | Phase 10 | Planned; release gate reopened | Post-Phase-9 frontend-integration audit found a P0 cross-candidate CV submission path, disconnected outbox/notification delivery, swallowed queue enqueue failures, missing contract idempotency, synchronous AI execution behind a 202 API, default-CV inconsistency, unusable invitation token delivery, response-contract drift and 431 lint warnings. Added BE-10-001–015; no runtime/frontend/shared-contract files changed. Current baseline remains 25/25 unit suites (187/187), 10/10 e2e suites (127/127), build pass and lint exit 0 with 431 warnings. |
| 2026-09-12 | Phase 10A / BE-10-001 | Verified | Enforced submitted-CV ownership and READY status inside the application creation transaction. Replaced e2e cross-candidate submission expectation with failing denial test (404 RESOURCE_NOT_FOUND, zero existence leakage). 20/20 tests pass in applications-lifecycle.spec.ts, all e2e suites pass. |
| 2026-09-12 | Phase 10A / BE-10-002 | Verified | Made candidate skills canonical via @IsUUID() and batch active catalog verification, removed dynamic catalog creation from client input. Added @IsISO8601() and endDate >= startDate validation. Verified with 8/8 unit tests in candidates.spec.ts and 11/11 e2e tests in candidates.e2e-spec.ts; zero lint errors, build clean. |
| 2026-09-12 | Phase 10A / BE-10-003 | Verified | Synchronized CandidateProfile.defaultCvId and Cv.isDefault atomically on upload, explicit default selection, and delete. Added partial unique index migration cvs_candidateProfileId_default_key. Rejects non-READY CV with 409 CV_NOT_READY, falls back to newest READY CV on deletion (or null). Verified with 27/27 unit tests in cvs.spec.ts and 13/13 e2e tests in cvs-interviews-notifications.e2e-spec.ts; zero lint errors, build clean. |
| 2026-09-12 | Phase 10B / BE-10-004 | Verified | Implemented actor/method/route-scoped idempotency persistence with IdempotencyRecord model and migration. Canonical request hashing, 16-128 ASCII key validation, 24h retention with injected clock, deterministic recovery from abandoned claims without logging key/body, and 409 IDEMPOTENCY_KEY_REUSED for different payloads verified with 15/15 unit tests in idempotency.spec.ts. |
| 2026-09-12 | Phase 10B / BE-10-005 | Verified | Applied canonical idempotency to application submission and transitions. Validates 16-128 ASCII key, replays identical requests with 201/200 and preserved bodies without duplicate writes, rejects payload tampering with 409 IDEMPOTENCY_KEY_REUSED, marks failed claims on error, and distinguishes business duplicates with 409 APPLICATION_ALREADY_EXISTS. 28/28 unit tests pass in applications-lifecycle.spec.ts, 26/26 e2e tests pass in applications.e2e-spec.ts; 100% test pass, lint 0 errors, build clean. |
| 2026-09-12 | Phase 10B / BE-10-006 | Verified | Applied canonical idempotency to interview scheduling and CV retry processing. Added @ApiHeader and IdempotencyService claim/complete/fail cycle; scoped CV retry by actor+method+route with attempt limit and payload mismatch defense; verified with 46 tests across unit/interviews.spec.ts and unit/cvs.spec.ts, all 27 unit test suites (236 tests), and all 10 e2e suites (144 tests); lint 0 errors, build clean. |
| 2026-09-12 | Phase 10C / BE-10-007 | Verified | Created src/outbox/domain-events.ts with strongly typed event map, versioning, and private payload field sanitizer. Included candidateUserId, jobTitle, and companyName in ApplicationSubmitted and ApplicationStatusChanged; aligned recruiter and admin status transition events to emit identical payloads; enforced version validation at event consumption; verified with 16 tests in notifications.spec.ts & outbox.spec.ts, all 27 unit test suites (240 tests), and all 10 e2e suites (144 tests); lint 0 errors, build clean. |
| 2026-09-12 | Phase 10C / BE-10-008 | Verified | Implemented OutboxDispatcherService with bounded periodic polling and concurrency guard; registered BullMQ workers NotificationProcessor and EmailProcessor in application lifecycle; ensured notification deduplication on (userId, type, resourceType, resourceId) and email deduplication by idempotencyKey; verified with 12 tests in outbox.spec.ts, 12 tests in notifications.spec.ts, all 27 unit suites (248 tests), all 10 e2e suites (144 tests); lint 0 errors, build clean. |
| 2026-09-12 | Phase 10C / BE-10-009 | Verified | QueueService.addJob throws classified QueueInfrastructureError instead of swallowing failure; CV upload and retry persist QUEUED operation and outbox event in same transaction and safely handle queue outage without HTTP failure; OutboxService routes CV events to cv-extraction-queue with deterministic jobId; CvExtractionProcessor supports outbox payloads and ensures idempotency on terminal states; added CvsService.reconcileStaleQueuedOperations to republish stale operations without creating new logical runs; verified with 13 tests in outbox.spec.ts, 31 tests in cvs.spec.ts, all 27 unit suites (251 tests), all 10 e2e suites (144 tests); lint 0 errors, build clean. |
| 2026-09-12 | Phase 10C / BE-10-010 | Verified | Made CV-to-job AI analysis genuinely asynchronous and idempotent. POST /ai/cv-job-analyses validates authorization/readiness, claims actor/method/route idempotency key, persists QUEUED operation and CvJobAnalysisQueued outbox event, and immediately returns 202 with pollable OperationDto without awaiting Gemini. CvJobAnalysisProcessor BullMQ worker executes job, acquires/releases concurrency slot via AiMetricsService in finally, persists AiAnalysis, records audit logs, updates operation to SUCCEEDED or classified FAILED. Idempotency replaying with same key returns cached operation; key reuse with changed payload returns 409 IDEMPOTENCY_KEY_REUSED. Verified with 17 tests in ai.spec.ts, 14 tests in ai-explainability.spec.ts, 18 e2e tests in ai.e2e-spec.ts; all 27 unit suites (256 tests), all 10 e2e suites (144 tests) pass 100%; lint 0 errors, build clean. |
| 2026-09-12 | Phase 10C / BE-10-011 | Verified | Delivered usable one-time company invitation link without secret leakage. Added CompanyInvitationDeliverySecret model and migration 20260912200000_company_invitation_delivery_secret; encrypted raw token using AES-256-GCM via InvitationSecretAdapter with INVITATION_TOKEN_ENCRYPTION_KEY; kept only SHA-256 acceptance hash on CompanyInvitation; persistent secret row contains only ciphertext, IV, and authTag. Injected InvitationDeliveryWorker decrypts token only when rendering invitation email with accept URL and deletes secret row upon confirmed delivery. Validated readiness failure when key is missing/invalid in HealthController. Verified with 14 unit tests in notifications.spec.ts, 4 unit tests in health.spec.ts, 25 e2e tests in companies.e2e-spec.ts; all 27 unit suites (259 tests), all 10 e2e suites (145 tests) pass 100%; lint 0 errors, build clean. |
| 2026-09-12 | Phase 10D / BE-10-012 | Verified | Returned canonical RecommendedJobDto projection { job, score, reasonCodes, evidence, limitations } without flat ...jobDto fields or unsafe type casts. Controller and service signatures aligned to CollectionResponse<RecommendedJobDto>; added exact-key verification in ai-explainability.spec.ts and ai.e2e-spec.ts; 14/14 unit tests and 18/18 e2e tests pass; lint 0 errors, build clean. |
| 2026-09-12 | Phase 10D / BE-10-013 | Verified | Aligned Notification projection to safe nested resource: { type, id } | null without userId or root resourceType/resourceId. Added MarkNotificationReadDto requiring { read: boolean } on PATCH /notifications/:id/read with deterministic replay and unmark-read support. Implemented opaque (createdAt, id) cursor pagination with strict validation (400 INVALID_CURSOR) and standard meta.page plus unreadCount. Verified with 15/15 unit tests in notifications.spec.ts and 13/13 e2e tests in cvs-interviews-notifications.e2e-spec.ts; lint 0 errors, build clean. |
| 2026-09-12 | Phase 10D / BE-10-014 | Verified | Eliminated all 208 explicit-any usages across 31 production files in src/**; replaced with Prisma generated types, concrete DTOs, unknown narrowing, and typed generics. Promoted @typescript-eslint/no-explicit-any to 'error' in .eslintrc.js for all production code. Verified with npm run lint (0 errors, 0 warnings), npm run build (clean exit 0), all 27 unit test suites (260/260 tests passing), and all 10 e2e suites (145/145 tests passing). |
| 2026-09-12 | Phase 10E / BE-10-015 | Verified | Full verification gates passed: prisma generate (exit 0), build (exit 0), lint (0 errors, 0 warnings, no-explicit-any error), unit tests (27/27 suites, 260/260 pass), e2e tests (10/10 suites, 145/145 pass). Created docs/frontend-handoff-phase-10.md documenting SavedJobCheck envelope, RecommendedJobDto projection, NotificationDto projection & { read: boolean } command, asynchronous operations pattern, Idempotency-Key header, and encrypted company invitation acceptance. Updated docs/authorization-and-data-exposure-review.md and docs/final-release-checklist.md. Phase 10 complete with 0 frontend files touched. |
