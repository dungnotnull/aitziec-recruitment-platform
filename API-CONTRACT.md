# ITZiec API Contract

## 1. Contract Authority and Status

This document is the source of truth for communication between the React + Vite
client and the NestJS backend. It controls HTTP paths, methods, authentication,
request and response fields, shared enums, error codes, pagination, lifecycle
transitions, and public domain-event payloads.

**Contract status:** Proposed baseline. No endpoint is implemented at the time of
this baseline.

An endpoint becomes `Implemented` only when all of the following exist:

- NestJS controller and use-case implementation.
- DTO and runtime validation.
- Authentication, role, and ownership/company-scope authorization.
- Prisma persistence and migration where required.
- OpenAPI representation matching this file.
- Required unit, integration, and API-level tests.

Both frontend and backend contributors must read and update this file before
changing a shared interface.

## 2. Compatibility and Versioning

- Base path: `/api/v1`.
- Content type: `application/json; charset=utf-8`, except multipart uploads.
- The major path version changes only for intentionally breaking contracts.
- Additive optional fields are permitted within `v1`.
- Existing fields cannot change meaning, type, nullability, or enum semantics
  without a breaking-change decision.
- Deprecated fields or endpoints remain available for at least one documented
  migration window and include `Deprecation` and `Sunset` response headers.
- Generated OpenAPI is verification output. This Markdown contract remains the
  reviewed source of truth until the project explicitly adopts generated specs
  as the authority.

## 3. Protocol Conventions

### 3.1 Naming and Serialization

- JSON property names use `camelCase`.
- URL path segments use plural kebab-case nouns.
- Enum wire values use `UPPER_SNAKE_CASE`.
- Public identifiers are UUID strings.
- Boolean names start with `is`, `has`, or `can` where practical.
- Unknown request fields are rejected with `VALIDATION_ERROR`.
- Response fields documented as nullable are present with `null`; optional
  request fields may be omitted.
- In a PATCH request, omitted means “leave unchanged” and explicit `null` means
  “clear the field” only where the field is documented as nullable.

### 3.2 Time and Date

- Timestamps are ISO 8601 UTC strings, for example `2026-09-08T09:30:00.000Z`.
- Date-only values use `YYYY-MM-DD`.
- The API stores and returns UTC. Clients localize for display.
- Expiration and deadline comparisons use backend time, not client time.

### 3.3 Money

- Monetary amounts are non-negative JSON integers in the currency's minor unit.
- `currency` is an ISO 4217 uppercase code.
- VND has zero decimal minor units; `25000000` means VND 25,000,000.
- Salary bounds are nullable. If both exist, `salaryMin <= salaryMax`.
- Floating-point money is invalid.

### 3.4 Request Correlation

- A client may send `X-Request-Id` as a UUID.
- The backend validates or replaces it and always returns `X-Request-Id`.
- Error bodies include the effective request ID.
- Queue jobs and domain events preserve the originating request ID when one
  exists.

### 3.5 Idempotency

- Endpoints marked idempotent accept an `Idempotency-Key` header of 16–128
  printable ASCII characters.
- The key scope is authenticated actor + method + route template.
- Reusing a key with the same canonical request returns the original status and
  body during the retention window.
- Reusing a key with a different request returns `409 IDEMPOTENCY_KEY_REUSED`.
- Initial retention target: 24 hours.

### 3.6 Optimistic Concurrency

- Mutable aggregate responses include an integer `version` starting at `1`.
- Contracted mutations provide `expectedVersion` in the JSON body.
- A mismatch returns `409 VERSION_CONFLICT` and does not partially mutate data.

## 4. Standard Envelopes

### 4.1 Success

```ts
type SuccessResponse<T> = {
  data: T;
  meta?: {
    requestId: string;
  };
};
```

### 4.2 Cursor-Paginated Collection

```ts
type PageInfo = {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
};

type CollectionResponse<T> = {
  data: T[];
  meta: {
    requestId: string;
    page: PageInfo;
  };
};
```

- Default `limit`: `20`.
- Minimum `limit`: `1`; maximum `limit`: `100`.
- Cursors are opaque. Clients must not construct or decode them.
- A cursor is valid only with the same filters and sort parameters used to
  produce it.
- Invalid or expired cursors return `400 INVALID_CURSOR`.

### 4.3 Error

