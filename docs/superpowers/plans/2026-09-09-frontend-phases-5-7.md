# Frontend Phases 5–7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the contract-backed frontend portions of Phases 5–7 with real runtime API calls, test-only fixtures, accessible enterprise UI, and truthful evidence tracking.

**Architecture:** Implement vertical slices through contract types, feature API modules, TanStack Query hooks, focused components, and lazy role-aware routes. Runtime code always calls `/api/v1`; deterministic fixtures remain inside unit/component tests, while live verification and release tasks stay blocked until their documented dependencies exist.

**Tech Stack:** React 19.2, Vite 8, strict TypeScript 6, TanStack Router/Query, React Hook Form, Zod, Tailwind CSS v4, Radix UI, Lucide, Vitest, Testing Library, MSW, Storybook, and Playwright.

## Global Constraints

- Frontend-only changes; do not modify backend source or backend trackers.
- Runtime and development builds use real `/api/v1` endpoints and contain no fallback records, seeded feature data, or enabled mock service worker.
- MSW/fixtures are allowed only under automated-test configuration.
- Follow `API-CONTRACT.md` version `0.1.0-draft`; never invent missing endpoints or response fields.
- AI output is advisory and cannot invoke application pipeline transitions.
- Do not persist or log tokens, CV text, prompts, signed URLs, private notes, or response payloads.
- New interactive targets are at least 44×44 CSS pixels, keyboard complete, and understandable without color.
- Only passed acceptance evidence changes a tracker checkbox to `[x]`.
- Preserve unrelated working-tree changes and stage only files owned by the current task.

---

### Task 1: Restore a deterministic frontend verification harness

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/vitest.config.ts`
- Modify: `frontend/src/shared/test/setup.ts`
- Modify: `frontend/playwright.config.ts`
- Replace: `frontend/tests/example.spec.ts`
- Test: `frontend/src/shared/ui/card.test.tsx`

**Interfaces:**
- Consumes: existing Vite/Vitest/Playwright packages.
- Produces: `npm run test:unit`, `npm run test:e2e`, `npm run typecheck`, and non-overlapping unit/E2E discovery.

- [ ] **Step 1: Record the failing baseline**

```powershell
npm.cmd run build
npm.cmd exec -- vitest run --config vitest.config.ts
```

Expected: build fails on TypeScript 6 `baseUrl` deprecation; Vitest incorrectly collects `tests/example.spec.ts` and attempts the Storybook browser project.

- [ ] **Step 2: Add explicit verification scripts and isolated discovery**

```json
{
  "scripts": {
    "typecheck": "tsc -b",
    "test:unit": "vitest run --project unit",
    "test:e2e": "playwright test"
  }
}
```

Configure the Vitest unit project with `name: "unit"`, `include: ["src/**/*.test.{ts,tsx}"]`, and `exclude: ["tests/**"]`; keep Storybook as a separately named project. Add `"ignoreDeprecations": "6.0"` to strict TypeScript configuration. Replace the external Playwright demo with a local route smoke test using `PLAYWRIGHT_BASE_URL` and configure Chromium, Firefox, WebKit, and mobile projects.

- [ ] **Step 3: Verify the harness**

```powershell
npm.cmd run test:unit
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Expected: unit tests no longer collect E2E files; commands expose remaining source errors without harness errors.

### Task 2: Complete contract types and safe shared helpers

**Files:**
- Modify: `frontend/src/api/types.ts`
- Create: `frontend/src/shared/lib/api-error.ts`
- Create: `frontend/src/shared/lib/api-error.test.ts`
- Create: `frontend/src/shared/lib/idempotency.ts`
- Create: `frontend/src/shared/lib/idempotency.test.ts`
- Create: `frontend/src/shared/lib/date-time.ts`
- Create: `frontend/src/shared/lib/date-time.test.ts`

**Interfaces:**
- Consumes: standard API success/error/collection envelopes.
- Produces: `Notification`, `AiAnalysis`, `CreateCvJobAnalysisRequest`, `AuditLog`, admin filter/request types, `getApiErrorDetails(error)`, `createActionKey()`, and locale-aware UTC formatting.

- [ ] **Step 1: Write failing helper tests**

```ts
expect(getApiErrorDetails(axiosError).requestId).toBe("req-123");
expect(getApiErrorDetails(axiosError).code).toBe("RATE_LIMITED");
expect(createActionKey()).toMatch(/^[0-9a-f-]{36}$/i);
expect(formatUtcDateTime("2026-09-08T09:30:00.000Z", "en-US", "UTC"))
  .toContain("Sep");
```

