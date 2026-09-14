# Frontend Handoff & Contract Specification — Phase 10

**Document Version:** 1.2.0  
**Effective Date:** 2026-09-12  
**Milestone:** Phase 10 (Reliability, Scalability, and Clean Architecture Hardening)  
**Status:** Approved & Verified  
**Applicability:** ITZiec Recruitment Platform (Frontend & Backend Integration)

---

## 1. Executive Summary

Phase 10 delivers comprehensive backend reliability, security hardening, and contract alignment across the application lifecycle. This document specifies the exact request/response envelopes, DTO structures, error contracts, and runtime behavioral patterns for frontend integration.

> **Note on Frontend Codebase:** In adherence to architectural governance, zero frontend source files were modified during Phase 10. Frontend client adapters should consume this specification when updating API client SDKs and UI data mappers.

### Summary of Key Integration Changes
1. **Saved Job Check Envelope:** `GET /api/v1/jobs/:jobId/save` returns standard `SuccessResponse<{ isSaved: boolean }>` instead of raw primitives.
2. **Canonical AI Recommendations:** `GET /api/v1/recommendations/jobs` returns clean `CollectionResponse<RecommendedJobDto>` with nested `job`, server-owned `score`, `reasonCodes`, `evidence`, and `limitations` (no top-level flattened job fields).
3. **Safe Notification Projections & Read Command:** `GET /api/v1/notifications` returns nested `resource: { type, id } | null` without leaking internal `userId`; `PATCH /api/v1/notifications/:id/read` requires `{ read: boolean }`; pagination uses opaque base64 cursors.
4. **Asynchronous Operations Pattern:** 202 Accepted pattern with pollable `OperationDto` for long-running processes (CV retry, AI matching).
5. **Idempotency Header:** Optional `Idempotency-Key` header (16–128 printable ASCII) on mutating operations with deterministic 24-hour replay and payload mismatch defense (`409 IDEMPOTENCY_KEY_REUSED`).
6. **One-Time Company Invitations:** Secure AES-256-GCM token delivery pipeline via email; frontend accepts via `POST /api/v1/company-invitations/:token/accept`.
7. **Canonical Skill Catalog:** Profile skills must reference valid UUIDs from `GET /api/v1/skills`.

---

## 2. Saved Job Check Envelope Semantics

### Endpoint: `GET /api/v1/jobs/:jobId/save`
- **Access:** Authenticated `CANDIDATE`
- **Purpose:** Check whether the authenticated candidate has bookmarked/saved a specific job.
- **Envelope:** Standard `SuccessResponse<{ isSaved: boolean }>`

#### Response Example (`200 OK`):
```json
{
  "data": {
    "isSaved": true
  },
  "meta": {
    "requestId": "c1f725a3-057d-45f8-8a8b-3023023e9812"
  }
}
```

#### Frontend Handling:
- Client code must access `response.data.isSaved` (not `response.data` directly as a boolean).

---

## 3. AI Job Recommendations

### Endpoint: `GET /api/v1/recommendations/jobs`
- **Access:** Authenticated `CANDIDATE` with active recommendation consent.
- **Envelope:** `CollectionResponse<RecommendedJobDto>`

#### Canonical Item Projection:
```json
{
  "data": [
    {
      "job": {
        "id": "c623be80-5a3d-472e-84ad-2cf55e347963",
        "title": "Senior Backend Engineer",
        "company": {
          "id": "d0e12345-6789-4abc-def0-123456789abc",
          "name": "Tech Corp",
          "logoUrl": "https://storage.itziec.com/logos/techcorp.png",
          "verified": true
        },
        "experienceLevel": "SENIOR",
        "employmentType": "FULL_TIME",
        "workplaceType": "HYBRID",
        "location": "Ho Chi Minh City",
        "salaryMin": 40000000,
        "salaryMax": 70000000,
        "currency": "VND",
        "isNegotiable": false,
        "deadline": "2026-10-01T00:00:00.000Z",
        "status": "PUBLISHED",
        "createdAt": "2026-09-01T00:00:00.000Z",
        "skills": [
          { "id": "11111111-2222-3333-4444-555555555555", "name": "Node.js" },
          { "id": "22222222-3333-4444-5555-666666666666", "name": "PostgreSQL" }
        ]
      },
      "score": 88,
      "reasonCodes": [
        "SKILL_MATCH",
        "EXPERIENCE_ALIGNMENT",
        "WORKPLACE_PREFERENCE"
      ],
      "evidence": [
        "Matches 2 required skills: Node.js, PostgreSQL",
        "Candidate experience (5 years) aligns with Senior requirement"
      ],
      "limitations": [
        "Candidate preferred salary (75,000,000 VND) slightly exceeds stated max (70,000,000 VND)"
      ]
    }
  ],
  "meta": {
    "page": {
      "limit": 20,
      "hasNextPage": false,
      "nextCursor": null
    },
    "requestId": "e4b37012-789a-4bc1-9012-def345678901"
  }
}
```

