# Frontend–Backend Contract Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align every frontend API consumer and feasible critical journey with the backend implementation merged in `d327eed`, using real runtime APIs and truthful completion evidence.

**Architecture:** Backend controllers, DTOs, response transformation, exception mapping, and live Swagger JSON define the transport boundary. Domain-focused frontend adapters validate or normalize those responses before React components consume them; TanStack Query owns server state and Playwright supplies live integration evidence without runtime interception.

**Tech Stack:** React 19.2, TypeScript 6, Vite 8, TanStack Router/Query, Axios, Zod 4, Vitest, Testing Library, Playwright, axe-core, NestJS Swagger JSON.

## Global Constraints

- Modify frontend source and frontend-owned documentation only; backend source is read-only.
- Runtime code calls `/api/v1` and never installs a mock worker, returns fallback records, invents resource IDs, or fabricates API fields.
- Backend implementation is operational truth; `API-CONTRACT.md` is checked for drift but cannot justify calling a route absent from backend controllers.
- Focused unit test doubles are allowed only to prove request and adapter behavior; they are not live-integration evidence.
- Live verification uses IDs and records created or returned by the real backend.
- Do not persist or log access tokens, CV contents, prompts, signed URLs, private notes, or full sensitive response payloads.
- AI output remains advisory and cannot call application transition mutations.
- A tracker build task may be checked after frontend implementation and local contract tests pass; explicit live/release tasks require real environment evidence.
- Preserve `frontend/fix.cjs` and `frontend/fix-checks.cjs` as untracked user files.

---

### Task 1: Add an executable backend endpoint inventory

**Files:**
- Create: `frontend/contracts/backend-required-endpoints.json`
- Create: `frontend/scripts/verify-backend-contract.mjs`
- Create: `frontend/src/shared/security/backend-contract.test.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/docs/OPERATIONS.md`

**Interfaces:**
- Consumes: NestJS Swagger JSON at `BACKEND_OPENAPI_URL`, defaulting to `http://127.0.0.1:4000/api/docs-json`.
- Produces: `compareBackendContract(openApi, requirements)`, `npm run contract:backend`, and a machine-readable list of every frontend-consumed method/path.

- [ ] **Step 1: Write the failing comparator test**

Create a minimal OpenAPI document containing `GET /api/v1/jobs` and requirements containing that endpoint plus `GET /api/v1/notifications`. Assert that comparison returns exactly one missing endpoint and no fabricated response data.

```ts
expect(compareBackendContract(openApi, requirements)).toEqual({
  missing: ['GET /api/v1/notifications'],
  present: ['GET /api/v1/jobs'],
})
```

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/shared/security/backend-contract.test.ts
```

Expected: fail because the comparator module does not exist.

- [ ] **Step 3: Implement the manifest and verifier**

List the exact backend routes used by auth, candidates, companies, jobs/search, saved jobs, CVs, applications, interviews, notifications, operations, AI, recommendations, admin users, admin moderation, and audit. Normalize Swagger parameter templates such as `{jobId}` without treating parameter names as values. Exit non-zero when any required method/path is absent.

```json
{ "method": "GET", "path": "/api/v1/notifications", "consumer": "notifications.list" }
```

Add:

```json
"contract:backend": "node scripts/verify-backend-contract.mjs"
```

- [ ] **Step 4: Run GREEN and verify against the real backend when available**

```powershell
npm.cmd run test:unit -- src/shared/security/backend-contract.test.ts
npm.cmd run contract:backend
```

Expected: comparator unit test passes; live command reports concrete missing routes and never converts them into passes.

---

### Task 2: Align shared enums, envelopes, errors, and authentication bootstrap

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/features/auth/api.ts`
- Modify: `frontend/src/features/auth/context.tsx`
- Modify: `frontend/src/app/providers.tsx`
- Modify: `frontend/src/app/routes/__root.tsx`
- Modify: `frontend/src/app/routes/_authenticated.tsx`
- Create: `frontend/src/features/auth/api.test.ts`
- Create: `frontend/src/features/auth/context.test.tsx`

**Interfaces:**
- Consumes: `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/logout-all`, standard envelopes and error bodies.
- Produces: `refreshSession()`, `getCurrentUser()`, `logoutAllSessions()`, auth state `{ status: 'loading' | 'authenticated' | 'anonymous'; ready: Promise<void> }`, and cache-safe terminal logout.

