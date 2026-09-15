# Phase 16 Runtime, Profile & Invitation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute inline task-by-task with TDD. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete BE-16-001 through BE-16-006 in tracker order while preserving existing API consumers and all unrelated working-tree changes.

**Architecture:** Repair the existing notification pipeline operationally rather than recreating it. Add Candidate avatar storage as an aggregate-owned, versioned public asset; preserve skill catalog pagination while adding a compatibility alias; and make invitation terminal transitions conditional and transactional.

**Tech Stack:** NestJS 10, TypeScript 5, Prisma/PostgreSQL, BullMQ/Redis, MinIO/S3, Jest/Supertest.

## Global Constraints

- Only modify `backend/**`, the approved design/plan documentation, and the Phase 16 tracker status/activity rows.
- Do not edit applied Prisma migration `20260914150000_job_pending_approval_notification` or reset/drop/truncate PostgreSQL.
- `POST /candidates/me/avatar` is Candidate-only; `GET /skills` keeps its collection envelope and exposes both `id` and `skillId`; revoke/reject return `204`; only company OWNER can revoke.
- Before every production-code change, add a focused test and run it to observe the expected failure.
- Preserve every unrelated uncommitted change. Remove only the approved invalid duplicate block at the end of `src/candidates/dto/candidate.dto.ts`.

---

### Task 1: BE-16-001 PostgreSQL enum recovery and notification-job replay

**Files:**
- Modify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md` only after operational evidence exists.
- Inspect: `backend/prisma/migrations/20260914150000_job_pending_approval_notification/migration.sql`, PostgreSQL `_prisma_migrations`, `pg_enum`, Redis/BullMQ notification queue.

**Interfaces:**
- Consumes: existing `JobPendingApproval` outbox event and notification job `b1216c20-5f5f-441d-bf3d-73fec4fdfa2c`.
- Produces: a PostgreSQL enum containing `JOB_PENDING_APPROVAL` and one idempotent owner notification delivery.

- [ ] **Step 1: Capture recovery baseline**

Run from `backend/` against the configured database and save only sanitized output in the task activity row:

```powershell
npx prisma migrate status
@'
SELECT m.migration_name, m.finished_at, m.rolled_back_at
FROM "_prisma_migrations" m
WHERE m.migration_name = '20260914150000_job_pending_approval_notification';
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'NotificationType'
ORDER BY e.enumsortorder;
'@ | npx prisma db execute --stdin --schema prisma/schema.prisma
```

Expected: migration row is finished and enum label is absent, proving the reported drift.

- [ ] **Step 2: Apply the idempotent enum repair and verify it**

```powershell
@'
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'JOB_PENDING_APPROVAL';
SELECT e.enumlabel
FROM pg_enum e
JOIN pg_type t ON t.oid = e.enumtypid
WHERE t.typname = 'NotificationType' AND e.enumlabel = 'JOB_PENDING_APPROVAL';
'@ | npx prisma db execute --stdin --schema prisma/schema.prisma
```

Expected: one returned label; repeat once and confirm no error/no duplicate.

- [ ] **Step 3: Replay the exact failed delivery and prove owner isolation**

Use the existing BullMQ administrative mechanism to retry job `b1216c20-5f5f-441d-bf3d-73fec4fdfa2c`; do not delete it unless retry reports it cannot be retried. Query notifications for the affected Company owners and verify one `JOB_PENDING_APPROVAL` resource notification per owner. If queue removal is necessary, record the exact queue and job ID, remove only that job, and re-dispatch its persisted outbox event rather than bypassing the lifecycle.

- [ ] **Step 4: Run notification regression and record completion evidence**

Run: `npm test -- --runTestsByPath test/unit/notifications.spec.ts test/unit/outbox.spec.ts`.

Expected: pass; tracker task can be marked complete only with sanitized SQL, queue action, owner-notification and no-duplicate evidence.

### Task 2: BE-16-002 frontend-origin invitation links

**Files:**
- Modify: `backend/.env`, `backend/.env.example`, `backend/src/config/configuration.ts`, `backend/src/companies/workers/invitation-delivery.worker.ts`, `backend/test/unit/notifications.spec.ts`.
- Test: `backend/test/unit/notifications.spec.ts` and invitation E2E coverage.

**Interfaces:**
- Consumes: `FRONTEND_URL` as an absolute origin.
- Produces: one-time invitation links at `<origin>/company-invitations/<token>/accept`.

- [ ] **Step 1: Write failing config/link tests**

Add tests asserting a trailing-slash `FRONTEND_URL` normalizes to exactly one slash and invalid/non-origin values are rejected. Update the invitation delivery test expectation to the approved 5173 origin before production code changes.

```ts
expect(emailArgs.html).toContain(
  'href="http://localhost:5173/company-invitations/one-time-raw-secret-token-456/accept"',
);
```

Run: `npm test -- --runTestsByPath test/unit/notifications.spec.ts`.

Expected: FAIL because the fixture/runtime fallback still uses `localhost:3000` and origin validation does not exist.

- [ ] **Step 2: Implement normalized required origin configuration**

Add a `FRONTEND_URL` config field validated as an absolute HTTP(S) origin without path/query/fragment. Replace the worker fallback chain with the validated config value and construct:

```ts
const acceptUrl = `${frontendUrl.replace(/\/$/, '')}/company-invitations/${rawToken}/accept`;
```

Add `FRONTEND_URL=http://localhost:5173` to both env files. Keep email delivery retryable when config is invalid and never delete a secret before successful send.

