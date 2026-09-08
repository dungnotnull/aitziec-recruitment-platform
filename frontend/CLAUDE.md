# Frontend Engineering Instructions

This file governs all work under `frontend/`. It extends the repository-wide
rules in `../CLAUDE.md` and translates the approved product and API documents
into frontend architecture, delivery, and enterprise UI standards.

## Current State

- Runtime status: `Planned`; no frontend application has been scaffolded or
  verified.
- Confirmed platform: React 19 + Vite + strict TypeScript.
- Contract baseline: `../API-CONTRACT.md` version `0.1.0-draft`.
- Every application capability remains planned until code and its required
  verification evidence exist.
- Backend tracker entries indicate dependency readiness only. They are never
  frontend completion evidence.

## Required Reading and Source Order

Before frontend work, read the relevant sections in this order:

1. `../API-CONTRACT.md` for endpoints, DTOs, shared enums, error codes,
   pagination, idempotency, optimistic concurrency, and transitions.
2. `../PROJECT-DETAIL.md` for actors, product rules, workflows, privacy, and
   quality requirements.
3. This file for frontend implementation and UI rules.
4. `DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` for task scope, dependencies,
   and evidence.
5. `ISSUES-LIST-TRACKING.md` for unresolved frontend decisions and blockers.
6. `../backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` for backend runtime
   readiness.
7. `../docs/ROADMAP.md` and `../CHANGELOG.md` for milestone and release context.

When documents disagree, follow the higher authority for its domain and repair
the lower document in the same change when that file is in scope.

## Planned Technology Baseline

| Concern | Planned choice | Rule |
| --- | --- | --- |
| UI runtime | React 19 | Use function components and framework-native composition |
| Build tooling | Vite | Keep environment variables statically typed and public-only |
| Language | TypeScript strict mode | Do not use implicit `any`, unchecked casts, or duplicated API enums |
| Routing | TanStack Router | Typed routes, role-aware route groups, URL-owned search state |
| Server state | TanStack Query | Query keys live with features; mutations own invalidation and conflict recovery |
| Forms | React Hook Form + Zod | Accessible labels, shared contract-aligned validation, server error mapping |
| Styling | Tailwind CSS v4 | CSS-first `@theme`; semantic tokens instead of raw values in features |
| Primitives | Radix UI primitives + local wrappers | Accessibility behavior is wrapped behind project-owned components |
| Icons | Lucide React | No emoji as functional icons; icon-only controls require accessible names |
| Component workshop | Storybook | Cover reusable states and visual regression fixtures |
| Unit/component tests | Vitest + Testing Library + axe-core | Test user-observable behavior and accessibility |
| API mocks | Mock Service Worker | Fixtures derive from the contract, not component-local objects |
| Browser tests | Playwright | Cover critical role journeys, responsive behavior, and screenshots |

Exact package versions are locked during scaffolding and recorded against
`FEI-001`. A version change must update lockfiles, verification evidence, and
this table when it changes an architectural baseline.

## Directory and Module Boundaries

Use feature-oriented organization:

```text
frontend/
  src/
    app/                    # bootstrap, providers, router, layouts, error boundary
    api/                    # transport, generated/shared DTOs, contract adapters
    features/
      auth/
      candidate-profile/
      companies/
      jobs/
      saved-jobs/
      cvs/
      applications/
      interviews/
      notifications/
      ai-assistance/
      admin/
    shared/
      ui/                   # project-owned primitives and compositions
      lib/                  # framework-neutral helpers
      hooks/                # cross-feature React hooks only
      assets/
      styles/               # Tailwind import, theme, reset, global utilities
      test/
  e2e/
```

- A feature exports a narrow public API. Do not import another feature's
  internal components, query keys, or test fixtures.
- Import leaf modules directly. Avoid broad barrel files that pull unrelated
  features into the initial bundle.
- Route groups are `public`, `candidate`, `recruiter`, and `admin`. Lazy-load
  authenticated feature groups and heavy editors or data views.
- Components do not call `fetch`, Axios, or generated clients directly. Feature
  query/mutation modules call the shared typed API transport.
- Keep files focused. Split a component when it owns unrelated data fetching,
  business mapping, and visual composition at the same time.
- Do not put business rules in presentation components. Convert contract data
  into explicit view models near the feature boundary.

