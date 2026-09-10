# Frontend Issues and Decisions Register

## Purpose

This frontend-owned register tracks reproducible defects, contract mismatches,
accessibility or enterprise UI risks, and unresolved decisions that block or
materially change frontend delivery. Feature work belongs in
`DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`.

The frontend runtime now exists. Records below distinguish implemented contract
resolutions from product, privacy, deployment, and backend blockers.

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| Open | Confirmed issue or decision with no active resolution |
| In progress | An owner is actively producing the decision, contract, or fix |
| Blocked | Resolution requires unavailable authority or prerequisite evidence |
| Fixed | The change exists but original reproduction/acceptance is not fully verified |
| Verified | Resolution criteria and regression checks pass |
| Deferred | Intentionally excluded from the active release with documented impact |
| Won't fix | Deliberately accepted with owner, rationale, and residual risk |

## Severity Vocabulary

| Severity | Meaning |
| --- | --- |
| Critical | Can expose sensitive data, break authorization, or prevent release |
| High | Blocks a critical user journey or creates major contract/accessibility risk |
| Medium | Blocks a feature subset or materially degrades enterprise UX/operations |
| Low | Limited impact with a safe workaround and no security or data-integrity risk |

## Issue Record Requirements

Every record includes status, severity, origin, impacted surface, linked backend
issue or contract section, concrete impact, a temporary planning assumption,
resolution criteria, affected frontend tasks, owner, and activity. Do not close
an issue because a choice was discussed; attach the contract, implementation,
test, design review, or environment evidence required by its criteria.

## Issue Register

### FEI-001 — Exact frontend runtime and package versions are not pinned

- Status: Open
- Severity: Medium
- Found: 2026-09-08
- Area/route: Platform foundation
- Contract version: `0.1.0-draft`
- Related backend issue: None
- Impact: Clean-checkout reproducibility, browser support, React/Vite behavior,
  security scanning, and CI evidence cannot be finalized without exact versions.
- Current planning assumption: Use React 19, current stable Vite, strict
  TypeScript, Tailwind CSS v4, TanStack Router/Query, React Hook Form + Zod,
  Radix primitives, Lucide, Vitest, Testing Library, MSW, Storybook, axe-core,
  and Playwright. Pin exact compatible versions during `FE-1-001`.
- Resolution criteria: Commit runtime/package-manager version files and lockfile;
  document supported browsers; prove clean install, type-check, tests, Storybook,
  and production build in CI.
- Affected tasks: FE-1-001–002, FE-1-014–018, FE-1-028–029, FE-7-020, FE-7-024
- Owner: Frontend lead
- Next action: Resolve in the first Phase 1 scaffold change.

### FEI-002 — Final brand assets and visual identity approval are unavailable

- Status: Open
- Severity: Medium
- Found: 2026-09-08
- Area/route: Global design system and public/recruiter/admin shells
- Contract version: `0.1.0-draft`
- Related backend issue: None
- Impact: Logo, product illustration, favicon, final font licensing/hosting, and
  visual-regression baselines cannot receive brand approval.
- Current planning assumption: Use the documented trust-and-evidence direction:
  ink/slate surfaces, blue action color, Plus Jakarta Sans headings, Inter body,
  IBM Plex Mono utility text, restrained motion, and the evidence rail as the
  signature component. Avoid generic AI purple/pink gradients and decorative
  glass effects.
- Resolution criteria: Approve logo/assets, font delivery, light/dark palettes,
  semantic status colors, evidence-rail usage, and representative desktop/mobile
  compositions with WCAG 2.2 AA contrast evidence.
- Affected tasks: FE-1-018–025, FE-3-001, FE-7-010–011, FE-7-026
- Owner: Product/design
- Next action: Review Storybook foundations before feature-page visual baselines.

### FEI-003 — Refresh-cookie origin and CSRF deployment assumptions are unresolved

- Status: Open
- Severity: Critical
- Found: 2026-09-08
- Area/route: Authentication, API transport, production deployment
- Contract version: `0.1.0-draft`
- Related backend issue: `BEI-005`
- Impact: Refresh credentials, `SameSite`, `Secure`, CORS, credential mode, CSRF
  defense, Content Security Policy, and local/production origins cannot be
  verified as a coherent browser security model.
