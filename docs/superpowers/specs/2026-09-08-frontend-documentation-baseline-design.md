# Frontend Documentation Baseline Design

## Status and scope

This design defines the frontend execution documentation for the planned ITZiec
React + Vite client. It updates documentation only; it does not scaffold or
claim implementation of a runtime frontend.

The controlling inputs are `PROJECT-DETAIL.md`, `API-CONTRACT.md`, and
`backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`. The backend tracker is
used to expose dependencies and readiness constraints, not to imply that any
backend endpoint currently exists.

## Chosen approach

Use a contract-driven frontend backlog aligned with backend capability phases,
plus a cross-cutting enterprise design-system workstream. This is preferred over
a short feature checklist because every frontend deliverable needs a stable ID,
an API or requirement reference, prerequisites, and objective verification
evidence.

The documentation has three responsibilities:

- `frontend/CLAUDE.md` defines frontend architecture, engineering constraints,
  state ownership, security, accessibility, testing, and enterprise UI rules.
- `frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` defines the complete
  phased work breakdown, dependency graph, evidence requirements, and activity
  log.
- `frontend/ISSUES-LIST-TRACKING.md` records frontend decisions and blockers
  without hiding unresolved contract or product questions in task descriptions.

## Architecture direction

The planned frontend is a strict TypeScript React + Vite single-page client.
It will use feature-oriented boundaries under `src/app`, `src/features`,
`src/shared`, and `src/api`. Components never call HTTP directly. A typed API
layer owns envelopes, authentication retries, errors, idempotency keys,
optimistic concurrency, cursor pagination, and request cancellation.

Remote server state belongs in a query/cache layer. URL-shareable search and
filter state belongs in the router. Form state and transient presentation state
remain local to their feature. Authentication uses in-memory access-token state
and the backend-managed refresh cookie; sensitive values are not persisted or
logged.

Role-aware route groups cover public discovery, candidate workflows, recruiter
workspaces, and administration. Authorization remains enforced by the backend;
the client only improves navigation and disclosure.

## Enterprise UI direction

The UI should feel credible, information-dense, and calm rather than decorative.
The documentation will require:

- semantic design tokens for color, typography, spacing, radius, elevation,
  motion, focus, and responsive density;
- reusable primitives for forms, feedback, overlays, navigation, data tables,
  filters, timelines, status badges, and skeletons;
- clear hierarchy for high-density recruiter and admin workspaces;
- restrained motion with reduced-motion support;
- keyboard-complete interaction, visible focus, accessible names, error
  summaries, and contrast meeting WCAG 2.2 AA;
- responsive layouts that preserve task completion on small screens instead of
  merely shrinking desktop tables;
- complete loading, empty, error, unauthorized, forbidden, stale/conflict,
  offline, and retry states for every remote surface.

AI scores and recommendations must show provenance, limitations, component
evidence, and advisory wording. They must never visually imply an automatic
hiring decision.

## Phase model

The frontend tracker will use eight phases:

1. Documentation and product mapping.
2. Platform foundation and enterprise design system.
3. Identity, profiles, companies, and CV management.
4. Job discovery, saved jobs, and recruiter job management.
5. Applications, recruiter pipeline, and interviews.
6. Notifications, asynchronous operations, and AI assistance.
7. Administration, audit, and operational views.
8. Accessibility, performance, security, E2E, and release hardening.

Phase numbering will remain frontend-owned even where backend prerequisites map
to different backend phases. Each task records exact requirement IDs, API IDs or
contract sections, dependencies, and acceptance evidence.

## Data and workflow rules

The tracker will explicitly cover the complete user journeys:

- guest job discovery, registration, login, refresh, and recovery from expired
  access tokens;
- candidate profile completion, skill and experience editing, private CV
  upload/status/default/download/delete behavior, and saved jobs;
- recruiter company context, job drafting/publishing/lifecycle management,
  applicant pipeline transitions, interview scheduling, and private feedback;
- candidate application submission/history, interview visibility, and
  notifications;
- asynchronous operation polling and safe AI match/gap/recommendation views;
- admin moderation and redacted audit exploration.

Optimistic-concurrency conflicts receive a first-class recovery state. Mutating
requests that require idempotency use stable request-scoped keys. Cursor lists
preserve deterministic ordering, and search/filter state is encoded in the URL
when sharing or browser navigation is useful.

## Error handling and security

The client branches on contract error `code`, uses `message` only as safe
display fallback, and retains `requestId` for support. It must not render
unsanitized job, CV, recruiter-note, or AI content as HTML.

Access tokens, refresh tokens, raw CV text, private notes, signed URLs, and
sensitive AI inputs are excluded from persistent browser storage, telemetry,
error reports, fixtures, and snapshots. Signed download URLs are requested only
at the point of use and are not cached.

## Verification strategy

No task is marked done for documentation or compilation alone when it describes
runtime behavior. Planned evidence includes:

- contract fixture and API-client unit tests;
- reducer/state-machine and validation tests for important business states;
- component interaction and accessibility tests;
- Mock Service Worker scenarios for success and failure states;
- Playwright journeys for guest, candidate, recruiter, and admin roles;
- visual regression at agreed desktop and mobile viewports;
- build, lint, strict type-check, unit coverage, bundle budgets, Lighthouse or
  equivalent performance checks, and accessibility automation;
- targeted manual verification for keyboard navigation, screen-reader
  announcements, responsive task completion, and enterprise visual consistency.

## Documentation consistency rules

- The frontend tracker must state that runtime implementation has not started.
- Proposed backend endpoints must be labelled as contract changes or decisions,
  not consumed as available APIs.
- Backend task IDs may be referenced as prerequisites, never copied as frontend
  completion evidence.
- Unresolved frontend choices are tracked with stable `FEI-*` IDs.
- The three frontend files must use UTF-8, consistent status vocabulary, and
  valid relative links.

## Out of scope

- Creating React source files, package manifests, tests, mock handlers, or CI.
- Changing HTTP schemas or adding endpoints to `API-CONTRACT.md`.
- Marking any frontend or backend runtime feature implemented.
- Defining final brand assets or producing high-fidelity screens.