## State Ownership

- TanStack Query owns remote data, loading state, freshness, retries, cache
  invalidation, cancellation, and mutation outcomes.
- TanStack Router owns shareable and navigable state such as job query, filters,
  sort, cursor position, active company, and selected admin filters.
- React Hook Form owns form state. Do not mirror every field in component state.
- Component state owns transient presentation only: open panels, disclosure,
  local selection, and unsaved UI preferences.
- Context is limited to stable app-wide concerns such as authenticated identity,
  theme, locale, and active company. Do not place rapidly changing tables or
  form fields in global context.
- Derive display values during render. Do not use effects to synchronize values
  that can be calculated from props, router state, or query data.

## API and Contract Rules

- Use `/api/v1` and the success, collection, error, and empty-response envelopes
  defined by `../API-CONTRACT.md`.
- Treat error `code` as programmatic and `message` as a safe display fallback.
  Preserve `requestId` in error details so support can correlate failures.
- One shared transport layer owns base URL, headers, JSON decoding, refresh
  coordination, request cancellation, timeouts, and envelope parsing.
- Refresh the session through the backend-managed secure cookie. Keep the access
  token in memory; never write access or refresh tokens to localStorage,
  sessionStorage, IndexedDB, logs, URLs, or analytics.
- Queue concurrent `401` retries behind one refresh request. Retry an original
  request at most once, then clear client identity and route to login while
  retaining only a safe return location.
- Generate a stable `Idempotency-Key` for contracted idempotent mutations and
  retain it only for that user action's retry window.
- Send `expectedVersion` for optimistic concurrency mutations. A conflict must
  show the stale data, explain that the resource changed, and offer reload or
  safe reapply; never silently overwrite.
- Cursor collections append or replace deterministically according to the
  surface. Do not invent page numbers when the contract provides cursors.
- Proposed endpoints in the backend inventory are unavailable until added to
  `../API-CONTRACT.md` and verified by backend evidence. Link the corresponding
  `FEI-*` issue instead of coding around the gap.
- Before changing a DTO, enum, route, query parameter, response assumption, or
  error behavior, update the API contract through its change protocol.

## Remote View State Contract

Every remote surface must intentionally design and test applicable states:

| State | Required behavior |
| --- | --- |
| Initial loading | Stable skeleton matching final geometry; no layout jump |
| Background refresh | Preserve usable content and expose subtle freshness feedback |
| Empty | Explain why it is empty and provide the next valid action |
| Validation error | Field-level error plus focused summary for multi-field failures |
| Recoverable error | Plain cause, retry action, and request ID when available |
| Unauthorized | Preserve safe return URL and offer login |
| Forbidden | Explain scope without revealing private resource existence |
| Not found | Offer a route back to the nearest valid collection |
| Offline/timeout | Preserve user input and provide explicit retry |
| Stale/conflict | Compare or reload current data before resubmission |
| Rate limited | Respect retry metadata and prevent repeated submissions |
| Success | Confirm the exact action using the same product vocabulary |

Loading indicators must not replace an entire usable view during background
refresh. Destructive and high-impact mutations require visible pending state and
duplicate-submission protection.

## Enterprise Design Direction

ITZiec uses a calm “trust and evidence” visual language suitable for candidates,
recruiters, and administrators. It must feel precise and credible, not playful
or like a generic AI dashboard.

### Visual signature

The distinctive project element is an **evidence rail**: a reusable vertical or
horizontal structure that connects application history, interview events, AI
evidence, audit records, and asynchronous operation progress. It communicates
sequence and provenance only where the information is truly ordered. It is not
used as decoration.

### Brand baseline

| Token role | Baseline | Intent |
| --- | --- | --- |
| Ink | `#0F172A` | Primary navigation, strong text, authority |
| Slate | `#334155` | Secondary surfaces and dense utility UI |
| Action | `#0369A1` | Primary actions and links |
| Canvas | `#F8FAFC` | Application background |
| Surface | `#FFFFFF` | Cards, dialogs, and focused work areas |
| Border | `#E2E8F0` | Quiet structural separation |
| Danger | `#DC2626` | Destructive actions and blocking errors only |