- [ ] **Step 2: Run RED**

```powershell
npm.cmd run test:unit -- src/shared/lib/api-error.test.ts src/shared/lib/idempotency.test.ts src/shared/lib/date-time.test.ts
```

Expected: modules do not exist.

- [ ] **Step 3: Implement contract-complete types and helpers**

```ts
export type AiAnalysisType = "CV_PROFILE" | "CV_JOB_MATCH" | "CV_GAP_ANALYSIS";
export type NotificationType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_RESCHEDULED"
  | "INTERVIEW_CANCELLED"
  | "APPLICATION_OUTCOME";

export const createActionKey = () => crypto.randomUUID();
```

Expand `ErrorCode` to the full contract registry and normalize Axios errors without logging payloads.

- [ ] **Step 4: Run GREEN**

```powershell
npm.cmd run test:unit -- src/shared/lib
```

Expected: helper tests pass.

### Task 3: Build the notification center vertical slice

**Files:**
- Create: `frontend/src/features/notifications/api.ts`
- Create: `frontend/src/features/notifications/api.test.ts`
- Create: `frontend/src/features/notifications/hooks.ts`
- Create: `frontend/src/features/notifications/resource-link.ts`
- Create: `frontend/src/features/notifications/resource-link.test.ts`
- Create: `frontend/src/features/notifications/NotificationCenter.tsx`
- Create: `frontend/src/features/notifications/NotificationCenter.test.tsx`
- Create: `frontend/src/app/routes/_authenticated/notifications.tsx`
- Modify: `frontend/src/shared/ui/AppShell.tsx`

**Interfaces:**
- Consumes: `GET /notifications`, `PATCH /notifications/:notificationId/read`, auth shell, collection envelopes.
- Produces: `notificationKeys`, `useNotifications({ read, cursor, limit })`, `useSetNotificationRead()`, and `/notifications`.

- [ ] **Step 1: Write failing API and resource-link tests**

```ts
expect(notificationResourceHref({ type: "APPLICATION", id: "app-1" }))
  .toBe("/candidate/applications?applicationId=app-1");
expect(notificationResourceHref({ type: "UNKNOWN", id: "private" }))
  .toBeNull();
```

Use an Axios adapter test double to assert `GET /notifications?read=false` and `PATCH .../read` body `{ read: true }`.

- [ ] **Step 2: Run RED and implement API/hooks**

```powershell
npm.cmd run test:unit -- src/features/notifications
```

Expected before implementation: missing modules; expected after implementation: API and mapping tests pass.

- [ ] **Step 3: Write failing component behavior tests**

```ts
expect(screen.getByRole("heading", { name: "Notifications" })).toBeVisible();
await user.click(screen.getByRole("button", { name: "Mark Interview scheduled as read" }));
expect(screen.getByText("Interview scheduled")).toHaveAttribute("data-read", "true");
```

Cover read filter, date grouping, cursor continuation, empty/error states, safe links, optimistic rollback, and accessible action names.

- [ ] **Step 4: Implement route and UI, then run GREEN**

```powershell
npm.cmd run test:unit -- src/features/notifications
npm.cmd run typecheck
```

Expected: behavior passes and the shell links every authenticated role to `/notifications` without a fabricated unread count.

### Task 4: Build reusable bounded operation tracking

**Files:**
- Create: `frontend/src/features/operations/api.ts`
- Create: `frontend/src/features/operations/polling.ts`
- Create: `frontend/src/features/operations/polling.test.ts`
- Create: `frontend/src/features/operations/hooks.ts`
- Create: `frontend/src/features/operations/OperationTracker.tsx`
- Create: `frontend/src/features/operations/OperationTracker.test.tsx`
- Modify: `frontend/src/features/cv/components/CvUploader.tsx`

**Interfaces:**
- Consumes: `GET /operations/:operationId`, `Operation`, CV upload response.
- Produces: `operationKeys.detail(id)`, `useOperation(id, options)`, `getOperationPollInterval(query)`, and `OperationTracker`.

- [ ] **Step 1: Write polling state tests**

```ts
expect(getOperationPollInterval({ status: "QUEUED", hidden: false, elapsedMs: 0 })).toBe(2000);
expect(getOperationPollInterval({ status: "SUCCEEDED", hidden: false, elapsedMs: 1 })).toBe(false);
expect(getOperationPollInterval({ status: "PROCESSING", hidden: true, elapsedMs: 1 })).toBe(false);
expect(getOperationPollInterval({ status: "PROCESSING", hidden: false, elapsedMs: 300001 })).toBe(false);
```

