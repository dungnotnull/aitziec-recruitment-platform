# Frontend Documentation Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the frontend documentation stub with a complete, contract-driven implementation backlog and enterprise UI engineering standard derived from the approved product and backend plans.

**Architecture:** Keep three frontend-owned documents with separate responsibilities: engineering rules, execution tracking, and durable issue/decision tracking. Align frontend phases to complete user journeys and backend readiness while preserving honest planned status and contract authority.

**Tech Stack:** Markdown, PowerShell validation, React 19 + Vite + strict TypeScript as the documented target, TanStack Router/Query, React Hook Form + Zod, MSW, Vitest, Testing Library, Playwright, axe-core, Storybook, Tailwind CSS v4 with semantic tokens.

## Global Constraints

- This change updates documentation only and must not claim that a runtime frontend exists.
- `API-CONTRACT.md` remains authoritative for endpoints, DTOs, enums, errors, pagination, and transitions.
- `PROJECT-DETAIL.md` remains authoritative for actors, product scope, business rules, and quality requirements.
- Backend task IDs are readiness dependencies, not frontend completion evidence.
- Every remote UI surface must plan loading, empty, error, unauthorized, forbidden, stale/conflict, offline, and retry behavior where applicable.
- Enterprise UI requirements include WCAG 2.2 AA, keyboard completion, responsive task completion, reduced-motion support, and semantic design tokens.
- Files remain UTF-8 and use English for formal requirements, identifiers, task names, and technical rules.

---

### Task 1: Expand Frontend Engineering Instructions

**Files:**
- Modify: `frontend/CLAUDE.md`

**Interfaces:**
- Consumes: `PROJECT-DETAIL.md`, `API-CONTRACT.md`, root `CLAUDE.md`, frontend design spec.
- Produces: mandatory architecture, API, state, UI, accessibility, security, testing, and tracking rules for all later frontend work.

- [ ] **Step 1: Run the baseline assertion and verify it fails**

```powershell
$text = Get-Content -Raw -Encoding UTF8 frontend/CLAUDE.md
@(
  'React 19',
  'WCAG 2.2 AA',
  'TanStack Query',
  'Content Security Policy',
  'Storybook',
  'optimistic concurrency'
) | ForEach-Object { if (-not $text.Contains($_)) { throw "Missing frontend rule: $_" } }
```

Expected: FAIL on at least `React 19` because the current file is a framework-selection stub.

- [ ] **Step 2: Replace the stale framework-selection language**

Record React + Vite as confirmed and set the source order to contract, product detail, frontend instructions, frontend tracker, frontend issues, and backend tracker for dependency evidence.

- [ ] **Step 3: Add architecture and dependency rules**

Document feature-oriented directories, direct imports, role-aware route groups,
lazy feature boundaries, typed API-client ownership, TanStack Query server state,
router-owned shareable state, local form/UI state, and prohibited direct HTTP
calls from components.

- [ ] **Step 4: Add enterprise UI standards**

Require semantic design tokens, reusable primitives, information-density modes,
responsive table/card alternatives, status semantics, accessible forms,
keyboard-complete overlays, feedback timing, motion limits, and full remote-state
coverage.

- [ ] **Step 5: Add security, performance, and test gates**

Specify refresh-cookie/access-token handling, sensitive-data exclusions,
sanitized rich content, request cancellation, route code splitting, bundle
budgets, component/accessibility/contract/E2E/visual tests, and evidence rules.

- [ ] **Step 6: Run the assertion again**

Run the command from Step 1.

Expected: PASS with no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/CLAUDE.md
git commit -m "docs(frontend): define engineering and enterprise UI standards"
```

### Task 2: Replace the Frontend Tracker With a Full Delivery Backlog

**Files:**
- Modify: `frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`

**Interfaces:**
- Consumes: frontend instructions, product requirement IDs, contract endpoint catalog, backend API/task inventory.
- Produces: stable `FE-*` tasks with references, dependencies, evidence, and activity history across phases 0–7.

- [ ] **Step 1: Run tracker structure assertions and verify they fail**

```powershell
$text = Get-Content -Raw -Encoding UTF8 frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md
$ids = [regex]::Matches($text, 'FE-[0-7]-[0-9]{3}') | ForEach-Object Value | Sort-Object -Unique
if ($ids.Count -lt 80) { throw "Expected at least 80 detailed tasks, found $($ids.Count)" }
0..7 | ForEach-Object { if (-not $text.Contains("## Phase $_")) { throw "Missing Phase $_" } }
@('Requirement/API refs', 'Depends', 'Evidence', 'Enterprise UI') |
  ForEach-Object { if (-not $text.Contains($_)) { throw "Missing tracker concept: $_" } }