```ts
type FieldError = {
  field: string;
  code: string;
  message: string;
};

type ErrorResponse = {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[] | Record<string, unknown>;
    requestId: string;
    timestamp: string;
  };
};
```

Error messages are safe for users but are not stable programmatic identifiers.
Clients branch on `error.code`, never on `message`.

### 4.4 Empty Success

Successful operations with no resource body return `204 No Content`. A 204
response never includes JSON.

## 5. Authentication and Sessions

### 5.1 Token Transport

- Access token: JWT returned in the response body and sent as
  `Authorization: Bearer <accessToken>`.
- Target access-token lifetime: 15 minutes.
- Refresh token: opaque rotating token stored in an `HttpOnly` cookie named
  `itziec_refresh` and never returned in JSON.
- Refresh cookie path: `/api/v1/auth`.
- Refresh cookie: `HttpOnly`, `SameSite=Lax`, and `Secure` outside local HTTP
  development.
- The React client keeps the access token in memory and sends credentialed
  requests only to the configured API origin.
- Password and refresh-token values must never appear in logs or errors.

### 5.2 Session Rules

- Successful refresh rotates the refresh token.
- Reuse of an already rotated token revokes the full refresh-token family and
  returns `401 REFRESH_TOKEN_REUSED`.
- Logout revokes the current session and clears the cookie.
- Logout-all revokes every refresh session for the authenticated user.
- Disabled or suspended users cannot create or refresh sessions.

## 6. Shared Enums

```ts
type UserRole = "CANDIDATE" | "HR" | "ADMIN";

type UserStatus = "ACTIVE" | "SUSPENDED" | "DISABLED";

type CompanyStatus = "ACTIVE" | "SUSPENDED";

type CompanyMemberRole = "OWNER" | "RECRUITER";

type JobStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "CLOSED";

type ExperienceLevel =
  | "INTERN"
  | "FRESHER"
  | "JUNIOR"
  | "MID"
  | "SENIOR"
  | "LEAD"
  | "MANAGER";

type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "INTERNSHIP";

type WorkplaceType = "ONSITE" | "HYBRID" | "REMOTE";

type ApplicationStatus =
  | "APPLIED"
  | "REVIEWING"
  | "INTERVIEWING"
  | "PASSED"
  | "REJECTED";

type CompanyInvitationStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REVOKED"
  | "EXPIRED";

type InterviewStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

type CvProcessingStatus =
  | "UPLOADED"
  | "EXTRACTING"
  | "READY"
  | "FAILED"
  | "DELETED";

type OperationStatus = "QUEUED" | "PROCESSING" | "SUCCEEDED" | "FAILED";

type AiAnalysisType = "CV_PROFILE" | "CV_JOB_MATCH" | "CV_GAP_ANALYSIS";

type NotificationType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_RESCHEDULED"
  | "INTERVIEW_CANCELLED"
  | "APPLICATION_OUTCOME"
  | "COMPANY_INVITATION"
  | "COMPANY_MEMBER_ADDED";
```

## 7. Application State Machine

The following transitions are the complete `v1.1` pipeline (incorporating BEI-001 early rejection resolution):

| Current | Allowed target | Actor |
| --- | --- | --- |
| `APPLIED` | `REVIEWING` | Authorized HR or admin |
| `APPLIED` | `REJECTED` | Authorized HR or admin |
| `REVIEWING` | `INTERVIEWING` | Authorized HR or admin |
| `REVIEWING` | `REJECTED` | Authorized HR or admin |
| `INTERVIEWING` | `PASSED` | Authorized HR or admin |
| `INTERVIEWING` | `REJECTED` | Authorized HR or admin |
| `PASSED` | None | Terminal |
| `REJECTED` | None | Terminal |

Self-transitions, skipped stages, reversal, reopening, and deletion are invalid.
An invalid transition returns `409 INVALID_APPLICATION_TRANSITION`.


## 8. Resource Schemas

These TypeScript-like definitions specify JSON wire shapes. They are not a
frontend or backend implementation requirement.

### 8.1 Identity

```ts
type UserSummary = {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
};

type AuthSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  user: UserSummary;
};

type RegisterRequest = {
  email: string;
  password: string;
  role: "CANDIDATE" | "HR";
};

type LoginRequest = {
  email: string;
  password: string;
};
```

Password policy is enforced by runtime validation and documented in OpenAPI.
The baseline minimum is 12 characters and maximum is 128 characters.