- [ ] **Step 2: Run RED, implement minimal polling, run GREEN**

```powershell
npm.cmd run test:unit -- src/features/operations/polling.test.ts
```

- [ ] **Step 3: Test and implement accessible operation presentation**

Verify progress is rendered only when non-null, terminal changes produce one atomic status message, failures expose retry guidance, and unmount cancels the query signal.

```powershell
npm.cmd run test:unit -- src/features/operations
```

- [ ] **Step 4: Integrate CV upload operation**

Keep the returned operation ID in the CV route query string, render `OperationTracker`, and never persist file contents or signed URLs.

### Task 5: Build AI analysis request and evidence result

**Files:**
- Create: `frontend/src/features/ai-assistance/api.ts`
- Create: `frontend/src/features/ai-assistance/api.test.ts`
- Create: `frontend/src/features/ai-assistance/hooks.ts`
- Create: `frontend/src/features/ai-assistance/AiAnalysisWorkspace.tsx`
- Create: `frontend/src/features/ai-assistance/AiAnalysisWorkspace.test.tsx`
- Create: `frontend/src/features/ai-assistance/AiAnalysisResult.tsx`
- Create: `frontend/src/features/ai-assistance/AiAnalysisResult.test.tsx`
- Create: `frontend/src/features/ai-assistance/boundary.test.ts`
- Create: `frontend/src/app/routes/_authenticated/candidate/ai.tsx`

**Interfaces:**
- Consumes: `POST /ai/cv-job-analyses`, `GET /ai/analyses/:analysisId`, `useCvs`, `useJobs`, `OperationTracker`.
- Produces: `useCreateCvJobAnalysis()`, `useAiAnalysis(id)`, candidate `/candidate/ai` workspace, and evidence views.

- [ ] **Step 1: Write failing request-boundary tests**

```ts
expect(request.headers.get("Idempotency-Key")).toBe(actionKey);
expect(await request.json()).toEqual({
  cvId: "cv-1",
  jobId: "job-1",
  analyses: ["CV_JOB_MATCH", "CV_GAP_ANALYSIS"]
});
```

- [ ] **Step 2: Implement API/hooks and verify GREEN**

```powershell
npm.cmd run test:unit -- src/features/ai-assistance/api.test.ts
```

- [ ] **Step 3: Write failing result semantics tests**

Assert bounded score text, component weight/evidence, missing versus unmet labels, limitations, provenance, advisory copy, and absence of pass/reject transition actions.

- [ ] **Step 4: Implement the workspace and result rail**

Render owned ready CVs and real job results, preserve selection on recoverable error, use one idempotency key per click/retry window, poll the returned operation, and load its analysis result resource.

- [ ] **Step 5: Enforce feature isolation**

```ts
expect(aiSourceFiles.some((source) => source.includes("features/application"))).toBe(false);
```

Run all AI tests and typecheck.

### Task 6: Add natural-language search preview

**Files:**
- Create: `frontend/src/features/job/components/NaturalLanguageSearch.tsx`
- Create: `frontend/src/features/job/components/NaturalLanguageSearch.test.tsx`
- Modify: `frontend/src/app/routes/jobs/index.tsx`

**Interfaces:**
- Consumes: existing `useParseSearchQuery()` and `JobSearchFilters`.
- Produces: an editable parsed-filter preview and confirmed URL application.

- [ ] **Step 1: Write failing interaction tests**

Assert the original query remains after rate limit/provider failure, returned filters appear before navigation, removing a parsed filter changes the preview, and Apply updates only documented URL keys.

- [ ] **Step 2: Run RED and implement the form/preview**

```powershell
npm.cmd run test:unit -- src/features/job/components/NaturalLanguageSearch.test.tsx
```

- [ ] **Step 3: Run GREEN with route typecheck**

```powershell
npm.cmd run test:unit -- src/features/job/components/NaturalLanguageSearch.test.tsx
npm.cmd run typecheck
```

### Task 7: Build job recommendations

**Files:**
- Create: `frontend/src/features/ai-assistance/Recommendations.tsx`
- Create: `frontend/src/features/ai-assistance/Recommendations.test.tsx`
- Create: `frontend/src/app/routes/_authenticated/candidate/recommendations.tsx`
- Modify: `frontend/src/features/ai-assistance/api.ts`
- Modify: `frontend/src/features/ai-assistance/hooks.ts`
- Modify: `frontend/src/shared/ui/AppShell.tsx`

