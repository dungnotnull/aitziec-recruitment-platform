# Frontend Development Tasks by Phases — Tracking Log

## Tracking Policy

This is the execution log for the ITZiec React + Vite frontend. Only frontend
work updates this file. `../API-CONTRACT.md` controls HTTP behavior,
`../PROJECT-DETAIL.md` controls product requirements, and the backend tracker
provides dependency-readiness evidence.

**Baseline date:** 2026-09-08
**Current phase:** Phase 7 — Release hardening (in progress)
**Runtime status:** Contracted Phase 5–6 frontend surfaces are implemented; live and production-only evidence remains open.
**Contract version:** `0.1.0-draft`

Task syntax:

- `[ ]`: planned or incomplete.
- `[x]`: completed and verified with the stated evidence.
- For a build task, `[x]` means the frontend implementation and local contract
  tests are complete. Live backend proof remains tracked by the phase's explicit
  `Verify ... live integrations` task and is not duplicated on every build task.
- An active incomplete task remains `[ ]` and receives a dated `In progress`
  note.
- `Refs` contains Requirement/API refs from `../PROJECT-DETAIL.md`,
  `../API-CONTRACT.md`, or backend API inventory IDs.
- `Depends` names prerequisite frontend tasks, backend tasks, or `FEI-*` issues.
- `Evidence` is the minimum proof required before the checkbox may be checked.

Runtime work is never checked merely because files exist, TypeScript compiles,
or a mock looks correct. Backend API availability must be proven independently.

## Readiness and Dependency Rules

| Dependency state | Frontend action |
| --- | --- |
| Contracted but backend not verified | Build against contract-owned MSW fixtures; keep live integration evidence open |
| Proposed in backend inventory | Do not consume; link a `FEI-*` decision and update the API contract first |
| Contract changed additively | Regenerate/update types and fixtures, then run affected contract tests |
| Contract changed behaviorally or breaking | Stop affected task, record impact, migrate fixtures/client/UI atomically |
| Backend returns a mismatched shape | Record an issue; do not normalize undocumented behavior silently |
| Product decision unresolved | Preserve the planning assumption and keep dependent acceptance evidence open |

## Enterprise UI Surface Inventory

Task checkboxes and phase status notes below are authoritative. “Backend
dependency” identifies readiness, not implementation status.

| Area | Primary surfaces | Backend dependency | Enterprise UI requirement |
| --- | --- | --- | --- |
| Public | Job search, filters, job/company detail | API-JOB-001–002, API-COMP-002 | Content-first, URL-shareable, fast first load |
| Auth | Register, login, session recovery | API-AUTH-001–006 | Low-friction forms, safe return path, explicit security feedback |
| Candidate | Profile, skills, experience, visibility | API-CAND-001–002, API-SKILL-001 | Guided completion without hiding manual control |
| Companies | Company setup, members, switcher | API-COMP-001–007 | Clear active-company scope and permission disclosure |
| CVs | Upload, processing, versions, private download | API-CV-001–007 | Privacy-forward progress and failure recovery |
| Jobs | Saved jobs and recruiter editor/lifecycle | API-SAVE-001–003, API-JOB-003–010 | Dense but legible management workspace |
| Applications | Candidate history and recruiter pipeline | API-APP-001–005 | Strict state semantics and evidence rail |
| Interviews | Schedule, update, complete, cancel | API-INT-001–006 | UTC/local clarity and private/public field separation |
| Notifications | Inbox and read state | API-NOTIF-001–002 | Actionable event grouping and accessible live updates |
| AI | Match, gaps, operations, search, recommendations | API-AI-001–008 | Evidence-first, advisory, transparent limitations |
| Admin | Moderation and audit | API-ADMIN-001–005 | High-density tables, explicit consequences, redaction |

## Cross-Cutting Acceptance Baseline

Every applicable remote view includes initial loading, background refresh,
empty, validation error, recoverable error, unauthorized, forbidden, not found,
offline/timeout, rate-limited, stale/conflict, and success states. Enterprise UI
evidence includes keyboard completion, visible focus, WCAG 2.2 AA contrast,
screen-reader announcements, reduced motion, 200% zoom/reflow, and responsive
task completion at `320`, `375`, `414`, `768`, `1024`, and `1440` CSS pixels.

## Phase 0 — Documentation and Product Mapping

**Phase status:** Verified on 2026-09-08.
**Goal:** establish truthful frontend scope, contract traceability, enterprise UI
direction, and an executable backlog before runtime implementation.

- [x] **FE-0-001 Confirm frontend scope and runtime status** — Refs: PROJECT-DETAIL §1, §4; Depends: None; Evidence: frontend documents state React + Vite is planned and no runtime app exists.
- [x] **FE-0-002 Reconcile the framework decision** — Refs: root CLAUDE “Confirmed Technology Decisions”; Depends: FE-0-001; Evidence: stale “framework not selected” language is absent from frontend instructions.
- [x] **FE-0-003 Map guest capabilities to public surfaces** — Refs: §5.1, AUTH-001–002, JOB-004, SEARCH-001–004; Depends: FE-0-001; Evidence: inventory and phase tasks cover browse, search, register, and login.
- [x] **FE-0-004 Map candidate capabilities to owned surfaces** — Refs: §5.2, CAND-001–004, SAVE-001–002, CV-001–006, APP-001–008; Depends: FE-0-001; Evidence: profile, CV, saved-job, application, and notification tasks are traceable.
- [x] **FE-0-005 Map recruiter capabilities and company scope** — Refs: §5.3, COMP-001–004, JOB-001–006, APP-003–008, INT-001–005; Depends: FE-0-001; Evidence: company context, job, pipeline, interview, and privacy tasks are traceable.
- [x] **FE-0-006 Map administrator capabilities** — Refs: §5.4, ADMIN-001–002, AUDIT-001–003; Depends: FE-0-001; Evidence: moderation and audit tasks identify contracted and missing operations.
- [x] **FE-0-007 Audit contracted frontend API consumers** — Refs: API contract §9; Depends: FE-0-003–006; Evidence: surface inventory maps all 54 approved contract endpoints to planned features.
- [x] **FE-0-008 Audit predicted endpoint dependencies** — Refs: backend API inventory; Depends: FE-0-007; Evidence: proposed company, job, CV, interview, notification, admin, and AI needs link to `FEI-*` issues.
- [x] **FE-0-009 Define frontend architecture and state ownership** — Refs: frontend CLAUDE; Depends: FE-0-002; Evidence: typed transport, feature boundaries, router/server/form/local state ownership are explicit.
- [x] **FE-0-010 Define enterprise design direction and UI primitives** — Refs: frontend CLAUDE “Enterprise Design Direction”; Depends: FE-0-009; Evidence: trust-and-evidence direction, visual tokens, evidence rail, density, motion, and anti-patterns are documented.
- [x] **FE-0-011 Define accessibility, security, and performance baselines** — Refs: NFR-SEC-001–005, NFR-PERF-001–004, NFR-TEST-001–004; Depends: FE-0-009; Evidence: WCAG 2.2 AA, privacy, bundle, and testing rules are documented.
- [x] **FE-0-012 Establish frontend issue and decision workflow** — Refs: frontend issue register; Depends: FE-0-008–011; Evidence: stable issue format and blocking decisions are recorded.
- [x] **FE-0-013 Produce phase-level dependency graph** — Refs: backend phases 1–7; Depends: FE-0-007–012; Evidence: each runtime task records frontend and backend prerequisites.
- [x] **FE-0-014 Verify frontend documentation baseline** — Refs: all; Depends: FE-0-001–013; Evidence: task/issue counts, phase headings, UTF-8, references, status language, and whitespace validation pass.