#### Key Architecture Notes:
- **No Spread Fields:** Recommendation items do **not** flatten `job` fields onto the top-level object. All job details reside in the nested `job` property.
- **Explainability Arrays:** `evidence` and `limitations` are guaranteed string arrays.
- **Preference Management:**
  - `GET /api/v1/recommendation-preferences`: View consent status (`{ enabled, consentPolicyVersion, consentedAt, updatedAt, version }`).
  - `PATCH /api/v1/recommendation-preferences`: Toggle consent with optimistic concurrency (`{ enabled, consentPolicyVersion, expectedVersion }`).
  - If consent is disabled (`enabled: false`), `GET /api/v1/recommendations/jobs` returns `{ data: [], meta: { disabled: true } }`.

---

## 4. Notifications API & Cursor Pagination

### 4.1 Notification Collection: `GET /api/v1/notifications`
- **Access:** Authenticated user (recipient owner only).
- **Query Parameters:**
  - `cursor`: Opaque base64 string encoding `(createdAt, id)`. Pass `undefined` for first page.
  - `limit`: Number between 1 and 50 (default 20).

#### Response Example (`200 OK`):
```json
{
  "data": [
    {
      "id": "e8d67280-9289-42b7-a3cf-b6a4b1239999",
      "type": "APPLICATION_STATUS_CHANGED",
      "title": "Application Update",
      "body": "Your application for Senior Backend Engineer was moved to INTERVIEW",
      "resource": {
        "type": "APPLICATION",
        "id": "a9c1f512-3210-4889-bcde-998877665544"
      },
      "readAt": null,
      "createdAt": "2026-09-12T09:30:00.000Z"
    }
  ],
  "meta": {
    "page": {
      "limit": 20,
      "hasNextPage": true,
      "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA5LTEyVDA5OjMwOjAwLjAwMFoiLCJpZCI6ImU4ZDY3MjgwLTkyODktNDJiNy1hM2NmLWI2YTRiMTIzOTk5OSJ9"
    },
    "unreadCount": 3,
    "requestId": "f12e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### Safe Nested Resource:
- The projection utilizes `resource: { type, id } | null`.
- `userId` is strictly omitted from the payload to prevent data leakage.
- Root-level `resourceType` and `resourceId` fields are deprecated and replaced by the nested `resource` object.

### 4.2 Mark Read/Unread: `PATCH /api/v1/notifications/:id/read`
- **Access:** Authenticated notification owner.
- **Request Body (Strictly Required):**
  ```json
  {
    "read": true
  }
  ```
- **Behavior:**
  - `"read": true`: Sets `readAt` to current timestamp if not already read. Replay is idempotent.
  - `"read": false`: Clears `readAt` back to `null` (marks unread).
  - Empty body or missing `read` property returns `400 Bad Request` (`VALIDATION_ERROR`).

---

## 5. Asynchronous Operations (`OperationDto`)

Long-running operations (such as CV text extraction and AI CV-to-job matching) execute asynchronously via background BullMQ workers.

### 5.1 Endpoints Returning 202 Accepted:
1. `POST /api/v1/cvs/:cvId/retry-processing`
   - Returns `202 Accepted`: `{ data: { cv: CvDto, operation: OperationDto } }`
2. `POST /api/v1/ai/cv-job-analyses`
   - Returns `202 Accepted`: `{ data: OperationDto }`

### 5.2 Polling Endpoint: `GET /api/v1/operations/:operationId`
- **Poll Interval:** Recommended exponential backoff starting at 1s, 2s, 4s (capped at 5s), with a 60s timeout.

#### Operation Object Schema:
```json
{
  "id": "op-c6198f42-4567-4890-bcde-123456789abc",
  "type": "CV_JOB_ANALYSIS",
  "status": "PROCESSING",
  "progress": 50,
  "resultResourceId": null,
  "errorCode": null,
  "errorMessage": null,
  "createdAt": "2026-09-12T10:15:00.000Z",
  "updatedAt": "2026-09-12T10:15:02.000Z"
}
```

#### Terminal States:
- **`SUCCEEDED`:** `progress = 100`, `resultResourceId` contains the resulting entity ID (e.g., `aiAnalysisId`). Frontend can now fetch `GET /api/v1/ai/analyses/:resultResourceId`.
- **`FAILED`:** `errorCode` contains classified code (e.g., `LLM_PROVIDER_ERROR`, `EXTRACTION_FAILED`), `errorMessage` contains safe user-facing message.

---

## 6. Idempotency Key Semantics

To prevent double-submissions caused by network retries, double-clicks, or connection timeouts, clients may supply an `Idempotency-Key` header on mutating endpoints.

### 6.1 Supported Endpoints:
- `POST /api/v1/applications` (Application submission)
- `POST /api/v1/applications/:id/transitions` (Application status change)
- `POST /api/v1/interviews` (Interview scheduling)
- `POST /api/v1/cvs/:id/retry-processing` (CV extraction retry)
- `POST /api/v1/ai/cv-job-analyses` (AI matching execution)

### 6.2 Header Specification:
```http
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```
- **Format:** 16 to 128 printable ASCII characters (`^[ -~]{16,128}$`). UUIDv4 is strongly recommended.
- **Scope:** Scoped to `(actorUserId, httpMethod, routePath, idempotencyKey)`.
- **TTL:** Stored for 24 hours.

### 6.3 Replay Semantics:
1. **First Request:** Request executes normally. Response body, status code, and headers are persisted.
2. **Identical Replay (Same Key & Same Payload):** Backend intercepts before business logic, returning the exact cached response with original status code (`201` or `200`) without creating duplicate records or sending duplicate notifications.
3. **Payload Mismatch (Same Key, Different Payload):** Backend rejects immediately with HTTP `409 Conflict`:
   ```json
   {
     "statusCode": 409,
     "code": "IDEMPOTENCY_KEY_REUSED",
     "message": "Idempotency key has already been used with a different request payload",
     "timestamp": "2026-09-12T10:20:00.000Z",
     "requestId": "..."
   }
   ```

---

## 7. Company Invitation Acceptance Flow

Company invitations for unregistered users are delivered securely via an encrypted email workflow.

```
[HR User] ──► POST /companies/:id/members { userEmail, role }
                     │
                     ▼ (Backend encrypts raw token via AES-256-GCM)
          [BullMQ Email Worker] ──► Sends email with acceptance URL:
                     │              https://itziec.com/company-invitations/accept?token=<RAW_TOKEN>
                     ▼