- [ ] **Step 3: Verify focused and integration behavior**

Run: `npm test -- --runTestsByPath test/unit/notifications.spec.ts`; then `npm run test:e2e -- --runTestsByPath test/e2e/companies.e2e-spec.ts` and inspect a newly generated Mailpit message after restarting the backend worker.

Expected: test and Mailpit href exactly use port 5173, delivery secret deletion still happens only after success.

### Task 3: BE-16-003 Candidate avatar upload

**Files:**
- Modify: `backend/prisma/schema.prisma`, new Prisma migration, `backend/src/candidates/candidates.controller.ts`, `candidates.service.ts`, `candidates.module.ts`, `dto/candidate.dto.ts`, `backend/src/audit/audit.service.ts` only if needed, `backend/test/e2e/in-memory-prisma.ts`.
- Create: `backend/src/candidates/dto/candidate-avatar.dto.ts` if a focused DTO is clearer.
- Test: `backend/test/unit/candidates.spec.ts`, new/extended candidate E2E test.

**Interfaces:**
- Consumes: authenticated Candidate, `multipart/form-data` field `avatar`, optional `expectedVersion`.
- Produces: `POST /api/v1/candidates/me/avatar -> { avatarUrl, version }`; CandidateProfile DTO includes nullable `avatarUrl`.

- [ ] **Step 1: Repair only the approved local parse blocker and write failing tests**

Remove the duplicate decorators and stray closing brace outside `UpdateCandidateProfileDto`. Add tests for a valid PNG upload, 5 MiB rejection, magic-byte/MIME mismatch, stale version, unauthorized role, storage failure compensation, and `GET /candidates/me` avatar round trip.

Run: `npm test -- --runTestsByPath test/unit/candidates.spec.ts`.

Expected: FAIL because the profile has no `avatarUrl` and no upload service/controller method exists.

- [ ] **Step 2: Add schema and migration**

Add `avatarUrl String?` to `CandidateProfile`; create an additive migration only. Regenerate Prisma client and update the in-memory Prisma model/test fixture.

Run: `npx prisma generate` and targeted test.

Expected: generated client succeeds; tests still fail until endpoint behavior is implemented.

- [ ] **Step 3: Implement secure storage transaction**

Reuse `StorageService.uploadPublicAsset` with a server-generated `candidates/<profileId>/<uuid>.<extension>` key. Validate PNG/JPEG/WebP magic bytes and 5 MiB ceiling before upload. In a transaction compare version, save URL/version, and audit `CANDIDATE_AVATAR_UPDATED`; delete the newly uploaded object on database failure and delete only a prior managed candidate asset after commit.

- [ ] **Step 4: Expose controller and DTO projection**

Add `@Post('me/avatar')`, JWT/Roles Candidate guard, `FileInterceptor('avatar')`, Swagger multipart documentation and a typed response. Include `avatarUrl` in the candidate profile mapper and DTO.

- [ ] **Step 5: Verify all avatar gates**

Run focused unit/E2E tests, `npx prisma generate`, `npm run lint`, and `npm run build`.

Expected: valid image returns the managed public URL/version; all invalid/race/failure tests pass without bytes or keys in audit logs.

### Task 4: BE-16-004 skill catalog compatibility

**Files:**
- Modify: `backend/src/skills/dto/skill-catalog.dto.ts`, `skills.service.ts`, tests in `backend/test/unit/skills.spec.ts`, `backend/test/e2e/skills.e2e-spec.ts`, candidate unit/E2E tests.

**Interfaces:**
- Consumes: canonical `Skill.id`.
- Produces: catalog item `{ id, skillId: id, name, aliases, active, createdAt, updatedAt }` inside existing `CollectionResponse`.

- [ ] **Step 1: Write failing alias and round-trip tests**

Add a catalog test asserting `item.skillId === item.id`, plus an E2E flow that obtains `skillId`, PATCHes it with years of experience, and verifies GET profile returns populated `{ skillId, name, yearsOfExperience }`.

Run: `npm test -- --runTestsByPath test/unit/skills.spec.ts`.

Expected: FAIL because catalog DTO omits `skillId`.

- [ ] **Step 2: Add only the compatibility field**

