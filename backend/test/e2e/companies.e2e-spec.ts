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

  it('POST /api/v1/companies/:companyId/members adds a recruiter member to the company', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/members`)
      .set('Authorization', `Bearer ${hrOwnerToken}`)
      .send({
        userEmail: 'hr-recruiter@itziec.com',
        role: 'RECRUITER',
      })
      .expect(201);

    expect(res.body.data.role).toBe('RECRUITER');
    expect(res.body.data.user.email).toBe('hr-recruiter@itziec.com');
    createdRecruiterMemberId = res.body.data.id;
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
    it('POST /api/v1/companies/:companyId/members creates a pending invitation with 202 for unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/members`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          userEmail: 'unregistered-guest@itziec.com',
          role: 'RECRUITER',
        })
        .expect(202);

      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.companyId).toBe(companyId);
      expect(res.body.data.email).toBe('u***t@itziec.com'); // masked email
      expect(res.body.data.role).toBe('RECRUITER');
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.expiresAt).toBeDefined();
      expect(res.body.data.createdAt).toBeDefined();
      // Ensure neither token nor hash is leaked
      expect(res.body.data.tokenHash).toBeUndefined();
      expect(res.body.data.token).toBeUndefined();

      // Verify audit log and outbox event
      const audit = inMemoryPrisma.auditLogs.find(
        (a) => a.action === 'COMPANY_INVITATION_CREATED' && a.targetId === res.body.data.id,
      );
      expect(audit).toBeDefined();
      expect(audit.metadata.maskedEmail).toBe('u***t@itziec.com');

      const outbox = inMemoryPrisma.outboxEvents.find(
        (e) => e.eventName === 'CompanyInvitationCreated' && e.aggregateId === res.body.data.id,
      );
      expect(outbox).toBeDefined();
      expect(outbox.payload.email).toBe('unregistered-guest@itziec.com');
      // Prove neither outbox payload nor audit contains plaintext token or encryption secret
      expect(outbox.payload.token).toBeUndefined();
      expect(outbox.payload.tokenHash).toBeUndefined();
      expect(outbox.payload.encryptedToken).toBeUndefined();

      // Verify CompanyInvitationDeliverySecret row in database snapshot
      const secretRow = inMemoryPrisma.companyInvitationDeliverySecrets.find(
        (s) => s.invitationId === res.body.data.id,
      );
      expect(secretRow).toBeDefined();
      expect(secretRow.encryptedToken).toBeDefined();
      expect(typeof secretRow.encryptedToken).toBe('string');
      expect(secretRow.iv).toBeDefined();
      expect(secretRow.authTag).toBeDefined();
      // Must be ciphertext, never plaintext
      expect(secretRow.token).toBeUndefined();
    });

    it('delivers invitation email with accept URL, recipient accepts with 201, and secret row is deleted', async () => {
      // 1. Create invitation for another unregistered guest
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

      // 4. Invitee registers account
      const registerRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'flow-invitee@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      const inviteeToken = registerRes.body.data.accessToken;

      // 5. Invitee calls accept endpoint using token from email
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
      const res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/members`)
        .set('Authorization', `Bearer ${hrOwnerToken}`)
        .send({
          userEmail: 'unregistered-guest@itziec.com',
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
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(404);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_NOT_FOUND);
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

      // candidateToken belongs to candidate@itziec.com != intended-invitee@itziec.com
      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_EMAIL_MISMATCH);
    });

    it('POST /api/v1/company-invitations/:token/accept rejects expired invitation with 409 INVITATION_EXPIRED', async () => {
      const rawToken = 'secret-raw-token-expired-case';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await inMemoryPrisma.companyInvitation.create({
        data: {
          companyId,
          email: 'candidate@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${candidateToken}`)
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
          email: 'candidate@itziec.com',
          role: 'RECRUITER',
          tokenHash,
          status: 'ACCEPTED',
          expiresAt: new Date(Date.now() + 7 * 86400000),
          acceptedAt: new Date(),
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/company-invitations/${rawToken}/accept`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(409);

      expect(res.body.error.code).toBe(ERROR_CODES.INVITATION_ALREADY_ACCEPTED);
    });
  });
});