- [ ] **Step 1: Write failing auth transport tests**

Assert exact paths, cookie credentials, a single refresh for concurrent 401 responses, no refresh recursion, and preservation of backend error `code`, `details`, and `requestId`.

```ts
expect(recordedRequests.map(({ method, url }) => `${method} ${url}`)).toContain('post /auth/logout-all')
```

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/auth
```

Expected: fail because bootstrap/status/logout-all behavior is absent.

- [ ] **Step 3: Implement session bootstrap and route waiting**

On provider mount, call the real refresh endpoint once. Set the access token only from `AuthSession`; clear it on terminal refresh failure. Resolve one stable `ready` promise after bootstrap, await it from the async `_authenticated.beforeLoad`, then redirect only when status is `anonymous`. Use `useQueryClient()` inside `AuthProvider` to clear authenticated server state when identity changes or logout completes.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run test:unit -- src/features/auth
npm.cmd run typecheck
```

---

### Task 3: Remove fabricated skill/company discovery and preserve real company context

**Files:**
- Modify: `frontend/src/features/company/api.ts`
- Modify: `frontend/src/features/company/components/CompanyDashboard.tsx`
- Modify: `frontend/src/features/company/components/CompanyProfileEditor.tsx`
- Modify: `frontend/src/app/routes/_authenticated/company/route.tsx`
- Modify: `frontend/src/app/routes/_authenticated/company/edit.lazy.tsx`
- Modify: `frontend/src/app/routes/_authenticated/recruiter/workspace.tsx`
- Modify: `frontend/src/features/candidate/components/SkillCombobox.tsx`
- Create: `frontend/src/features/company/api.test.ts`
- Create: `frontend/src/features/company/company-context.test.tsx`
- Modify: `frontend/ISSUES-LIST-TRACKING.md`

**Interfaces:**
- Consumes: `POST /companies`, `GET /companies/:companyIdOrSlug`, `PATCH /companies/:companyId`, membership endpoints, and profile-returned candidate skills.
- Produces: real-response company context carried by URL/query cache after create or navigation; a truthful blocked state when an HR account has no discoverable company target.

- [ ] **Step 1: Write failing source and request tests**

Assert no frontend runtime source contains `/companies/mine`, `skillsDB`, generated `skill-*` IDs, or a default company ID. Assert company create/update/member calls match backend bodies and concurrency fields exactly.

```ts
expect(runtimeSource).not.toContain('/companies/mine')
expect(runtimeSource).not.toContain('skillsDB')
```

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/company src/features/candidate
```

Expected: fail on the proposed company endpoint and hard-coded skill catalog.

- [ ] **Step 3: Implement truthful company and skill states**

Remove `getMyCompanies()`. Validate an optional `companyId` search value on the `/company` route. After a real create response, seed `['company', company.id]` and navigate to `/company?companyId=<returned-id>`; dashboard, edit, and recruiter job links reuse that server-returned ID and fetch through `GET /companies/:companyIdOrSlug`. Existing skills render from `CandidateProfile.skills`; adding a new skill remains unavailable with copy explaining that the backend exposes no skill catalog.

- [ ] **Step 4: Verify GREEN**

```powershell
npm.cmd run test:unit -- src/features/company src/features/candidate
npm.cmd run typecheck
```

---

### Task 4: Align jobs, search, saved jobs, and recruiter job lifecycle

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/features/job/api/job.api.ts`
- Modify: `frontend/src/features/job/hooks/useJobs.ts`
- Modify: `frontend/src/features/job/components/JobFilters.tsx`
- Modify: `frontend/src/features/job/components/JobEditor.tsx`
- Modify: `frontend/src/features/job/components/JobDetail.tsx`
- Create: `frontend/src/features/job/api/job.api.test.ts`
- Modify: `frontend/src/features/job/job-search-url.test.ts`
- Create: `frontend/src/features/saved-jobs/api/saved-jobs.api.test.ts`

**Interfaces:**
- Consumes: backend `JobDto`, `JobSearchQueryDto`, lifecycle DTOs, `/jobs/search/parse`, and `/saved-jobs`.
- Produces: `ExperienceLevel` including `FRESHER`, deterministic array-query serialization, and exact lifecycle payloads.

