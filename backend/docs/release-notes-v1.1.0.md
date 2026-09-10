# Release Notes — v1.1.0 (Frontend Integration Remediation)

**Release Date:** 2026-09-10  
**Milestone:** Phase 8 Remediation & Production Handoff  
**Branch:** `backend`  
**Git Tag:** `v1.1.0`

---

## 1. Executive Summary

Release v1.1.0 delivers a comprehensive remediation of cross-tier frontend integration gaps, database migration hardening, and enterprise-grade recruitment lifecycle features. All 25 tasks across Phase 8 (`BE-8-001` through `BE-8-025`) have been implemented, tested, and verified with 100% test pass rates across both unit and end-to-end test suites.

---

## 2. Key Highlights & Added Capabilities

### 2.1 Database & Search Infrastructure Repair (`BE-8-002`, `BE-8-003`, `BE-8-004`)
- Repaired PostgreSQL migration `20260909000000_jobs_and_saved_jobs` by replacing rejected stored generated columns (`42P17`/Prisma `P3018`) with a trigger-maintained `tsvector` and PostgreSQL GIN index (`jobs_search_vector_gin_idx`).
- Restored `ExperienceLevel` enum query validation for public jobs API (`GET /jobs?experienceLevel=FRESHER`).

### 2.2 Skill Catalog Module (`BE-8-006`, `BE-8-007`)
- Extended canonical Skill schema with `normalizedName`, `active`, and `SkillAlias` mapping.
- Implemented `GET /api/v1/skills` supporting case-insensitive canonical/alias search and cursor pagination.

### 2.3 Recruiter Multi-Company Discovery & Job Management (`BE-8-008`, `BE-8-009`)
- Added `GET /api/v1/companies/mine` to discover caller company memberships and assigned roles.
- Added company-scoped job management collection `GET /api/v1/companies/:companyId/jobs` permitting members to view draft, closed, and expired jobs.

### 2.4 Company Pending Invitations & Member Management (`BE-8-010`, `BE-8-011`, `BE-8-012`)
- Modeled pending company invitations with SHA-256 token hashing, 7-day expiration, and partial unique index.
- Added `POST /api/v1/companies/:companyId/members` (returning `201` for existing users and `202` for pending invites) and `POST /api/v1/company-invitations/:token/accept`.
- Delivered isolated transactional notifications and email routing.

### 2.5 Admin Collections & Application Moderation (`BE-8-013`, `BE-8-014`, `BE-8-015`)
- Implemented admin-only company (`GET /api/v1/admin/companies`) and job (`GET /api/v1/admin/jobs`) query collections with status filters and optimistic concurrency versions.
- Implemented redacted admin application collection (`GET /api/v1/admin/applications`) and detail API (`GET /api/v1/admin/applications/:applicationId`).
- Added audited admin application moderation (`POST /api/v1/admin/applications/:applicationId/moderate`) with version checks and audit trail.

### 2.6 Asynchronous CV Extraction & Idempotent Retry (`BE-8-016`, `BE-8-017`)
- Migrated CV extraction to asynchronous BullMQ worker processing with linked `Operation` records.
- Added bounded and idempotent retry endpoint `POST /api/v1/cvs/:cvId/retry-processing` for failed CV extractions.

### 2.7 Direct Interview Detail API (`BE-8-018`)
- Promoted and verified `GET /api/v1/interviews/:interviewId` with role-based field omission (redacting recruiter private notes and feedback for candidates).

### 2.8 Early Rejection & CV Retention Reconciliation (`BE-8-019`, `BE-8-020`)
- Updated application state machine to permit early rejections (`APPLIED -> REJECTED` and `REVIEWING -> REJECTED`), resolving `BEI-001`.
- Reconciled CV retention policy (`BEI-002`): soft-deleted CVs previously submitted to job applications remain accessible for authorized hiring compliance audits by recruiters and admins; decoupled S3 deletion from DB transaction.

### 2.9 Recommendation Consent, Preferences & Explainability (`BE-8-021`, `BE-8-022`)
- Modeled `RecommendationPreference` with optimistic concurrency versioning and audit trail.
- Implemented `GET/PATCH /api/v1/recommendation-preferences`.
- Enhanced `GET /api/v1/recommendations/jobs` with explainable `RecommendedJobDto` (bounded scores, server-owned reason codes, evidence, and limitations), immediate opt-out enforcement, and active company eligibility filtering.

### 2.10 Browser Security & Performance Baselines (`BE-8-023`, `BE-8-024`)
- Documented frontend-backend security and observability handshake in `docs/frontend-backend-runtime-matrix.md`.
- Published deterministic search corpus in `test/fixtures/search-corpus.json` and performance handoff in `docs/search-performance-handoff.md`, resolving `BEI-006`.

---

## 3. Verification & Test Metrics

- **Unit Test Suites:** 25/25 suites passing (161/161 tests).
- **End-to-End Suites:** 10/10 suites passing (117/117 tests).
- **Linter:** 0 errors.
- **Prisma Migrations:** Fully validated and clean deploy proven.
- **Open Handles:** 0 sockets or timers left active after test runs.