### 8.2 Candidate Profile

```ts
type CandidateSkill = {
  skillId: string;
  name: string;
  yearsOfExperience: number | null;
};

type WorkExperience = {
  id: string;
  companyName: string;
  title: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
};

type CandidateProfile = {
  id: string;
  userId: string;
  fullName: string;
  headline: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  isSearchable: boolean;
  profileCompleteness: number;
  skills: CandidateSkill[];
  experiences: WorkExperience[];
  defaultCvId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type UpdateCandidateProfileRequest = {
  expectedVersion: number;
  fullName?: string;
  headline?: string | null;
  phone?: string | null;
  location?: string | null;
  bio?: string | null;
  isSearchable?: boolean;
  skills?: Array<{
    skillId: string;
    yearsOfExperience: number | null;
  }>;
  experiences?: Array<{
    id?: string;
    companyName: string;
    title: string;
    startDate: string;
    endDate: string | null;
    description: string | null;
  }>;
};
```

### 8.3 Company

```ts
type Company = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  location: string | null;
  status: CompanyStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type CompanyMembership = {
  id: string;
  companyId: string;
  user: UserSummary;
  role: CompanyMemberRole;
  createdAt: string;
};
```

### 8.4 Job

```ts
type Job = {
  id: string;
  company: Pick<Company, "id" | "slug" | "name" | "logoUrl">;
  title: string;
  slug: string;
  description: string;
  requirements: string;
  responsibilities: string | null;
  technologyNames: string[];
  location: string;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  applicationDeadline: string;
  status: JobStatus;
  publishedAt: string | null;
  closedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type CreateJobRequest = {
  title: string;
  description: string;
  requirements: string;
  responsibilities?: string | null;
  technologyNames: string[];
  location: string;
  workplaceType: WorkplaceType;
  experienceLevel: ExperienceLevel;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  applicationDeadline: string;
};

type UpdateJobRequest = Partial<CreateJobRequest> & {
  expectedVersion: number;
};

type JobSearchFilters = {
  q?: string;
  technology?: string[];
  location?: string[];
  experienceLevel?: ExperienceLevel[];
  employmentType?: EmploymentType[];
  workplaceType?: WorkplaceType[];
  companyId?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  publishedAfter?: string;
  sort?: "RELEVANCE" | "NEWEST" | "SALARY_ASC" | "SALARY_DESC";
  cursor?: string;
  limit?: number;
};
```

### 8.5 CV

```ts
type Cv = {
  id: string;
  candidateId: string;
  originalFileName: string;
  mimeType: "application/pdf";
  sizeBytes: number;
  checksumSha256: string;
  processingStatus: CvProcessingStatus;
  failureCode: string | null;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type SignedDownload = {
  url: string;
  expiresAt: string;
};
```

Raw object keys and extracted text are never returned by the general CV
resource.

### 8.6 Application

```ts
type ApplicationStatusEvent = {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  actorId: string;
  occurredAt: string;
};

type Application = {
  id: string;
  candidateId: string;
  jobId: string;
  submittedCvId: string;
  status: ApplicationStatus;
  candidateNote: string | null;
  version: number;
  submittedAt: string;
  updatedAt: string;
};

type ApplicationDetail = Application & {
  job: Job;
  candidate: Pick<CandidateProfile, "id" | "fullName" | "headline" | "skills">;
  history: ApplicationStatusEvent[];
};

type SubmitApplicationRequest = {
  cvId: string;
  candidateNote?: string | null;
};

type TransitionApplicationRequest = {
  expectedVersion: number;
  targetStatus: ApplicationStatus;
  reason?: string | null;
};
```

The candidate view omits recruiter-private fields. The recruiter view includes
candidate data only when company scope permits it.

### 8.7 Interview

```ts
type Interview = {
  id: string;
  applicationId: string;
  status: InterviewStatus;
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions: string | null;
  recruiterPrivateNotes?: string | null;
  recruiterFeedback?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type CreateInterviewRequest = {
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions?: string | null;
  recruiterPrivateNotes?: string | null;
};

type UpdateInterviewRequest = {
  expectedVersion: number;
  startsAt?: string;
  endsAt?: string;
  locationOrMeetingUrl?: string;
  candidateInstructions?: string | null;
  recruiterPrivateNotes?: string | null;
  recruiterFeedback?: string | null;
};
```

