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
import { JwtService } from '@nestjs/jwt';
import { JobExpirationScheduler } from '../../src/jobs/job-expiration.scheduler';
import { NotificationsService } from '../../src/notifications/notifications.service';

describe('Jobs, Search & Saved Jobs E2E (BE-3-001 to BE-3-022)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let hrToken = '';
  let hrUserId = '';
  let candidateToken = '';
  let adminToken = '';
  let companyId = '';
  let jobId = '';

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

    // 1. Register HR
    const hrRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-jobs@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;
    hrUserId = hrRes.body.data.user.id;

    // 2. Register Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-jobs@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;

    // 3. Create Candidate Profile
    await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        expectedVersion: 1,
        fullName: 'Nguyen Van Candidate',
        headline: 'Senior Backend Engineer',
      });

    // 4. Register Admin directly in mock DB
    const adminUser = await inMemoryPrisma.user.create({
      data: {
        email: 'admin-jobs@itziec.com',
        passwordHash: 'dummy',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    const jwtService = app.get(JwtService);
    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // 5. Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Jobs Corp Vietnam',
        description: 'Great IT company',
      });
    companyId = compRes.body.data.id;
  });

  afterAll(async () => {
    await app.close();
  });

  const futureDeadline = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

  it('1. HR creates draft job for company (BE-3-002)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Senior NestJS Developer',
        description: 'Building high-scale recruitment platform',
        requirements: 'NestJS, TypeScript, PostgreSQL',
        responsibilities: 'Lead backend architecture',
        technologyNames: ['Node.js', 'NestJS', 'PostgreSQL'],
        location: 'Ho Chi Minh City',
        workplaceType: 'HYBRID',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        salaryMin: 30000000,
        salaryMax: 50000000,
        currency: 'VND',
        applicationDeadline: futureDeadline,
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBe('Senior NestJS Developer');
    expect(res.body.data.status).toBe('DRAFT');
    expect(res.body.data.version).toBe(1);
    jobId = res.body.data.id;
  });

  it('2. Public browse /jobs does NOT list draft job (BE-3-003, BE-3-014)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/jobs');
    expect(res.status).toBe(200);
    const found = res.body.data.find((j: any) => j.id === jobId);
    expect(found).toBeUndefined();
  });

  it('3. Public get /jobs/:jobId returns 404 for draft job to conceal existence (BE-3-003)', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/jobs/${jobId}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
  });

  it('4. Scoped HR reads draft job detail successfully (BE-3-003)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${hrToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(jobId);
    expect(res.body.data.status).toBe('DRAFT');
  });

  it('5. HR updates draft job with expectedVersion (BE-3-004)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 1,
        title: 'Lead NestJS Developer',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Lead NestJS Developer');
    expect(res.body.data.version).toBe(2);
  });

  it('6. Rejects update with 409 VERSION_CONFLICT if expectedVersion is stale (BE-3-004)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/jobs/${jobId}`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 1, // now at 2
        title: 'Stale update',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODES.VERSION_CONFLICT);
  });

  it('7. HR publishes job with expectedVersion (BE-3-006)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 2,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toBeDefined();
    expect(res.body.data.version).toBe(3);
  });

  it('8. Public search finds published job (BE-3-014)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/jobs');
    expect(res.status).toBe(200);
    const found = res.body.data.find((j: any) => j.id === jobId);
    expect(found).toBeDefined();
    expect(found.status).toBe('PUBLISHED');
  });

  it('9. Public search filters by keyword and technology (BE-3-011, BE-3-014)', async () => {
    const resMatch = await request(app.getHttpServer()).get('/api/v1/jobs?q=NestJS');
    expect(resMatch.status).toBe(200);
    expect(resMatch.body.data.some((j: any) => j.id === jobId)).toBe(true);

    const resNoMatch = await request(app.getHttpServer()).get('/api/v1/jobs?q=Golang');
    expect(resNoMatch.status).toBe(200);
    expect(resNoMatch.body.data.some((j: any) => j.id === jobId)).toBe(false);
  });

  it('9b. Public search filters by experienceLevel=FRESHER regression (BE-8-004)', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Fresher Backend Engineer',
        description: 'Great fresher opportunity',
        requirements: 'Knowledge of TypeScript and Git',
        technologyNames: ['TypeScript'],
        location: 'Ho Chi Minh City',
        workplaceType: 'ONSITE',
        experienceLevel: 'FRESHER',
        employmentType: 'FULL_TIME',
        currency: 'VND',
        applicationDeadline: futureDeadline,
      });
    expect(createRes.status).toBe(201);
    const fresherJobId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${fresherJobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 1 });

    const res = await request(app.getHttpServer()).get('/api/v1/jobs?experienceLevel=FRESHER');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((j: any) => j.experienceLevel === 'FRESHER')).toBe(true);
    expect(res.body.meta.page).toBeDefined();
  });

  it('9c. Rejects invalid experienceLevel query value with 400 VALIDATION_ERROR (BE-8-004)', async () => {
    const res = await request(app.getHttpServer()).get(
      '/api/v1/jobs?experienceLevel=INVALID_LEVEL',
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.details).toBeDefined();
  });

  it('10. Parses natural language search query (BE-3-014, API-JOB-008)', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/jobs/search/parse').send({
      query: 'Senior backend remote NestJS lương 30 triệu tại HCM',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.workplaceType).toEqual(['REMOTE']);
    expect(res.body.data.experienceLevel).toEqual(['SENIOR']);
    expect(res.body.data.location).toEqual(['Ho Chi Minh']);
  });

  it('11. Candidate saves job idempotently (BE-3-019)', async () => {
    const res1 = await request(app.getHttpServer())
      .put(`/api/v1/saved-jobs/${jobId}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res1.status).toBe(204);

    // Repeated PUT is idempotent
    const res2 = await request(app.getHttpServer())
      .put(`/api/v1/saved-jobs/${jobId}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res2.status).toBe(204);
  });

  it('12. Candidate lists saved jobs (BE-3-020)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/saved-jobs')
      .set('Authorization', `Bearer ${candidateToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(jobId);
  });

  it('13. Candidate unsaves job idempotently (BE-3-019)', async () => {
    const res1 = await request(app.getHttpServer())
      .delete(`/api/v1/saved-jobs/${jobId}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res1.status).toBe(204);

    // Repeated DELETE is idempotent
    const res2 = await request(app.getHttpServer())
      .delete(`/api/v1/saved-jobs/${jobId}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res2.status).toBe(204);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/saved-jobs')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(listRes.body.data).toHaveLength(0);
  });

  describe('13b. Check saved job state endpoint (BE-9-003, API-SAVE-004)', () => {
    it('returns { isSaved: false } when candidate has not saved the job', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved-jobs/${jobId}/check`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ isSaved: false });
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('returns { isSaved: true } after candidate saves the job', async () => {
      // Save job
      await request(app.getHttpServer())
        .put(`/api/v1/saved-jobs/${jobId}`)
        .set('Authorization', `Bearer ${candidateToken}`);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved-jobs/${jobId}/check`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ isSaved: true });
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('returns { isSaved: false } after candidate unsaves the job', async () => {
      // Unsave job
      await request(app.getHttpServer())
        .delete(`/api/v1/saved-jobs/${jobId}`)
        .set('Authorization', `Bearer ${candidateToken}`);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved-jobs/${jobId}/check`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ isSaved: false });
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('returns { isSaved: false } for valid non-existent job UUID', async () => {
      const nonExistentJobId = '11111111-2222-4333-8444-555555555555';
      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved-jobs/${nonExistentJobId}/check`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ isSaved: false });
    });

    it('returns 401 when request lacks authorization token', async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/saved-jobs/${jobId}/check`);

      expect(res.status).toBe(401);
    });

    it('returns 403 when called by non-candidate role (HR)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/saved-jobs/${jobId}/check`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 400 VALIDATION_ERROR when jobId is not a valid UUID', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/saved-jobs/not-a-valid-uuid/check')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });
  });

  it('14. HR unpublishes job (BE-3-007)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/unpublish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('UNPUBLISHED');
    expect(res.body.data.version).toBe(4);
  });

  it('15. HR closes job with reason (BE-3-008)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/close`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 4,
        reason: 'Recruitment finished',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('CLOSED');
    expect(res.body.data.closedAt).toBeDefined();
    expect(res.body.data.version).toBe(5);
  });

  describe('16. Recruiter Company Jobs Collection (BE-8-009)', () => {
    it('rejects unauthenticated request with 401', async () => {
      await request(app.getHttpServer()).get(`/api/v1/companies/${companyId}/jobs`).expect(401);
    });

    it('rejects CANDIDATE with 403 FORBIDDEN', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(403);
    });

    it('rejects outsider HR with 403 FORBIDDEN', async () => {
      const outsider = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'outsider-hr-jobs@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${outsider.body.data.accessToken}`)
        .expect(403);
    });

    it('returns all company jobs including CLOSED and DRAFT for company member', async () => {
      // Create a second draft job for this company
      const draftRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          title: 'Draft React Frontend Engineer',
          description: 'Working with React and modern web apps',
          requirements: 'React, TypeScript, CSS',
          technologyNames: ['React', 'TypeScript'],
          location: 'Da Nang, Vietnam',
          workplaceType: 'HYBRID',
          experienceLevel: 'JUNIOR',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: new Date(Date.now() + 86400000 * 30).toISOString(),
        })
        .expect(201);
      expect(draftRes.body.data.status).toBe('DRAFT');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify both CLOSED and DRAFT jobs are present
      const statuses = res.body.data.map((j: { status: string }) => j.status);
      expect(statuses).toContain('CLOSED');
      expect(statuses).toContain('DRAFT');
    });

    it('filters company jobs by status properly', async () => {
      const resDraft = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs?status=DRAFT`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(resDraft.body.data.length).toBe(1);
      expect(resDraft.body.data[0].status).toBe('DRAFT');

      const resClosed = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs?status=CLOSED`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(resClosed.body.data.length).toBe(1);
      expect(resClosed.body.data[0].status).toBe('CLOSED');
    });

    it('allows company member to inspect jobs even if company is SUSPENDED, but rejects mutation', async () => {
      // Suspend company in inMemoryPrisma
      const comp = inMemoryPrisma.companies.find((c) => c.id === companyId);
      if (comp) comp.status = 'SUSPENDED';

      // Member can still read jobs
      const readRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);
      expect(readRes.body.data.length).toBeGreaterThanOrEqual(1);

      // Mutation is rejected with 403
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          title: 'Should fail on suspended company',
          description: 'desc',
          requirements: 'reqs',
          technologyNames: ['Node.js'],
          location: 'HN',
          workplaceType: 'ONSITE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: new Date(Date.now() + 86400000).toISOString(),
        })
        .expect(403);

      // Restore company status
      if (comp) comp.status = 'ACTIVE';
    });

    it('enforces role-based scoping: RECRUITER sees only own jobs, OWNER and ADMIN see all (BE-11-002)', async () => {
      // 1. Register second recruiter
      const rec2Res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'recruiter2-jobs@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      const rec2Token = rec2Res.body.data.accessToken;
      const rec2UserId = rec2Res.body.data.user.id;

      // 2. Add recruiter2 to company as RECRUITER
      await inMemoryPrisma.companyMembership.create({
        data: {
          companyId,
          userId: rec2UserId,
          role: 'RECRUITER',
        },
      });

      // 3. Recruiter 2 creates a job
      const rec2JobRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${rec2Token}`)
        .send({
          title: 'QA Engineer by Recruiter 2',
          description: 'Testing automation',
          requirements: 'Playwright, Jest',
          technologyNames: ['Playwright'],
          location: 'Da Nang',
          workplaceType: 'REMOTE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: new Date(Date.now() + 86400000 * 15).toISOString(),
        })
        .expect(201);

      expect(rec2JobRes.body.data.creatorId).toBe(rec2UserId);

      // 4. Recruiter 2 lists jobs: sees ONLY their own job
      const rec2List = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${rec2Token}`)
        .expect(200);

      expect(rec2List.body.data.length).toBe(1);
      expect(rec2List.body.data[0].id).toBe(rec2JobRes.body.data.id);
      expect(rec2List.body.data[0].creatorId).toBe(rec2UserId);

      // 5. Company OWNER (hrToken) lists jobs: sees all company jobs (>= 3)
      const ownerList = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(ownerList.body.data.length).toBeGreaterThanOrEqual(3);
      const ownerJobIds = ownerList.body.data.map((j: { id: string }) => j.id);
      expect(ownerJobIds).toContain(rec2JobRes.body.data.id);

      // 6. Global ADMIN lists jobs: sees all company jobs (>= 3)
      const adminList = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(adminList.body.data.length).toBeGreaterThanOrEqual(3);
      const adminJobIds = adminList.body.data.map((j: { id: string }) => j.id);
      expect(adminJobIds).toContain(rec2JobRes.body.data.id);
    });

    it('branches publish by role and supports approval flow (BE-11-003)', async () => {
      // 1. Register Recruiter 3
      const rec3Res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'recruiter3-jobs@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      const rec3Token = rec3Res.body.data.accessToken;
      const rec3UserId = rec3Res.body.data.user.id;

      // 2. Add recruiter3 to company as RECRUITER
      await inMemoryPrisma.companyMembership.create({
        data: {
          companyId,
          userId: rec3UserId,
          role: 'RECRUITER',
        },
      });

      // 3. Recruiter 3 creates a job
      const draftRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${rec3Token}`)
        .send({
          title: 'Cloud Security Architect by Recruiter 3',
          description: 'Securing cloud infrastructure and zero-trust',
          requirements: 'AWS, IAM, Kubernetes, ISO 27001',
          technologyNames: ['AWS', 'Kubernetes', 'Terraform'],
          location: 'Ho Chi Minh City',
          workplaceType: 'HYBRID',
          experienceLevel: 'LEAD',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: new Date(Date.now() + 86400000 * 20).toISOString(),
        })
        .expect(201);

      const pendingJobId = draftRes.body.data.id;
      expect(draftRes.body.data.status).toBe('DRAFT');

      // 4. Recruiter 3 publishes: should transition to PENDING_APPROVAL, publishedAt null
      const publishRes = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${pendingJobId}/publish`)
        .set('Authorization', `Bearer ${rec3Token}`)
        .send({ expectedVersion: 1 })
        .expect(200);

      expect(publishRes.body.data.status).toBe('PENDING_APPROVAL');
      expect(publishRes.body.data.publishedAt).toBeNull();
      expect(publishRes.body.data.version).toBe(2);

      // 4b. Verify JobPendingApproval outbox event was recorded and route notification (BE-14-001)
      const outboxEvt = inMemoryPrisma.outboxEvents.find(
        (e) => e.eventName === 'JobPendingApproval' && e.aggregateId === pendingJobId,
      );
      expect(outboxEvt).toBeDefined();
      const outboxPayload = outboxEvt!.payload as any;
      expect(outboxPayload.jobId).toBe(pendingJobId);
      expect(outboxPayload.companyId).toBe(companyId);
      expect(outboxPayload.ownerUserIds).toContain(hrUserId);

      // Route event to notifications service
      const notifService = app.get(NotificationsService);
      await notifService.routeEvent('JobPendingApproval', outboxPayload);

      // Company owner receives in-app notification
      const ownerNotifs = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      const ownerPendingNotif = ownerNotifs.body.data.find(
        (n: any) => n.type === 'JOB_PENDING_APPROVAL' && n.resource?.id === pendingJobId,
      );
      expect(ownerPendingNotif).toBeDefined();
      expect(ownerPendingNotif.resource.type).toBe('JOB');
      expect(ownerPendingNotif.readAt).toBeNull();

      // Recruiter and candidate do not receive this notification
      const recNotifs = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${rec3Token}`)
        .expect(200);
      expect(recNotifs.body.data.some((n: any) => n.resource?.id === pendingJobId)).toBe(false);

      const candNotifs = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);
      expect(candNotifs.body.data.some((n: any) => n.resource?.id === pendingJobId)).toBe(false);

      // 5. Public search does NOT find PENDING_APPROVAL job
      const searchRes = await request(app.getHttpServer())
        .get('/api/v1/jobs?q=Cloud+Security+Architect')
        .expect(200);
      expect(searchRes.body.data.some((j: { id: string }) => j.id === pendingJobId)).toBe(false);

      // 6. Public get returns 404 for PENDING_APPROVAL job (conceal existence)
      await request(app.getHttpServer()).get(`/api/v1/jobs/${pendingJobId}`).expect(404);

      // 7. Candidate applying to PENDING_APPROVAL job gets 404
      await request(app.getHttpServer())
        .post(`/api/v1/jobs/${pendingJobId}/applications`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ cvId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);

      // 8. Recruiter 3 attempts to approve: rejected with 403 (Owner or Admin only)
      await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs/${pendingJobId}/approve`)
        .set('Authorization', `Bearer ${rec3Token}`)
        .send({ expectedVersion: 2 })
        .expect(403);

      // 9. Company OWNER approves the job: transitions to PUBLISHED, sets publishedAt
      const approveRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs/${pendingJobId}/approve`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ expectedVersion: 2 })
        .expect(200);

      expect(approveRes.body.data.status).toBe('PUBLISHED');
      expect(approveRes.body.data.publishedAt).toBeDefined();
      expect(approveRes.body.data.version).toBe(3);

      // 10. Public get now returns the published job
      const publicGetRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${pendingJobId}`)
        .expect(200);
      expect(publicGetRes.body.data.status).toBe('PUBLISHED');
    });

    it('automatically transitions overdue published jobs to EXPIRED via scheduler (BE-11-004)', async () => {
      // 1. Create a job that has a short deadline
      const deadline = new Date(Date.now() + 1000);
      const jobRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          title: 'Expiring Job Developer',
          description: 'Will expire shortly',
          requirements: 'TypeScript',
          technologyNames: ['TypeScript'],
          location: 'Remote',
          workplaceType: 'REMOTE',
          experienceLevel: 'JUNIOR',
          employmentType: 'CONTRACT',
          currency: 'VND',
          applicationDeadline: deadline.toISOString(),
        })
        .expect(201);

      const expiringJobId = jobRes.body.data.id;

      // 2. Publish it by owner -> PUBLISHED
      await request(app.getHttpServer())
        .post(`/api/v1/jobs/${expiringJobId}/publish`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ expectedVersion: 1 })
        .expect(200);

      // 3. Obtain scheduler from Nest app container
      const scheduler = app.get(JobExpirationScheduler);

      // Run scheduler with a simulated future date after the deadline
      const simulatedNow = new Date(deadline.getTime() + 10000);
      const expiredCount = await scheduler.expireOverdueJobs(simulatedNow);
      expect(expiredCount).toBeGreaterThanOrEqual(1);

      // 4. Inspect job via company jobs endpoint: status is EXPIRED
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${companyId}/jobs?status=EXPIRED`)
        .set('Authorization', `Bearer ${hrToken}`)
        .expect(200);

      expect(listRes.body.data.some((j: { id: string }) => j.id === expiringJobId)).toBe(true);

      // 5. Candidate applying to EXPIRED job gets 409 JOB_NOT_OPEN
      const applyRes = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${expiringJobId}/applications`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ cvId: '00000000-0000-0000-0000-000000000000' })
        .expect(409);
      expect(applyRes.body.error.code).toBe(ERROR_CODES.JOB_NOT_OPEN);

      // 6. Running scheduler again is idempotent
      const secondRunCount = await scheduler.expireOverdueJobs(simulatedNow);
      expect(secondRunCount).toBe(0);
    });
  });

  describe('Phase 17: Job Hot/Benefits, Applicant Count & Candidate State Projection (BE-17-004)', () => {
    let phase17JobId = '';
    let phase17JobSlug = '';

    it('creates draft job with isHot and benefits, then updates and publishes it', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${companyId}/jobs`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          title: 'Staff Fullstack Architect',
          description: 'Leading technical initiatives',
          requirements: 'TypeScript, Node.js, React',
          technologyNames: ['Node.js', 'React'],
          location: 'Ho Chi Minh City',
          workplaceType: 'HYBRID',
          experienceLevel: 'LEAD',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: new Date(Date.now() + 86400000 * 30).toISOString(),
          isHot: true,
          benefits: ['Performance bonus', 'Annual health check'],
        })
        .expect(201);

      expect(createRes.body.data.isHot).toBe(true);
      expect(createRes.body.data.benefits).toEqual(['Performance bonus', 'Annual health check']);
      expect(createRes.body.data.applicantCount).toBe(0);
      phase17JobId = createRes.body.data.id;
      phase17JobSlug = createRes.body.data.slug;

      const updateRes = await request(app.getHttpServer())
        .patch(`/api/v1/jobs/${phase17JobId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: createRes.body.data.version,
          benefits: ['Performance bonus', 'Annual health check', '13th month salary'],
        })
        .expect(200);

      expect(updateRes.body.data.benefits).toEqual([
        'Performance bonus',
        'Annual health check',
        '13th month salary',
      ]);
      expect(updateRes.body.data.isHot).toBe(true);

      await request(app.getHttpServer())
        .post(`/api/v1/jobs/${phase17JobId}/publish`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({ expectedVersion: updateRes.body.data.version })
        .expect(200);
    });

    it('GET /jobs/:jobIdOrSlug projects applicantCount and candidate hasApplied/isSaved state', async () => {
      const guestRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${phase17JobSlug}`)
        .expect(200);

      expect(guestRes.body.data.id).toBe(phase17JobId);
      expect(guestRes.body.data.applicantCount).toBe(0);
      expect(guestRes.body.data.isHot).toBe(true);
      expect(guestRes.body.data.hasApplied).toBeUndefined();
      expect(guestRes.body.data.isSaved).toBeUndefined();

      const candRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${phase17JobSlug}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(candRes.body.data.hasApplied).toBe(false);
      expect(candRes.body.data.isSaved).toBe(false);
      expect(candRes.body.data.applicantCount).toBe(0);

      await request(app.getHttpServer())
        .put(`/api/v1/saved-jobs/${phase17JobId}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(204);

      const candSavedRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${phase17JobSlug}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(candSavedRes.body.data.isSaved).toBe(true);
      expect(candSavedRes.body.data.hasApplied).toBe(false);

      const candidateProfile = inMemoryPrisma.candidateProfiles[0];
      inMemoryPrisma.applications.push({
        id: 'app-p17-test',
        candidateId: candidateProfile.id,
        jobId: phase17JobId,
        status: 'APPLIED',
        submittedCvId: '00000000-0000-0000-0000-000000000000',
        submittedAt: new Date(),
        version: 1,
      });

      const candAppliedRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${phase17JobSlug}`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(candAppliedRes.body.data.hasApplied).toBe(true);
      expect(candAppliedRes.body.data.isSaved).toBe(true);
      expect(candAppliedRes.body.data.applicantCount).toBe(1);

      const guestFinal = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${phase17JobSlug}`)
        .expect(200);

      expect(guestFinal.body.data.applicantCount).toBe(1);
      expect(guestFinal.body.data.hasApplied).toBeUndefined();
      expect(guestFinal.body.data.isSaved).toBeUndefined();
    });

    it('GET /jobs (search) projects candidate state without cache pollution', async () => {
      const candSearch = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      const targetJob = candSearch.body.data.find((j: { id: string }) => j.id === phase17JobId);
      expect(targetJob).toBeDefined();
      expect(targetJob.hasApplied).toBe(true);
      expect(targetJob.isSaved).toBe(true);
      expect(targetJob.applicantCount).toBe(1);
      expect(targetJob.isHot).toBe(true);

      const guestSearch = await request(app.getHttpServer()).get('/api/v1/jobs').expect(200);

      const guestJob = guestSearch.body.data.find((j: { id: string }) => j.id === phase17JobId);
      expect(guestJob).toBeDefined();
      expect(guestJob.hasApplied).toBeUndefined();
      expect(guestJob.isSaved).toBeUndefined();
      expect(guestJob.applicantCount).toBe(1);
      expect(guestJob.isHot).toBe(true);
    });
  });

  describe('Phase 18: Company Job Creator Identity Projection (BE-18-001)', () => {
    let p18CompanyId: string;
    let ownerToken: string;
    let ownerUserId: string;
    let recToken: string;
    let recUserId: string;
    let noNameRecToken: string;
    let noNameRecUserId: string;

    beforeAll(async () => {
      // 1. Owner with full profile
      const ownerRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'owner-p18@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      ownerToken = ownerRes.body.data.accessToken;
      ownerUserId = ownerRes.body.data.user.id;

      await request(app.getHttpServer())
        .patch('/api/v1/hr/me')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          expectedVersion: 1,
          firstName: '  Pham  ',
          lastName: '  Van Owner  ',
        });

      // Create company
      const compRes = await request(app.getHttpServer())
        .post('/api/v1/companies')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Phase 18 Tech Company',
          description: 'Testing creator projections',
        });
      p18CompanyId = compRes.body.data.id;

      // 2. Recruiter with single name part (firstName only)
      const recRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'rec-single-p18@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      recToken = recRes.body.data.accessToken;
      recUserId = recRes.body.data.user.id;

      await request(app.getHttpServer())
        .patch('/api/v1/hr/me')
        .set('Authorization', `Bearer ${recToken}`)
        .send({
          expectedVersion: 1,
          firstName: '  Minh  ',
        });

      // Add recruiter to company membership directly in mock DB
      await inMemoryPrisma.companyMembership.create({
        data: {
          companyId: p18CompanyId,
          userId: recUserId,
          role: 'RECRUITER',
        },
      });

      // 3. Recruiter with no profile names
      const noNameRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'rec-noname-p18@itziec.com',
        password: 'Password123!@#',
        role: 'HR',
      });
      noNameRecToken = noNameRes.body.data.accessToken;
      noNameRecUserId = noNameRes.body.data.user.id;

      await inMemoryPrisma.companyMembership.create({
        data: {
          companyId: p18CompanyId,
          userId: noNameRecUserId,
          role: 'RECRUITER',
        },
      });
    });

    it('projects creatorName and creatorEmail correctly across full profile, single name, no name, and legacy job', async () => {
      // 1. Owner creates Job 1
      const job1Res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Job by Owner with Full Profile',
          description: 'Desc 1',
          requirements: 'Req 1',
          technologyNames: ['TypeScript'],
          location: 'HCM',
          workplaceType: 'HYBRID',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: futureDeadline,
        })
        .expect(201);

      // 2. Recruiter creates Job 2
      const job2Res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${recToken}`)
        .send({
          title: 'Job by Recruiter with Single Name',
          description: 'Desc 2',
          requirements: 'Req 2',
          technologyNames: ['Node.js'],
          location: 'HN',
          workplaceType: 'REMOTE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: futureDeadline,
        })
        .expect(201);

      // 3. No-name Recruiter creates Job 3
      const job3Res = await request(app.getHttpServer())
        .post(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${noNameRecToken}`)
        .send({
          title: 'Job by Recruiter without Names',
          description: 'Desc 3',
          requirements: 'Req 3',
          technologyNames: ['React'],
          location: 'DN',
          workplaceType: 'ONSITE',
          experienceLevel: 'JUNIOR',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: futureDeadline,
        })
        .expect(201);

      // 4. Legacy job with creatorId: null
      const legacyJob = await inMemoryPrisma.job.create({
        data: {
          companyId: p18CompanyId,
          creatorId: null,
          title: 'Legacy Orphan Job',
          slug: 'legacy-orphan-job-' + Date.now(),
          description: 'Legacy job without creator',
          requirements: 'Legacy reqs',
          technologyNames: ['Java'],
          location: 'Hue',
          workplaceType: 'ONSITE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: new Date(futureDeadline),
          status: 'DRAFT',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // 5. Owner lists all company jobs
      const ownerListRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const items = ownerListRes.body.data;
      expect(items.length).toBeGreaterThanOrEqual(4);

      // Check all items have both keys present as string | null
      for (const item of items) {
        expect(item).toHaveProperty('creatorName');
        expect(item).toHaveProperty('creatorEmail');
        expect(typeof item.creatorName === 'string' || item.creatorName === null).toBe(true);
        expect(typeof item.creatorEmail === 'string' || item.creatorEmail === null).toBe(true);
      }

      // Check Job 1 (full profile)
      const foundJob1 = items.find((j: { id: string }) => j.id === job1Res.body.data.id);
      expect(foundJob1).toBeDefined();
      expect(foundJob1.creatorId).toBe(ownerUserId);
      expect(foundJob1.creatorName).toBe('Pham Van Owner');
      expect(foundJob1.creatorEmail).toBe('owner-p18@itziec.com');

      // Check Job 2 (single name part)
      const foundJob2 = items.find((j: { id: string }) => j.id === job2Res.body.data.id);
      expect(foundJob2).toBeDefined();
      expect(foundJob2.creatorId).toBe(recUserId);
      expect(foundJob2.creatorName).toBe('Minh');
      expect(foundJob2.creatorEmail).toBe('rec-single-p18@itziec.com');

      // Check Job 3 (no name in profile)
      const foundJob3 = items.find((j: { id: string }) => j.id === job3Res.body.data.id);
      expect(foundJob3).toBeDefined();
      expect(foundJob3.creatorId).toBe(noNameRecUserId);
      expect(foundJob3.creatorName).toBeNull();
      expect(foundJob3.creatorEmail).toBe('rec-noname-p18@itziec.com');

      // Check Job 4 (legacy job with null creatorId)
      const foundLegacy = items.find((j: { id: string }) => j.id === legacyJob.id);
      expect(foundLegacy).toBeDefined();
      expect(foundLegacy.creatorId).toBeNull();
      expect(foundLegacy.creatorName).toBeNull();
      expect(foundLegacy.creatorEmail).toBeNull();

      // 6. Recruiter isolation (BE-11-002 regression)
      const recListRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${recToken}`)
        .expect(200);

      expect(recListRes.body.data.length).toBe(1);
      expect(recListRes.body.data[0].id).toBe(job2Res.body.data.id);
      expect(recListRes.body.data[0].creatorName).toBe('Minh');
      expect(recListRes.body.data[0].creatorEmail).toBe('rec-single-p18@itziec.com');

      // 7. Global Admin sees all with accurate identities
      const adminListRes = await request(app.getHttpServer())
        .get(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const adminItems = adminListRes.body.data;
      const adminJob1 = adminItems.find((j: { id: string }) => j.id === job1Res.body.data.id);
      expect(adminJob1.creatorName).toBe('Pham Van Owner');
      expect(adminJob1.creatorEmail).toBe('owner-p18@itziec.com');
    });

    it('isolates PII: public job list and detail return creatorName: null and creatorEmail: null', async () => {
      // Create and publish a job by Owner
      const pubDraftRes = await request(app.getHttpServer())
        .post(`/api/v1/companies/${p18CompanyId}/jobs`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          title: 'Publicly Accessible Published Job',
          description: 'Public job description',
          requirements: 'Public requirements',
          technologyNames: ['NestJS'],
          location: 'HCM',
          workplaceType: 'REMOTE',
          experienceLevel: 'LEAD',
          employmentType: 'FULL_TIME',
          currency: 'VND',
          applicationDeadline: futureDeadline,
        })
        .expect(201);

      const pubJobId = pubDraftRes.body.data.id;
      const pubSlug = pubDraftRes.body.data.slug;

      await request(app.getHttpServer())
        .post(`/api/v1/jobs/${pubJobId}/publish`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ expectedVersion: 1 })
        .expect(200);

      // 1. Guest reads public detail
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${pubSlug}`)
        .expect(200);

      expect(detailRes.body.data.creatorName).toBeNull();
      expect(detailRes.body.data.creatorEmail).toBeNull();

      // 2. Candidate searches public jobs
      const searchRes = await request(app.getHttpServer()).get('/api/v1/jobs').expect(200);

      const foundInSearch = searchRes.body.data.find((j: { id: string }) => j.id === pubJobId);
      expect(foundInSearch).toBeDefined();
      expect(foundInSearch.creatorName).toBeNull();
      expect(foundInSearch.creatorEmail).toBeNull();
    });
  });
});