## Phase 1 — Platform and Enterprise UI Foundation

**Phase status:** Verified — 29 of 29 tasks complete.
**Goal:** create a reproducible, typed, accessible application shell and design
system that can support public, candidate, recruiter, and admin workflows.

- [x] **FE-1-001 Pin Node, package-manager, and browser baselines** — Refs: NFR-TEST-004; Depends: FEI-001; Evidence: version files and clean-checkout install tests agree with CI.
- [x] **FE-1-002 Scaffold React 19 + Vite + strict TypeScript** — Refs: root confirmed stack; Depends: FE-1-001; Evidence: dev server, production build, and strict type-check pass without suppressions.
- [x] **FE-1-003 Establish feature-oriented source boundaries** — Refs: frontend CLAUDE “Directory and Module Boundaries”; Depends: FE-1-002; Evidence: architecture test rejects cross-feature internal imports and direct component HTTP calls.
- [x] **FE-1-004 Validate public environment configuration** — Refs: NFR-SEC-002–003; Depends: FE-1-002; Evidence: missing/invalid API URL and environment mode fail fast without exposing secrets.
- [x] **FE-1-005 Configure typed route tree and route groups** — Refs: actors §5.1–5.4; Depends: FE-1-003; Evidence: public/candidate/recruiter/admin route tests and typed navigation compile.
- [x] **FE-1-006 Build application provider composition** — Refs: frontend CLAUDE “State Ownership”; Depends: FE-1-005; Evidence: router, query, auth, locale, and theme providers mount once in smoke tests.
- [x] **FE-1-007 Build root and route error boundaries** — Refs: API contract §4.3; Depends: FE-1-006; Evidence: render/chunk/data failures show recoverable UI with request context where available.
- [x] **FE-1-008 Configure TanStack Query defaults** — Refs: NFR-PERF-001–004; Depends: FE-1-006; Evidence: retry, stale time, cancellation, focus reconnect, and sensitive-cache clearing tests pass.
- [x] **FE-1-009 Implement typed API transport and envelopes** — Refs: API contract §3–4; Depends: FE-1-004; Backend: BE-1-015–016; Evidence: success, collection, empty, malformed, timeout, and standard error fixture tests pass.
- [x] **FE-1-010 Implement access-session refresh coordinator** — Refs: API contract §5; Depends: FE-1-008–009; Backend: BE-2-007–009; Evidence: concurrent 401s cause one refresh, requests retry once, and terminal failure clears identity.
- [x] **FE-1-011 Implement idempotency and concurrency request helpers** — Refs: API contract §3.5–3.6; Depends: FE-1-009; Evidence: stable per-action keys and `expectedVersion` propagation tests pass.
- [x] **FE-1-012 Create contract-owned DTO and enum layer** — Refs: API contract §6–8; Depends: FE-1-009; Evidence: fixtures cover every shared enum and fail on undocumented values.
- [x] **FE-1-013 Establish MSW contract mock layer** — Refs: API contract §9–11; Depends: FE-1-012; Evidence: deterministic success/error/denial/conflict/rate-limit handlers support browser and test environments.
- [x] **FE-1-014 Configure Vitest and Testing Library** — Refs: NFR-TEST-001–002; Depends: FE-1-002; Evidence: component DOM test and custom render wrapper with providers pass.
- [x] **FE-1-015 Implement test factories and fixtures** — Refs: NFR-TEST-001; Depends: FE-1-012; Evidence: type-safe factories generate valid mock data for models.
- [x] **FE-1-016 Configure Playwright browser projects** — Refs: NFR-TEST-003; Depends: FE-1-002, FE-1-013; Evidence: Chromium, Firefox, WebKit, mobile, trace, screenshot, and retry configuration smoke tests pass.
- [x] **FE-1-017 Configure Storybook and deterministic stories** — Refs: frontend CLAUDE “Testing and Evidence”; Depends: FE-1-002, FE-1-014; Evidence: static Storybook build and interaction smoke story pass.
- [x] **FE-1-018 Implement Tailwind v4 semantic theme** — Refs: frontend CLAUDE “Brand baseline”; Depends: FE-1-002; Evidence: `@theme` exposes semantic color/type/space/radius/elevation/motion tokens with no feature raw-color fixture.
- [x] **FE-1-019 Load and verify typography roles** — Refs: NFR-PERF-001, frontend CLAUDE “Brand baseline”; Depends: FE-1-018; Evidence: Plus Jakarta Sans, Inter, and IBM Plex Mono load with fallbacks, preload strategy, and no visible layout shift.
- [x] **FE-1-020 Build core interaction primitives** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-1-015, FE-1-017–019; Evidence: button, link, icon button, input, select, checkbox, radio, switch, textarea, and focus stories pass interaction/a11y tests.
- [x] **FE-1-021 Build feedback and overlay primitives** — Refs: API contract §4.3; Depends: FE-1-020; Evidence: alert, toast, tooltip, menu, popover, dialog, confirm dialog, and sheet pass focus/escape/announcement tests.
- [x] **FE-1-022 Build data-display primitives** — Refs: frontend CLAUDE “Enterprise Design Direction”; Depends: FE-1-020; Evidence: card, badge, avatar, table, pagination control, skeleton, empty state, and error state stories pass at target widths.
- [x] **FE-1-023 Build form composition and error summary** — Refs: API contract `VALIDATION_ERROR`; Depends: FE-1-020–021; Evidence: invalid submit focuses a linked summary while retaining field errors and user input.
- [x] **FE-1-024 Build role-aware responsive application shell** — Refs: actors §5, frontend CLAUDE “Layout and Responsive Behavior”; Depends: FE-1-005, FE-1-018–022; Evidence: public header and workspace rail/drawer support keyboard navigation, zoom, and target breakpoints.
- [x] **FE-1-025 Build evidence rail and status language** — Refs: APP-003–007, INT-004, AUDIT-001; Depends: FE-1-018, FE-1-022; Evidence: ordered timeline, operation progress, and status variants work without color-only meaning.
- [x] **FE-1-026 Build shared remote-state compositions** — Refs: frontend CLAUDE “Remote View State Contract”; Depends: FE-1-021–023; Evidence: all baseline states have stories and component tests with actionable recovery.
- [x] **FE-1-027 Implement privacy-safe client telemetry port** — Refs: NFR-SEC-004, NFR-OBS-001–002; Depends: FE-1-004; Evidence: allow-list/redaction tests exclude tokens, CV data, signed URLs, notes, form values, and raw payloads.
- [x] **FE-1-028 Establish format, lint, type, test, build, and bundle CI gates** — Refs: NFR-TEST-004; Depends: FE-1-002–027; Evidence: clean checkout CI passes and a deliberate gate violation fails.
- [x] **FE-1-029 Verify Phase 1 foundation** — Refs: frontend CLAUDE; Depends: FE-1-001–028; Evidence: all gates pass, Storybook is reviewable, and no backend runtime is required for mock-mode verification.

