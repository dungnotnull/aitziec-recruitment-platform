# Frontend–Backend Contract Mapping Design

**Date:** 2026-09-10

**Status:** Approved for planning

**Scope:** Frontend implementation and frontend-owned documentation only

## Objective

Map every frontend API consumer and critical user journey to the backend implementation merged in commit `d327eed`, remove transport mismatches, and verify the browser application against real `/api/v1` responses. Runtime code must never install a mock worker, return fallback records, fabricate identifiers, or infer fields that the backend did not return.

The backend controllers, DTOs, response interceptor, exception filter, and Swagger document are the operational source of truth. `API-CONTRACT.md` remains a compatibility reference. When backend code and the written contract disagree, the frontend adapts only to behavior the backend actually exposes and records the drift instead of silently inventing an endpoint or payload.

## Current Findings

The initial source audit found concrete mismatches that explain why frontend release tasks could not be marked complete:

- The frontend calls `GET /companies/mine`, but `CompaniesController` exposes no company-membership discovery route.
- Notification responses expose `userId`, `resourceType`, and `resourceId`; the frontend expects a nested `resource` object.
- Audit queries accept `startDate` and `endDate`; the frontend currently sends `occurredAfter` and `occurredBefore`.
- Audit `actorId` and `requestId` are nullable in the backend DTO but required strings in the frontend.
- AI component weights are coefficients from `0.0` to `1.0`; the frontend currently renders them as percentages without conversion.
- The backend AI type includes `CV_JOB_ANALYSIS`, and job experience levels include `FRESHER`; both are absent from frontend unions.
- Admin company/job moderation commands exist, but the backend exposes no admin company/job discovery collection and no application-administration endpoint.

These are mapping defects or explicit API gaps, not reasons to introduce mock data.

## Chosen Architecture

### 1. Transport DTOs and domain view models

Each frontend feature API module owns the backend transport shape it consumes. Where the backend response shape is unsuitable for UI use, a small pure adapter converts it to an existing frontend domain model. For example, notification transport fields `resourceType` and `resourceId` become a nullable domain `resource` value in one tested boundary function.

Adapters must be lossless for fields the UI is authorized to use. They must not add display reasons, counts, status transitions, company ownership, recommendation explanations, or privacy state that the response does not contain.

### 2. Runtime response validation

Critical response boundaries use Zod schemas for backend envelopes and DTOs. A malformed response becomes a classified, recoverable frontend error carrying the backend request ID when available. Validation failures never log the full payload because CV, candidate, application, AI, and audit responses may contain sensitive data.

Schemas are grouped by domain rather than placed in one global file so a route does not load unrelated validation code.

### 3. Endpoint inventory and drift verification

A frontend-owned contract verification script fetches the real NestJS Swagger JSON endpoint and compares method/path pairs required by frontend modules. It reports:

- missing backend endpoints consumed by the frontend;
- frontend consumers not represented in the approved inventory;
- query or DTO differences covered by explicit adapter tests;
- known backend gaps that must remain disabled or blocked in the UI.

The script has no runtime role and does not generate fake responses. If a live backend URL is unavailable, static unit/type/build checks can pass, but live-integration tracker tasks remain open.

### 4. Query and mutation behavior

TanStack Query remains the owner of server state. Query keys include all effective backend filters. Independent requests start together; obsolete search and operation requests receive abort signals. Mutations are never silently retried. Successful mutations update or invalidate only role-scoped resources, while logout and terminal refresh failure clear authenticated caches.

Optimistic updates are permitted only where the backend command is idempotent or the frontend has a complete rollback snapshot. Concurrency commands always send `expectedVersion` from the latest real response.

### 5. Missing endpoint behavior

Frontend-only work cannot create backend capabilities. A feature whose target cannot be discovered through an existing authorized response must not add free-form ID entry, scrape another projection, or reuse public data as an authorization substitute.

Specifically:

