import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { InMemoryPrismaService } from './in-memory-prisma';
import { ContractValidationPipe } from '../../src/common/pipes/contract-validation.pipe';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseTransformInterceptor } from '../../src/common/interceptors/response-transform.interceptor';
import { ERROR_CODES } from '../../src/common/constants/error-codes';
import { EmailService } from '../../src/email/email.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { InvitationSecretAdapter } from '../../src/companies/adapters/invitation-secret.adapter';

describe('Companies & Memberships E2E (BE-2-015 to BE-2-020)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let hrOwnerToken = '';
  let hrRecruiterToken = '';
  let candidateToken = '';
  let companyId = '';
  let createdRecruiterMemberId = '';

  beforeAll(async () => {
    inMemoryPrisma = new InMemoryPrismaService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(inMemoryPrisma)
      .overrideProvider(RedisService)
      .useValue({
        getClient: () => ({}),
        isHealthy: async () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ContractValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());

    await app.init();

    // Register HR Owner
    const ownerRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-owner@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrOwnerToken = ownerRes.body.data.accessToken;

    // Register HR Recruiter (to be invited as member)
    const recruiterRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-recruiter@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrRecruiterToken = recruiterRes.body.data.accessToken;

    // Register Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-comp@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/companies creates company and assigns owner membership', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        name: 'VNG Corporation',
        slug: 'vng-corp',
        description: 'VNG technology company',
        websiteUrl: 'https://vng.com.vn',
        location: 'District 7, Ho Chi Minh City',
      })
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.slug).toBe('vng-corp');
    expect(res.body.data.version).toBe(1);
    companyId = res.body.data.id;
  });

  it('POST /api/v1/companies rejects slug collision with 409 COMPANY_SLUG_EXISTS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        name: 'Another VNG',
        slug: 'vng-corp',
      })
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.COMPANY_SLUG_EXISTS);
  });

  it('POST /api/v1/companies rejects CANDIDATE role with 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        name: 'Candidate Fake Company',
      })
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('GET /api/v1/companies/:companyIdOrSlug returns public company profile', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/companies/vng-corp').expect(200);

    expect(res.body.data.id).toBe(companyId);
    expect(res.body.data.name).toBe('VNG Corporation');
  });

  it('PATCH /api/v1/companies/:companyId updates company fields with expectedVersion', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        expectedVersion: 1,
        name: 'VNG Corporation Vietnam',
      })
      .expect(200);

    expect(res.body.data.name).toBe('VNG Corporation Vietnam');
    expect(res.body.data.version).toBe(2);
  });

  it('PATCH /api/v1/companies/:companyId rejects stale version with 409 VERSION_CONFLICT', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        expectedVersion: 1, // Stale! Current version is 2
        name: 'Trying to update',
      })
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.VERSION_CONFLICT);
  });

  it('PATCH /api/v1/companies/:companyId rejects non-owner/recruiter with 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${hrRecruiterToken}`)
      .send({
        expectedVersion: 2,
        name: 'Unauthorized update',
      })
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('PATCH /api/v1/companies/:companyId accepts unchanged slug and updates company (tolerant slug handling)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        expectedVersion: 2,
        name: 'VNG Corporation Vietnam Ltd',
        slug: 'vng-corp', // Same slug sent by frontend
      })
      .expect(200);

    expect(res.body.data.name).toBe('VNG Corporation Vietnam Ltd');
    expect(res.body.data.slug).toBe('vng-corp');
    expect(res.body.data.version).toBe(3);
  });

  it('PATCH /api/v1/companies/:companyId rejects modified slug with 400 VALIDATION_ERROR', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/companies/${companyId}`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        expectedVersion: 3,
        name: 'VNG Hack',
        slug: 'vng-new-slug',
      })
      .expect(400);

    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.message).toContain('Company slug cannot be changed once created');
  });

  it('POST /api/v1/companies/:companyId/logo uploads company logo and increments version', async () => {
    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0),
    ]);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/logo`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .attach('logo', pngBuffer, { filename: 'test-logo.png', contentType: 'image/png' })
      .field('expectedVersion', 3)
      .expect(200);

    expect(res.body.data.version).toBe(4);
    expect(res.body.data.logoUrl).toContain('companies/');
    expect(res.body.data.logoUrl).toMatch(/\.png$/);
  });

  it('POST /api/v1/companies/:companyId/logo rejects candidate with 403 FORBIDDEN', async () => {
    const pngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 0),
    ]);

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/logo`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .attach('logo', pngBuffer, { filename: 'test-logo.png', contentType: 'image/png' })
      .expect(403);
  });

  it('POST /api/v1/companies/:companyId/logo rejects file with invalid signature with 415', async () => {
    const fakeBuffer = Buffer.from('NOT_A_REAL_IMAGE');

    await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/logo`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .attach('logo', fakeBuffer, { filename: 'fake.png', contentType: 'image/png' })
      .expect(415);
  });

  it('POST /api/v1/companies/:companyId/members creates pending invitation with 202 for registered HR and accepts', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        userEmail: 'hr-recruiter@itziec.com',
        role: 'RECRUITER',
      })
      .expect(202);

    expect(res.body.data.role).toBe('RECRUITER');
    expect(res.body.data.status).toBe('PENDING');
    const invitationId = res.body.data.id;

    // Decrypt the raw token to accept
    const secretRow = inMemoryPrisma.companyInvitationDeliverySecrets.find(
      (s) => s.invitationId === invitationId,
    );
    expect(secretRow).toBeDefined();
    const secretAdapter = app.get(InvitationSecretAdapter);
    const rawToken = secretAdapter.decryptToken(
      secretRow.encryptedToken,
      secretRow.iv,
      secretRow.authTag,
    );

    // HR Recruiter accepts the invitation
    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/company-invitations/${rawToken}/accept`)
      .set('Authorization', `Bearer ${hrRecruiterToken}`)
      .expect(201);

    expect(acceptRes.body.data.role).toBe('RECRUITER');
    expect(acceptRes.body.data.user.email).toBe('hr-recruiter@itziec.com');
    createdRecruiterMemberId = acceptRes.body.data.id;
  });

  it('POST /api/v1/companies/:companyId/members rejects duplicate member with 409 MEMBERSHIP_ALREADY_EXISTS', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        userEmail: 'hr-recruiter@itziec.com',
      })
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.MEMBERSHIP_ALREADY_EXISTS);
  });

  it('POST /api/v1/companies/:companyId/members rejects non-HR user with 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        userEmail: 'candidate-comp@itziec.com',
      })
      .expect(400);

    expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_TARGET_INELIGIBLE);
  });

  it('GET /api/v1/companies/:companyId/members lists memberships for member', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${hrRecruiterToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2); // Owner + Recruiter
  });

  it('DELETE /api/v1/companies/:companyId/members/:memberId prevents removing the last owner', async () => {
    // Look up owner membership id
    const membersList = await request(app.getHttpServer())
      .get(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${hrOwnerToken}`);

    const ownerMember = membersList.body.data.find((m: any) => m.role === 'OWNER');

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}/members/${ownerMember.id}`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.LAST_COMPANY_OWNER);
  });

  it('DELETE /api/v1/companies/:companyId/members/:memberId removes recruiter member successfully', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/companies/${companyId}/members/${createdRecruiterMemberId}`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .expect(204);
  });

  describe('GET /api/v1/companies/mine (BE-8-008)', () => {
    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get('/api/v1/companies/mine').expect(401);
    });

    it('rejects CANDIDATE caller with 403 FORBIDDEN', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/companies/mine')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('returns companies for HR owner with membership and company fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/companies/mine')
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const item = res.body.data[0];
      expect(item.membership).toBeDefined();
      expect(item.membership.role).toBe('OWNER');
      expect(item.company).toBeDefined();
      expect(item.company.id).toBe(companyId);
      expect(item.company.status).toBe('ACTIVE');
      expect(item.company.version).toBeDefined();
    });

    it('returns empty collection for newly registered HR without companies', async () => {
      const freshHr = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'fresh-hr-no-company@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      const freshToken = freshHr.body.data.accessToken;

      const res = await request(app.getHttpServer())
        .get('/api/v1/companies/mine')
        .set('Authorization', `Bearer ${freshToken}`)
        .expect(200);

      expect(res.body.data).toEqual([]);
      expect(res.body.meta.page.hasNextPage).toBe(false);
      expect(res.body.meta.page.nextCursor).toBeNull();
    });
  });

  describe('Company Invitations & Acceptance (BE-8-010 to BE-8-012)', () => {
    it('POST /api/v1/companies/:companyId/members rejects unknown email with 400 INVITATION_TARGET_INELIGIBLE (BE-16-005)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/members`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          userEmail: 'unregistered-guest@itziec.com',
          role: 'RECRUITER',
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_TARGET_INELIGIBLE);

      // Verify zero invitations, secrets, audit, and outbox created
      const inv = inMemoryPrisma.companyInvitations.find(
        (i) => i.email === 'unregistered-guest@itziec.com',
      );
      expect(inv).toBeUndefined();
    });

    it('delivers invitation email with accept URL, recipient accepts with 201, and secret row is deleted', async () => {
      // 0. Register active HR recipient first (BE-16-005)
      const registerRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'flow-invitee@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      const inviteeToken = registerRes.body.data.accessToken;

      // 1. Create invitation for registered active HR
      const inviteRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/members`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          userEmail: 'flow-invitee@itziec.com',
          role: 'RECRUITER',
        })
        .expect(202);

      const invitationId = inviteRes.body.data.id;
      const secretBefore = inMemoryPrisma.companyInvitationDeliverySecrets.find(
        (s) => s.invitationId === invitationId,
      );
      expect(secretBefore).toBeDefined();

      // 2. Mock or capture email delivery
      let deliveredAcceptUrl = '';
      const emailService = app.get(EmailService);
      emailService.sendEmail = jest.fn().mockImplementation(async (opts) => {
        const match = opts.text.match(/\/company-invitations\/([a-f0-9]+)\/accept/);
        if (match) {
          deliveredAcceptUrl = match[0];
        }
        return { success: true, messageId: 'mock-sent' };
      });

      // 3. Deliver invitation via NotificationsService
      const notificationsService = app.get(NotificationsService);
      await notificationsService.routeEvent('CompanyInvitationCreated', {
        companyId,
        companyName: 'Test Company',
        email: 'flow-invitee@itziec.com',
        role: 'RECRUITER',
        invitedById: 'owner-id',
        invitationId,
      });

      expect(deliveredAcceptUrl).toMatch(/\/company-invitations\/[a-f0-9]{64}\/accept/);
      const tokenMatch = deliveredAcceptUrl.match(/\/company-invitations\/([a-f0-9]{64})\/accept/);
      expect(tokenMatch).not.toBeNull();
      const rawToken = tokenMatch![1];

      // Delivery secret row must be deleted after confirmed delivery
      const secretAfter = inMemoryPrisma.companyInvitationDeliverySecrets.find(
        (s) => s.invitationId === invitationId,
      );
      expect(secretAfter).toBeUndefined();

      // 4. Invitee calls accept endpoint using token from email
      const acceptRes = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`)
        .expect(201);

      expect(acceptRes.body.data.role).toBe('RECRUITER');
      expect(acceptRes.body.data.companyId).toBe(companyId);
      expect(acceptRes.body.data.user.email).toBe('flow-invitee@itziec.com');

      // Replay acceptance is rejected
      await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`)
        .expect(409);
    });

    it('POST /api/v1/companies/:companyId/members rejects duplicate pending invitation with 409 INVITATION_ALREADY_PENDING', async () => {
      // Register active HR first
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'dup-pending@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });

      // First invite succeeds
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/members`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          userEmail: 'dup-pending@itziec.com',
          role: 'RECRUITER',
        })
        .expect(202);

      // Second invite rejected as already pending
      const res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/members`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          userEmail: 'dup-pending@itziec.com',
          role: 'RECRUITER',
        })
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_ALREADY_PENDING);
    });

    it('POST /api/v1/company-invitations/:token/accept rejects unauthenticated caller with 401', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/company-invitations/some-token-value/accept')
        .expect(401);
    });

    it('POST /api/v1/company-invitations/:token/accept rejects non-existent token with 404 INVITATION_NOT_FOUND', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/company-invitations/non-existent-token-xyz/accept')
        .set('Authorization', `Bearer ${hrRecruiterToken}`)
        .expect(404);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_NOT_FOUND);
    });

    it('POST /api/v1/company-invitations/:token/accept rejects CANDIDATE caller with 403 FORBIDDEN', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/company-invitations/any-token/accept')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);

      expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
    });

    it('POST /api/v1/company-invitations/:token/accept rejects email mismatch with 403 INVITATION_EMAIL_MISMATCH', async () => {
      // Create invitation for a specific email
      const rawToken = 'secret-raw-token-for-mismatch-test';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await inMemoryPrisma.companyInvitation.create({
        data: {
          companyId,
          email: 'intended-invitee@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      // hrOwnerToken belongs to hr-owner@itziec.com != intended-invitee@itziec.com
      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(403);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_EMAIL_MISMATCH);
    });

    it('POST /api/v1/company-invitations/:token/accept rejects expired invitation with 409 INVITATION_EXPIRED', async () => {
      const rawToken = 'secret-raw-token-expired-case';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await inMemoryPrisma.companyInvitation.create({
        data: {
          companyId,
          email: 'hr-owner@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_EXPIRED);
    });

    it('POST /api/v1/company-invitations/:token/accept atomically accepts invitation and creates membership with 201', async () => {
      // Register a brand new user
      const registerRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'new-invited-hr@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      const inviteeToken = registerRes.body.data.accessToken;

      const rawToken = 'secret-raw-token-successful-accept';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const inv = await inMemoryPrisma.companyInvitation.create({
        data: {
          companyId,
          email: 'new-invited-hr@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${inviteeToken}`)
        .expect(201);

      expect(res.body.data.role).toBe('RECRUITER');
      expect(res.body.data.companyId).toBe(companyId);
      expect(res.body.data.user.email).toBe('new-invited-hr@itziec.com');

      // Verify invitation updated to ACCEPTED
      const updatedInv = inMemoryPrisma.companyInvitations.find((i) => i.id === inv.id);
      expect(updatedInv.status).toBe('ACCEPTED');
      expect(updatedInv.acceptedAt).toBeDefined();

      // Verify audit log and outbox event
      const audit = inMemoryPrisma.auditLogs.find(
        (a) => a.action === 'COMPANY_MEMBER_ADDED' && a.targetId === res.body.data.id,
      );
      expect(audit).toBeDefined();

      const outbox = inMemoryPrisma.outboxEvents.find(
        (e) => e.eventName === 'CompanyMemberAdded' && e.aggregateId === companyId,
      );
      expect(outbox).toBeDefined();
    });

    it('POST /api/v1/company-invitations/:token/accept rejects already accepted invitation with 409 INVITATION_ALREADY_ACCEPTED', async () => {
      const rawToken = 'secret-raw-token-already-accepted';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await inMemoryPrisma.companyInvitation.create({
        data: {
          companyId,
          email: 'hr-owner@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 86400000),
          acceptedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_ALREADY_ACCEPTED);
    });

    describe('Owner Revoke and HR Reject Lifecycle (BE-16-006)', () => {
      let activeHrEmail = 'invitee-revoke-reject@itziec.com';
      let activeHrToken = '';
      let testInvitationId = '';
      let testRawToken = '';

      beforeEach(async () => {
        activeHrEmail = `invitee-${Date.now()}-${Math.random().toString(36).substring(2, 6)}@itziec.com`;
        const regRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
          email: activeHrEmail,
          password: 'Password123!@#',
          role: 'HR',
        });
        activeHrToken = regRes.body.data.accessToken;

        const invRes = await request(app.getHttpServer())
          .post(`/api/v1/companies/${companyId}/members`)
          .set('Authorization', `Bearer ${hrOwnerToken}`)
          .send({
            userEmail: activeHrEmail,
            role: 'RECRUITER',
          })
          .expect(202);

        testInvitationId = invRes.body.data.id;

        const sec = inMemoryPrisma.companyInvitationDeliverySecrets.find(
          (s) => s.invitationId === testInvitationId,
        );
        const secretAdapter = app.get(InvitationSecretAdapter);
        testRawToken = secretAdapter.decryptToken(sec.encryptedToken, sec.iv, sec.authTag);
      });

      it('OWNER revokes pending invitation with 204 and clears secret', async () => {
        await request(app.getHttpServer())
          .delete(`/api/v1/companies/${companyId}/invitations/${testInvitationId}`)
          .set('Authorization', `Bearer ${hrOwnerToken}`)
          .expect(204);

        const inv = inMemoryPrisma.companyInvitations.find((i) => i.id === testInvitationId);
        expect(inv.status).toBe('REVOKED');
        expect(inv.revokedAt).toBeDefined();

        const sec = inMemoryPrisma.companyInvitationDeliverySecrets.find(
          (s) => s.invitationId === testInvitationId,
        );
        expect(sec).toBeUndefined();

        const audit = inMemoryPrisma.auditLogs.find(
          (a) => a.action === 'COMPANY_INVITATION_REVOKED' && a.targetId === testInvitationId,
        );
        expect(audit).toBeDefined();

        const acceptRes = await request(app.getHttpServer())
          .post(`/api/v1/company-invitations/${testRawToken}/accept`)
          .set('Authorization', `Bearer ${activeHrToken}`)
          .expect(409);

        expect(acceptRes.body.error.code).toBe(ERROR_CODES.INVITATION_REVOKED);

        await request(app.getHttpServer())
          .delete(`/api/v1/companies/${companyId}/invitations/${testInvitationId}`)
          .set('Authorization', `Bearer ${hrOwnerToken}`)
          .expect(409);
      });

      it('rejects non-owner recruiter from revoking invitation with 403', async () => {
        await request(app.getHttpServer())
          .delete(`/api/v1/companies/${companyId}/invitations/${testInvitationId}`)
          .set('Authorization', `Bearer ${hrRecruiterToken}`)
          .expect(403);
      });

      it('HR recipient rejects pending invitation with 204 and clears secret', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/hr/invitations/${testInvitationId}/reject`)
          .set('Authorization', `Bearer ${activeHrToken}`)
          .expect(204);

        const inv = inMemoryPrisma.companyInvitations.find((i) => i.id === testInvitationId);
        expect(inv.status).toBe('REVOKED');
        expect(inv.revokedAt).toBeDefined();

        const sec = inMemoryPrisma.companyInvitationDeliverySecrets.find(
          (s) => s.invitationId === testInvitationId,
        );
        expect(sec).toBeUndefined();

        const audit = inMemoryPrisma.auditLogs.find(
          (a) => a.action === 'COMPANY_INVITATION_REJECTED' && a.targetId === testInvitationId,
        );
        expect(audit).toBeDefined();

        const acceptRes = await request(app.getHttpServer())
          .post(`/api/v1/company-invitations/${testRawToken}/accept`)
          .set('Authorization', `Bearer ${activeHrToken}`)
          .expect(409);

        expect(acceptRes.body.error.code).toBe(ERROR_CODES.INVITATION_REVOKED);

        await request(app.getHttpServer())
          .post(`/api/v1/hr/invitations/${testInvitationId}/reject`)
          .set('Authorization', `Bearer ${activeHrToken}`)
          .expect(409);
      });

      it('rejects HR from rejecting another user invitation with 404', async () => {
        await request(app.getHttpServer())
          .post(`/api/v1/hr/invitations/${testInvitationId}/reject`)
          .set('Authorization', `Bearer ${hrRecruiterToken}`)
          .expect(404);
      });
    });
  });

  describe('HR Personal Profile & Invitations Inbox (Phase 13)', () => {
    it('GET /api/v1/hr/me returns HR profile and excludes other users / company fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/hr/me')
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(200);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.userId).toBeDefined();
      expect(res.body.data.version).toBe(1);
      // Ensure company fields are not leaked
      expect(res.body.data.companyId).toBeUndefined();
      expect(res.body.data.company).toBeUndefined();
    });

    it('GET /api/v1/hr/me rejects CANDIDATE with 403 FORBIDDEN', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/hr/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('PATCH /api/v1/hr/me updates profile fields and increments version', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/hr/me')
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          firstName: 'Alice',
          lastName: 'Smith',
          phone: '+84987654321',
          expectedVersion: 1,
        })
        .expect(200);

      expect(res.body.data.firstName).toBe('Alice');
      expect(res.body.data.lastName).toBe('Smith');
      expect(res.body.data.phone).toBe('+84987654321');
      expect(res.body.data.version).toBe(2);

      // Subsequent update with stale version fails with 409
      const conflictRes = await request(app.getHttpServer())
        .patch('/api/v1/hr/me')
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          firstName: 'Bob',
          expectedVersion: 1,
        })
        .expect(409);

      expect(conflictRes.body.error.code).toBe(ERROR_CODES.VERSION_CONFLICT);
    });

    it('GET /api/v1/hr/invitations returns pending invitations for authenticated HR', async () => {
      // Create a pending invitation for hr-owner@itziec.com
      const rawToken = 'secret-raw-token-for-inbox-test';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await inMemoryPrisma.companyInvitation.create({
        data: {
          companyId,
          email: 'hr-owner@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/hr/invitations')
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const inv = res.body.data[0];
      expect(inv.id).toBeDefined();
      expect(inv.company).toBeDefined();
      expect(inv.company.id).toBe(companyId);
      expect(inv.role).toBe('RECRUITER');
      expect(inv.status).toBe('PENDING');
      // Token or hash must never be in projection
      expect(inv.token).toBeUndefined();
      expect(inv.tokenHash).toBeUndefined();
    });

    it('GET /api/v1/hr/invitations rejects CANDIDATE with 403', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/hr/invitations')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('GET /api/v1/hr/invitations rejects malformed cursor with 400 INVALID_CURSOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/hr/invitations?cursor=invalid-cursor-string')
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CURSOR);
    });
  });

  describe('Phase 17: Public Company Discovery, Follow & Dashboard KPIs', () => {
    it('BE-17-001: PATCH /companies/:companyId updates extended recruitment metadata', async () => {
      const cur = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/companies/${companyId}`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          expectedVersion: cur.body.data.version,
          companyModel: 'Product',
          companySize: '1000-5000',
          country: 'Vietnam',
          workingTime: 'Monday - Friday',
          overtimePolicy: 'No OT',
          techStack: ['Node.js', 'NestJS', 'PostgreSQL'],
          reasonsToJoin: [
            { title: 'Great Culture', content: 'Supportive team and learning opportunities' },
          ],
          perks: [{ title: 'Hybrid Work', description: '2 days remote per week' }],
        })
        .expect(200);

      expect(res.body.data.companyModel).toBe('Product');
      expect(res.body.data.companySize).toBe('1000-5000');
      expect(res.body.data.country).toBe('Vietnam');
      expect(res.body.data.workingTime).toBe('Monday - Friday');
      expect(res.body.data.overtimePolicy).toBe('No OT');
      expect(res.body.data.techStack).toEqual(['Node.js', 'NestJS', 'PostgreSQL']);
      expect(res.body.data.reasonsToJoin).toHaveLength(1);
      expect(res.body.data.perks).toHaveLength(1);
    });

    it('BE-17-001: activeJobsCount reflects published non-expired jobs of active company', async () => {
      const futureDate = new Date(Date.now() + 30 * 86400000);
      inMemoryPrisma.jobs.push({
        id: 'job-p17-1',
        companyId,
        creatorId: 'user-hr-owner',
        title: 'Senior Engineer',
        slug: 'senior-engineer-p17',
        description: 'desc',
        requirements: 'reqs',
        responsibilities: null,
        technologyNames: ['NestJS'],
        location: 'District 7, Ho Chi Minh City',
        workplaceType: 'HYBRID',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        salaryMin: 30000000,
        salaryMax: 50000000,
        currency: 'VND',
        applicationDeadline: futureDate,
        isHot: true,
        benefits: ['Premium healthcare'],
        status: 'PUBLISHED',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      inMemoryPrisma.jobs.push({
        id: 'job-p17-expired',
        companyId,
        creatorId: 'user-hr-owner',
        title: 'Expired Engineer',
        slug: 'expired-engineer-p17',
        description: 'desc',
        requirements: 'reqs',
        responsibilities: null,
        technologyNames: ['NestJS'],
        location: 'District 7, Ho Chi Minh City',
        workplaceType: 'HYBRID',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        salaryMin: null,
        salaryMax: null,
        currency: 'VND',
        applicationDeadline: new Date(Date.now() - 86400000),
        status: 'PUBLISHED',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}`)
        .expect(200);

      expect(res.body.data.activeJobsCount).toBe(1);
    });

    it('BE-17-002: Candidate can follow, check isFollowed, and unfollow company idempotently', async () => {
      const guestRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}`)
        .expect(200);
      expect(guestRes.body.data.isFollowed).toBeUndefined();

      const candBefore = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);
      expect(candBefore.body.data.isFollowed).toBe(false);

      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/follow`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/follow`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/follow`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(204);

      const candAfter = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);
      expect(candAfter.body.data.isFollowed).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/companies/${companyId}/follow`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .delete(`/api/v1/companies/${companyId}/follow`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(204);

      const candFinal = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);
      expect(candFinal.body.data.isFollowed).toBe(false);
    });

    it('BE-17-003: GET /companies returns public company directory with search & pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/companies?page=1&limit=10')
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const c = res.body.data.find((item: any) => item.id === companyId);
      expect(c).toBeDefined();
      expect(c.name).toContain('VNG Corporation');
      expect(c.activeJobsCount).toBe(1);
      expect(Array.isArray(c.techStack)).toBe(true);
      expect(res.body.meta.page).toBeDefined();

      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/companies?search=VNG')
        .expect(200);
      expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);

      const locRes = await request(app.getHttpServer())
        .get('/api/v1/companies?location=District%207')
        .expect(200);
      expect(locRes.body.data.length).toBeGreaterThanOrEqual(1);

      const emptyRes = await request(app.getHttpServer())
        .get('/api/v1/companies?search=NonExistentCompanyXYZ')
        .expect(200);
      expect(emptyRes.body.data).toHaveLength(0);
    });

    it('BE-17-005: GET /companies/:companyId/dashboard-stats returns authoritative KPIs', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/dashboard-stats`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);

      const statsRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/dashboard-stats`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(200);

      expect(statsRes.body.data.activeJobsCount).toBe(1);
      expect(statsRes.body.data.totalApplicationsCount).toBe(0);
      expect(statsRes.body.data.teamMembersCount).toBeGreaterThanOrEqual(1);

      inMemoryPrisma.applications.push({
        id: 'app-p17-1',
        candidateId: 'cand-p17-id',
        jobId: 'job-p17-1',
        status: 'APPLIED',
        submittedCvId: 'cv-1',
        submittedAt: new Date(),
        version: 1,
      });

      const updatedStats = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/dashboard-stats`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .expect(200);

      expect(updatedStats.body.data.totalApplicationsCount).toBe(1);
      expect(updatedStats.body.data.activeJobsCount).toBe(1);
    });
  });
});