- Current planning assumption: Keep access tokens in memory; use the
  backend-managed `HttpOnly` refresh cookie only for refresh/logout; send
  credentials only to the configured API origin; allow-list return URLs; never
  persist tokens. Do not finalize production auth integration until deployment
  topology and CSRF controls are approved.
- Resolution criteria: Approve local/staging/production origin topology, cookie
  attributes, CORS policy, CSRF mechanism, credentialed requests, CSP, and threat
  tests; update `API-CONTRACT.md` if browser-visible behavior changes.
- Affected tasks: FE-1-004, FE-1-009–010, FE-2-001–006, FE-7-016, FE-7-018, FE-7-023
- Owner: Backend/security and frontend leads
- Next action: Coordinate with `BEI-005` before live authentication verification.

### FEI-004 — Canonical skill catalog APIs are not approved in the contract

- Status: Open
- Severity: High
- Found: 2026-09-08
- Area/route: Candidate profile and recruiter job editor
- Contract version: `0.1.0-draft`
- Related backend APIs: `API-SKILL-001–005`
- Impact: The frontend cannot implement contract-safe skill search,
  normalization, aliases, inactive values, or admin catalog management.
- Current planning assumption: Design a typed searchable combobox against MSW
  only after `GET /skills` response/query behavior is approved. Do not accept
  arbitrary skill strings or invent an endpoint in feature code.
- Resolution criteria: Approve read access, query/pagination shape, skill DTO,
  alias/inactive behavior, and any admin operations in `API-CONTRACT.md`; verify
  backend contract tests and regenerate frontend fixtures.
- Affected tasks: FE-2-009, FE-3-016, FE-6-001–013
- Owner: Product/backend contract owners
- Next action: Resolve backend `API-SKILL-001` at minimum before profile editor integration.

### FEI-005 — Recruiter company discovery API is missing from the contract

- Status: Open
- Severity: High
- Found: 2026-09-08
- Area/route: Recruiter onboarding and active-company switcher
- Contract version: `0.1.0-draft`
- Related backend API: `API-COMP-007` proposed `GET /companies/mine`
- Impact: An authenticated HR user has no contracted way to discover their
  memberships and select the company scope required by recruiter routes.
- Current planning assumption: Plan an active-company model and switcher but do
  not call the proposed endpoint until its projection, role fields, status, and
  pagination are contracted.
- Resolution criteria: Add and approve the endpoint or an equivalent discovery
  flow in `API-CONTRACT.md`; verify owner/member/suspended/empty behavior and
  frontend cache isolation between companies.
- Affected tasks: FE-2-013–019, FE-3-013–023, FE-4-008–021
- Owner: Product/backend contract owners
- Next action: Promote `API-COMP-007` through the contract-change protocol.

### FEI-006 — Recruiter company-job list API is missing from the contract

- Status: Open
- Severity: High
- Found: 2026-09-08
- Area/route: Recruiter job workspace
- Contract version: `0.1.0-draft`
- Related backend API: `API-JOB-009` proposed `GET /companies/:companyId/jobs`
- Impact: Public `GET /jobs` intentionally hides draft, unpublished, closed, and
  expired jobs, so it cannot power recruiter job management.
- Current planning assumption: Build the route and states against a proposed
  contract fixture only after status filters, sort, cursor, scoped projection,
  and moderation fields are approved.
- Resolution criteria: Contract and verify a company-scoped job management list
  that includes every lifecycle state without weakening public job visibility.
- Affected tasks: FE-3-013–023, FE-4-008–009
- Owner: Product/backend contract owners
- Next action: Promote `API-JOB-009` before recruiter workspace integration.

### FEI-007 — Failed CV-processing retry API is not contracted

- Status: Open
- Severity: Medium
- Found: 2026-09-08
- Area/route: Candidate CV library
- Contract version: `0.1.0-draft`
- Related backend API: `API-CV-007` proposed
- Impact: `CV-004` requires visible retry-safe failure handling, but the client
  has no approved action for retrying a failed extraction.
