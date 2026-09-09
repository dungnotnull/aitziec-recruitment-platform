# Frontend Phases 5–7 Design

**Date:** 2026-09-09  
**Status:** Approved for implementation planning  
**Contract baseline:** `API-CONTRACT.md` version `0.1.0-draft`

## Objective

Implement the frontend scope in Phases 5, 6, and 7 as contract-first vertical
slices. Runtime and development builds must use real `/api/v1` HTTP endpoints;
they must not contain mock responses, fabricated fallback records, or seeded
feature data. Contract-derived MSW fixtures are permitted only in automated
tests, as explicitly approved by the user.

Completion remains evidence-based. A tracker checkbox may be checked only when
the task's stated acceptance evidence exists and passes. A missing backend,
unapproved contract, deployment decision, or manual acceptance environment is a
blocker, not permission to weaken evidence or invent an endpoint.

## Scope and Delivery Strategy

Delivery uses vertical slices in this order:

1. Phase 5: notifications, asynchronous operations, and AI assistance.
2. Phase 6: administration and audit.
3. Phase 7: cross-role release hardening.

Each feature slice includes contract types, an API module, TanStack Query hooks,
route integration, accessible UI states, and focused tests before moving to the
next slice. Existing Phase 1–4 code is reused through its public interfaces.
Earlier-phase code may be repaired only where a Phase 5–7 feature directly
depends on it; unrelated redesign or backend implementation is out of scope.

## Runtime Architecture

New code follows the existing feature-oriented structure:

```text
frontend/src/
  api/                     shared contract types and HTTP transport
  app/routes/              lazy, role-aware route entry points
  features/
    notifications/         list, filters, resource navigation, read state
    operations/            bounded asynchronous-operation polling
    ai-assistance/         analysis, natural-language search, recommendations
    admin/                 route boundary and moderation workflows
    audit/                 audit filters, list, and safe detail projection
  shared/
    lib/                   formatting, redaction, and framework-neutral helpers
    ui/                    reusable accessible primitives
```

Routes render feature entry components and do not issue HTTP requests directly.
Feature API modules are the only feature-level callers of `apiClient`. Query
hooks own remote state, cancellation, cache keys, retries, invalidation, and
optimistic rollback. Shareable filters and selected records are URL-owned where
deep linking is safe. Forms use React Hook Form and Zod for client validation,
while server error codes remain authoritative.

No runtime code imports test handlers, test fixtures, or `mockServiceWorker.js`.
The frontend displays a truthful error/retry state when a real endpoint is
unavailable. It never silently substitutes local records.

## Phase 5 Design

### Notifications

The authenticated notification center calls `GET /notifications` with a
read-state filter and cursor. It groups notifications by localized date,
preserves cursor order, provides empty/loading/error/refresh states, and maps
known resource types to existing safe routes. Unknown resource types remain
readable without producing an unsafe link.

Read/unread changes call `PATCH /notifications/:notificationId/read`. The UI
updates optimistically, prevents duplicate submissions for the same record, and
rolls back on failure. Both the notification list and any detail-derived cache
are synchronized after success.

`FE-5-003` remains blocked by `FEI-011`: there is no contracted unread-summary
endpoint or count field. The shell may provide a notification navigation item,
but it must not derive a misleading global numeric badge by exhausting cursor
pages or aggressive polling.

### Asynchronous Operations

The generic operation tracker calls `GET /operations/:operationId`. Polling is
active only for non-terminal statuses, pauses while the document is hidden, and
stops on success, failure, timeout, unmount, or query cancellation. Only
meaningful state transitions are announced through a restrained live region.
The tracker shows progress when supplied, never fabricates a percentage, and
provides error-specific retry guidance without automatically repeating a
mutation.

CV processing integrates this tracker through the operation returned by upload.
The operation identifier is retained in safe route/query state so processing can
be understood after navigation or refresh; sensitive CV content is never
persisted.

### AI Analysis

The CV-to-job action requires an owned CV and a selected job, displays a privacy
notice, creates one stable idempotency key per user action, and calls
`POST /ai/cv-job-analyses`. A `202` response enters the operation tracker. When
the operation succeeds, its result resource leads to
`GET /ai/analyses/:analysisId`.

The result surface presents the overall score and score components as bounded
numbers with textual labels, weights, evidence, matched skills, missing skills,
unmet requirements, suggestions, limitations, and model/prompt/schema
provenance. Missing evidence is distinguished from an absent skill. All text is
rendered as text, never unsanitized HTML. Persistent copy states that output is
advisory and cannot decide or change an application status.

AI components have no dependency on application transition mutations. An
architecture test enforces this boundary, and browser tests verify that no AI
action exposes pass/reject controls.

Natural-language search sends the user's text to `POST /jobs/search/parse`,
preserves it across recoverable errors, previews the returned structured
filters, and applies only user-confirmed filters to the existing job-search URL.
Recommendations call `GET /recommendations/jobs`, expose server-provided reason
codes and exclusions, support cursors and existing save-job behavior, and show a
truthful cold-start or empty state.

Recommendation consent and provider privacy behavior in `FE-5-013` and the
policy-dependent portions of `FE-5-014` remain blocked by `FEI-013`. The client
must not invent consent persistence, retention promises, provider settings, or
an opt-out endpoint. Contracted technical failures can still receive safe,
non-speculative messages.

## Phase 6 Design

The admin route boundary checks the authenticated role for navigation UX and
lazy-loads the admin workspace. Backend authorization remains authoritative;
direct denial shows scoped guidance and never reveals whether a private target
exists.

