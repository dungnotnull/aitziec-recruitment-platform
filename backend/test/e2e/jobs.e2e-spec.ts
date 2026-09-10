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

describe('Jobs, Search & Saved Jobs E2E (BE-3-001 to BE-3-022)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let hrToken = '';
  let candidateToken = '';
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
    await inMemoryPrisma.user.create({
      data: {
        email: 'admin-jobs@itziec.com',
        passwordHash: 'dummy',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
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
  });
});
