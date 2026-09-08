# Backend API Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comprehensive, documentation-derived backend API inventory to the backend phase tracking log without claiming that runtime endpoints already exist.

**Architecture:** Keep the existing Phase 0–7 implementation backlog intact and insert an API-first planning section before it. Organize endpoints by backend module, then summarize reuse, missing contracts, possible redundancy, schema/auth/validation/error gaps, and decisions required before implementation.

**Tech Stack:** NestJS; Prisma; PostgreSQL; Redis; BullMQ; MinIO; Nodemailer; Mailpit; Gemini; REST `/api/v1`; OpenAPI.

**Execution status:** Completed and verified on 2026-09-08.

## Global Constraints

- No backend source code, Prisma schema, controller, DTO, guard, or automated test exists in the repository.
- Every runtime API is classified `NOT_IMPLEMENTED`.
- The original requirements and `PROJECT-DETAIL.md` define product intent.
- `API-CONTRACT.md` defines approved HTTP interfaces.
- Predicted missing endpoints are labeled `NEEDS_DECISION` or `CHANGE_CONTRACT` before implementation.
- Do not add frontend files or tasks.
- Do not duplicate full request and response schemas from `API-CONTRACT.md`.

---

### Task 1: Add inventory metadata and classification rules

**Files:**

- Modify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`

**Interfaces:**

- Consumes: repository file inventory and documentation source-of-truth order.
- Produces: audit basis, confidence statement, status/action legend, and stable API ID convention.

- [x] **Step 1: State the no-code evidence boundary**

Record that the repository has no runtime backend implementation and Markdown does not prove endpoint existence.

- [x] **Step 2: Define inventory columns and actions**

Define API ID, function, method, endpoint, access, purpose, requirement, evidence, and action. Define `ADD`, `REUSE`, `CHANGE_CONTRACT`, `NEEDS_DECISION`, and `REMOVE`.

### Task 2: Inventory all approved contract APIs

**Files:**

- Modify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`

**Interfaces:**

- Consumes: every method/path row in `API-CONTRACT.md` Section 9.
- Produces: module tables for health, auth, candidate, company, jobs/search, saved jobs, CVs, applications, interviews, AI/operations, notifications, and administration/audit.

- [x] **Step 1: Add stable API rows by module**

Copy method/path semantics without copying full DTO definitions. Mark every approved endpoint `NOT_IMPLEMENTED` and `ADD`, or `REUSE` when one endpoint intentionally serves multiple requirements.

- [x] **Step 2: Confirm contract coverage**

Extract method/path pairs from the contract and compare them with the inventory so no approved endpoint is omitted.

### Task 3: Add predicted missing and decision-dependent APIs

**Files:**

- Modify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`

**Interfaces:**

- Consumes: original requirements, product requirements, issue register, and gaps in the approved endpoint catalog.
- Produces: explicit rows for recruiter job management lists, skill catalog, job reopening, membership invitation, admin resource lists/details, role changes, failed-job operations, notification preferences, interview detail, CV retry, and batch screening as supported by evidence.

- [x] **Step 1: Add missing-contract rows**

Label proposed paths `CHANGE_CONTRACT` when a requirement clearly needs an endpoint and `NEEDS_DECISION` when behavior or ownership is ambiguous.

- [x] **Step 2: Separate non-required candidates**

List common APIs that are not in the original scope, such as password recovery or candidate application withdrawal, so they are not accidentally implemented as assumed requirements.

### Task 4: Add concise backend gap and reuse analysis

**Files:**

- Modify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`

**Interfaces:**

- Consumes: completed inventory.
- Produces: actionable summaries for shared APIs, possible overlaps, database entities/constraints, validation, authentication, authorization, errors, pagination, idempotency, concurrency, audit/outbox, and unresolved decisions.

- [x] **Step 1: Document APIs intentionally reused**

Identify shared application transition, analysis creation, operation status, scoped detail, profile update, interview PATCH, and metadata/download behaviors.

- [x] **Step 2: Document overlap and redundancy findings**

Explain why lifecycle actions, CV metadata/download, public/recruiter job lists, and role-specific projections should or should not remain separate.

- [x] **Step 3: Document schema and cross-cutting prerequisites**

List required entities, unique/index/check constraints, auth/RBAC, validation, error mapping, request IDs, cursor pagination, version checks, idempotency, upload security, audit, and outbox infrastructure.

- [x] **Step 4: Document questions requiring confirmation**

Reference issue IDs and affected APIs for early rejection, reopen, CV retention, invitations, admin mutation scope, AI privacy, cookie/CSRF behavior, skills ownership, notification preferences, and queue replay.

### Task 5: Validate and preserve tracker state

**Files:**

- Verify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`

**Interfaces:**

- Consumes: final API inventory and existing phase backlog.
- Produces: evidence that the inventory is complete, unique, backend-only, and honest about implementation state.

- [x] **Step 1: Validate unique API IDs and method/path pairs**

Run a PowerShell/regex check that rejects duplicate API IDs and unexplained duplicate method/path pairs.

- [x] **Step 2: Validate implementation status**

Confirm every API row is `NOT_IMPLEMENTED` and no Phase 1–7 task was checked.

- [x] **Step 3: Validate contract coverage and Markdown quality**

Confirm all contract method/path pairs are present, decision-dependent APIs are labeled, no frontend task exists, and `git diff --check` passes.

- [x] **Step 4: Record inventory summary**

Record counts for total API rows, approved contract APIs, reused APIs, contract changes, and decision-dependent APIs without changing runtime completion status.