User administration calls `GET /admin/users` with URL-backed typed filters and
cursor state. It uses a dense accessible table on wide screens and labeled cards
on narrow screens. Status moderation calls
`PATCH /admin/users/:userId/status` only after the admin supplies a reason and
confirms the target, desired status, and session consequence.

Company and job moderation commands use the contracted endpoints
`PATCH /admin/companies/:companyId/status` and
`POST /admin/jobs/:jobId/moderate`, including `expectedVersion` and mandatory
reason. Conflict responses preserve input and offer a reload path. However,
`FE-6-004`, `FE-6-006`, and their dependent verification cannot be completed
until `FEI-014` supplies approved admin discovery/read paths. Public lists must
not be repurposed to expose draft, private, or moderation-only data.

Application administration in `FE-6-008` remains blocked by `FEI-014` because
the product behavior and endpoints are not defined. No placeholder action is
rendered.

The audit explorer calls `GET /admin/audit-logs` with actor, action, target, UTC
time, and cursor filters reflected in the URL. Its detail drawer renders the
contracted identity fields and a recursively sanitized metadata projection.
Metadata display follows a conservative allow-list; tokens, credentials, raw CV
text, signed URLs, prompts, private notes, and unknown sensitive values are
omitted. The drawer has a name, keyboard dismissal, predictable focus restore,
and a non-color-only status presentation.

## Phase 7 Design

Phase 7 adds executable quality gates rather than feature-shaped placeholders:

- Playwright journeys target a configured real frontend and API for live
  verification; isolated browser tests may use test-only MSW fixtures.
- Automated accessibility coverage uses role/label-based interaction and axe
  checks, supplemented by documented keyboard, screen-reader, zoom, reflow, and
  target-size matrices where manual evidence is required.
- Responsive checks cover `320`, `375`, `414`, `768`, `1024`, and `1440` CSS
  pixels and guard against unintended horizontal overflow.
- Production builds report initial, shared, and route chunks. Budgets are not
  declared verified until `FEI-016` defines approved thresholds.
- Network checks verify parallel independent requests, canceled obsolete
  searches/polls, and absence of duplicate hidden fetches.
- Security checks cover refresh behavior, cache clearing, forbidden persistence,
  sensitive-data scans, safe history, and dependency review.
- CSP, telemetry integration, deployment topology, source maps, rollback, and
  release tagging remain gated by `FEI-003` and `FEI-015` until their production
  values and providers are approved.
- Localization completion remains gated by `FEI-012`; meanwhile copy stays
  extractable and date/time/currency formatting uses locale-aware utilities.

The operational runbook documents bad deployment, chunk load failure, API
outage, authentication loop, telemetry outage, and rollback procedures. A final
release checkbox or semantic tag is not produced until all upstream evidence is
available and the working tree represents the intended immutable artifact.

## Error and State Model

Every new remote surface deliberately handles initial loading, background
refresh, empty, validation failure, recoverable failure, unauthorized,
forbidden, not found, offline/timeout, stale conflict, rate limit, and success
where applicable. Error codes drive behavior; safe backend messages are fallback
copy. Request identifiers remain visible for support correlation.

Mutations lock only the affected action, preserve user input, and prevent
duplicate submission. Destructive or high-impact actions require explicit
confirmation. Background refresh never replaces usable content with a full-page
spinner.

## Accessibility and Visual Design

The existing calm “trust and evidence” system remains authoritative. New pages
use semantic theme tokens, Plus Jakarta Sans headings, Inter body text, IBM Plex
Mono identifiers/numeric evidence, Lucide icons, and the evidence rail only for
ordered/provenance content. AI does not receive decorative purple gradients,
and moderation actions do not share ordinary primary-action styling.

Native controls are preferred. Inputs retain visible labels, tables have an
accessible name, dialogs restore focus, async changes are announced once, and
status is never communicated by color alone. Touch targets remain at least
44×44 CSS pixels and content reflows at 320 CSS pixels and 200% zoom.

## Testing Strategy

Implementation follows red-green-refactor for each behavior. Unit tests cover
pure URL mapping, redaction, resource-link resolution, polling termination, and
error classification. API tests verify exact paths, query/body shapes,
idempotency, `expectedVersion`, envelopes, and cancellation. Component tests
exercise user-visible remote states and accessibility. Architecture tests guard
feature boundaries and prevent AI-to-pipeline mutation coupling.

MSW and contract-derived fixtures are confined to test configuration. They test
success, denial, conflict, validation, rate limit, timeout, malformed response,
and privacy cases without becoming application data. Live-integration evidence
uses the configured real API and is recorded separately from isolated tests.

Verification is proportional and cumulative: focused tests first, then strict
type-check, lint, full unit/component suite, production build, browser journeys,
accessibility checks, and relevant security/performance audits.

## Tracker and Documentation Rules

Only verified work changes `[ ]` to `[x]`. Implemented frontend code awaiting a
backend or environment keeps its checkbox unchecked and receives an activity
entry stating `Implemented` or `Blocked`, the exact evidence available, and the
next action. Phase status is derived from its tasks rather than declared
optimistically.

User-visible behavior, security controls, and verified milestone changes update
`CHANGELOG.md`. New blockers or discovered contract mismatches update
`frontend/ISSUES-LIST-TRACKING.md`. Backend source and backend trackers are not
modified.

## Explicit Non-Goals

- Implementing or modifying backend endpoints.
- Inventing API routes, fields, consent semantics, privacy guarantees, or
  production infrastructure values.
- Shipping runtime mock data or enabling the service worker outside tests.
- Marking live integration, manual acceptance, release, or tag tasks complete
  without their stated evidence.
- Refactoring unrelated Phase 1–4 features.