Add `skillId` to `SkillCatalogItemDto` and mapper without removing `id`, changing ordering, cursor semantics, search behavior or active filtering.

- [ ] **Step 3: Verify catalog/profile regressions**

Run focused skills/candidates unit and E2E suites, then lint/build.

Expected: existing consumers retain `id`; new frontend consumer uses `skillId`; invalid/inactive/duplicate skill PATCH requests remain atomic failures.

### Task 5: BE-16-005 invitation target eligibility

**Files:**
- Modify: `backend/src/companies/companies.service.ts`, `backend/src/common/constants/error-codes.ts` if a new stable code is needed, invitation tests.
- Test: `backend/test/e2e/companies.e2e-spec.ts` and focused company-service unit tests if present.

**Interfaces:**
- Consumes: normalized email and inviter with existing owner/admin create permission.
- Produces: `202 CompanyInvitationDto` only for persisted active HR targets; one stable 4xx result and no side effect for every ineligible target.

- [ ] **Step 1: Write failing no-side-effect tests**

Add test cases for missing email, Candidate, ADMIN and inactive HR. Each case asserts zero invitation rows, delivery secrets, outbox events and queued email calls.

Run: `npm run test:e2e -- --runTestsByPath test/e2e/companies.e2e-spec.ts`.

Expected: missing-email case currently fails because it creates an invitation.

- [ ] **Step 2: Make target eligibility a precondition**

Immediately after `findUnique`, reject when target is absent, non-HR or non-active before membership/pending checks, token generation, encryption or transaction. Use one approved safe domain code for all target-ineligible cases; preserve active-HR invitation and existing-membership conflict behavior.

- [ ] **Step 3: Verify target matrix**

Run invitation E2E and unit coverage plus lint/build.

Expected: only active existing HR can produce one pending invitation and accept it.

### Task 6: BE-16-006 invitation revoke and reject

**Files:**
- Modify: `backend/src/companies/companies.controller.ts`, `companies.service.ts`, `company-scope.service.ts` if owner-only assertion is needed, `backend/src/hr/hr.controller.ts`, `hr.service.ts`, error codes/tests.
- Test: `backend/test/e2e/companies.e2e-spec.ts`, focused invitation/service tests.

**Interfaces:**
- Consumes: `DELETE /companies/:companyId/invitations/:invitationId` as membership OWNER and `POST /hr/invitations/:invitationId/reject` as matching HR.
- Produces: `204`, an atomically revoked invitation with `revokedAt`, absent delivery secret, one audit record and non-acceptable token.

- [ ] **Step 1: Write failing authorization and terminal-state tests**

Add tests for owner revoke, other-owner/recruiter/candidate/admin denial, recipient reject, wrong-email denial, missing/non-pending conflict, token accept after revoke, and accept-vs-revoke race.

```ts
await request(app.getHttpServer())
  .delete(`/api/v1/companies/${companyId}/invitations/${invitationId}`)
  .set('Authorization', `Bearer ${ownerToken}`)
  .expect(204);
```

Run: `npm run test:e2e -- --runTestsByPath test/e2e/companies.e2e-spec.ts`.

Expected: FAIL because both routes are absent.

- [ ] **Step 2: Implement one reusable conditional revoke service**

Create a private transaction helper that conditionally updates only `PENDING` invitation rows to:

```ts
{ status: 'REVOKED', revokedAt: now }
```

It deletes `CompanyInvitationDeliverySecret` with `deleteMany`, records the supplied revoke/reject audit action, and maps zero updates to stable not-found/conflict errors. Owner authorization checks exact `CompanyMembership.role === 'OWNER'`; HR reject resolves the current database email and compares normalized values.

- [ ] **Step 3: Add both controllers and delivery guard**

Expose the approved `DELETE` and `POST` routes with UUID validation, JWT/Roles guards and `@HttpCode(HttpStatus.NO_CONTENT)`. Before invitation email rendering, re-read/require invitation `PENDING` so a queued revoked invitation is skipped safely.

- [ ] **Step 4: Verify terminal transition behavior**

Run focused invitation tests, full company E2E, lint and build.

Expected: exactly one of accept/revoke/reject wins, audit/secret state follows it, and no rejected invitation can be delivered or accepted.

### Task 7: Phase 16 tracker closure

**Files:**
- Modify: `backend/DEVELOPMENT-TASK-BY-PHASES-TRACKING-LOGS.md`.

- [ ] **Step 1: Run full verification after all source tasks are green**

Run:

```powershell
npx prisma generate
npm run lint
npm run build
npm test
npm run test:e2e
```

Expected: all commands exit `0`.

- [ ] **Step 2: Record evidence and transition statuses**

For each task, add only real command/result evidence to the Activity Log, change `[ ]` to `[x]` only when its listed acceptance criteria are met, and leave a precise dated in-progress/blocker note for anything unavailable in the local environment.