```

Expected: FAIL because the current tracker has four coarse tasks and no complete phase breakdown.

- [ ] **Step 2: Add policy, readiness, and UI inventory sections**

Define honest status syntax, backend readiness semantics, contract-change handling,
enterprise surface inventory, shared shell/primitives, role boundaries, and the
rule that a checked task needs reproducible evidence.

- [ ] **Step 3: Add Phase 0 and Phase 1 tasks**

Break documentation/product mapping and platform/design-system foundation into
small tasks covering framework decisions, package baseline, routing, providers,
API client, mock layer, Storybook, tokens, primitives, responsive shell,
telemetry safety, test harnesses, and CI gates.

- [ ] **Step 4: Add Phase 2 and Phase 3 tasks**

Cover auth/session UX, candidate profile, company context, CV workflows, public
job discovery, URL filters, job detail, saved jobs, recruiter job editor, job
lifecycle, concurrency recovery, and representative performance states.

- [ ] **Step 5: Add Phase 4 and Phase 5 tasks**

Cover candidate application submission/history, recruiter applicant workspace,
strict pipeline transitions, interview workflows, notification center,
asynchronous operation UI, AI match/gap analysis, natural-language search, and
recommendations with advisory presentation.

- [ ] **Step 6: Add Phase 6 and Phase 7 tasks**

Cover admin moderation/audit interfaces, cross-role E2E, accessibility,
responsive and visual regression, performance budgets, security review,
observability, resilience, deployment configuration, and release verification.

- [ ] **Step 7: Add activity log and run assertions**

Append an entry recording the documentation-baseline expansion and run Step 1.

Expected: PASS with at least 80 unique task IDs and all phase headings.

- [ ] **Step 8: Commit**

```bash
git add frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md
git commit -m "docs(frontend): add phased implementation backlog"
```

### Task 3: Expand the Frontend Decision and Issue Register

**Files:**
- Modify: `frontend/ISSUES-LIST-TRACKING.md`

**Interfaces:**
- Consumes: unresolved product/backend decisions and choices required by the frontend backlog.
- Produces: durable `FEI-*` blockers with impact, temporary planning assumption, resolution criteria, and affected tasks.

- [ ] **Step 1: Run issue-register assertions and verify they fail**

```powershell
$text = Get-Content -Raw -Encoding UTF8 frontend/ISSUES-LIST-TRACKING.md
$ids = [regex]::Matches($text, 'FEI-[0-9]{3}') | ForEach-Object Value | Sort-Object -Unique
if ($ids.Count -lt 8) { throw "Expected at least 8 frontend issues, found $($ids.Count)" }
@('Impact', 'Current planning assumption', 'Resolution criteria', 'Affected tasks') |
  ForEach-Object { if (-not $text.Contains($_)) { throw "Missing issue field: $_" } }
```

Expected: FAIL because the current register contains no issue records.

- [ ] **Step 2: Add status/severity policy and issue records**

Track at least: frontend package/runtime version lock, design language and brand
assets, cookie/CSRF and deployment-origin assumptions, company selection API,
recruiter job-list API, CV retry behavior, interview detail access, early
rejection, submitted-CV retention, AI privacy/consent, notification unread
summary, localization, and production telemetry/deployment.

- [ ] **Step 3: Add issue activity and maintenance rules**

Require linked tasks/contracts, evidence-based resolution, retained fixed
records, newest-first activity, and no duplication of ordinary feature work.

- [ ] **Step 4: Run issue assertions**

Run the command from Step 1.

Expected: PASS with at least eight unique `FEI-*` records.

- [ ] **Step 5: Commit**

```bash
git add frontend/ISSUES-LIST-TRACKING.md
git commit -m "docs(frontend): register delivery decisions and blockers"
```

### Task 4: Validate Cross-Document Consistency

**Files:**
- Verify: `frontend/CLAUDE.md`
- Verify: `frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`
- Verify: `frontend/ISSUES-LIST-TRACKING.md`

**Interfaces:**
- Consumes: all outputs from Tasks 1–3.
- Produces: reproducible evidence that the frontend documentation is internally consistent and does not overstate implementation.

- [ ] **Step 1: Validate identifiers and references**

```powershell
$tracker = Get-Content -Raw -Encoding UTF8 frontend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md
$issues = Get-Content -Raw -Encoding UTF8 frontend/ISSUES-LIST-TRACKING.md
$taskIds = [regex]::Matches($tracker, 'FE-[0-7]-[0-9]{3}') | ForEach-Object Value
$issueIds = [regex]::Matches($issues, 'FEI-[0-9]{3}') | ForEach-Object Value
if (($taskIds | Sort-Object -Unique).Count -lt 80) { throw 'Frontend task coverage is incomplete' }
if (($issueIds | Sort-Object -Unique).Count -lt 8) { throw 'Frontend issue coverage is incomplete' }
```

Expected: PASS.

- [ ] **Step 2: Validate honest status and prohibited claims**

```powershell
$files = Get-ChildItem frontend -File -Filter *.md
$text = $files | Get-Content -Raw -Encoding UTF8
if ($text -match 'Runtime status:\s*(Implemented|Verified)') { throw 'Runtime status is overstated' }
if ($text -match 'framework is not selected') { throw 'Stale framework decision remains' }
```

Expected: PASS.

- [ ] **Step 3: Validate formatting and links**

```powershell
git diff --check
@('PROJECT-DETAIL.md','API-CONTRACT.md','backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md') |
  ForEach-Object { if (-not (Test-Path $_)) { throw "Missing referenced source: $_" } }
```

Expected: PASS with no whitespace errors and all controlling files present.

- [ ] **Step 4: Review the final diff**

```bash
git diff --stat HEAD~3..HEAD
git status --short
```

Expected: the three frontend documents are updated, the design/plan checkpoints
are present, and the worktree is clean after the final commit.