`recruiterPrivateNotes` and `recruiterFeedback` are omitted from candidate
responses, not returned as `null`.

### 8.8 AI Analysis and Asynchronous Operation

```ts
type Operation = {
  id: string;
  type: string;
  status: OperationStatus;
  progressPercent: number | null;
  resultResource: { type: string; id: string } | null;
  failure: { code: string; message: string } | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type ScoreComponent = {
  name: "SKILLS" | "EXPERIENCE" | "REQUIREMENTS" | "KEYWORDS";
  score: number;
  weight: number;
  evidence: string[];
};

type AiAnalysis = {
  id: string;
  type: AiAnalysisType;
  candidateId: string;
  cvId: string;
  jobId: string | null;
  status: "SUCCEEDED" | "FAILED";
  overallScore: number | null;
  components: ScoreComponent[];
  matchedSkills: string[];
  missingSkills: string[];
  unmetRequirements: string[];
  suggestions: string[];
  limitations: string[];
  model: string;
  promptVersion: string;
  schemaVersion: string;
  createdAt: string;
};

type CreateCvJobAnalysisRequest = {
  cvId: string;
  jobId: string;
  analyses: Array<"CV_JOB_MATCH" | "CV_GAP_ANALYSIS">;
};
```

Scores are integers from `0` through `100`. A score is advisory and never
changes an application status.

### 8.9 Notification

```ts
type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  resource: { type: string; id: string } | null;
  readAt: string | null;
  createdAt: string;
};
```

### 8.10 Skill Catalog

```ts
type SkillCatalogItem = {
  id: string;
  name: string;
  aliases: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 8.11 Company Invitations and Recruiter Memberships

```ts
type CompanyInvitation = {
  id: string;
  companyId: string;
  maskedEmail: string;
  role: CompanyMemberRole;
  status: CompanyInvitationStatus;
  expiresAt: string;
  createdAt: string;
};

type RecruiterCompanyMembership = {
  membership: {
    id: string;
    role: CompanyMemberRole;
    createdAt: string;
  };
  company: Company;
};
```

### 8.12 Recommendation Preferences and Recommendations

```ts
type RecommendationPreference = {
  enabled: boolean;
  consentPolicyVersion: string;
  consentedAt: string;
  updatedAt: string;
  version: number;
};

type UpdateRecommendationPreferenceRequest = {
  enabled: boolean;
  consentPolicyVersion: string;
  expectedVersion: number;
};

type RecommendedJob = {
  job: Job;
  score: number;
  reasonCodes: string[];
  evidence: string[];
  limitations: string[];
};
```

### 8.13 Admin Oversight and Moderation

```ts
type AdminCompany = Company & {
  memberCount?: number;
  jobCount?: number;
};

type AdminJob = Job & {
  company: Pick<Company, "id" | "name" | "slug" | "status">;
};

type AdminApplicationSummary = {
  id: string;
  status: ApplicationStatus;
  version: number;
  submittedAt: string;
  updatedAt: string;
  candidate: {
    id: string;
    fullName: string;
    headline: string | null;
    skills: string[];
  };
  job: {
    id: string;
    title: string;
    slug: string;
  };
  company: {
    id: string;
    name: string;
    slug: string;
  };
};

type AdminApplicationDetail = AdminApplicationSummary & {
  history: ApplicationStatusEvent[];
};

type ModerateApplicationRequest = {
  targetStatus: ApplicationStatus;
  reason: string;
  expectedVersion: number;
};
```


## 9. Endpoint Catalog

All endpoints below are `Proposed baseline`.

### 9.1 Authentication

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /auth/register` | Guest | `RegisterRequest` | `201 SuccessResponse<AuthSession>` + refresh cookie |
| `POST /auth/login` | Guest | `LoginRequest` | `200 SuccessResponse<AuthSession>` + refresh cookie |
| `POST /auth/refresh` | Refresh cookie | Empty | `200 SuccessResponse<AuthSession>` + rotated cookie |
| `POST /auth/logout` | Refresh cookie | Empty | `204`, cookie cleared |
| `POST /auth/logout-all` | Bearer token | Empty | `204`, all sessions revoked |
| `GET /auth/me` | Bearer token | None | `200 SuccessResponse<UserSummary>` |

