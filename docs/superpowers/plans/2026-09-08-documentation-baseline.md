# Documentation Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a consistent Markdown documentation baseline for backend-first development of the ITZiec recruitment platform.

**Architecture:** Use a contract-first documentation hierarchy: product requirements define intent, the API contract defines shared interfaces, repository and directory conventions define implementation boundaries, and roadmap/tracking files distinguish planned work from verified completion. The original brief remains immutable historical input, while the README becomes the navigation and onboarding entry point.

**Tech Stack:** React + Vite contract consumer; NestJS; Prisma; PostgreSQL; Redis; BullMQ; MinIO; Nodemailer; Mailpit; Gemini API; Docker Compose; OpenAPI.

**Execution status:** Completed and verified on 2026-09-08.

## Global Constraints

- English is used for requirements, contracts, identifiers, schemas, endpoints, and examples.
- Vietnamese is used only for comments or explanatory implementation notes where useful.
- Backend is the only workstream with a detailed task backlog.
- `API-CONTRACT.md` is the source of truth for shared HTTP interfaces and types.
- All product capabilities remain `Planned` until code and acceptance evidence exist.
- Existing unrelated user changes must be preserved.
- The original `itziec_recruitment_platform_details.md` remains unchanged.

---

### Task 1: Establish shared product and repository truth

**Files:**

- Create: `CLAUDE.md`
- Create: `PROJECT-DETAIL.md`

**Interfaces:**

- Consumes: original requirements from `itziec_recruitment_platform_details.md` and decisions in the approved design spec.
- Produces: document precedence, status vocabulary, requirement IDs, module boundaries, business rules, and non-functional targets referenced by all later documentation.

- [x] **Step 1: Write root repository conventions**

Define source-of-truth precedence, planned architecture, synchronous and asynchronous module communication, agent ownership, contract-first changes, security rules, test evidence, and documentation update rules.

- [x] **Step 2: Write the implementation-oriented product detail**

Define goals, non-goals, actors, functional requirements with stable identifiers, workflows, business rules, conceptual data model, security, observability, performance targets, and release acceptance criteria.

- [x] **Step 3: Validate shared terminology**

Run:

```powershell
rg -n "React|Vite|NestJS|Prisma|PostgreSQL|Planned|API-CONTRACT" CLAUDE.md PROJECT-DETAIL.md
```

Expected: all confirmed stack and status terms are present, with no conflicting framework or ORM.

### Task 2: Define the public HTTP API contract

**Files:**

- Create: `API-CONTRACT.md`

**Interfaces:**

- Consumes: requirement IDs and state-machine rules from `PROJECT-DETAIL.md`.
- Produces: base path, conventions, envelopes, enums, resource schemas, endpoint catalog, events, error codes, and contract change protocol used by both directory-specific convention files.

- [x] **Step 1: Define cross-cutting protocol rules**

Specify `/api/v1`, JSON naming, UUID identifiers, ISO timestamps, VND money fields, authentication, refresh rotation, request IDs, idempotency, optimistic concurrency, pagination, filtering, sorting, and standardized errors.

- [x] **Step 2: Define shared types and resource schemas**

Specify roles, lifecycle enums, application transitions, job and application resources, CV metadata, interviews, AI analysis, asynchronous operations, notifications, and domain-event envelopes.

- [x] **Step 3: Define endpoint catalog and access rules**

Cover auth, candidate profile, companies, jobs/search, saved jobs, CVs, applications, interviews, AI operations, recommendations, notifications, admin operations, and health endpoints. Each endpoint includes authorization, request shape, response shape, and important errors.

- [x] **Step 4: Define contract governance**

Document proposed-versus-implemented status, additive and breaking changes, update-first requirements, OpenAPI verification, and deprecation rules.

- [x] **Step 5: Validate contract completeness**

Run:

```powershell
rg -n "^## |^### |ApplicationStatus|ErrorResponse|/api/v1|Idempotency-Key|X-Request-Id" API-CONTRACT.md
```

Expected: all protocol sections and the application state machine are discoverable.

### Task 3: Define backend-specific agent conventions

**Files:**

- Create: `backend/CLAUDE.md`

**Interfaces:**