Implement these as perceptually tuned semantic tokens in Tailwind v4 `@theme`,
with dark-mode counterparts evaluated separately. Feature components consume
names such as `background`, `surface`, `foreground`, `muted`, `primary`,
`success`, `warning`, `danger`, `border`, and `focus`; they do not embed hex or
palette-scale values.

- Display and major workspace headings: Plus Jakarta Sans, restrained to
  strong hierarchy and product identity.
- Body and controls: Inter for compact, high-legibility operational text.
- IDs, request references, scores, and tabular numerals: IBM Plex Mono.
- Base body text is at least `16px` with a minimum `1.5` line height. Utility
  labels never go below `12px` and cannot carry essential content alone.
- Default density is compact-enterprise, but touch targets remain at least
  `44x44px`. Density changes spacing, not legibility or hit area.
- Use one clear primary action per view. Secondary actions are visually quiet;
  destructive actions never share primary styling.
- Use icons from one outlined family. Do not mix emoji, filled clip art, and
  unrelated icon styles.
- Avoid decorative AI purple/pink gradients, excessive glass effects, fake live
  charts, and animation that does not explain state.

## Layout and Responsive Behavior

- Design mobile-first, then verify at `320`, `375`, `414`, `768`, `1024`, and
  `1440` CSS pixels.
- Public discovery uses a content-first shell. Recruiter/admin workspaces use a
  persistent desktop rail and a compact mobile top bar/drawer.
- Preserve filters in a URL-backed sheet on small screens and a visible filter
  rail on large screens.
- Data tables may scroll horizontally only when column comparison is the task.
  Otherwise convert rows to labelled cards, hide non-critical columns behind a
  detail view, and keep primary actions reachable.
- Sticky headers and action bars must not obscure focused elements or validation
  summaries. Account for browser zoom to 200% and safe areas.
- Avoid fixed-height content containers for variable job descriptions, CV
  metadata, application timelines, and translated copy.

## Interaction and Motion

- All interactions are keyboard-complete and have a visible `3px` or `4px`
  focus indication with sufficient contrast.
- Hover is enhancement only. Focus, selected, expanded, pending, success, and
  disabled states remain understandable without hover or color alone.
- Use motion to explain hierarchy or state change. Standard transitions stay in
  the `150–300ms` range; larger route/sheet transitions may use up to `400ms`.
- Prefer opacity and transform. Do not animate layout dimensions when it causes
  reflow or obscures focus.
- Respect `prefers-reduced-motion` by removing non-essential movement and
  rendering the final state immediately.
- Dialogs, menus, comboboxes, sheets, and popovers restore focus predictably,
  support Escape where appropriate, and expose accessible names.
- Toasts never contain the only copy of an error or required action. Important
  status changes also update an appropriate live region or persistent surface.

## Domain-Specific UX Rules

- Show application statuses with text and a consistent semantic badge; never
  use color alone. The UI exposes only transitions allowed by the contract.
- Candidate history excludes recruiter-private notes. Recruiter views label
  private notes and candidate-visible instructions unambiguously.
- CV upload exposes PDF constraints before selection, upload progress,
  processing state, failure reason, retry availability, and safe deletion rules.
- Job salary uses contract currency/minor-unit semantics and never fabricates an
  average when a bound is absent.
- Search filters are reversible, URL-backed, removable individually, and
  summarized clearly on mobile.
- AI match and gap views present component scores, evidence, missing inputs,
  limitations, model/schema provenance where appropriate, and explicit advisory
  language. AI output cannot render as a pass/reject recommendation or trigger a
  pipeline transition.
- Moderation forms require a reason before enabling the action and present the
  target, scope, and consequence in the confirmation step.

## Accessibility Requirements

- Meet WCAG 2.2 AA for contrast, keyboard access, focus visibility, semantics,
  status announcements, zoom/reflow, target size, and error identification.
- Use native elements first. ARIA supplements semantics; it does not recreate a
  native button, link, input, table, or dialog unnecessarily.
- Every input has a persistent visible label. Placeholder text is example or
  hint content only.
- On failed multi-field submit, show an error summary, move focus to it, and link
  each item to its field while retaining inline errors.
- Announce asynchronous status changes without repeatedly interrupting screen
  readers. Polling indicators use restrained live-region updates.
- Tables have captions or accessible names, correct header relationships, and
  a non-color-only representation of status.
- Automated axe checks are required, but critical journeys also receive manual
  keyboard and screen-reader smoke verification.