Important errors: `EMAIL_ALREADY_EXISTS`, `INVALID_CREDENTIALS`,
`INVALID_REFRESH_TOKEN`, `REFRESH_TOKEN_REUSED`, `ACCOUNT_SUSPENDED`, and
`RATE_LIMITED`. Register and login errors must not disclose whether an unrelated
account exists beyond the explicit registration conflict.

### 9.2 Candidate Profile

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /candidates/me` | Candidate | None | `200 SuccessResponse<CandidateProfile>` |
| `PATCH /candidates/me` | Candidate | `UpdateCandidateProfileRequest` | `200 SuccessResponse<CandidateProfile>` |

The candidate ID comes from the authenticated user, never from a body field.

### 9.3 Companies and Memberships

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /companies` | HR | Company create fields | `201 SuccessResponse<Company>` |
| `GET /companies/mine` | HR | Cursor query | `200 CollectionResponse<RecruiterCompanyMembership>` |
| `GET /companies/:companyIdOrSlug` | Public | None | `200 SuccessResponse<Company>` |
| `PATCH /companies/:companyId` | Owner/admin | Mutable fields + `expectedVersion` | `200 SuccessResponse<Company>` |
| `GET /companies/:companyId/members` | Company member/admin | Cursor query | `200 CollectionResponse<CompanyMembership>` |
| `POST /companies/:companyId/members` | Owner/admin | `{ userEmail, role }` | `201 SuccessResponse<CompanyMembership>` for registered user; `202 SuccessResponse<CompanyInvitation>` for unknown user |
| `DELETE /companies/:companyId/members/:memberId` | Owner/admin | None | `204` |
| `POST /company-invitations/:token/accept` | Authenticated invited user | Empty | `201 SuccessResponse<CompanyMembership>` |
| `GET /companies/:companyId/jobs` | Scoped HR or admin | Status/filter/cursor query | `200 CollectionResponse<Job>` |

The final active owner cannot be removed. Membership changes and invitations are audited.

### 9.4 Jobs and Search

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /jobs` | Public | `JobSearchFilters` query | `200 CollectionResponse<Job>` |
| `GET /jobs/:jobIdOrSlug` | Public or scoped HR | None | `200 SuccessResponse<Job>` |
| `POST /companies/:companyId/jobs` | Company recruiter/admin | `CreateJobRequest` | `201 SuccessResponse<Job>` |
| `PATCH /jobs/:jobId` | Company recruiter/admin | `UpdateJobRequest` | `200 SuccessResponse<Job>` |
| `POST /jobs/:jobId/publish` | Company recruiter/admin | `{ expectedVersion }` | `200 SuccessResponse<Job>` |
| `POST /jobs/:jobId/unpublish` | Company recruiter/admin | `{ expectedVersion }` | `200 SuccessResponse<Job>` |
| `POST /jobs/:jobId/close` | Company recruiter/admin | `{ expectedVersion, reason? }` | `200 SuccessResponse<Job>` |
| `POST /jobs/search/parse` | Public, rate-limited | `{ query: string }` | `200 SuccessResponse<JobSearchFilters>` |

Public job reads return `404 RESOURCE_NOT_FOUND` for drafts, unpublished jobs,
or inaccessible records to avoid leaking existence. HR users with company scope
may retrieve their non-public jobs.

### 9.5 Saved Jobs

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /saved-jobs` | Candidate | Cursor query | `200 CollectionResponse<Job>` |
| `PUT /saved-jobs/:jobId` | Candidate | Empty | `204` |
| `DELETE /saved-jobs/:jobId` | Candidate | None | `204` |

Save and unsave are idempotent.

