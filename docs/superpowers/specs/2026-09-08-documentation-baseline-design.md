# Documentation Baseline Design

## Context

The repository currently contains an original requirements brief and a broad
README, but it does not contain application source code or package manifests.
The README describes a planned platform and still contains an ambiguous
`Vue / React` frontend choice. Without an explicit documentation hierarchy,
future agents could treat planned functionality as implemented or create
incompatible frontend and backend assumptions.

This design establishes the project documentation baseline before backend
implementation begins. The user is responsible only for backend development;
therefore, frontend documentation is limited to contract-consumer guidance and
does not include a frontend task backlog.

## Confirmed Decisions

- Frontend framework: React with Vite.
- Backend framework: NestJS.
- ORM: Prisma.
- Database: PostgreSQL.
- API style: versioned REST API with OpenAPI documentation.
- Documentation language: English for requirements, contracts, identifiers,
  schemas, endpoint definitions, and examples.
- Comments and explanatory implementation notes: Vietnamese where useful.
- Backend work is the only workstream with a detailed task-tracking document.
- AI output is advisory and must never independently reject or advance an
  application.

## Considered Approaches

### 1. Contract-first, phase-based documentation

Define shared data and behavior in `API-CONTRACT.md`, organize backend delivery
by roadmap phases, and represent current progress explicitly. This approach
reduces frontend/backend drift while avoiding false claims about implementation.

### 2. Exhaustive API-first documentation

Fully specify every endpoint and field before implementation. This reduces
short-term decisions during coding but creates a high revision cost because no
implementation or user feedback currently exists.

### 3. Minimal documentation

Document only high-level architecture and module boundaries. This is fast, but
it does not provide enough state tracking or contract precision for reliable
agent-assisted backend development.

## Selected Approach

Use the contract-first, phase-based approach. Define stable cross-cutting API
rules and complete core workflow contracts now, while marking the entire API as
a proposed baseline until implementation and tests verify it. Additive details
may be introduced during a phase through the documented contract-change
protocol.

## Source-of-Truth Hierarchy

When documents disagree, agents use this order:

1. `API-CONTRACT.md` for HTTP interfaces, DTOs, enums, error codes, pagination,
   and application state transitions.
2. `PROJECT-DETAIL.md` for product scope, actors, business rules, and
   non-functional requirements.
3. `backend/CLAUDE.md` for backend implementation conventions.
4. `frontend/CLAUDE.md` for React/Vite contract-consumer conventions.
5. `docs/ROADMAP.md` for milestone order and exit criteria.
6. `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` for detailed backend
   execution progress.
7. `backend/ISSUES-LIST-TRACKING.md` for known backend defects and risks.
8. `CHANGELOG.md` for historical changes and the current released documentation
   baseline.
9. `README.md` for onboarding and navigation.
10. `itziec_recruitment_platform_details.md` as the preserved original brief.

Higher-ranked documents control their stated domain only. A lower-ranked
document can contain more operational detail as long as it does not contradict
the controlling document.

## Documentation Architecture

### Root conventions: `CLAUDE.md`

Define repository-wide rules, the planned modular architecture, module
communication paths, document ownership, status vocabulary, Git and security
rules, and the mandatory contract-first change procedure. It must explicitly
forbid agents from claiming an unverified feature is implemented.

### Product specification: `PROJECT-DETAIL.md`

Translate the original brief into an implementation-oriented product reference:
goals, non-goals, actors, module responsibilities, end-to-end workflows,
business rules, data concepts, security, observability, performance targets,
testing expectations, and acceptance criteria. Requirements use stable IDs so
backend tasks can reference them.

### Shared interface: `API-CONTRACT.md`

Act as the primary frontend/backend agreement. Define:

- API base path, JSON conventions, timestamps, identifiers, money, and nullable
  fields.
- Authentication and refresh-session behavior.
- Success, list, and error envelopes.
- Pagination, filtering, sorting, idempotency, optimistic concurrency, and
  request-correlation rules.
- Shared enums and the allowed application state-transition matrix.
- Core resource schemas and endpoint catalog for auth, candidates, companies,
  jobs, saved jobs, CVs, applications, interviews, AI analysis,
  recommendations, notifications, administration, and health.