- Current planning assumption: Show failure reason and support guidance; expose a
  retry action only in MSW design fixtures and keep it disabled in live mode.
- Resolution criteria: Contract eligible statuses, idempotency, authorization,
  operation response, retry limits, and error codes; verify backend and frontend
  retry/polling tests.
- Affected tasks: FE-2-022, FE-2-026, FE-5-004–005
- Owner: Backend contract owner
- Next action: Promote `API-CV-007` before Phase 2 live CV verification.

### FEI-008 — Early application rejection conflicts with the baseline state machine

- Status: Open
- Severity: High
- Found: 2026-09-08
- Area/route: Recruiter applicant pipeline
- Contract version: `0.1.0-draft`
- Related backend issue: `BEI-001`
- Impact: The exact baseline permits rejection only from `INTERVIEWING`; common
  recruiter expectations may include rejection from `APPLIED` or `REVIEWING`.
- Current planning assumption: Render only
  `APPLIED → REVIEWING → INTERVIEWING → PASSED | REJECTED`. Do not add disabled,
  hidden, drag-based, or optimistic shortcuts for uncontracted transitions.
- Resolution criteria: Product explicitly keeps or changes the state machine;
  contract, backend tests, UI controls, copy, fixtures, and E2E tests agree.
- Affected tasks: FE-4-011–015, FE-4-022–024, FE-7-003
- Owner: Product owner
- Next action: Resolve with `BEI-001` before final recruiter workflow approval.

### FEI-009 — Submitted-CV deletion and retention behavior is undefined

- Status: Open
- Severity: Critical
- Found: 2026-09-08
- Area/route: CV deletion, application history, recruiter access
- Contract version: `0.1.0-draft`
- Related backend issue: `BEI-002`
- Impact: The frontend cannot accurately explain whether deletion is blocked,
  soft-deletes candidate access, preserves an application snapshot, or removes
  a signed-download path after the CV has been submitted.
- Current planning assumption: Do not promise permanent deletion or expose a
  destructive action for a submitted/default CV until policy is approved. Keep
  the CV private and avoid local copies.
- Resolution criteria: Approve per-state retention and access behavior, legal or
  audit exceptions, cleanup timing, user copy, endpoint errors, and E2E privacy
  tests; update the contract when HTTP behavior changes.
- Affected tasks: FE-2-020, FE-2-025, FE-4-002–010, FE-7-017
- Owner: Product/privacy/backend owners
- Next action: Resolve with `BEI-002` before CV deletion implementation.

### FEI-010 — Direct interview-detail endpoint is implemented

- Status: Fixed
- Severity: Medium
- Found: 2026-09-08
- Area/route: Interview deep links and notification destinations
- Contract version: `0.1.0-draft`
- Related backend API: `API-INT-006` proposed
- Impact: A notification cannot reliably deep-link to one interview without
  loading and searching the application interview collection.
- Current implementation: Notifications deep-link to the implemented
  `GET /interviews/:interviewId` route; the backend remains responsible for
  candidate/recruiter projection and authorization.
- Resolution criteria: Approve direct-detail authorization/projection and
  not-found behavior, or explicitly standardize parent-collection navigation;
  update notification link fixtures accordingly.
- Affected tasks: FE-4-016–021, FE-5-001
- Owner: Product/backend contract owners
- Next action: Exercise candidate and recruiter deep links when real role credentials and a migrated backend database are available.

### FEI-011 — Global notification unread summary is supplied in collection metadata

- Status: Fixed
- Severity: Medium
- Found: 2026-09-08
- Area/route: Global application shell and notification center
- Contract version: `0.1.0-draft`
- Related backend APIs: `API-NOTIF-001–002`
- Impact: A persistent unread badge may require fetching collection pages,
  polling too aggressively, or presenting an inaccurate count.
- Current implementation: The shell consumes backend `meta.unreadCount` with a
  shared query, a 60-second interval, `99+` visual cap, and polite accessible copy.
- Resolution criteria: Approve summary/count field or endpoint, cache/polling or
  push behavior, maximum displayed count, read synchronization, and accessible
  announcement rules.