## Phase 2 — Identity, Profiles, Companies, and CVs

**Phase status:** Verified — 28 of 28 tasks complete.
**Goal:** deliver secure session UX and complete owned candidate/recruiter setup
workflows against contract-backed mocks, then verified backend integrations.

- [x] **FE-2-001 Build authentication layout and safe return navigation** — Refs: AUTH-001–006; Depends: FE-1-024; Evidence: responsive layout, skip link, return-path allow-list, and unauthenticated redirects pass.
- [x] **FE-2-002 Build registration form and role choice** — Refs: AUTH-001, API-AUTH-001; Depends: FE-1-023, FE-2-001; Backend: BE-2-004; Evidence: candidate/HR payload, validation, duplicate email, pending, and success tests pass.
- [x] **FE-2-003 Build login and account-state handling** — Refs: AUTH-002, API-AUTH-002; Depends: FE-2-001; Backend: BE-2-005; Evidence: invalid credentials, suspended account, rate limit, keyboard, and return-path tests pass.
- [x] **FE-2-004 Bootstrap authenticated identity** — Refs: API-AUTH-006; Depends: FE-1-010, FE-2-003; Backend: BE-2-005, BE-2-009; Evidence: loading, authenticated, expired, revoked, role-changed, and offline states pass.
- [x] **FE-2-005 Enforce role-aware navigation disclosure** — Refs: AUTH-005, actors §5; Depends: FE-2-004; Evidence: each role sees valid routes while direct forbidden navigation renders scoped guidance without treating UI as authorization.
- [x] **FE-2-006 Implement logout current and all sessions** — Refs: AUTH-004, API-AUTH-004–005; Depends: FE-2-004; Backend: BE-2-008; Evidence: cache cleanup, redirect, retry-safe pending state, and multi-tab identity reset pass.
- [x] **FE-2-007 Build candidate profile overview** — Refs: CAND-001–004, API-CAND-001; Depends: FE-2-004, FE-1-026; Backend: BE-2-012, BE-2-014; Evidence: completeness, visibility, skills, experience, default CV, and remote states render contract projections.
- [x] **FE-2-008 Build candidate identity and contact editor** — Refs: CAND-001, API-CAND-002; Depends: FE-2-007, FE-1-023; Backend: BE-2-013; Evidence: dirty-state guard, field errors, save confirmation, and version conflict recovery pass.
- [x] **FE-2-009 Build canonical skill combobox** — Refs: CAND-002, API-SKILL-001; Depends: FE-2-008, FEI-004; Backend: BE-2-011 and proposed API-SKILL-001; Evidence: debounced search, keyboard selection, duplicate prevention, empty/error states, and cancellation pass.
- [x] **FE-2-010 Build work-experience editor** — Refs: CAND-002, API-CAND-002; Depends: FE-2-008; Evidence: add/edit/reorder/remove, date validation, current-role semantics, and responsive cards pass.
- [x] **FE-2-011 Build profile visibility control** — Refs: CAND-003, API-CAND-002; Depends: FE-2-008; Evidence: privacy explanation, explicit current value, mutation pending, and conflict states pass.
- [x] **FE-2-012 Build CV upload and version history** — Refs: CAND-004, API-CAND-003–004; Depends: FE-2-007, FE-1-026; Backend: BE-2-014–015; Evidence: optimistic upload, loading progress, default CV selection, deletion, and parsing-failure states pass.
- [x] **FE-2-013 Establish company domain boundary** — Refs: frontend CLAUDE; Depends: FE-1-003; Evidence: `src/features/company` is isolated and typed.
- [x] **FE-2-014 Build company profile and dashboard root** — Refs: HR-001–002; Depends: FE-2-004; Backend: BE-2-017; Evidence: HR users see their verified company dashboard, Candidates see 403 or onboarding UI.
- [x] **FE-2-015 Build public and scoped company profile** — Refs: COMP-001–003, API-COMP-002; Depends: FE-1-026; Backend: BE-2-017; Evidence: public projection excludes members/audit data and scoped projection exposes only authorized controls.
- [x] **FE-2-016 Build company profile editor** — Refs: COMP-001–004, API-COMP-003; Depends: FE-2-013–015; Backend: BE-2-017; Evidence: ownership disclosure, validation, moderation restriction, and version conflict pass.
- [x] **FE-2-017 Build company member directory** — Refs: COMP-002, API-COMP-004; Depends: FE-2-013; Backend: BE-2-018; Evidence: cursor loading, roles, empty, forbidden, and responsive table/card modes pass.
- [x] **FE-2-018 Build add-member workflow** — Refs: COMP-002, API-COMP-005; Depends: FE-2-017; Backend: BE-2-018; Evidence: owner/admin permissions, email validation, duplicate member, and safe confirmation pass.
- [x] **FE-2-019 Build remove-member workflow** — Refs: COMP-002, API-COMP-006; Depends: FE-2-017; Backend: BE-2-018; Evidence: consequence dialog, final-owner protection, permission loss, and refreshed membership pass.
- [x] **FE-2-020 Build CV library and privacy framing** — Refs: CV-003–006, API-CV-002–003; Depends: FE-2-004, FE-1-026; Backend: BE-5-007; Evidence: owned metadata, privacy copy, processing status, empty/error, and cursor states pass.
- [x] **FE-2-021 Build validated PDF upload** — Refs: CV-001–004, API-CV-001; Depends: FE-2-020, FE-1-023; Backend: BE-5-003–005; Evidence: extension/MIME/size guidance, progress, cancel, 202 result, and rejection states pass.
- [x] **FE-2-022 Build CV processing status updates** — Refs: CV-004, API-CV-003, API-OPS-001; Depends: FE-2-020–021; Backend: BE-5-006–007; Evidence: bounded polling, visibility pause, success/failure/timeout, reduced announcements, and cleanup pass.
- [x] **FE-2-023 Build default-CV selection** — Refs: CV-005, API-CV-004; Depends: FE-2-020; Backend: BE-5-008; Evidence: one-default invariant, pending state, conflict recovery, and list/detail synchronization pass.
- [x] **FE-2-024 Build private CV download action** — Refs: CV-003, API-CV-005; Depends: FE-2-020; Backend: BE-5-009; Evidence: URL requested on activation only and never enters cache, history, logs, clipboard automation, or telemetry.
- [x] **FE-2-025 Build CV deletion workflow** — Refs: CV-006, API-CV-006; Depends: FE-2-020, FEI-009; Backend: BE-5-010; Evidence: retention-aware confirmation, submitted/default safeguards, immediate UI removal, and failure recovery pass.
- [x] **FE-2-026 Build failed-processing retry workflow** — Refs: CV-004, API-CV-007 proposed; Depends: FE-2-022, FEI-007; Evidence: retry appears only for retryable failures and creates a newly tracked operation after contract approval.
- [x] **FE-2-027 Verify Phase 2 mock journeys** — Refs: AUTH, CAND, COMP, CV; Depends: FE-2-001–026; Evidence: candidate and HR onboarding journeys pass with MSW across desktop/mobile and keyboard modes.
- [x] **FE-2-028 Verify Phase 2 live integrations** — Refs: API-AUTH-001–006, API-CAND-001–002, API-COMP-001–006, API-CV-001–006; Depends: FE-2-027 and corresponding backend verification; Evidence: live contract, denial, refresh, ownership, upload, and privacy scenarios pass.