### 9.6 CVs

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /cvs` | Candidate | `multipart/form-data` field `file` | `202 SuccessResponse<{ cv: Cv; operation: Operation }>` |
| `POST /cvs/:cvId/retry-processing` | Owner candidate or admin; idempotent | Empty | `202 SuccessResponse<{ cv: Cv; operation: Operation }>` |
| `GET /cvs` | Candidate | Cursor query | `200 CollectionResponse<Cv>` |
| `GET /cvs/:cvId` | Owner or scoped recruiter/admin | None | `200 SuccessResponse<Cv>` |
| `POST /cvs/:cvId/default` | Owner | `{ expectedVersion }` | `200 SuccessResponse<Cv>` |
| `POST /cvs/:cvId/download-url` | Owner or scoped recruiter/admin | Empty | `200 SuccessResponse<SignedDownload>` |
| `DELETE /cvs/:cvId` | Owner | None | `204` |

Upload limit baseline: 10 MiB. The backend verifies PDF signature and parseability
instead of trusting the extension or declared MIME type. Recruiter access exists
only through an application for a job in the recruiter's company.

### 9.7 Applications

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /jobs/:jobId/applications` | Candidate; idempotent | `SubmitApplicationRequest` | `201 SuccessResponse<Application>` |
| `GET /applications` | Candidate | Status/cursor query | `200 CollectionResponse<ApplicationDetail>` |
| `GET /applications/:applicationId` | Owner, scoped HR, or admin | None | `200 SuccessResponse<ApplicationDetail>` |
| `GET /jobs/:jobId/applications` | Scoped HR/admin | Status/cursor/sort query | `200 CollectionResponse<ApplicationDetail>` |
| `POST /applications/:applicationId/transitions` | Scoped HR/admin; idempotent | `TransitionApplicationRequest` | `200 SuccessResponse<ApplicationDetail>` |

Application submission requires `Idempotency-Key`. A database unique constraint
on candidate + job is still authoritative. Transition requests require
`expectedVersion`; only Section 7 transitions are valid.

### 9.8 Interviews

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /applications/:applicationId/interviews` | Scoped HR/admin; idempotent | `CreateInterviewRequest` | `201 SuccessResponse<Interview>` |
| `GET /applications/:applicationId/interviews` | Candidate owner, scoped HR/admin | Cursor query | `200 CollectionResponse<Interview>` |
| `GET /interviews/:interviewId` | Candidate owner, scoped HR/admin | None | `200 SuccessResponse<Interview>` |
| `PATCH /interviews/:interviewId` | Scoped HR/admin | `UpdateInterviewRequest` | `200 SuccessResponse<Interview>` |
| `POST /interviews/:interviewId/complete` | Scoped HR/admin | `{ expectedVersion, recruiterFeedback? }` | `200 SuccessResponse<Interview>` |
| `POST /interviews/:interviewId/cancel` | Scoped HR/admin | `{ expectedVersion, reason }` | `200 SuccessResponse<Interview>` |

Creation requires application status `INTERVIEWING`. A schedule-changing PATCH
emits `InterviewRescheduled`. Candidate responses omit recruiter-private fields.

### 9.9 AI Analysis and Recommendations

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `POST /ai/cv-job-analyses` | CV owner or scoped HR/admin; idempotent | `CreateCvJobAnalysisRequest` | `202 SuccessResponse<Operation>` |
| `GET /ai/analyses/:analysisId` | Input owner or scoped HR/admin | None | `200 SuccessResponse<AiAnalysis>` |
| `GET /operations/:operationId` | Operation owner or scoped admin | None | `200 SuccessResponse<Operation>` |
| `GET /recommendation-preferences` | Candidate | None | `200 SuccessResponse<RecommendationPreference>` |
| `PATCH /recommendation-preferences` | Candidate | `UpdateRecommendationPreferenceRequest` | `200 SuccessResponse<RecommendationPreference>` |
| `GET /recommendations/jobs` | Candidate | Cursor/limit query | `200 CollectionResponse<RecommendedJob>` |

The analysis request is rejected with `409 CV_NOT_READY` until extraction is
ready. Provider failure is represented on the operation and does not mutate an
application. Raw prompts, CV text, and provider credentials are never returned.
If candidate recommendation consent is disabled, the endpoint returns an empty collection
without triggering AI score queries.

### 9.10 Notifications

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /notifications` | Authenticated owner | Read-state/cursor query | `200 CollectionResponse<Notification>` |
| `PATCH /notifications/:notificationId/read` | Owner | `{ read: boolean }` | `200 SuccessResponse<Notification>` |