- Upload behavior and asynchronous job status.
- Domain event envelope and core event names.
- Backward-compatibility and contract-change protocol.

Because application code does not exist yet, endpoints are labeled
`Proposed baseline`, not `Implemented`. An endpoint may be marked implemented
only after its handler, validation, authorization, OpenAPI output, and relevant
automated tests exist.

### Project history: `CHANGELOG.md`

Use Keep a Changelog structure and semantic versions. Keep an `Unreleased`
section and record documentation decisions separately from implemented product
features. The initial entry records the documentation baseline without implying
that runtime functionality exists.

### Milestones: `docs/ROADMAP.md`

Contain Phase 0 through Phase 7 with milestone goals, scope, dependencies, and
exit criteria. Update only when milestone scope or completion changes. Detailed
task activity belongs in the backend tracking log.

### Frontend context: `frontend/CLAUDE.md`

Record only the confirmed React + Vite stack, contract-consumer rules, API client
boundaries, error/pagination/auth handling, and the obligation to update
`API-CONTRACT.md` before changing shared interfaces. It must not contain a
frontend implementation backlog.

### Backend context: `backend/CLAUDE.md`

Define NestJS + Prisma conventions, module boundaries, dependency direction,
DTO validation, authorization, transactions, migrations, event/outbox rules,
queue processing, file storage, AI adapters, structured logging, and test
expectations. It also defines which backend agent owns each tracking document.

### Backend task tracking

`backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` contains all backend work
as checkboxes grouped by roadmap phase. Each task has an identifier, requirement
references, dependencies, acceptance evidence, and status. All implementation
tasks start unchecked because the repository contains no backend code.

### Backend issue tracking

`backend/ISSUES-LIST-TRACKING.md` defines the issue schema and records known
backend risks or defects without presenting planned work as a discovered bug.
Each issue includes severity, status, affected scope, reproduction or evidence,
resolution, and verification. Fixed issues retain their history.

### Onboarding: `README.md`

Rewrite or normalize the README so it clearly separates planned capabilities
from implemented status, removes the frontend ambiguity, preserves the project
license statement accurately, and links to every controlling document. Commands
that do not work yet must be labeled as target commands instead of current setup
instructions.

## Communication and Change Flow

```text
Product requirement
  -> PROJECT-DETAIL.md
  -> API-CONTRACT.md when shared data or behavior changes
  -> backend phase task or issue
  -> backend implementation and tests
  -> OpenAPI verification
  -> task status and CHANGELOG.md update
```

Frontend and backend agents must read `API-CONTRACT.md` before modifying an
endpoint, DTO, enum, or error code. The contract is updated first in the same
change set. Breaking changes require a versioning decision and migration notes;
agents must not silently alter a shared interface.

## Status Model

- `Planned`: accepted scope with no verified runtime implementation.
- `In progress`: active work exists but exit evidence is incomplete.
- `Implemented`: code, validation, authorization, documentation, and required
  tests exist.
- `Verified`: implementation passed the stated acceptance checks in the target
  environment.
- `Deferred`: intentionally removed from the current milestone with a reason.

Checkboxes in the backend tracking log represent verified completion, not work
that was merely started. Narrative status is used for partially completed work.

## Validation

The completed documentation set must pass these checks:

- Every requested file exists at the exact requested path.
- All Markdown files decode as UTF-8 and headings render without mojibake.
- No unresolved placeholder markers or deferred-detail phrases remain.
- React + Vite, NestJS, Prisma, and PostgreSQL are consistent across documents.
- No frontend task backlog is created.
- Every backend phase has detailed checkbox tasks and measurable exit evidence.
- Root and directory-specific conventions agree with the API contract.
- Application states and transitions are identical in every document.
- Planned and implemented statuses are visibly distinguishable.
- README links resolve to the controlling files.
- Existing user changes unrelated to this documentation set are preserved.

## Scope Boundary

This work creates a documentation baseline only. It does not scaffold frontend
or backend applications, install dependencies, provision infrastructure, or
claim runtime behavior. Implementation will follow the roadmap and backend task
tracking log in later work.