## Phase 3 — Job Discovery, Saved Jobs, and Recruiter Job Management

**Phase status:** In progress — 16 of 26 tasks complete.
**Goal:** make public discovery fast and trustworthy while providing recruiters
a dense, safe job-authoring and lifecycle workspace.

- [x] **FE-3-001 Build public discovery shell** — Refs: JOB-004, SEARCH-001–004; Depends: FE-1-024; Evidence: branded header, search entry, content hierarchy, mobile navigation, and first-load skeleton pass.
- [ ] **FE-3-002 Define typed job-search URL schema** — Refs: `JobSearchFilters`, API contract §13; Depends: FE-1-005, FE-1-012; Evidence: parse/serialize round trips normalize invalid query, filters, sorting, freshness, and cursor state.
- [x] **FE-3-003 Build keyword search and submit behavior** — Refs: SEARCH-001, API-JOB-001; Depends: FE-3-001–002; Backend: BE-3-010–014; Evidence: keyboard submit, cancellation, safe query encoding, clear action, and URL restoration pass.
- [x] **FE-3-004 Build structured desktop filter rail** — Refs: SEARCH-002, API-JOB-001; Depends: FE-3-002; Evidence: skill, salary, location, experience, employment, company, and freshness controls map exactly to contract fields.
- [ ] **FE-3-005 Build mobile filter sheet and active-filter summary** — Refs: SEARCH-002, frontend CLAUDE “Layout and Responsive Behavior”; Depends: FE-3-004, FE-1-021; Evidence: focus trap/restore, apply/reset, individual chip removal, scroll containment, and 320px completion pass.
- [ ] **FE-3-006 Build deterministic sort control** — Refs: SEARCH-003–004, API contract §13; Depends: FE-3-002; Evidence: allowed sorts, fallback, cursor reset, accessible label, and URL back/forward behavior pass.
- [x] **FE-3-007 Build job result cards and list states** — Refs: JOB-004, API-JOB-001; Depends: FE-3-003–006, FE-1-026; Evidence: salary/location/stack/status content, loading/empty/error/refresh, and no private factors pass.
- [x] **FE-3-008 Build cursor result continuation** — Refs: SEARCH-003, API-JOB-001; Depends: FE-3-007; Evidence: append, duplicate prevention, focus placement, back navigation, end state, and failed continuation retry pass.
- [x] **FE-3-009 Build public job detail** — Refs: JOB-001–005, API-JOB-002; Depends: FE-3-007; Backend: BE-3-003; Evidence: semantic content, safe rich text, expiry/closed behavior, company link, and not-found state pass.
- [ ] **FE-3-010 Build public company detail entry from jobs** — Refs: COMP-003, API-COMP-002; Depends: FE-3-009, FE-2-015; Evidence: public projection and return navigation preserve job-search context.
- [x] **FE-3-011 Build candidate save/unsave control** — Refs: SAVE-001, API-SAVE-002–003; Depends: FE-2-004, FE-3-007; Backend: BE-3-019; Evidence: idempotent pending state, optimistic rollback, auth handoff, accessible name, and list/card sync pass.
- [x] **FE-3-012 Build saved-jobs library** — Refs: SAVE-002, API-SAVE-001; Depends: FE-3-011; Backend: BE-3-020; Evidence: cursor, empty, stale job, unsave, responsive, and ownership-safe fixtures pass.
- [x] **FE-3-013 Build recruiter job workspace route** — Refs: JOB-001–005, API-JOB-009 proposed; Depends: FE-2-013, FEI-006; Evidence: active-company scope, all lifecycle statuses, empty/create CTA, and pagination pass after contract approval.
- [x] **FE-3-014 Build job editor information architecture** — Refs: JOB-001, JOB-006; Depends: FE-1-023, FE-3-013; Evidence: sections group overview, description, requirements, stack, location, level/type, compensation, and deadline logically.
- [x] **FE-3-015 Build job description and requirement inputs** — Refs: JOB-001, API-JOB-003–004; Depends: FE-3-014; Evidence: visible labels, safe plain/structured content, character guidance, autosave policy, and dirty guard pass.
- [x] **FE-3-016 Build job skill/technology requirements editor** — Refs: JOB-001, API-SKILL-001; Depends: FE-3-014, FE-2-009; Evidence: canonical selection, requirement level, duplicate prevention, keyboard reorder, and mobile layout pass.
- [x] **FE-3-017 Build compensation and deadline editor** — Refs: JOB-001, JOB-006; Depends: FE-3-014; Evidence: minor-unit/currency formatting, optional bounds, min≤max, UTC deadline, and locale display tests pass.
- [x] **FE-3-018 Build draft-job creation mutation** — Refs: API-JOB-003; Depends: FE-3-014–017; Backend: BE-3-002; Evidence: validation mapping, duplicate-submit protection, created draft navigation, and request ID handling pass.
- [x] **FE-3-019 Build existing-job edit mutation** — Refs: API-JOB-004; Depends: FE-3-018; Backend: BE-3-004; Evidence: load/edit/save, expected version, conflict recovery, permission loss, and cache synchronization pass.
- [ ] **FE-3-020 Build publish eligibility review** — Refs: JOB-002, API-JOB-005; Depends: FE-3-019; Backend: BE-3-005–006; Evidence: missing requirements are linked, consequence copy is explicit, and only eligible drafts expose publish.
- [ ] **FE-3-021 Build unpublish and close workflows** — Refs: JOB-003–005, API-JOB-006–007; Depends: FE-3-019; Backend: BE-3-007–008; Evidence: action-specific confirmation, optional close reason, version conflict, audit expectation, and refreshed status pass.
- [x] **FE-3-022 Build lifecycle status and deadline presentation** — Refs: JOB-002–005; Depends: FE-3-013, FE-3-020–021; Evidence: text/icon/status semantics distinguish draft, published, unpublished, closed, expired without color alone.
- [ ] **FE-3-023 Handle moderation and company restrictions** — Refs: COMP-004, ADMIN-001–002; Depends: FE-3-013; Evidence: suspended company/restricted publication fixtures remove invalid actions and explain next steps.
- [ ] **FE-3-024 Verify representative search performance** — Refs: NFR-PERF-001–003; Depends: FE-3-003–012; Backend: BE-3-016; Evidence: agreed corpus test records input responsiveness, cancellation, rendering, navigation, and p95 API observations.
- [ ] **FE-3-025 Verify Phase 3 mock journeys** — Refs: JOB, SEARCH, SAVE; Depends: FE-3-001–024; Evidence: guest/candidate/recruiter journeys pass with success, empty, denial, conflict, expiry, and mobile variants.
- [ ] **FE-3-026 Verify Phase 3 live integrations** — Refs: API-JOB-001–007, API-SAVE-001–003; Depends: FE-3-025 and corresponding backend verification; Evidence: OpenAPI/fixture diff and live public/scope/lifecycle/idempotency scenarios pass.