### 9.11 Administration and Audit

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /admin/users` | Admin | Filters/cursor | `200 CollectionResponse<UserSummary>` |
| `PATCH /admin/users/:userId/status` | Admin | `{ status, reason }` | `200 SuccessResponse<UserSummary>` |
| `GET /admin/companies` | Admin | Status/search/cursor filters | `200 CollectionResponse<AdminCompany>` |
| `PATCH /admin/companies/:companyId/status` | Admin | `{ status, reason, expectedVersion }` | `200 SuccessResponse<Company>` |
| `GET /admin/jobs` | Admin | Company/status/search/cursor filters | `200 CollectionResponse<AdminJob>` |
| `POST /admin/jobs/:jobId/moderate` | Admin | `{ action: "UNPUBLISH" | "CLOSE", reason, expectedVersion }` | `200 SuccessResponse<Job>` |
| `GET /admin/applications` | Admin | Filters/cursor | `200 CollectionResponse<AdminApplicationSummary>` |
| `GET /admin/applications/:applicationId` | Admin | None | `200 SuccessResponse<AdminApplicationDetail>` |
| `POST /admin/applications/:applicationId/moderate` | Admin | `ModerateApplicationRequest` | `200 SuccessResponse<AdminApplicationDetail>` |
| `GET /admin/audit-logs` | Admin | Actor/action/target/time/cursor filters | `200 CollectionResponse<AuditLog>` |

```ts
type AuditLog = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
};
```

Moderation reason is required and included in safe audit metadata.

### 9.12 Health

| Method and path | Access | Success |
| --- | --- | --- |
| `GET /health/live` | Public | `200 SuccessResponse<{ status: "ok" }>` |
| `GET /health/ready` | Internal or protected in production | `200` when required dependencies are ready; otherwise `503` |

Health responses expose no credentials, internal hostnames, or stack traces.

### 9.13 Skill Catalog

| Method and path | Access | Request | Success |
| --- | --- | --- | --- |
| `GET /skills` | Authenticated | Query (`search?`, `active?`, `cursor?`, `limit?`) | `200 CollectionResponse<SkillCatalogItem>` |

## 10. HTTP Status Semantics

| Status | Meaning |
| --- | --- |
| `200` | Successful read or mutation with a returned resource |
| `201` | Resource created synchronously |
| `202` | Request accepted for asynchronous processing |
| `204` | Successful operation with no body |
| `400` | Malformed request, invalid cursor, or validation failure |
| `401` | Missing, invalid, expired, or revoked authentication |
| `403` | Authenticated actor lacks role or resource scope |
| `404` | Resource absent or intentionally concealed from the actor |
| `409` | Uniqueness, lifecycle, idempotency, or version conflict |
| `413` | Upload exceeds the configured size limit |
| `415` | Unsupported or invalid media type |
| `422` | Syntactically valid input cannot satisfy a domain rule |
| `429` | Rate limit exceeded |
| `500` | Unexpected server failure with safe public details |
| `502` | Required upstream provider failed synchronously |
| `503` | Service or required dependency is unavailable |

## 11. Error Code Registry

```ts
type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CURSOR"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_CREDENTIALS"
  | "ACCESS_TOKEN_EXPIRED"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_REUSED"
  | "ACCOUNT_SUSPENDED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_FOUND"
  | "EMAIL_ALREADY_EXISTS"
  | "COMPANY_SLUG_EXISTS"
  | "MEMBERSHIP_ALREADY_EXISTS"
  | "LAST_COMPANY_OWNER"
  | "JOB_NOT_PUBLISHABLE"
  | "JOB_NOT_OPEN"
  | "JOB_DEADLINE_PASSED"
  | "APPLICATION_ALREADY_EXISTS"
  | "INVALID_APPLICATION_TRANSITION"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_REUSED"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "PDF_INVALID"
  | "CV_NOT_READY"
  | "CV_RETRY_EXHAUSTED"
  | "INVITATION_NOT_FOUND"
  | "INVITATION_EXPIRED"
  | "INVITATION_ALREADY_ACCEPTED"
  | "RECOMMENDATION_OPTED_OUT"
  | "INTERVIEW_TIME_INVALID"
  | "INTERVIEW_STATUS_INVALID"
  | "AI_OUTPUT_INVALID"
  | "UPSTREAM_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";
```

Validation example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid fields.",
    "details": [
      {
        "field": "salaryMin",
        "code": "MIN_VALUE",
        "message": "salaryMin must be greater than or equal to 0."
      }
    ],
    "requestId": "be8db5af-89d7-41f2-9ad1-f98c9d64f2fd",
    "timestamp": "2026-09-08T09:30:00.000Z"
  }
}
```

## 12. Domain Event Contract

Events are internal integration contracts between the API/outbox dispatcher and
workers. They are versioned independently from HTTP resources.