- [ ] **Step 1: Write failing enum and query tests**

Assert `FRESHER` survives URL parse/serialize and is rendered in filters/editor. Assert array filters reach Axios as backend-accepted repeated or comma-separated values without JSON encoding.

```ts
expect(parseJobSearch({ experienceLevel: ['FRESHER'] }).experienceLevel).toEqual(['FRESHER'])
```

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/job src/features/saved-jobs
```

- [ ] **Step 3: Implement backend DTO parity**

Add `FRESHER`, encode documented filters, include `expectedVersion` on update/publish/unpublish/close, omit undefined close reasons, preserve public job status behavior, and keep saved-job writes bodyless.

- [ ] **Step 4: Run GREEN**

```powershell
npm.cmd run test:unit -- src/features/job src/features/saved-jobs
npm.cmd run typecheck
```

---

### Task 5: Verify CV, application, and interview transports end to end

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/features/cv/api/cv.api.ts`
- Modify: `frontend/src/features/application/api/application.api.ts`
- Modify: `frontend/src/features/interview/api/interview.api.ts`
- Modify: `frontend/src/features/interview/hooks/useInterview.ts`
- Create: `frontend/src/features/cv/api/cv.api.test.ts`
- Create: `frontend/src/features/application/api/application.api.test.ts`
- Create: `frontend/src/features/interview/api/interview.api.test.ts`
- Create: `frontend/src/app/routes/_authenticated/interviews/$interviewId.tsx`

**Interfaces:**
- Consumes: multipart `POST /cvs`, CV collection/detail/default/download/delete, application collection/detail/transition, and all six interview routes.
- Produces: exact request adapters, `getInterview(interviewId)`, `useInterview(interviewId)`, and authorized interview detail navigation.

- [ ] **Step 1: Write failing exact-transport tests**

Assert the CV request lets the browser set the multipart boundary, the upload response reads `{ data: { cv, operation } }`, delete accepts 204, application filters omit undefined values, and complete/cancel interview bodies match their backend DTOs.

```ts
expect(uploadHeaders['Content-Type']).toBeUndefined()
expect(cancelBody).toEqual({ expectedVersion: 3, reason: 'Candidate withdrew' })
```

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/cv src/features/application src/features/interview
```

Expected: multipart header and interview-detail coverage fail.

- [ ] **Step 3: Implement minimal transport fixes and detail route**

Remove the explicit multipart content type so Axios/browser supplies its boundary. Add the missing interview detail consumer and render only fields the caller receives; recruiter-private fields remain absent for candidates because the backend projection omits them.

- [ ] **Step 4: Run GREEN**

```powershell
npm.cmd run test:unit -- src/features/cv src/features/application src/features/interview
npm.cmd run typecheck
```

---

### Task 6: Adapt backend notification DTOs at one boundary

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/features/notifications/api.ts`
- Modify: `frontend/src/features/notifications/api.test.ts`
- Modify: `frontend/src/features/notifications/resource-link.ts`
- Modify: `frontend/src/features/notifications/NotificationCenter.test.tsx`

**Interfaces:**
- Consumes: backend `NotificationDto` with `resourceType` and `resourceId`.
- Produces: `toNotification(dto): Notification` with nullable nested `resource`, applied to list and read-state responses.

- [ ] **Step 1: Write the failing adapter test**

```ts
expect(toNotification({
  id: 'notification-1', userId: 'user-1', type: 'INTERVIEW_SCHEDULED',
  title: 'Interview scheduled', body: 'Review the schedule',
  resourceType: 'INTERVIEW', resourceId: 'interview-1', readAt: null,
  createdAt: '2026-09-10T00:00:00.000Z',
}).resource).toEqual({ type: 'INTERVIEW', id: 'interview-1' })
```