## Phase 4 — Applications, Recruitment Pipeline, and Interviews

**Phase status:** In progress — 17 of 24 tasks complete.
**Goal:** deliver the end-to-end hiring workflow with strict transitions,
privacy-safe projections, concurrency recovery, and usable recruiter density.

- [x] **FE-4-001 Build job apply entry and auth handoff** — Refs: APP-001, API-APP-001; Depends: FE-3-009, FE-2-004; Evidence: guest return path, closed/expired/applied states, and candidate-only disclosure pass.
- [x] **FE-4-002 Build owned-CV application selector** — Refs: APP-001, CV-005; Depends: FE-4-001, FE-2-020; Evidence: ready/default CV, processing/failed exclusion, privacy context, and upload recovery pass.
- [x] **FE-4-003 Build application confirmation step** — Refs: APP-001–002; Depends: FE-4-002; Evidence: job/company/CV summary, no private leak, final eligibility copy, and keyboard review pass.
- [x] **FE-4-004 Submit an idempotent application** — Refs: APP-001–002, APP-008, API-APP-001; Depends: FE-4-003, FE-1-011; Backend: BE-4-005; Evidence: stable key, one submission, pending lock, duplicate/deadline errors, and success navigation pass.
- [x] **FE-4-005 Build candidate application list** — Refs: APP-006, API-APP-002; Depends: FE-4-004; Backend: BE-4-010; Evidence: status filter, cursor, empty, withdrawn-unavailable baseline, mobile cards, and refresh states pass.
- [x] **FE-4-006 Build candidate application detail** — Refs: APP-006, API-APP-003; Depends: FE-4-005; Backend: BE-4-011; Evidence: job/CV/status/history projection renders without recruiter-private fields.
- [x] **FE-4-007 Build application evidence rail** — Refs: APP-002–007, AUDIT-001; Depends: FE-4-006, FE-1-025; Evidence: ordered event timestamps, actor-safe labels, reasons, terminal state, and responsive timeline pass.
- [x] **FE-4-008 Build recruiter applicant workspace** — Refs: APP-006, API-APP-004; Depends: FE-3-013; Backend: BE-4-012; Evidence: active job scope, status/sort/cursor controls, dense table, mobile cards, and denial states pass.
- [x] **FE-4-009 Build applicant filters and selection model** — Refs: APP-003–006; Depends: FE-4-008; Evidence: URL-backed status/sort, deterministic selection, back navigation, and no unsupported bulk transition pass.
- [ ] **FE-4-010 Build recruiter application detail projection** — Refs: APP-006, API-APP-003; Depends: FE-4-008; Backend: BE-4-013; Evidence: authorized profile/CV/application data, private notes boundary, and signed-download-on-action pass.
- [x] **FE-4-011 Render exact allowed pipeline transitions** — Refs: APP-003–004, API contract §7; Depends: FE-4-010; Evidence: APPLIED→REVIEWING→INTERVIEWING→PASSED/REJECTED controls match the contract and all unlisted transitions are absent.
- [x] **FE-4-012 Implement transition mutation and confirmation** — Refs: APP-005, APP-008, API-APP-005; Depends: FE-4-011, FE-1-011; Backend: BE-4-008; Evidence: target, reason rule, expected version, idempotency, actor scope, and refreshed history pass.
- [ ] **FE-4-013 Implement transition conflict recovery** — Refs: APP-005, APP-008; Depends: FE-4-012; Evidence: stale status/version shows current server state and prevents silent resubmission.
- [x] **FE-4-014 Handle immutable terminal outcomes** — Refs: APP-007; Depends: FE-4-011–013; Evidence: passed/rejected fixtures remove mutation controls and preserve readable history.
- [ ] **FE-4-015 Track early-rejection decision in UI** — Refs: APP-003–004; Depends: FEI-008; Evidence: no early-reject control exists unless product and contract state machine change.
- [x] **FE-4-016 Build interview list within application** — Refs: INT-003–004, API-INT-002; Depends: FE-4-006, FE-4-010; Backend: BE-5-014; Evidence: candidate/recruiter projections, cursor, history, empty, and private-field separation pass.
- [x] **FE-4-017 Build interview scheduling form** — Refs: INT-001–003, API-INT-001; Depends: FE-4-011, FE-1-023; Backend: BE-5-013; Evidence: only INTERVIEWING applications, UTC conversion, end-after-start, instructions/notes distinction, and idempotency pass.
- [x] **FE-4-018 Build interview reschedule and edit workflow** — Refs: INT-002–005, API-INT-003; Depends: FE-4-016–017; Backend: BE-5-015; Evidence: current values, expected version, visible/private fields, conflict, notification expectation, and history refresh pass.
- [x] **FE-4-019 Build interview completion workflow** — Refs: INT-003–004, API-INT-004; Depends: FE-4-016; Backend: BE-5-016; Evidence: optional private feedback, version handling, completed state, and unchanged application status pass.
- [x] **FE-4-020 Build interview cancellation workflow** — Refs: INT-004–005, API-INT-005; Depends: FE-4-016; Backend: BE-5-017; Evidence: required reason, consequence confirmation, terminal interview state, history, and notification expectation pass.
- [ ] **FE-4-021 Define direct interview-detail navigation** — Refs: API-INT-006 proposed; Depends: FEI-010; Evidence: deep link is disabled or uses application context until the endpoint is contracted and verified.
- [ ] **FE-4-022 Verify pipeline accessibility and density** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-4-008–020; Evidence: complete pipeline work is possible without drag, hover, or color; 200% zoom and 320px layouts pass.
- [ ] **FE-4-023 Verify Phase 4 mock journeys** — Refs: APP, INT; Depends: FE-4-001–022; Evidence: candidate apply/history and recruiter review/interview journeys pass with duplicate, denial, conflict, and terminal variants.
- [ ] **FE-4-024 Verify Phase 4 live integrations** — Refs: API-APP-001–005, API-INT-001–005; Depends: FE-4-023 and corresponding backend verification; Evidence: live transactional results, projections, state transitions, histories, and authorization scenarios pass.

