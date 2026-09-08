# Backend Issues List and Resolution Tracking

## Purpose

This register tracks backend defects, design risks, security findings, and
decisions that block implementation. It does not replace the phase task tracker.
Planned work belongs in `DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`; an entry
belongs here when evidence shows a defect/risk or a decision is required.

**Baseline date:** 2026-09-08  
**Current runtime state:** No backend implementation exists; baseline entries are
pre-implementation risks and blocking decisions, not production defects.

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `OPEN` | Confirmed issue/risk with no accepted resolution |
| `NEEDS_DECISION` | Product or architecture decision is required |
| `IN_PROGRESS` | Owner is actively applying an accepted resolution |
| `FIXED_PENDING_VERIFICATION` | Resolution exists but required evidence is incomplete |
| `VERIFIED` | Resolution passed the documented verification |
| `WONT_FIX` | Accepted risk with approver and rationale recorded |
| `DUPLICATE` | Tracked by another issue ID |

## Severity Vocabulary

| Severity | Meaning and expected response |
| --- | --- |
| `CRITICAL` | Active data loss, credential exposure, or system-wide security failure; stop affected release/work |
| `HIGH` | Blocks a milestone or can violate authorization, privacy, or core data integrity |
| `MEDIUM` | Material correctness, reliability, operability, or product ambiguity with a workaround |
| `LOW` | Limited impact or maintainability risk that does not block the current milestone |

## Issue Record Requirements

Every new issue must include:

- Immutable issue ID in the form `BEI-NNN`.
- Type: `DEFECT`, `SECURITY`, `RISK`, or `DECISION`.
- Severity, status, owner, discovered date, affected phase/module, and related
  requirement/task/contract section.
- Evidence or reproduction. Never paste secrets, tokens, raw CV content, signed
  URLs, or private candidate/recruiter data.
- Impact and acceptance criteria for resolution.
- Resolution and verification evidence when fixed.

Fixed issues remain in this file. Do not delete history to reduce the open count.

## Active Issues

### BEI-001 — Early rejection is not supported by the baseline pipeline

| Field | Value |
| --- | --- |
| Type | `DECISION` |
| Severity | `HIGH` |
| Status | `NEEDS_DECISION` |
| Owner | Product/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 4; applications |
| Related | APP-003, APP-004, BE-4-001, `API-CONTRACT.md` Section 7 |

**Evidence:** The original brief defines
`APPLIED -> REVIEWING -> INTERVIEWING -> PASSED | REJECTED`. The contract follows
that exact sequence, so a recruiter cannot reject an application before the
interviewing stage.

**Impact:** This is internally consistent but may not match normal recruiter
operations. Implementing an assumed early-rejection path would create an
undocumented behavioral contract change.

**Resolution acceptance:** Before BE-4-007 begins, explicitly keep the strict
matrix or approve exact additional transitions. Update `PROJECT-DETAIL.md`,
`API-CONTRACT.md`, transition tests, tracker references, and `CHANGELOG.md` if it
changes.

### BEI-002 — Submitted CV deletion and retention are undefined

| Field | Value |
| --- | --- |
| Type | `DECISION` |
| Severity | `HIGH` |
| Status | `NEEDS_DECISION` |
| Owner | Product/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 5; CVs and applications |
| Related | CV-005, CV-006, APP-001, BE-5-001, BE-5-010, `API-CONTRACT.md` Section 14 |

**Evidence:** Candidates must be able to delete CVs, while applications must
retain the submitted CV context for authorized recruitment review and audit.
The brief does not define whether deletion preserves an immutable snapshot,
soft-deletes metadata, or prevents deletion during retention.

**Impact:** A wrong choice can break historical applications or violate privacy
expectations.

**Resolution acceptance:** Approve retention duration, candidate-visible
behavior, recruiter access, snapshot/object strategy, cleanup timing, audit
exception, and API response. Add migration and deletion integration tests before
the delete endpoint is implemented.

### BEI-003 — AI provider privacy and data-retention policy is not approved

| Field | Value |
| --- | --- |
| Type | `SECURITY` |
| Severity | `HIGH` |
| Status | `NEEDS_DECISION` |
| Owner | Security/product/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 6; AI and CV data |
| Related | AI-001–009, NFR-SEC-003, NFR-SEC-004, BE-6-001 |

**Evidence:** The planned Gemini workflow transmits CV/JD-derived content to an
external provider, but provider configuration, consent, geographic processing,
retention, deletion, and acceptable fields are not documented.

**Impact:** Implementation could expose sensitive candidate data or make the
system unsuitable for its intended environment.