- recruiter company refresh-safe discovery remains blocked while `/companies/mine` or an equivalent membership projection is absent;
- admin company/job lookup and application administration remain blocked while collection/detail routes are absent;
- existing command adapters may remain tested but must not be made discoverable without an authorized target source.

The tracker records these as backend implementation gaps even if the backend phase document says Phase 7 is complete.

## Domain Mapping Order

1. **Platform and authentication:** envelopes, error codes, refresh behavior, nullable metadata, and Swagger endpoint inventory.
2. **Candidate and company:** profile DTOs, skill/experience payloads, company create/update/member behavior, and the missing membership-discovery decision.
3. **Jobs and saved jobs:** `FRESHER`, array query serialization, lifecycle commands, pagination, and public detail routes.
4. **Applications, CVs, and interviews:** exact create/transition payloads, upload response, signed downloads, private-field visibility, and concurrency.
5. **Notifications and operations:** notification transport adapter, resource links, operation state, polling, and terminal failures.
6. **AI and recommendations:** analysis type union, coefficient display, operation-to-analysis handoff, advisory semantics, and server-owned recommendation data.
7. **Administration and audit:** nullable identifiers, date query mapping, redaction, user moderation, and undiscoverable company/job command handling.
8. **Release verification:** real backend smoke journeys, browser/accessibility matrices, bundle and sensitive-data scans, contract drift report, documentation, and tracker reconciliation.

## Real-API Verification

Verification uses an actual backend process and database configured for a disposable test environment. Candidate and HR accounts are created through the real registration API with unique test identities. Subsequent profile, company, job, CV, application, interview, notification, operation, and AI actions use IDs returned by earlier real API calls.

Admin journeys require an environment-provided real admin account because public registration correctly cannot create administrators. AI live tests require the configured provider or a backend-supported deterministic test provider; the frontend will not intercept those requests. Missing credentials, unavailable infrastructure, or a skipped test is recorded as missing evidence rather than a pass.

Test artifacts may include a valid non-sensitive PDF specifically created for the test environment, but application runtime and production bundles contain no mock data or service worker.

## Error and Privacy Handling

- Preserve backend `error.code`, `message`, `details`, `requestId`, and rate-limit headers.
- Map validation fields to accessible form summaries without echoing secret values.
- Never persist access tokens, CV contents, AI prompts, signed URLs, recruiter-private notes, or audit payloads in local storage.
- Redact audit metadata through the conservative allowlist before rendering.
- Show unavailable or contract-drift states truthfully; never substitute generated records.
- AI output stays advisory and has no import path or callback into application transition mutations.

## Testing Strategy

Implementation follows red–green–refactor per domain:

- pure adapter/schema tests cover every discovered DTO mismatch;
- API request tests cover exact method, path, query serialization, headers, and body;
- component tests cover loading, empty, malformed, denial, conflict, retry, and privacy behavior;
- contract verification checks required endpoints against live Swagger JSON;
- Playwright drives real guest, candidate, HR, and admin journeys when the required environment is available;
- axe, keyboard, reflow, dark theme, supported browsers, production build, dependency audit, and sensitive-data scans form the final frontend gates.

Test doubles are allowed only for focused unit isolation and never as runtime or live-integration evidence. A task is checked in the frontend tracker only when its frontend implementation and stated local evidence pass. Explicit live-integration and release tasks require actual backend/environment evidence.

## Completion and Git Scope

The final change updates frontend source, frontend tests/scripts, frontend documentation, and `frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`. Backend files are read-only and excluded from commits. Existing helper files `frontend/fix.cjs` and `frontend/fix-checks.cjs` remain untouched and untracked.

Completion requires:

- all mapped frontend unit tests, typecheck, lint, build, and security scans pass;
- the live contract report contains no unexplained consumer drift;
- every feasible real-API journey passes in available browsers;
- unresolved backend endpoints or production-policy dependencies are listed precisely;
- completed frontend tasks are marked `[x]`, while incomplete live/release tasks remain `[ ]`;
- commits are pushed to `origin/frontend` without including backend changes.