**Interfaces:**
- Consumes: `GET /recommendations/jobs`, `Job`, existing `JobCard` and saved-job mutation.
- Produces: cursor-backed `/candidate/recommendations` with cold-start, reason/exclusion, empty, and error states.

- [ ] **Step 1: Write failing API and component tests**

Assert exact cursor/limit parameters, append without duplicate job IDs, preserve server reason metadata only if present in the contracted projection, and show a truthful cold-start state when no results exist.

- [ ] **Step 2: Implement with no local recommendation scoring**

The browser must not rank, infer, or fabricate reasons. When the current `Job` contract lacks reason fields, render the returned job collection and a neutral server-recommendation label; record the projection gap instead of adding fields.

- [ ] **Step 3: Run GREEN**

```powershell
npm.cmd run test:unit -- src/features/ai-assistance/Recommendations.test.tsx
npm.cmd run typecheck
```

### Task 8: Build admin role boundary and user moderation

**Files:**
- Create: `frontend/src/features/admin/api.ts`
- Create: `frontend/src/features/admin/api.test.ts`
- Create: `frontend/src/features/admin/hooks.ts`
- Create: `frontend/src/features/admin/UserAdministration.tsx`
- Create: `frontend/src/features/admin/UserAdministration.test.tsx`
- Create: `frontend/src/app/routes/_authenticated/admin/route.tsx`
- Create: `frontend/src/app/routes/_authenticated/admin/index.lazy.tsx`
- Modify: `frontend/src/shared/ui/AppShell.tsx`

**Interfaces:**
- Consumes: auth role, `GET /admin/users`, `PATCH /admin/users/:userId/status`.
- Produces: admin-only `/admin`, URL filters, cursor list, responsive users, and reason-required moderation dialog.

- [ ] **Step 1: Write failing access and request tests**

Assert non-admin direct navigation is denied before the admin module renders; list query uses only contract filters; status body is exactly `{ status, reason }`.

- [ ] **Step 2: Implement route/API/hooks and run GREEN**

```powershell
npm.cmd run test:unit -- src/features/admin/api.test.ts
npm.cmd run typecheck
```

- [ ] **Step 3: Test and implement accountable moderation**

Assert visible target/status/consequence, disabled confirmation until a trimmed reason exists, one in-flight action per target, error summary focus, and cache synchronization after success.

### Task 9: Build privacy-safe audit exploration

**Files:**
- Create: `frontend/src/features/audit/api.ts`
- Create: `frontend/src/features/audit/hooks.ts`
- Create: `frontend/src/features/audit/redaction.ts`
- Create: `frontend/src/features/audit/redaction.test.ts`
- Create: `frontend/src/features/audit/AuditExplorer.tsx`
- Create: `frontend/src/features/audit/AuditExplorer.test.tsx`
- Create: `frontend/src/app/routes/_authenticated/admin/audit.tsx`

**Interfaces:**
- Consumes: `GET /admin/audit-logs`, `AuditLog`.
- Produces: `sanitizeAuditMetadata(value)`, URL-backed audit filters, cursor continuation, responsive records, and focus-safe detail dialog.

- [ ] **Step 1: Write failing recursive redaction tests**

```ts
expect(sanitizeAuditMetadata({ requestId: "r1", token: "secret", nested: { cvText: "private" } }))
  .toEqual({ requestId: "r1" });
```

Also reject case/format variants such as `access_token`, `signedUrl`, `prompt`, `password`, and `privateNotes`.

- [ ] **Step 2: Run RED, implement conservative allow-listing, run GREEN**

```powershell
npm.cmd run test:unit -- src/features/audit/redaction.test.ts
```

- [ ] **Step 3: Test and implement explorer interactions**

Cover actor/action/target/time filters, cursor, URL restoration, table/card views, empty/error states, dialog name/Escape/focus restore, request ID, and sanitized metadata.

### Task 10: Add contracted moderation command adapters without inventing discovery

**Files:**
- Modify: `frontend/src/features/admin/api.ts`
- Modify: `frontend/src/features/admin/api.test.ts`
- Modify: `frontend/src/features/admin/hooks.ts`
- Modify: `frontend/ISSUES-LIST-TRACKING.md`

**Interfaces:**
- Consumes: `PATCH /admin/companies/:companyId/status` and `POST /admin/jobs/:jobId/moderate`.
- Produces: typed mutations callable only after an approved target read/discovery flow exists.