- Affected tasks: FE-1-024, FE-5-001–003, FE-5-016–018
- Owner: Product/backend/frontend leads
- Next action: Verify live count changes after the backend notification timeout and migration blockers are fixed.

### FEI-012 — Launch locales and copy ownership are unselected

- Status: Open
- Severity: Medium
- Found: 2026-09-08
- Area/route: All user-visible routes
- Contract version: `0.1.0-draft`
- Related backend issue: None
- Impact: Vietnamese/English launch scope affects routing, dictionaries, text
  expansion, date/time/currency formats, validation copy, SEO, and screenshot
  baselines.
- Current planning assumption: Write source UI copy in concise English, keep it
  extractable, use locale-aware formatters, avoid string concatenation, and test
  layouts with longer pseudo-localized text. Do not add locale URL segments yet.
- Resolution criteria: Approve launch locales, fallback, copy owner, route/SEO
  strategy, locale detection, user preference persistence, and translation QA.
- Affected tasks: FE-1-005, FE-1-006, FE-1-019–026, all feature copy, FE-7-021
- Owner: Product/content lead
- Next action: Resolve before final visual-regression baseline and release copy review.

### FEI-013 — AI provider privacy, retention, and recommendation consent are unapproved

- Status: Open
- Severity: Critical
- Found: 2026-09-08
- Area/route: CV analysis, gaps, recommendations, AI privacy copy
- Contract version: `0.1.0-draft`
- Related backend issue: `BEI-003`
- Impact: The UI cannot truthfully explain transmitted fields, provider
  retention, model use, deletion impact, recommendation data sources, or opt-out.
- Current planning assumption: AI remains advisory and opt-in per action; never
  send or persist extra client data; display limitations; do not enable
  recommendation consent controls or live analysis until policy is approved.
- Resolution criteria: Approve transmitted/stored fields, provider settings,
  retention, redaction, lawful/consent basis, opt-out effect, provenance, and
  user-facing copy; pass privacy and no-auto-decision tests.
- Affected tasks: FE-5-006–015, FE-7-002, FE-7-017, FE-7-026
- Owner: Product/privacy/backend owners
- Next action: Resolve with `BEI-003` before Phase 5 live integration.

### FEI-014 — Admin collection discovery and application-moderation APIs are incomplete

- Status: In progress
- Severity: High
- Found: 2026-09-08
- Area/route: Admin users, companies, jobs, and applications
- Contract version: `0.1.0-draft`
- Related backend APIs: `API-ADMIN-001–005` plus predicted admin inventory
- Impact: User listing is contracted, but efficient company/job discovery and
  the product requirement to administer applications do not have a complete,
  explicit frontend-consumable contract.
- Current implementation: Company/job moderation accepts a known ID or slug,
  loads the approved scoped detail, then submits the backend-returned ID/version.
  Collection discovery and application administration remain blocked; public
  search is not used to expose private job states.
- Resolution criteria: Define which resources are listable/searchable by admin,
  projections, filters, pagination, application actions, reasons, audit effects,
  and denial/redaction behavior in the contract.
- Affected tasks: FE-6-004–008, FE-6-012–013, FE-7-004
- Owner: Product/backend contract owners
- Next action: Complete admin API inventory decisions before Phase 6 implementation.

### FEI-015 — Production frontend topology and telemetry provider are unselected

- Status: Open
- Severity: High
- Found: 2026-09-08
- Area/route: Deployment, CSP, observability, source maps, rollback
- Contract version: `0.1.0-draft`
- Related backend issue: `BEI-004`
- Impact: API origin, asset hosting, caching, CSP destinations, error reporting,
  source-map privacy, release identifiers, and rollback cannot be verified.
- Current planning assumption: Keep deployment/provider-neutral ports; allow-list
  telemetry metadata; serve immutable hashed assets; do not upload source maps or
  enable a third-party provider until topology and privacy controls are approved.
- Resolution criteria: Approve hosting, domains, API origin, TLS, CDN/cache,
  telemetry provider/region/retention, source-map access, CSP, release tagging,
  rollback, and incident ownership.