- Consumes: root conventions and `API-CONTRACT.md`.
- Produces: NestJS/Prisma implementation rules for the only active workstream.

- [x] **Step 1: Write backend conventions**

Document NestJS module layout, dependency direction, Prisma migrations and transactions, DTO validation, RBAC, events/outbox, BullMQ workers, storage, AI adapters, observability, testing, and ownership of backend trackers.

- [x] **Step 2: Check backend rules against the root contract**

Run:

```powershell
rg -n "API-CONTRACT.md|NestJS|Prisma|transaction|migration" backend/CLAUDE.md
```

Expected: backend rules require contract-first changes and contain only backend workstream context.

### Task 4: Create milestone and backend execution tracking

**Files:**

- Modify: `docs/ROADMAP.md`
- Create: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`
- Create: `backend/ISSUES-LIST-TRACKING.md`

**Interfaces:**

- Consumes: product requirement IDs, architecture modules, and contract endpoints.
- Produces: milestone-level phase order, detailed backend task checkboxes, acceptance evidence expectations, and durable issue history.

- [x] **Step 1: Normalize the roadmap**

Keep Phase 0 through Phase 7 at milestone level with goals, dependencies, scope, exit criteria, status, and update policy.

- [x] **Step 2: Write the backend phase tracker**

Create detailed unchecked tasks for documentation, platform foundation, identity/profiles, jobs/search, applications, CV/interviews/notifications, AI, and release hardening. Give each task a stable ID, dependencies, requirement references, and acceptance evidence.

- [x] **Step 3: Write the backend issue register**

Define severity and status vocabularies, issue fields, known pre-implementation risks, fixed-issue retention, verification evidence, and maintenance rules.

- [x] **Step 4: Verify phase alignment**

Run:

```powershell
rg -n "^## Phase [0-7]" docs/ROADMAP.md backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md
rg -n "^- \[ \] BE-[0-7]-" backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md
```

Expected: both phase documents contain Phase 0 through Phase 7 and backend implementation tasks remain unchecked.

### Task 5: Establish history and onboarding

**Files:**

- Create: `CHANGELOG.md`
- Modify: `README.md`

**Interfaces:**

- Consumes: every controlling document created in Tasks 1 through 4.
- Produces: accurate documentation history and a concise entry point with working relative links.

- [x] **Step 1: Create the changelog**

Use Keep a Changelog structure with `Unreleased` and initial documentation baseline entries. State clearly that runtime features are not implemented.

- [x] **Step 2: Rewrite the README as the project entry point**

Describe the planned platform, current status, confirmed stack, architecture, major capabilities, documentation map, target local services, target commands, contribution workflow, and license status without presenting non-working commands as available.

- [x] **Step 3: Verify README links**

Run a PowerShell check that extracts relative Markdown links and asserts that every local target exists.

Expected: all local documentation links resolve.

### Task 6: Cross-document validation

**Files:**

- Verify: all requested Markdown files.

**Interfaces:**

- Consumes: completed documentation set.
- Produces: evidence that paths, terminology, states, task status, and encoding are consistent.

- [x] **Step 1: Confirm exact file paths**

Run:

```powershell
@('CLAUDE.md','PROJECT-DETAIL.md','CHANGELOG.md','docs/ROADMAP.md','backend/CLAUDE.md','API-CONTRACT.md','backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md','backend/ISSUES-LIST-TRACKING.md','README.md') | ForEach-Object { if (-not (Test-Path $_)) { throw "Missing $_" } }
```

Expected: command exits successfully.

- [x] **Step 2: Scan for unresolved markers and conflicting stack choices**

Run targeted searches for deferred-detail markers, Vue, TypeORM, and claims that runtime features are complete.

Expected: no unresolved markers or stack conflicts; historical/contextual mentions are explicitly labeled.

- [x] **Step 3: Verify state-machine consistency**

Compare all occurrences of application statuses and allowed transitions against `API-CONTRACT.md`.

Expected: every document uses `APPLIED`, `REVIEWING`, `INTERVIEWING`, `PASSED`, and `REJECTED` with the same allowed transitions.

- [x] **Step 4: Review the final diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the requested documentation set and pre-existing untracked support files appear.