**Resolution acceptance:** Approve the minimum transmitted data, user notice or
consent, provider retention/training controls, regional constraints, redaction,
application retention, and deletion behavior. Tests must prove raw CV text is
absent from normal logs and event payloads.

### BEI-004 — Production deployment topology and providers are unselected

| Field | Value |
| --- | --- |
| Type | `DECISION` |
| Severity | `MEDIUM` |
| Status | `NEEDS_DECISION` |
| Owner | Platform/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 7; deployment and operations |
| Related | BE-7-022, BE-7-023, NFR-SEC-002, NFR-SEC-003 |

**Evidence:** Local dependencies are defined, while production hosting, managed
PostgreSQL/Redis, S3-compatible storage, SMTP, secrets, TLS termination, network
boundaries, and separate API/worker scaling are not selected.

**Impact:** Production configuration and CI/CD cannot be verified against a real
target; local development is not blocked.

**Resolution acceptance:** Record an approved topology, provider/configuration
interfaces, secret ownership, network access, backup responsibility, deployment
health gates, and rollback strategy before BE-7-023.

### BEI-005 — Refresh-cookie local origin and CSRF deployment assumptions need verification

| Field | Value |
| --- | --- |
| Type | `RISK` |
| Severity | `MEDIUM` |
| Status | `OPEN` |
| Owner | Backend/security owner |
| Discovered | 2026-09-08 |
| Affects | Phase 2; authentication |
| Related | AUTH-002–004, BE-2-007–010, `API-CONTRACT.md` Section 5 |

**Evidence:** The baseline uses an `HttpOnly`, `SameSite=Lax` refresh cookie and
an in-memory bearer access token. Vite development commonly runs on a different
origin from the API, while the production topology is not yet chosen.

**Impact:** Incorrect CORS, cookie domain/path, TLS, proxy, or CSRF assumptions
can break refresh or weaken session protection.

**Resolution acceptance:** Before auth verification, document development and
production origins, credentialed CORS allowlist, proxy behavior, cookie
attributes, CSRF threat model, and automated browser/API tests for allowed and
rejected origins.

### BEI-006 — Representative search corpus and ranking expectations are undefined

| Field | Value |
| --- | --- |
| Type | `RISK` |
| Severity | `MEDIUM` |
| Status | `OPEN` |
| Owner | Search/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 3; search |
| Related | SEARCH-001–004, NFR-PERF-002, BE-3-015, BE-3-016 |

**Evidence:** The product defines ranking factors and a p95 target, but there is
no versioned representative job corpus, query mix, relevance judgment, hardware
profile, or concurrent-load level.

**Impact:** Search correctness and the performance exit criterion cannot be
measured reproducibly.

**Resolution acceptance:** Add a sanitized deterministic corpus generator,
representative queries with expected ordering, dataset size, PostgreSQL version,
resource profile, concurrency, warm/cold-cache policy, and report format.

### BEI-007 — Password hashing algorithm and operational parameters are unselected

| Field | Value |
| --- | --- |
| Type | `SECURITY` |
| Severity | `MEDIUM` |
| Status | `NEEDS_DECISION` |
| Owner | Security/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 2; authentication |
| Related | AUTH-001, BE-2-003, NFR-SEC-001 |

**Evidence:** Backend conventions require a current memory-hard password hash
with versioned parameters, but the exact algorithm, memory/time/parallelism cost,
runtime budget, and rehash threshold are not yet benchmarked.

**Impact:** Hard-coded defaults may be too weak or make login unavailable on the
chosen deployment resources.

**Resolution acceptance:** Benchmark and approve the algorithm/parameters on the
target class of hardware, store hash metadata, implement rehash-on-login, and
record latency and resource test evidence.

## Fixed and Verified Issues

No backend issue has reached `VERIFIED` in the documentation-only baseline.

When an issue is verified, keep its original description and append:

- Resolution decision and implementation summary.
- Affected migration, contract, and changelog references.
- Verification date and exact test/report/commit evidence.
- Any remaining accepted risk.

## Maintenance Rules

- Review active `CRITICAL` and `HIGH` issues before starting or closing a phase.
- A task blocked by an issue remains unchecked and references the issue ID.
- Status moves to `FIXED_PENDING_VERIFICATION` only after the resolution exists.
- Status moves to `VERIFIED` only after the issue-specific acceptance evidence
  passes.
- `WONT_FIX` requires named approval, rationale, impact, and review date.
- Record issue status changes in the activity table below and in `CHANGELOG.md`
  when they affect product behavior, schema, security, or release scope.

## Issue Activity

| Date | Issue | From | To | Reason / evidence |
| --- | --- | --- | --- | --- |
| 2026-09-08 | BEI-001–007 | New | Current baseline status | Initial documentation review identified blocking decisions and implementation risks. |