- [ ] **Step 1: Write failing exact-payload tests**

```ts
expect(companyBody).toEqual({ status: "SUSPENDED", reason: "Policy breach", expectedVersion: 4 });
expect(jobBody).toEqual({ action: "UNPUBLISH", reason: "Misleading listing", expectedVersion: 7 });
```

- [ ] **Step 2: Implement adapters and keep UI undiscoverable**

Do not add ID-entry shortcuts or reuse public lists. Record `FE-6-004`, `FE-6-006`, and `FE-6-008` as blocked by `FEI-014`.

- [ ] **Step 3: Verify adapter tests**

```powershell
npm.cmd run test:unit -- src/features/admin/api.test.ts
```

### Task 11: Apply Phase 7 automated hardening

**Files:**
- Modify: `frontend/src/shared/styles/global.css`
- Modify: `frontend/src/shared/ui/AppShell.tsx`
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/playwright.config.ts`
- Create: `frontend/tests/critical-routes.spec.ts`
- Create: `frontend/tests/responsive-accessibility.spec.ts`
- Create: `frontend/scripts/check-sensitive-data.mjs`
- Create: `frontend/scripts/check-sensitive-data.test.ts`
- Create: `frontend/docs/OPERATIONS.md`
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: all completed routes and environment-supplied real API/auth state.
- Produces: critical-route, responsive, keyboard, sensitive-data, bundle-report, and operational checks.

- [ ] **Step 1: Test the sensitive-data scanner before implementation**

Feed controlled safe and prohibited artifacts to the script and assert non-zero exit for tokens, raw CV text markers, signed URLs, prompts, passwords, and private notes.

- [ ] **Step 2: Implement and run the scanner**

```powershell
npm.cmd run test:unit -- scripts/check-sensitive-data.test.ts
npm.cmd run security:frontend
```

- [ ] **Step 3: Implement browser matrices**

Use configured `PLAYWRIGHT_BASE_URL`; never visit third-party demo sites. Cover guest routes plus role journeys only when `E2E_CANDIDATE_*`, `E2E_HR_*`, and `E2E_ADMIN_*` credentials are supplied. Record a skip as missing live evidence, not a pass.

- [ ] **Step 4: Harden semantic theme and shell**

Remove decorative glass/gradient treatments that conflict with the approved evidence-first direction, add dark semantic tokens, visible 3px focus, reduced-motion overrides, safe-area spacing, minimum targets, and mobile navigation disclosure.

- [ ] **Step 5: Add bundle reporting and operational runbook**

Report emitted chunk sizes without claiming an unapproved budget. Document bad deploy, chunk failure, API outage, auth loop, telemetry outage, and rollback procedures using environment-neutral variables.

- [ ] **Step 6: Run available Phase 7 gates**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run security:frontend
npm.cmd run test:e2e
```

Expected: local automated gates pass where dependencies exist; browser installation, backend, credentials, CSP topology, telemetry provider, performance budgets, screen-reader acceptance, and release tagging remain explicit blockers when absent.

### Task 12: Verify evidence and update frontend records

**Files:**
- Modify: `frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`
- Modify: `frontend/ISSUES-LIST-TRACKING.md`
- Modify: `CHANGELOG.md`
- Modify: this plan file

**Interfaces:**
- Consumes: command output and task-specific evidence from Tasks 1–11.
- Produces: truthful task checkboxes, phase status, blockers, activity entries, and changelog notes.

- [ ] **Step 1: Run the cumulative verification commands**

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:unit
npm.cmd run build
npm.cmd run security:frontend
```

- [ ] **Step 2: Map evidence to each FE-5/6/7 tracker item**

Check only items whose entire stated evidence passed. Mark implemented-but-not-live tasks in the activity log without checking them. Keep `FE-5-003`, policy-dependent `FE-5-013/014`, admin discovery/application tasks, live integration tasks, manual acceptance, production topology, localization, performance-budget, release checklist, and release-tag tasks unchecked until their dependencies exist.

- [ ] **Step 3: Repair tracker encoding only after preserving semantic content**

Write the file as UTF-8 without BOM and verify legitimate characters such as `§`, smart quotes, and arrows remain intact.

- [ ] **Step 4: Update changelog and issue activity**

Record new user-visible frontend capabilities, security/redaction behavior, verification results, and exact blockers. Do not change backend tracking files.

- [ ] **Step 5: Review the final diff**

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; unrelated pre-existing files remain unstaged and unmodified by this work.