- Affected tasks: FE-1-004, FE-1-027–029, FE-7-018, FE-7-022–024, FE-7-027–029
- Owner: Platform/security/product owners
- Next action: Resolve with `BEI-004` before production hardening.

### FEI-016 — Representative job-search corpus and frontend performance budgets are undefined

- Status: Open
- Severity: Medium
- Found: 2026-09-08
- Area/route: Public search and recruiter/admin large lists
- Contract version: `0.1.0-draft`
- Related backend issue: `BEI-006`
- Impact: Search relevance UX, result density, long-content behavior, client
  rendering limits, bundle thresholds, and end-to-end performance cannot receive
  objective acceptance.
- Current planning assumption: Use sanitized fixtures covering long titles,
  missing salary bounds, large skill sets, mixed locations, expired jobs, and
  multiple cursor pages; profile before virtualization or memoization.
- Resolution criteria: Approve representative corpus/query mix/device/network,
  API p95 context, frontend LCP/INP/CLS, bundle and interaction budgets, and a
  reproducible measurement command.
- Affected tasks: FE-3-007–009, FE-3-024–026, FE-7-012–015
- Owner: Product/backend/frontend leads
- Next action: Align the frontend performance matrix with `BEI-006`.

### FEI-017 — Direct company membership versus invitation flow is unresolved

- Status: Open
- Severity: Medium
- Found: 2026-09-08
- Area/route: Company member management
- Contract version: `0.1.0-draft`
- Related backend APIs: `API-COMP-005`, proposed `API-COMP-008–011`
- Impact: Directly granting membership by email and inviting a user have
  different confirmation, pending, expiry, revoke, acceptance, and security UX.
- Current planning assumption: Implement only the contracted direct-add flow;
  do not show pending invitations or acceptance routes.
- Resolution criteria: Product approves direct-add for the first release or the
  invitation endpoints and states are added to the contract with authorization,
  expiry, resend/revoke, acceptance, and audit behavior.
- Affected tasks: FE-2-017–019, FE-7-003
- Owner: Product/security/backend owners
- Next action: Resolve before company-member UX receives final approval.

## Fixed and Verified Issues

FEI-010 and FEI-011 are fixed in place above so their original context and
resolution evidence remain together; live role/data verification is still recorded as the next action.

## Issue Template

```md
### FEI-018 — Short title

- Status: Open | In progress | Blocked | Fixed | Verified | Deferred | Won't fix
- Severity: Critical | High | Medium | Low
- Found: YYYY-MM-DD
- Area/route:
- Contract version:
- Related backend issue or API:
- Impact:
- Current planning assumption:
- Resolution criteria:
- Affected tasks:
- Owner:
- Next action:
```

## Maintenance Rules

- Keep IDs stable and never delete a resolved issue.
- Move an issue to `Fixed` only when the resolution exists; move it to
  `Verified` only after the original acceptance or reproduction and relevant
  automated checks pass.
- Add new activity entries first and include the affected task, contract
  version, evidence, and next action.
- Contract mismatches update `../API-CONTRACT.md` before frontend code relies on
  the changed shape.
- Security, privacy, accessibility, and data-exposure concerns cannot be closed
  with a visual review alone.
- Do not duplicate normal feature work here. Link the tracker task and record
  only the blocker, defect, risk, or decision.

## Issue Activity

| Date | Issue | Change | Evidence / next action |
| --- | --- | --- | --- |
| 2026-09-10 | FEI-010–011, FEI-014 | Reconciled with merged backend implementation | Direct interview detail and unread-count metadata are fixed against live Swagger and frontend contract tests. Known-target company/job moderation is implemented; role/data verification, collection discovery, and application administration remain open. |
| 2026-09-08 | FEI-001–017 | Registered | Derived from product requirements, API contract gaps, backend inventory/issues, and frontend enterprise delivery needs. |
| 2026-09-08 | FEI-003, FEI-009, FEI-013, FEI-015 | Marked release-critical dependencies | Coordinate with BEI-005, BEI-002, BEI-003, and BEI-004 before live integration or release. |