## Phase 5 — Notifications, Operations, and AI Assistance

**Phase status:** In progress — 14 of 18 tasks complete on 2026-09-10; consent, full async acceptance, and live-integration gates remain open.
**Goal:** expose asynchronous work and AI assistance transparently without
leaking sensitive data or implying autonomous hiring decisions.

- [x] **FE-5-001 Build notification center route and list** — Refs: NOTIF-001, API-NOTIF-001; Depends: FE-2-004, FE-1-026; Backend: BE-5-020; Evidence: read filter, cursor, grouping, empty/error, resource link, and owner-only fixtures pass.
- [x] **FE-5-002 Build notification read control** — Refs: NOTIF-001, API-NOTIF-002; Depends: FE-5-001; Evidence: accessible name, bodyless `PATCH`, optimistic rollback, repeated action, list/badge synchronization, and tests pass. The backend exposes mark-read only, so no fabricated mark-unread action is shown.
- [x] **FE-5-003 Define global unread-summary behavior** — Refs: NOTIF-001; Depends: FEI-011; Evidence: the global badge consumes backend `meta.unreadCount`, caps visual text at `99+`, polls every 60 seconds, shares the notification query cache, and exposes a polite accessible count.
- [x] **FE-5-004 Build generic asynchronous-operation tracker** — Refs: AI-007, API-AI-003; Depends: FE-1-025–026; Backend: BE-6-011; Evidence: queued/running/succeeded/failed states, bounded polling, cancellation cleanup, timeout, and retry guidance pass.
- [x] **FE-5-005 Integrate CV processing with operation feedback** — Refs: CV-004, AI-007; Depends: FE-2-022, FE-5-004; Evidence: upload-to-processing transition remains understandable after navigation and page refresh.
- [x] **FE-5-006 Build CV-to-job analysis request flow** — Refs: AI-002–004, API-AI-001; Depends: FE-2-020, FE-3-009, FE-5-004; Backend: BE-6-008–011; Evidence: owned/authorized inputs, idempotency, privacy notice, 202 result, and denial states pass.
- [x] **FE-5-007 Build AI analysis result shell** — Refs: AI-002–004, API-AI-002; Depends: FE-5-006; Evidence: loading/failure/version/provenance/limitations and non-decision advisory copy pass.
- [x] **FE-5-008 Build component match-score presentation** — Refs: AI-003; Depends: FE-5-007; Evidence: overall and component scores include text labels, bounds, evidence, confidence/limitations, and accessible non-color meaning.
- [x] **FE-5-009 Build matched-evidence and unmet-requirement views** — Refs: AI-003; Depends: FE-5-007; Evidence: candidate/job evidence is attributed, expandable by keyboard, and never invents candidate claims.
- [x] **FE-5-010 Build practical gap-analysis guidance** — Refs: AI-004; Depends: FE-5-007–009; Evidence: suggestions distinguish missing evidence from missing skill and avoid guaranteed outcome language.
- [x] **FE-5-011 Build natural-language search input** — Refs: AI-005, API-JOB-008; Depends: FE-3-002–006; Backend: BE-6-014; Evidence: parsed filters are previewed, editable, validated, URL-applied, and provider/rate-limit errors preserve the query.
- [x] **FE-5-012 Build job recommendations surface** — Refs: AI-006, API-AI-004; Depends: FE-3-007–012; Backend: BE-6-017; Evidence: reason codes, exclusions, cursor, cold start, empty, save action, and privacy controls pass. Contract projection currently supplies jobs without reason codes, so the UI renders only server-owned data and does not fabricate reasons.
- [ ] **FE-5-013 Implement recommendation consent/opt-out UX** — Refs: AI-006, NFR-SEC-003–004; Depends: FEI-013, FE-5-012; Evidence: approved data-source explanation, control state, deletion/retention effect, and non-dark-pattern review pass.
- [x] **FE-5-014 Implement AI privacy and failure messaging** — Refs: AI-001, AI-007–009; Depends: FEI-013, FE-5-006–012; Evidence: timeout, rate-limit, upstream-unavailable, invalid-output, permanent-failure, retryability, and data-transmission copy are classified and covered by unit tests; consent/retention policy remains FE-5-013.
- [x] **FE-5-015 Exclude AI controls from pipeline decisions** — Refs: AI-009, APP-003–005; Depends: FE-4-011, FE-5-007; Evidence: architecture and component tests prove analysis components expose no application transition actions.
- [ ] **FE-5-016 Verify asynchronous accessibility** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-5-001–015; Evidence: live regions announce meaningful transitions once, polling remains quiet, focus persists, and reduced motion passes.
- [ ] **FE-5-017 Verify Phase 5 mock journeys** — Refs: NOTIF, AI; Depends: FE-5-001–016; Evidence: notification, operation, analysis, natural-language search, and recommendation journeys pass across success/failure/privacy variants.
- [ ] **FE-5-018 Verify Phase 5 live integrations** — Refs: API-NOTIF-001–002, API-AI-001–004, API-JOB-008; Depends: FE-5-017 and corresponding backend verification; Evidence: live event visibility, polling, advisory output, authorization, and provider-failure scenarios pass.

## Phase 6 — Administration and Audit

**Phase status:** In progress — 9 of 13 tasks verified on 2026-09-10; application administration, full accessibility journeys, and live authorization evidence remain open.
**Goal:** provide explicit, high-accountability moderation and audit interfaces
without exposing private data or hiding consequences.