## Performance and React Rules

- Start independent requests together and avoid chained client waterfalls.
- Lazy-load role workspaces, rich editors, charts, PDF helpers, and admin tools.
  Do not include them in the public job-search entry bundle.
- Use direct imports and analyzable paths. Review bundle output before adding a
  large dependency.
- Use Suspense or route pending boundaries where they preserve useful shell
  content and prevent full-page flicker.
- Abort obsolete search, autocomplete, and navigation requests. Debounce only
  inputs that benefit from it; do not delay direct button actions.
- Build `Map` or `Set` indexes for repeated large-list lookup. Virtualize only
  after profiling proves a rendering bottleneck.
- Subscribe to the smallest derived state. Use functional updates and lazy state
  initialization where they prevent stale closures or repeated work.
- Do not define components inside other components. Avoid effects for actions
  that belong in event handlers.
- Establish measurable route bundle, Core Web Vitals, and large-list interaction
  budgets in Phase 7; profile before optimization.

## Security and Privacy

- Never render unsanitized job descriptions, CV text, recruiter notes, or AI
  output with `dangerouslySetInnerHTML`.
- Do not persist or log passwords, tokens, raw CV contents, signed URLs, private
  notes, full AI prompts, or sensitive provider payloads.
- Request a signed CV download only when the user activates download. Do not
  prefetch, cache, place it in browser history, or send it to telemetry.
- Treat route guards as navigation UX, not authorization. Backend ownership,
  membership, and role checks remain authoritative.
- Define a Content Security Policy with the deployment architecture before
  production. Avoid inline script/style exceptions unless documented and
  minimized.
- Redact query strings, form values, response payloads, and breadcrumbs before
  sending frontend telemetry. Allow-list safe metadata.
- Clear sensitive query/cache state on logout, role loss, company-context
  change, and terminal authentication failure.

## Testing and Evidence

- Follow test-driven development for new behavior: write a focused failing test,
  observe the expected failure, implement minimally, pass it, then refactor.
- API-client tests cover envelopes, refresh concurrency, one-retry behavior,
  error mapping, idempotency headers, expected versions, cursor pagination,
  cancellation, and timeouts.
- Component tests cover meaningful user actions and every applicable remote view
  state. Prefer role/label/text queries over implementation selectors.
- MSW handlers and fixtures mirror the contract and include denial, conflict,
  validation, rate-limit, timeout, and malformed-response cases.
- Storybook stories cover primitives and stable feature compositions at their
  major states. Visual snapshots use deterministic data and animation controls.
- Playwright covers guest job discovery; auth/session recovery; candidate
  profile, CV, save, apply, and history; recruiter job/pipeline/interview work;
  and admin moderation/audit work.
- CI gates include format, lint, strict type-check, unit/component tests,
  accessibility tests, production build, E2E smoke, and agreed bundle limits.
- A task is `Done` only when its listed evidence passes. Compilation or file
  existence alone is not evidence for runtime behavior.

## Copy and Localization

- Write interface copy from the user's perspective with active verbs and
  sentence case: `Publish job`, `Save changes`, `Schedule interview`.
- Keep action vocabulary consistent from button through confirmation and toast.
- Empty states explain the next valid action. Errors state what happened, what
  remains safe, and how to recover; do not use vague apology text.
- Do not concatenate translated fragments. Format UTC timestamps and currency
  only in the presentation layer through locale-aware utilities.
- The localization launch scope is tracked by `FEI-012`; until resolved, keep
  all copy extractable and avoid layout assumptions tied to English length.

## Tracking Workflow

- Only frontend work updates the two frontend tracker files.
- Before starting a task, confirm its contract and backend dependencies. If a
  dependency is unavailable, retain `Planned` or set `Blocked` with an `FEI-*`
  reference.
- Allowed task states are `Planned`, `In progress`, `Blocked`, `Implemented`,
  `Verified`, and `Deferred`.
- Update the activity log only for task/phase state changes, blockers, contract
  changes, or verification events. Routine edits belong in Git history.
- Record unresolved defects or decisions in `ISSUES-LIST-TRACKING.md`; never hide
  them by weakening task evidence.
- Add a changelog entry for user-visible behavior, architectural baselines,
  security changes, contract behavior, or verified milestone changes.
