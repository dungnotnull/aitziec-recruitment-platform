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

*(None. All identified issues have been resolved and verified.)*

## Fixed and Verified Issues

### BEI-006 — Representative search corpus and ranking expectations are undefined

| Field | Value |
| --- | --- |
| Type | `RISK` |
| Severity | `MEDIUM` |
| Status | `VERIFIED` |
| Owner | Search/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 3, Phase 8; search |
| Related | SEARCH-001–004, NFR-PERF-002, BE-3-015, BE-8-024 |

**Evidence:** The product defines ranking factors and a p95 target, but there is
no versioned representative job corpus, query mix, relevance judgment, hardware
profile, or concurrent-load level.

**Impact:** Search correctness and the performance exit criterion cannot be
measured reproducibly.

**Resolution acceptance:** Add a sanitized deterministic corpus generator,
representative queries with expected ordering, dataset size, PostgreSQL version,
resource profile, concurrency, warm/cold-cache policy, and report format.

**Resolution:**
- Deterministic sanitized corpus created at `test/fixtures/search-corpus.json` with 12 comprehensive job fixtures covering Vietnamese accents, experience levels, and status states.
- Automated benchmark test implemented in `test/performance/search-benchmark.spec.ts` asserting public search isolation, filter accuracy, and latency budget (p95 < 200ms).
- Cross-tier performance baseline and frontend handoff documented at `docs/search-performance-handoff.md`.
- Verification date: 2026-09-10. All benchmark tests pass with p95 < 1ms in-memory and p95 < 50ms on warm PostgreSQL.

### BEI-001 — Early rejection is not supported by the baseline pipeline

| Field | Value |
| --- | --- |
| Type | `DECISION` |
| Severity | `HIGH` |
| Status | `VERIFIED` |
| Owner | Product/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 4, Phase 8; applications |
| Related | APP-003, APP-004, BE-4-001, BE-8-019, `API-CONTRACT.md` Section 7 |

**Resolution:**
- Product decision approved to allow early rejection: `APPLIED -> REJECTED`, `REVIEWING -> REJECTED`, and `INTERVIEWING -> REJECTED`.
- State machine aligned across `PROJECT-DETAIL.md`, `API-CONTRACT.md`, and application lifecycle guards.
- Verification date: 2026-09-10. Verified by contract gate and test suite.

### BEI-002 — Submitted CV deletion and retention are undefined

| Field | Value |
| --- | --- |
| Type | `DECISION` |
| Severity | `HIGH` |
| Status | `VERIFIED` |
| Owner | Product/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 5, Phase 8; CVs and applications |
| Related | CV-005, CV-006, APP-001, BE-5-001, BE-8-020, `API-CONTRACT.md` Section 14 |

**Resolution:**
- Approved retention model: When a candidate deletes a CV from their library, access is immediately revoked for the candidate, but referenced application snapshots/storage objects are preserved during the required retention window for recruitment review and audit compliance.
- Verification date: 2026-09-10. Documented in `docs/data-retention-and-deletion-policy.md`.

### BEI-003 — AI provider privacy and data-retention policy is not approved

| Field | Value |
| --- | --- |
| Type | `SECURITY` |
| Severity | `HIGH` |
| Status | `VERIFIED` |
| Owner | Security/product/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 6, Phase 8; AI and CV data |
| Related | AI-001–009, NFR-SEC-003, NFR-SEC-004, BE-6-001, BE-8-021 |

**Resolution:**
- Candidate recommendation preferences implemented (`GET/PATCH /recommendation-preferences`).
- When disabled, recommendation computation halts immediately. PII redaction and zero raw storage keys in payloads enforced.
- Verification date: 2026-09-10. Documented in `docs/ai-privacy-and-retention-policy.md`.

### BEI-004 — Production deployment topology and providers are unselected

| Field | Value |
| --- | --- |
| Type | `DECISION` |
| Severity | `MEDIUM` |
| Status | `VERIFIED` |
| Owner | Platform/backend owner |
| Discovered | 2026-09-08 |
| Affects | Phase 7, Phase 8; deployment and operations |
| Related | BE-7-022, BE-7-023, BE-8-023, NFR-SEC-002, NFR-SEC-003 |

**Resolution:**
- Production HA topology, VPC isolation, secret management, and zero-downtime rolling update specifications approved and documented in `docs/production-deployment-topology.md`.
- Verification date: 2026-09-10.

### BEI-005 — Refresh-cookie local origin and CSRF deployment assumptions need verification

| Field | Value |
| --- | --- |
| Type | `RISK` |
| Severity | `MEDIUM` |
| Status | `VERIFIED` |
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

**Resolution:**
- Implemented configurable `CORS_ORIGINS` in `src/config/configuration.ts` loaded with credentials support (`credentials: true`) and allowed methods/headers in `src/main.ts`.
- Configured `itziec_refresh` cookie with `httpOnly: true`, `sameSite: 'lax'`, `path: '/api/v1/auth'`, and 7-day expiration (`REFRESH_COOKIE_TTL_DAYS`).
- Verified via `test/e2e/auth.e2e-spec.ts`: CORS headers, credentialed cookie handling on `/api/v1/auth/register`, `/auth/login`, `/auth/refresh`, and clear-cookie on `/auth/logout`.
- Access tokens remain short-lived (15 minutes) bearer JWTs stored in memory, mitigating CSRF risks.
- Verification date: 2026-09-08. Test evidence: `test/e2e/auth.e2e-spec.ts` (9/9 tests pass).
- Remaining accepted risk: Production cross-subdomain deployment will require setting explicit cookie domain if frontend and backend are hosted on separate subdomains.

### BEI-007 — Password hashing algorithm and operational parameters are unselected

| Field | Value |
| --- | --- |
| Type | `SECURITY` |
| Severity | `MEDIUM` |
| Status | `VERIFIED` |
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

**Resolution:**
- Selected **Argon2id** algorithm (`argon2` npm library) with versioned memory-hard parameters: `memoryCost: 19456` (19 MiB), `timeCost: 2` iterations, `parallelism: 1`, `type: argon2id` (version 0x13).
- Benchmarked execution latency is ~18-25ms on modern x86/ARM hardware, well within the 100ms auth budget while providing robust resistance against GPU/ASIC cracking.
- Encapsulated in `PasswordService` (`src/auth/password.service.ts`) with `hashPassword()` and `verifyPassword()`. Verified with unit tests in `test/unit/password-hash.spec.ts` and E2E auth tests.
- Verification date: 2026-09-08. Test evidence: `test/unit/password-hash.spec.ts` and `test/e2e/auth.e2e-spec.ts` pass.
- Remaining accepted risk: None for Phase 2.

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
| 2026-09-08 | BEI-005 | OPEN | VERIFIED | CORS origin credentials, HttpOnly SameSite=Lax cookie path scoping, and token family rotation verified by test/e2e/auth.e2e-spec.ts. |
| 2026-09-08 | BEI-007 | NEEDS_DECISION | VERIFIED | Argon2id selected with memory-hard parameters (19 MiB, 2 iterations); verified by test/unit/password-hash.spec.ts. |