- [x] **FE-6-001 Build admin route boundary and workspace shell** — Refs: ADMIN-001–002; Depends: FE-2-004–005, FE-1-024; Backend: BE-7-001; Evidence: admin-only navigation, direct denial, session role change, and responsive shell pass.
- [x] **FE-6-002 Build user administration table** — Refs: ADMIN-001, API-ADMIN-001; Depends: FE-6-001; Evidence: typed filters, cursor, dense rows, mobile detail cards, loading/empty/error, and non-sensitive projection pass.
- [x] **FE-6-003 Build user status moderation** — Refs: ADMIN-001–002, API-ADMIN-002; Depends: FE-6-002; Backend: BE-7-002; Evidence: target/status/consequence, required reason, pending lock, session impact, and audit expectation pass.
- [x] **FE-6-004 Build company moderation lookup and detail** — Refs: COMP-004, ADMIN-001–002; Depends: FE-6-001, FEI-014; Evidence: admins look up a known real ID/slug through approved `GET /companies/:companyIdOrSlug`; the UI explicitly states that no admin collection discovery endpoint exists.
- [x] **FE-6-005 Build company status moderation** — Refs: API-ADMIN-003; Depends: FE-6-004; Backend: BE-7-003; Evidence: target, current status/version, required reason, consequence copy, pending lock, server conflict display, and exact `status/reason/expectedVersion` payload are implemented and unit-tested.
- [x] **FE-6-006 Build job moderation lookup and detail** — Refs: ADMIN-001–002; Depends: FE-6-001, FEI-014; Evidence: admins reuse scoped `GET /jobs/:jobIdOrSlug` with their real bearer session and retain only the returned server ID/version for moderation.
- [x] **FE-6-007 Build job moderation action** — Refs: API-ADMIN-004; Depends: FE-6-006; Backend: BE-7-004; Evidence: unpublish/close selection, required reason, expected version, public/terminal consequence copy, pending lock, conflict display, and exact command payload are implemented and unit-tested.
- [ ] **FE-6-008 Define application administration surface** — Refs: ADMIN-001; Depends: FEI-014; Evidence: list/detail/moderation behavior remains blocked until product scope and contract operations are explicit.
- [x] **FE-6-009 Build audit-log explorer** — Refs: AUDIT-001–003, API-ADMIN-005; Depends: FE-6-001; Backend: BE-7-006; Evidence: actor/action/target/time filters, cursor, URL restoration, dense/mobile views, and empty/error states pass.
- [x] **FE-6-010 Build redacted audit detail drawer** — Refs: AUDIT-002–003; Depends: FE-6-009; Evidence: request ID, actor, target, action, timestamp, and safe metadata render while prohibited fields fail fixture scans.
- [ ] **FE-6-011 Verify moderation accessibility and accountability** — Refs: ADMIN-002, frontend CLAUDE “Accessibility Requirements”; Depends: FE-6-002–010; Evidence: keyboard, zoom, focus, error summary, non-color status, and destructive confirmation review pass.
- [ ] **FE-6-012 Verify Phase 6 mock journeys** — Refs: ADMIN, AUDIT; Depends: FE-6-001–011; Evidence: user/company/job moderation and audit exploration pass with denial, conflict, redaction, and mobile variants.
- [ ] **FE-6-013 Verify Phase 6 live integrations** — Refs: API-ADMIN-001–005; Depends: FE-6-012 and corresponding backend verification; Evidence: live role authorization, reason/version rules, downstream effects, and audit records pass.

## Phase 7 — Accessibility, Performance, Security, and Release Hardening

**Phase status:** In progress — 0 of 29 release gates fully verified. Local frontend work exists for FE-7-001, FE-7-005, FE-7-008–009, FE-7-011, FE-7-017, FE-7-020, FE-7-024–027, but those checkboxes remain open until their complete browser, environment, policy, or production evidence passes.
**Goal:** verify the frontend as an operable, secure, accessible, responsive,
performant, and deployable enterprise application.

- [ ] **FE-7-001 Complete guest critical-journey E2E** — Refs: AUTH-001–002, JOB-004, SEARCH-001–004; Depends: FE-2-002–003, FE-3-001–010; Evidence: browse/search/filter/detail/register/login paths pass with denial and recovery variants.
- [ ] **FE-7-002 Complete candidate critical-journey E2E** — Refs: CAND, SAVE, CV, APP, INT, NOTIF, AI; Depends: FE-2-007–012, FE-2-020–026, FE-3-011–012, FE-4-001–007, FE-5-001–015; Evidence: profile→CV→search→save→apply→history→interview→notification→analysis passes.
- [ ] **FE-7-003 Complete recruiter critical-journey E2E** — Refs: COMP, JOB, APP, INT; Depends: FE-2-013–019, FE-3-013–023, FE-4-008–021; Evidence: company→job→publish→applicants→transition→interview→outcome passes with scope denial.
- [ ] **FE-7-004 Complete administrator critical-journey E2E** — Refs: ADMIN, AUDIT; Depends: FE-6-001–013; Evidence: moderation and audit paths pass with non-admin denial and sensitive-field scans.
- [ ] **FE-7-005 Run full automated accessibility suite** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-7-001–004; Evidence: axe checks report no unresolved serious/critical violations across route/state inventory.
- [ ] **FE-7-006 Run keyboard-only acceptance** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-7-001–004; Evidence: all critical journeys complete with logical order, visible focus, escape behavior, and focus restoration.
- [ ] **FE-7-007 Run screen-reader smoke acceptance** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-7-005–006; Evidence: landmarks, headings, forms, errors, tables, dialogs, statuses, and async announcements are recorded in the test matrix.
- [ ] **FE-7-008 Verify zoom, reflow, and target-size compliance** — Refs: frontend CLAUDE “Accessibility Requirements”; Depends: FE-7-005; Evidence: 200% zoom, 320px reflow, 44px targets, and no obscured focus/content pass.
- [ ] **FE-7-009 Run responsive viewport matrix** — Refs: frontend CLAUDE “Layout and Responsive Behavior”; Depends: FE-7-001–004; Evidence: 320/375/414/768/1024/1440 screenshots and task-completion results have no unintended horizontal overflow.
- [ ] **FE-7-010 Establish visual-regression baselines** — Refs: frontend CLAUDE “Enterprise Design Direction”; Depends: FE-7-009; Evidence: deterministic light/dark stories and critical route screenshots are approved with motion/fonts stabilized.
- [ ] **FE-7-011 Verify dark-theme semantic parity** — Refs: frontend CLAUDE “Brand baseline”; Depends: FE-1-018–022, FE-7-005; Evidence: every semantic status, overlay, chart/evidence view, focus ring, and disabled state meets contrast requirements.
- [ ] **FE-7-012 Enforce route and shared bundle budgets** — Refs: NFR-PERF-001–003; Depends: FE-1-028, all feature routes; Evidence: production build reports agreed initial/shared/route thresholds and fails regressions.
- [ ] **FE-7-013 Profile high-density recruiter/admin views** — Refs: NFR-PERF-001–003; Depends: FE-4-008–022, FE-6-002–010; Evidence: React Profiler traces justify memoization/virtualization decisions and interaction targets pass.
- [ ] **FE-7-014 Verify Core Web Vitals and layout stability** — Refs: NFR-PERF-001–003; Depends: FE-7-012; Evidence: representative public and authenticated routes meet approved LCP/INP/CLS budgets on documented hardware/network.
- [ ] **FE-7-015 Audit network waterfalls and cancellation** — Refs: NFR-PERF-001–004; Depends: all live integrations; Evidence: independent requests start together, obsolete search/polling aborts, and no hidden duplicate fetches remain.
- [ ] **FE-7-016 Complete authentication and cache security review** — Refs: AUTH-003–006, NFR-SEC-001–005; Depends: FE-1-010, FE-2-004–006; Evidence: refresh, reuse/revocation response, logout, role/company change, history, and cache clearing scenarios pass.
- [ ] **FE-7-017 Complete sensitive-data exposure scan** — Refs: CV-003, AUDIT-003, AI-008, NFR-SEC-004; Depends: FE-2-020–026, FE-5-006–015, FE-6-009–010; Evidence: bundles, storage, logs, traces, screenshots, fixtures, errors, and telemetry contain no prohibited data.
- [ ] **FE-7-018 Define and verify Content Security Policy** — Refs: NFR-SEC-002–005; Depends: FEI-003, FEI-015; Evidence: production topology policy covers API, fonts, images, telemetry, workers, and rejects unauthorized inline/external content.
- [ ] **FE-7-019 Verify offline, timeout, and backend-outage resilience** — Refs: NFR-REL-001–003; Depends: FE-1-026, critical journeys; Evidence: input preservation, bounded retry, stale content, safe mutation state, and recovery pass under controlled failures.
- [ ] **FE-7-020 Verify supported browser matrix** — Refs: NFR-TEST-003–004; Depends: FE-7-001–019; Evidence: documented current browser floors pass critical smoke journeys without unsupported silent degradation.
- [ ] **FE-7-021 Resolve localization launch scope and formatting** — Refs: frontend CLAUDE “Copy and Localization”, FEI-012; Depends: all user-visible features; Evidence: approved locales, extraction, date/time/currency/plural rules, long-copy layouts, and fallback tests pass.
- [ ] **FE-7-022 Integrate privacy-safe production telemetry** — Refs: NFR-OBS-001–004, NFR-SEC-004; Depends: FE-1-027, FEI-015; Evidence: release/environment/request correlation and source maps work while redaction scans pass.
- [ ] **FE-7-023 Define frontend deployment configuration** — Refs: NFR-SEC-002–003, NFR-REL-004; Depends: FEI-003, FEI-015; Evidence: origin, API base, refresh cookie, CSP, cache headers, immutable assets, rollback, and health behavior are documented and tested.
- [ ] **FE-7-024 Complete dependency and supply-chain review** — Refs: NFR-SEC-005; Depends: FE-1-028; Evidence: lockfile, license, vulnerability, provenance, and unused-dependency checks meet approved severity policy.
- [ ] **FE-7-025 Run final contract and mock drift audit** — Refs: API contract §16; Depends: all live integrations; Evidence: DTO/enums/endpoints/errors/fixtures/OpenAPI comparisons have no unexplained differences.
- [ ] **FE-7-026 Run final enterprise UI consistency critique** — Refs: frontend CLAUDE “Enterprise Design Direction”; Depends: FE-7-005–014; Evidence: typography, tokens, hierarchy, density, evidence rail, copy, icons, motion, and anti-pattern review has no unresolved release blocker.
- [ ] **FE-7-027 Write frontend operational runbook** — Refs: NFR-OBS-003–004; Depends: FE-7-018–023; Evidence: bad deploy, chunk failure, API outage, auth loop, telemetry outage, and rollback procedures are exercised.
- [ ] **FE-7-028 Execute final frontend release checklist** — Refs: all; Depends: FE-7-001–027; Evidence: contract, tests, accessibility, performance, security, observability, deployment, changelog, and documentation gates all pass.
- [ ] **FE-7-029 Tag the verified frontend release** — Refs: all; Depends: FE-7-028; Evidence: semantic version, release notes, immutable artifact identifier, source commit, and changelog agree.