Also assert that a half-present resource pair maps to `null` and cannot produce a link.

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/notifications
```

- [ ] **Step 3: Implement and apply the pure adapter**

Keep `userId` at the transport boundary; do not expose it unnecessarily in notification presentation. Apply the same adapter after read/unread mutations.

- [ ] **Step 4: Run GREEN**

```powershell
npm.cmd run test:unit -- src/features/notifications
npm.cmd run typecheck
```

---

### Task 7: Align operations, AI analysis, and recommendation semantics

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/features/ai-assistance/api.ts`
- Modify: `frontend/src/features/ai-assistance/api.test.ts`
- Modify: `frontend/src/features/ai-assistance/AiAnalysisResult.tsx`
- Modify: `frontend/src/features/ai-assistance/AiAnalysisResult.test.tsx`
- Modify: `frontend/src/features/ai-assistance/Recommendations.tsx`
- Modify: `frontend/src/features/operations/polling.ts`
- Modify: `frontend/src/features/operations/polling.test.ts`

**Interfaces:**
- Consumes: backend `AiAnalysisDto`, `ScoreComponentDto`, `OperationDto`, and recommendation `CollectionResponse<JobDto>`.
- Produces: AI type support for `CV_JOB_ANALYSIS`, coefficient-to-percent presentation, safe operation polling, and server-owned recommendation UI.

- [ ] **Step 1: Write failing weight/type tests**

Render a backend component `{ weight: 0.4 }` and assert accessible text says `weight 40%`, not `0.4%`. Assert `CV_JOB_ANALYSIS` parses as a supported analysis type and no recommendation reason appears unless the backend adds one.

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/ai-assistance src/features/operations
```

- [ ] **Step 3: Implement semantic mapping**

Convert coefficients only at presentation, clamp score and coefficient ranges defensively without mutating response data, keep operation result IDs server-owned, stop polling on hidden/terminal/timeout states, and retain advisory copy.

- [ ] **Step 4: Run GREEN**

```powershell
npm.cmd run test:unit -- src/features/ai-assistance src/features/operations
npm.cmd run typecheck
```

---

### Task 8: Align admin and audit DTOs without inventing discovery APIs

**Files:**
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/features/audit/api.ts`
- Modify: `frontend/src/features/audit/audit-search.ts`
- Modify: `frontend/src/features/audit/audit-search.test.ts`
- Modify: `frontend/src/features/audit/AuditExplorer.tsx`
- Modify: `frontend/src/features/audit/AuditExplorer.test.tsx`
- Modify: `frontend/src/features/admin/api.test.ts`
- Modify: `frontend/ISSUES-LIST-TRACKING.md`

**Interfaces:**
- Consumes: audit query `startDate/endDate`, nullable `actorId/requestId`, admin user collection/status, company status, and job moderation commands.
- Produces: URL/UI filters mapped to backend query names and null-safe redacted audit presentation.

- [ ] **Step 1: Write failing query/nullability tests**

```ts
expect(toAuditApiFilters({ occurredAfter: start, occurredBefore: end })).toEqual({
  startDate: start,
  endDate: end,
})
```

Render an audit row with `actorId: null` and `requestId: null`; assert it shows `System` and `Not provided` without exposing metadata.

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/features/audit src/features/admin
```

- [ ] **Step 3: Implement exact mapping and keep missing surfaces blocked**

Translate only at the request boundary, retain browser-facing URL keys for restoration, update nullability types, and verify moderation command payloads. Do not add admin company/job lookup or application-administration UI because the backend exposes no authorized discovery endpoints.

- [ ] **Step 4: Run GREEN**

```powershell
npm.cmd run test:unit -- src/features/audit src/features/admin
npm.cmd run typecheck
```

---

### Task 9: Extend real-environment browser and accessibility coverage

**Files:**
- Modify: `frontend/playwright.config.ts`
- Modify: `frontend/tests/example.spec.ts`
- Modify: `frontend/tests/authenticated-critical.spec.ts`
- Modify: `frontend/tests/accessibility.spec.ts`
- Create: `frontend/tests/real-api-lifecycle.spec.ts`
- Create: `frontend/tests/fixtures/blank-cv.pdf`
- Modify: `frontend/docs/OPERATIONS.md`

**Interfaces:**
- Consumes: `PLAYWRIGHT_BASE_URL`, real candidate/HR/admin credentials or real registration endpoints, and live backend APIs.
- Produces: guest, candidate, HR, admin, responsive, keyboard, dark-theme, and lifecycle evidence with no request interception.

- [ ] **Step 1: Add tests that fail on current mapping defects**

Cover refresh-session restoration, `FRESHER` search, real company creation followed by job creation, CV multipart upload, candidate application, recruiter transition/interview, notification resource navigation, AI operation status, audit nullable fields, and admin access. Guard only admin/provider-specific paths with explicit environment checks.

- [ ] **Step 2: Run the smallest real-API RED set**

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'; npm.cmd run test:e2e -- --project=chromium tests/real-api-lifecycle.spec.ts
```