```ts
type DomainEvent<T> = {
  eventId: string;
  eventName: DomainEventName;
  eventVersion: 1;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  requestId: string | null;
  actorId: string | null;
  payload: T;
};

type DomainEventName =
  | "ApplicationSubmitted"
  | "ApplicationStatusChanged"
  | "InterviewScheduled"
  | "InterviewRescheduled"
  | "InterviewCancelled"
  | "CvUploaded"
  | "CvTextExtracted"
  | "AiAnalysisRequested"
  | "AiAnalysisCompleted";
```

Core payloads:

```ts
type ApplicationSubmittedPayload = {
  applicationId: string;
  candidateId: string;
  jobId: string;
  companyId: string;
  submittedAt: string;
};

type ApplicationStatusChangedPayload = {
  applicationId: string;
  candidateId: string;
  jobId: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedAt: string;
};

type InterviewEventPayload = {
  interviewId: string;
  applicationId: string;
  candidateId: string;
  startsAt: string;
  endsAt: string;
};
```

- Events are written to an outbox in the same database transaction as the
  aggregate change.
- Consumers deduplicate by `eventId`.
- Adding an optional payload field is additive; removing or changing a field
  requires a new `eventVersion` and migration plan.
- Event payloads contain identifiers and minimum notification data, not raw CV
  text, access tokens, signed URLs, or recruiter-private notes.

## 13. Filtering and Sorting Rules

- Repeated query parameters represent arrays, for example
  `technology=Node.js&technology=PostgreSQL`.
- All filter values are combined with logical AND; repeated values within one
  filter are logical OR unless an endpoint states otherwise.
- Text query length is 2–200 characters after normalization.
- Sort values are endpoint-specific enums, never arbitrary column names.
- Every sort includes `id` as a stable tie-breaker encoded in the cursor.
- Empty result sets return `200` with `data: []` and valid page metadata.

## 14. Upload and Download Rules

- `POST /cvs` consumes `multipart/form-data` with exactly one `file` part.
- A filename is display metadata and never becomes an object-storage key.
- Accepted media type is only validated PDF (`application/pdf`).
- Initial maximum size is 10 MiB; exceeding it returns `413 FILE_TOO_LARGE`.
- Download URLs expire after at most 5 minutes and are never cached in API
  responses or logs.
- Deleting a CV referenced by an application must preserve an authorized
  submission snapshot or reject deletion according to the implemented retention
  decision; Phase 5 must resolve this before the delete endpoint is implemented.

## 15. Rate-Limit Headers

Rate-limited endpoints return:

- `RateLimit-Limit`: maximum requests in the active window.
- `RateLimit-Remaining`: remaining requests.
- `RateLimit-Reset`: UTC epoch seconds when the window resets.
- `Retry-After`: seconds to wait on a `429` response.

Authentication, natural-language parsing, AI creation, upload, and administrative
mutations require endpoint-specific limits.

## 16. Contract Change Protocol

For every shared contract change:

1. Identify the controlling product requirement and affected consumers.
2. Edit this file before or atomically with implementation changes.
3. Classify the change:
   - `Additive`: new optional response field or new endpoint.
   - `Behavioral`: same shape with changed validation or lifecycle behavior.
   - `Deprecating`: old behavior remains temporarily with migration guidance.
   - `Breaking`: existing valid consumers would fail or change meaning.
4. Update NestJS DTOs, runtime validation, authorization, use cases, Prisma
   schema/migrations, and events as applicable.
5. Update OpenAPI metadata and run contract/API tests.
6. Update `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` and
   `CHANGELOG.md`.
7. For a breaking change, either preserve compatibility or introduce a new API
   major version; never silently ship it under the existing contract.

> Ghi chú: không sửa DTO trong code trước rồi mới “chữa” contract theo code. Nếu
> implementation phát hiện contract chưa hợp lý, dừng ở ranh giới thay đổi và
> cập nhật quyết định trước.

## 17. Open Decisions That Block Specific Endpoints

The baseline is implementable except for the following decisions, which are
tracked in `backend/ISSUES-LIST-TRACKING.md` and must be resolved before the
affected endpoint is marked implemented:

- CV retention when a submitted CV is deleted.
- Whether early rejection from `APPLIED` or `REVIEWING` should be added in a
  future behavioral contract change. The current state machine does not allow it.
- Production deployment topology and provider-specific configuration.

