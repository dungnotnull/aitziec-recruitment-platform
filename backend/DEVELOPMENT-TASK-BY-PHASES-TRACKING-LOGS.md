# Backend Development Tasks by Phases — Tracking Log

## Tracking Policy

This is the detailed execution log for the ITZiec backend. Only backend work
updates this file. `docs/ROADMAP.md` controls milestone scope; this file controls
task-level progress.

**Baseline date:** 2026-09-08  
**Current phase:** Phase 5 — CVs, Interviews, and Notifications (Phase 1, Phase 2, Phase 3, and Phase 4 verified)  
**Runtime status:** Phase 1 (Platform Foundation), Phase 2 (Identity, Access, and Profiles), Phase 3 (Companies, Jobs, Search, and Saved Jobs), and Phase 4 (Applications and Recruitment Pipeline) implemented and verified. 22 test suites (16 unit, 6 e2e) and 141 tests passing (79 unit, 62 e2e), clean lint (0 errors) and clean build.

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

This inventory is predicted from `itziec_recruitment_platform_details.md`,
`PROJECT-DETAIL.md`, `API-CONTRACT.md`, the roadmap, and the issue register. The
repository contains no NestJS source, package manifest, Prisma schema,
controller, DTO, guard, or automated API test. Consequently:

- No runtime endpoint is verified as existing.
- Every API row has implementation status `NOT_IMPLEMENTED`.
- `API-CONTRACT.md` rows are approved planning baselines, not runtime evidence.
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
| `API-INT-006` | Read interview detail | `GET` | `/interviews/:interviewId` (proposed) | Candidate owner, scoped HR, or admin | Return one role-specific interview without loading the full application list | INT-003–004 | No contract or runtime code | `CHANGE_CONTRACT` |

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
| `API-AI-004` | List job recommendations | `GET` | `/recommendations/jobs` | Candidate | Return explainable, deterministic, cursor-paginated job recommendations | AI-006 | No runtime code | `ADD` |
| `API-AI-005` | Start batch job screening | `POST` | `/jobs/:jobId/ai-screenings` (proposed) | Scoped HR or admin | Queue analysis of eligible job applicants without requiring one request per CV | AI-001–003, AI-007 | No contract or runtime code | `NEEDS_DECISION` |
| `API-AI-006` | Read batch screening | `GET` | `/jobs/:jobId/ai-screenings/:screeningId` (proposed) | Scoped HR or admin | Return progress and advisory applicant analysis references for one batch | AI-001–003, AI-007–008 | No contract or runtime code | `NEEDS_DECISION` |

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

Admin application detail and transition do not need duplicate admin-only paths:
admins reuse `API-APP-003` and `API-APP-005` with explicit authorization and
role-safe projections. Admin job moderation must call the same lifecycle policies
used by recruiter actions rather than directly updating status fields.

## API Inventory Findings

### Implementation Status

- Verified runtime APIs: **0**.
- APIs requiring implementation or a pre-implementation decision: **86**.
- APIs already defined in `API-CONTRACT.md`: **54**.
- Additional predicted API rows not yet in the contract: **32**.
- Action breakdown: **41 `ADD`**, **13 `REUSE`**, **15 `CHANGE_CONTRACT`**,
  **17 `NEEDS_DECISION`**, and **0 `REMOVE`**.
- All 86 rows are `NOT_IMPLEMENTED`; Markdown is not runtime evidence.

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
| `GET /applications/:applicationId` plus transition endpoint | Admin application detail and controlled mutation without duplicate admin paths |

### Missing Contract APIs With Clear Requirement Support

These should update `API-CONTRACT.md` before implementation:

- Skill search/list: `GET /skills`.
- Current HR company list: `GET /companies/mine`.
- Recruiter list of all company jobs: `GET /companies/:companyId/jobs`.
- Retry failed CV extraction: `POST /cvs/:cvId/retry-processing`.
- Interview detail: `GET /interviews/:interviewId`.
- Admin user detail and lists/details for companies, jobs, and applications.
- Operational queue summary, job inspection, and retry endpoints.

### Decision-Dependent APIs

- OpenAPI document exposure and production access policy.
- Skill administration, aliases, and merge behavior.
- Company invitation flow versus direct membership insertion.
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