Expected: fail at the first unresolved mapping or unavailable backend dependency; do not install a route interceptor.

- [ ] **Step 3: Complete the viewport and accessibility matrix**

Exercise 320, 375, 414, 768, 1024, and 1440 widths; 200% zoom; 44px targets; keyboard focus restoration; light/dark axe scans; Chromium, Firefox, and WebKit. Screenshots are evidence artifacts, not baseline data returned to the application.

- [ ] **Step 4: Run GREEN where infrastructure exists**

```powershell
npm.cmd run test:e2e -- --project=chromium
npm.cmd run test:e2e -- --project=webkit
npm.cmd run test:e2e -- --project=firefox
```

Record every skip/hang as open evidence.

---

### Task 10: Run cumulative security, performance, and contract gates

**Files:**
- Modify: `frontend/scripts/check-sensitive-data.mjs`
- Modify: `frontend/src/shared/security/check-sensitive-data.test.ts`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/README.md`
- Modify: `frontend/CHANGELOG.md`

**Interfaces:**
- Consumes: production `dist`, source inventory, live Swagger report, npm dependency graph, and emitted chunk sizes.
- Produces: release evidence without claiming unapproved production budgets.

- [ ] **Step 1: Extend the scanner test before implementation**

Add failing cases for refresh/access tokens, signed download URLs, raw CV markers, prompts, recruiter-private notes, audit metadata, and accidentally bundled mock-worker signatures. Include safe request IDs as a passing case.

- [ ] **Step 2: Run RED, implement scanner coverage, run GREEN**

```powershell
npm.cmd run test:unit -- src/shared/security/check-sensitive-data.test.ts
npm.cmd run build
npm.cmd run security:frontend
```

- [ ] **Step 3: Run dependency and bundle checks**

```powershell
npm.cmd audit
npm.cmd audit --omit=dev
npm.cmd ls --depth=0
```

Document peer, license, provenance, or unused dependency findings instead of forcing incompatible packages.

- [ ] **Step 4: Run the complete local frontend gate**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run security:frontend
```

Expected: zero command errors; warnings are itemized with impact.

---

### Task 11: Reconcile frontend task and issue records with evidence

**Files:**
- Modify: `frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`
- Modify: `frontend/ISSUES-LIST-TRACKING.md`
- Modify: `frontend/CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-09-10-frontend-backend-contract-mapping.md`

**Interfaces:**
- Consumes: unit/build/security/browser/live-contract outputs from Tasks 1–10.
- Produces: accurate Phase 1–7 counts, `[x]` markers, live blockers, contract drift records, and final handoff.

- [ ] **Step 1: Generate checkbox counts by phase**

Use a read-only script to count checked/open `FE-*` lines inside each phase and compare those counts to each phase status line.

- [ ] **Step 2: Mark completed frontend implementation tasks**

Check tasks whose frontend code and stated local tests pass, including newly repaired transport and UI tasks. Do not check explicit live integration, full browser, CSP, telemetry, deployment, localization, performance-budget, release checklist, or tagging tasks unless their complete evidence was actually produced.

- [ ] **Step 3: Record backend implementation gaps precisely**

Keep company-membership discovery, admin company/job discovery, and application administration open if the final controller inventory still lacks those routes. Link each item to the live contract report rather than the older planning assumption.

- [ ] **Step 4: Verify documentation integrity**

```powershell
git diff --check
rg -n "^## Phase|^\*\*Phase status" frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md
```

Ensure UTF-8 punctuation remains valid and counts match task lines.

- [ ] **Step 5: Commit and push only owned changes**

```powershell
git status --short
git diff --cached --check
git commit -m "feat(frontend): align clients with backend phase 7"
git push origin frontend
```

Expected: backend files and the two untracked helper scripts are excluded; `origin/frontend` points to the verified source commit.