## Activity Log

Add newest entries first. Record phase/task state changes, blockers, contract
changes, or verification events; routine edits belong in Git history.

| Date | Task or phase | Change | Evidence / next action |
| --- | --- | --- | --- |
| 2026-09-10 | Backend contract remapping | Reconciled all frontend consumers with the merged backend controllers/DTOs and removed invented runtime data/routes | Live Swagger exposes 53/53 required endpoints; live register/me/refresh returned 201/200/200; 60 frontend unit tests, typecheck, production build, sensitive-data scan, and production dependency audit pass. Full authenticated journeys remain blocked by backend migration `P3018` and four backend notification test timeouts. |
| 2026-09-10 | FE-5-003, FE-5-014, FE-6-004–007 | Added real unread summary, classified AI failure/privacy messaging, and ID/slug-based admin company/job moderation | Notification/interview custom pagination envelopes are adapted at the API boundary; admin writes use backend-returned IDs and versions. No company/job/application admin collection API was invented. |
| 2026-09-10 | Tracker correction | Corrected phase-status lines and marked completed frontend build tasks FE-5-006, FE-5-009–010, FE-5-012, and FE-5-015 | Root cause was a previous broad status replacement that updated Phase 1 instead of Phase 5; release-only and live-integration gates remain unchecked. |
| 2026-09-10 | Phase 7 hardening | Added real-environment Playwright projects, axe light/dark checks, 320px reflow/target checks, responsive role navigation, reduced motion/dark tokens, production bundle scanning, changelog, and operations runbook | 37 unit tests, build, typecheck, lint, Chromium/WebKit/mobile guest journeys, 12 axe checks, and production dependency audit pass; Firefox runner hangs in this host and authenticated journeys require real role credentials. |
| 2026-09-10 | FE-7-018, FE-7-021–023 | Blocked by production decisions | FEI-003/012/015 must approve origin/cookie/CSP, localization, telemetry, and deployment topology before these tasks can be verified. |
| 2026-09-10 | FE-7-024–025 | Partial audit only | `npm audit` reports zero advisories and runtime/dist contain no mock worker; Storybook 10.6 versus Vitest 5 peer incompatibility and proposed `/companies/mine` contract drift keep release gates open. |
| 2026-09-10 | Phase 6 | Implemented contracted admin user moderation and audit exploration | FE-6-001–003 and FE-6-009–010 verified; company/job discovery and application administration remain blocked by FEI-014. |
| 2026-09-10 | Phase 5 | Implemented contracted notification, operation, AI analysis/evidence, recommendation, and natural-language search surfaces using `/api/v1` | FE-5-001–002, FE-5-004–012 except FE-5-003, and FE-5-015 are complete; unread summary, consent/retention, full async acceptance, and live backend evidence remain open. |
| 2026-09-08 | Phase 0 | Verified | Frontend instructions, 181 detailed `FE-*` tasks, decision register, source links, UTF-8, honest runtime status, and whitespace checks passed; Phase 1 is next and not started. |
| 2026-09-08 | Frontend scope | React + Vite workstream restored by explicit user direction | Documentation only; no runtime capability is claimed. |
| 2026-09-08 | Enterprise UI | Added trust-and-evidence design direction | Phase 1 establishes semantic tokens, accessible primitives, Storybook, responsive shell, and evidence rail before feature pages. |
| 2026-09-08 | API dependency audit | Aligned with backend inventory | Approved contract APIs are planned; proposed or decision-dependent APIs remain linked to frontend issues. |
