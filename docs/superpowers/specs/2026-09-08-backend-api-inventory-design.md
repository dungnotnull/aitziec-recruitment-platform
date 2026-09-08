# Backend API Inventory Design

## Context

The repository contains product requirements, an API contract, a roadmap, and a
backend phase tracker, but no backend source code, package manifest, Prisma
schema, controllers, DTOs, guards, or automated tests. Therefore, the inventory
cannot claim that any runtime API exists.

The requested output is a detailed prediction of the backend APIs required to
implement the documented product. It is not a detailed implementation plan for
DTO fields, Prisma models, service methods, or tests.

## Goal

Extend `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` with a comprehensive,
implementation-oriented API inventory that lets a backend developer see which
HTTP interfaces are required, who can call them, why they exist, and whether
they should be added, reused, changed, removed, or confirmed before coding.

## Evidence Rules

- Markdown requirements and contracts are planning evidence only.
- An API is `EXISTING` only when a controller/route and relevant tests can be
  inspected. There is currently no such evidence.
- Every currently proposed API is classified `NOT_IMPLEMENTED`.
- `ADD` means create a new runtime endpoint from the approved contract.
- `REUSE` means one endpoint intentionally satisfies multiple documented
  functions; it is still not implemented until code evidence exists.
- `CHANGE_CONTRACT` means the current contract must be changed before coding.
- `NEEDS_DECISION` means requirements do not determine one safe interface.
- `REMOVE` is used only when an endpoint is provably outside scope or duplicated
  by another approved endpoint. No runtime endpoint can currently be removed.

## Inventory Structure

Add a dedicated section before the phase task backlog. Organize it by backend
module rather than by implementation phase so all APIs for one business
capability can be reviewed together.

Each API row contains:

| Column | Meaning |
| --- | --- |
| API ID | Stable identifier such as `API-AUTH-001` |
| Function | User or system capability served |
| Method | HTTP method |
| Endpoint | Version-relative path under `/api/v1` |
| Access | Guest, candidate, scoped HR, company owner, admin, internal, or combinations |
| Purpose | One concise behavior statement |
| Requirement | Requirement IDs or technical requirement source |
| Evidence | Whether matching runtime code was found |
| Action | `ADD`, `REUSE`, `CHANGE_CONTRACT`, or `NEEDS_DECISION` |

Payload and response type names may be referenced from `API-CONTRACT.md`, but
the inventory does not duplicate their full schemas.

## Modules Covered

The inventory covers:

1. Platform health and operational metadata.
2. Authentication and refresh sessions.
3. Users and current-account operations.
4. Candidate profiles, skills, and experience.
5. Companies and recruiter memberships.
6. Jobs, lifecycle actions, recruiter job management, and public search.
7. Saved jobs.
8. CV upload, metadata, default selection, download, processing, and deletion.
9. Applications, recruiter applicant views, history, and transitions.
10. Interviews and recruiter feedback.
11. Notifications and delivery preferences where required.
12. Asynchronous operation status.
13. AI CV extraction, matching, gap analysis, natural-language parsing, and job
    recommendations.
14. Administration, moderation, audit, and operational queue controls.

## Required Gap Analysis

After the API tables, add concise findings for:

- Contracted APIs that are required but have no implementation.
- Required functions with no adequate endpoint in the current contract.
- Endpoints that can be reused across roles or requirements.
- Candidate overlaps that should remain separate because they represent
  different resource or lifecycle semantics.
- Database/schema prerequisites at entity and constraint level.
- Cross-cutting validation, authentication, authorization, error, pagination,
  idempotency, concurrency, upload, audit, and outbox prerequisites.
- Open product or architecture decisions that must be resolved before affected
  APIs are implemented.

## Predicted Contract Gaps

The audit must explicitly evaluate and, when supported, list proposed APIs for:

- Recruiter listing of all company jobs, including non-public lifecycle states.
- Skill catalog/search used by candidate profiles and job requirements.
- Job reopening if the original “open/close” requirement includes reopening.
- Company membership invitation/acceptance if direct membership insertion is
  not acceptable.
- Administrator lists/details for companies, jobs, and applications.
- Administrator role changes if `USER_ROLE_CHANGED` remains an audit event.
- Authorized failed queue-job inspection and replay.
- Notification preference management only if email opt-out or channel control is
  considered required.

These APIs remain `NEEDS_DECISION` when the original requirements do not define
their exact behavior.

## Duplication and Reuse Rules

- Application status changes use one transition endpoint, not separate endpoints
  for each target state.
- AI CV/JD match and gap analysis may share one asynchronous analysis creation
  endpoint with requested analysis types.
- All long-running features reuse the generic operation-status endpoint.
- Candidate and scoped recruiter views may reuse a resource endpoint when
  authorization and response projection are explicit.
- Public job search cannot substitute for recruiter management listing because
  it hides draft, unpublished, closed, and expired records.
- CV metadata and signed-download endpoints remain separate because one returns
  a resource and the other grants short-lived private-object access.
- Lifecycle actions remain separate from general PATCH when they enforce
  transition-specific authorization, validation, audit, and events.

## Scope Boundary

This change updates only the backend tracking Markdown file and supporting
design/plan documentation. It does not create NestJS code, Prisma schema, DTOs,
tests, OpenAPI output, or runtime status claims. It does not add frontend files
or frontend tasks.

## Validation

- Every inventory row has all nine required columns.
- API IDs are unique and stable.
- Method/path pairs are unique unless the row explicitly documents role-based
  reuse.
- Every endpoint already in `API-CONTRACT.md` appears in the inventory.
- Every original functional requirement maps to at least one API or an explicit
  non-HTTP/background task.
- Missing contract endpoints are visibly separated from approved contract APIs.
- No API is labeled existing without code evidence.
- No frontend API task is created.
- Existing backend phase tasks and their completion state are preserved.
