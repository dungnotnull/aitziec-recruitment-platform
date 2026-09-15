# Phase 16 Runtime, Profile & Invitation Design

**Goal:** Repair notification schema drift, complete Candidate avatar and skill-catalog integration, and finalize secure company-invitation cancellation behavior without breaking current consumers.

## Scope and decisions

Phase 16 contains the only six incomplete tracker tasks. Work proceeds in task order:

1. Reconcile the missing PostgreSQL enum value and replay the identified failed notification job.
2. Set and validate `FRONTEND_URL` so invitation email links use the Vite frontend origin.
3. Implement a Candidate-only avatar upload API.
4. Preserve the skills collection envelope and pagination while returning both legacy `id` and new `skillId`.
5. Restrict company invitations to existing active HR accounts.
6. Add owner revoke and recipient HR reject commands.

The approved avatar contract is `POST /api/v1/candidates/me/avatar`, multipart field `avatar`, with optional `expectedVersion`. It returns the updated avatar URL and profile version; `GET /api/v1/candidates/me` exposes `avatarUrl`. Avatar ownership stays on `CandidateProfile`; neither `HrProfile.avatarUrl` nor company logo behavior changes.

The approved skill compatibility contract retains `CollectionResponse` and existing query/pagination behavior. Each catalog item exposes both `id` and `skillId` with the same canonical UUID. Candidate profile writes and reads retain `{ skillId, name, yearsOfExperience }`.

The approved invitation commands are:

- `DELETE /api/v1/companies/:companyId/invitations/:invitationId`, available only to a membership `OWNER`, returning `204`.
- `POST /api/v1/hr/invitations/:invitationId/reject`, available only to the matching HR recipient, returning `204`.

Global `ADMIN` is not an override for the owner-only revoke command.

## Architecture

### 16A: operational recovery and configuration

The application source already emits and consumes `JobPendingApproval`; PostgreSQL lacks the enum value despite the migration ledger saying it is applied. The operational repair verifies the target database and migration history, runs idempotent `ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_PENDING_APPROVAL';`, verifies `pg_enum`, and retries the exact failed BullMQ job. Only if retry is unavailable does the operator remove the exact job and re-dispatch according to the existing outbox lifecycle. No migration checksum or historical migration file is edited.

Invitation delivery uses `FRONTEND_URL` and must not silently build a localhost:3000 link. Local configuration and its example set `http://localhost:5173`; config parsing normalizes an origin and fails safely for invalid production configuration. Tests assert the exact email route through Mailpit-compatible delivery mocks.

### 16B: Candidate media and skills compatibility

The Candidate profile gains one nullable `avatarUrl` field through an additive Prisma migration. The upload flow follows the proven company-logo pattern: JWT Candidate scope, multipart size limit, MIME plus magic-byte verification, server-generated public-asset key, atomic profile version update and audit, compensating deletion on database failure, and post-commit deletion only for an old managed asset.

The skills catalog does not change storage or canonicalization. Its DTO/mapper adds `skillId` as a compatibility alias. Existing profile service behavior remains the source of truth for validating active skill UUIDs and transactionally replacing candidate skills. Cross-service tests prove the catalog selection payload can round-trip through profile PATCH and GET.

### 16C: invitation eligibility and terminal states

Invitation creation resolves the normalized target email before generating a token. Only a persisted, active `HR` account proceeds to the existing invitation, encrypted-delivery-secret and outbox path. All rejected target classes have no write or queue side effects.

Revoke and reject both perform a conditional `PENDING -> REVOKED` transition in one transaction with `revokedAt`, delivery-secret cleanup and an audit row. The transition is race-safe against accept and the losing operation returns a stable conflict rather than a Prisma error. Delivery workers must skip invitations that became non-pending before send.

## Error handling and security

- Never reset PostgreSQL, alter migration history, or operate on an unverified queue/database target.
- Reject avatar input that is empty, too large, MIME/signature-mismatched, SVG/script-capable, or has a stale profile version. Do not log bytes, filenames, object keys or credentials.
- Keep invitation tokens, hashes, ciphertext and full email addresses out of API responses, audit metadata and logs.
- Return the established 401/403/404/409 envelopes and map validation errors to 400. Conditional transitions prevent duplicate audit records or memberships.

## Testing and verification

Each source behavior starts with a focused failing unit or E2E test, followed by the smallest implementation to pass. Each completed task runs its focused tests, `npm run lint`, `npm run build`, Prisma generation/migration checks when schema changes, and relevant E2E tests. The operational recovery records direct PostgreSQL and queue evidence before Phase 16 task status changes.

## Working-tree constraint

`backend/src/candidates/dto/candidate.dto.ts` has an uncommitted duplicate decorator block outside its class that currently breaks TypeScript parsing. The user approved removing only that invalid duplicate while implementing BE-16-003/004. All other uncommitted changes are preserved.