[Recipient User] ──► Clicks link in email
                     │
                     ├─► 1. If not logged in: prompts Login/Registration
                     └─► 2. Frontend calls: POST /api/v1/company-invitations/:token/accept
```

#### Frontend Action on Accept:
- Endpoint: `POST /api/v1/company-invitations/:token/accept`
- Body: None (token passed in URL path).
- Authentication: Bearer token of the logged-in user whose email matches the invitation email.
- Response: `201 Created` with `CompanyMembershipDto`.

---

## 8. Candidate Skills Catalog Verification

Candidate skills must be canonical references to the central skills catalog.

### 8.1 Fetch Skills Catalog: `GET /api/v1/skills`
- Query: `search`, `active` (default `true`), `cursor`, `limit`.
- Returns collection of `SkillCatalogItemDto` (`{ id, name, aliases, active }`).

### 8.2 Profile Update: `PUT /api/v1/candidates/profile`
- Skill entries in profile must provide valid UUIDs from catalog:
  ```json
  {
    "skills": [
      { "skillId": "3fa85f64-5717-4562-b3fc-2c963f66afa6", "level": "INTERMEDIATE" }
    ]
  }
  ```
- Providing non-existent or inactive skill UUIDs returns `400 Bad Request` (`VALIDATION_ERROR`). Free-form skill names are not accepted.
- Work experience dates are strictly validated: `endDate` must be greater than or equal to `startDate`, and both must be ISO 8601 strings.

---

## 9. Phase 10 Error Codes Reference

| HTTP Status | Error Code | Description / Client Guidance |
| :--- | :--- | :--- |
| `400` | `INVALID_IDEMPOTENCY_KEY` | Key is shorter than 16 or longer than 128 characters, or contains non-ASCII characters. |
| `400` | `INVALID_CURSOR` | Pagination cursor is malformed, not valid base64, or contains tampered values. Reset cursor to null. |
| `400` | `VALIDATION_ERROR` | Request body failed class-validator validation (e.g., missing `{ read: boolean }` on notification read). |
| `404` | `RESOURCE_NOT_FOUND` | Referenced entity not found or inaccessible (e.g., submitting application with CV owned by another candidate). |
| `409` | `IDEMPOTENCY_KEY_REUSED` | Attempted to reuse an idempotency key with different request arguments/body. Generate a new UUIDv4 key for new actions. |
| `409` | `APPLICATION_ALREADY_EXISTS` | Candidate has already applied for this job (business rule violation distinct from idempotency replay). |
| `409` | `CV_NOT_READY` | Selected CV is in `PENDING`, `PROCESSING`, or `FAILED` state. Only `READY` CVs can be applied or set as default. |
| `409` | `VERSION_CONFLICT` | Optimistic locking conflict (`expectedVersion` mismatch). Refetch latest entity state and retry. |
| `503` | `QUEUE_INFRASTRUCTURE_ERROR` | Asynchronous queue or Redis temporarily unavailable. Frontend should show retryable transient error notice. |

---

## 10. Summary Verification Matrix

All Phase 10 verification gates have passed 100%:

| Gate | Target | Result | Status |
| :--- | :--- | :--- | :--- |
| **Prisma Generation** | Clean client generation | Exit code 0 | **PASS** |
| **TypeScript Build** | `nest build` strict compilation | Exit code 0 | **PASS** |
| **ESLint** | Zero errors, zero warnings (`no-explicit-any: error`) | Exit code 0 | **PASS** |
| **Unit Test Suite** | 27/27 test suites | 260/260 tests pass | **PASS** |
| **E2E Test Suite** | 10/10 test suites | 145/145 tests pass | **PASS** |
| **Scope Boundary** | Backend only, 0 frontend files modified | 0 frontend diffs | **PASS** |
