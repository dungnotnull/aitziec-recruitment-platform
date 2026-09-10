import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { InMemoryPrismaService } from './in-memory-prisma';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ContractValidationPipe } from '../../src/common/pipes/contract-validation.pipe';
import { ResponseTransformInterceptor } from '../../src/common/interceptors/response-transform.interceptor';
import { ApplicationStatus } from '../../src/applications/dto/application.dto';

describe('Applications (E2E)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let hrToken = '';
  let outsiderHrToken = '';
  let candidateTokenA = '';
  let candidateTokenB = '';
  let publishedJobId = '';
  let draftJobId = '';
  let closedJobId = '';
  let applicationId = '';

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

    // 1. Register Company HR
    const hrRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-apps@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // 2. Register Outsider HR
    const outsiderRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'outsider-hr-apps@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    outsiderHrToken = outsiderRes.body.data.accessToken;

    // 3. Register Candidate A
    const candResA = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'cand-a-apps@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateTokenA = candResA.body.data.accessToken;

    // Candidate A profile
    await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateTokenA}`)
      .send({
        expectedVersion: 1,
        fullName: 'Nguyen Candidate A',
        headline: 'Senior Fullstack Engineer',
      });

    // 4. Register Candidate B
    const candResB = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'cand-b-apps@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateTokenB = candResB.body.data.accessToken;

    // Candidate B profile
    await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateTokenB}`)
      .send({
        expectedVersion: 1,
        fullName: 'Tran Candidate B',
        headline: 'Frontend Engineer',
      });

    // 5. Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Applications Test Corp',
        slug: 'apps-corp-2026',
        description: 'Company for applications tests',
      });
    const companyId = compRes.body.data.id;

    // 6. Create Published Job
    const deadlineFuture = new Date(Date.now() + 7 * 86400000).toISOString();
    const pubJobRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Senior Backend Engineer',
        description: 'Building microservices in NestJS and Postgres',
        requirements: '3+ years TypeScript and NestJS experience',
        technologyNames: ['NestJS', 'PostgreSQL', 'Docker'],
        location: 'Ho Chi Minh City',
        workplaceType: 'HYBRID',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        salaryMin: 35000000,
        salaryMax: 60000000,
        currency: 'VND',
        applicationDeadline: deadlineFuture,
      });
    publishedJobId = pubJobRes.body.data.id;

    // Publish it
    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${publishedJobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 1 });

    // 7. Create Draft Job
    const draftJobRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Draft Designer Job',
        description: 'Draft job not yet published',
        requirements: 'Figma expertise',
        technologyNames: ['Figma'],
        location: 'Remote',
        workplaceType: 'REMOTE',
        experienceLevel: 'MID',
        employmentType: 'FULL_TIME',
        currency: 'VND',
        applicationDeadline: deadlineFuture,
      });
    draftJobId = draftJobRes.body.data.id;

    // 8. Create Closed Job
    const closedJobRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Closed DevOps Job',
        description: 'DevOps job to be closed immediately',
        requirements: 'Kubernetes',
        technologyNames: ['Kubernetes'],
        location: 'Hanoi',
        workplaceType: 'ONSITE',
        experienceLevel: 'LEAD',
        employmentType: 'FULL_TIME',
        currency: 'VND',
        applicationDeadline: deadlineFuture,
      });
    closedJobId = closedJobRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${closedJobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 1 });

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${closedJobId}/close`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 2, reason: 'Position filled internally' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('BE-4-004 Application Eligibility Checks', () => {
    it('returns 404 when applying to a draft job', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${draftJobId}/applications`)
        .set('Authorization', `Bearer ${candidateTokenA}`)
        .send({
          cvId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('returns 409 JOB_NOT_OPEN when applying to a closed job', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${closedJobId}/applications`)
        .set('Authorization', `Bearer ${candidateTokenA}`)
        .send({
          cvId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('JOB_NOT_OPEN');
    });
  });

  describe('BE-4-005 Idempotent Application Submission & Constraints', () => {
    it('successfully submits an application for a published job', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${publishedJobId}/applications`)
        .set('Authorization', `Bearer ${candidateTokenA}`)
        .set('Idempotency-Key', 'idemp-key-sub-001')
        .send({
          cvId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
          candidateNote: 'Excited about this opportunity!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe(ApplicationStatus.APPLIED);
      expect(res.body.data.version).toBe(1);
      expect(res.body.data.candidateNote).toBe('Excited about this opportunity!');

      applicationId = res.body.data.id;
    });

    it('BE-4-002 & BE-4-006 rejects duplicate application from same candidate for same job', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${publishedJobId}/applications`)
        .set('Authorization', `Bearer ${candidateTokenA}`)
        .send({
          cvId: 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d',
          candidateNote: 'Trying again',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('APPLICATION_ALREADY_EXISTS');
    });
  });

  describe('BE-4-010 & BE-4-011 Candidate Application Views', () => {
    it('candidate A lists own applications with cursor pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${candidateTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(applicationId);
      expect(res.body.data[0].status).toBe(ApplicationStatus.APPLIED);
      expect(res.body.meta.page).toBeDefined();
    });

    it('candidate A reads application detail with ordered history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${candidateTokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(applicationId);
      expect(res.body.data.job.title).toBe('Senior Backend Engineer');
      expect(res.body.data.history.length).toBe(1);
      expect(res.body.data.history[0].toStatus).toBe(ApplicationStatus.APPLIED);
    });

    it('candidate B is denied access to candidate A application', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${candidateTokenB}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('BE-4-012 & BE-4-013 Recruiter Scoped Application Views', () => {
    it('outsider HR is forbidden from reading applications of another company', async () => {
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${publishedJobId}/applications`)
        .set('Authorization', `Bearer ${outsiderHrToken}`);

      expect(listRes.status).toBe(403);

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${outsiderHrToken}`);

      expect(detailRes.status).toBe(403);
    });

    it('company HR lists job applications', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${publishedJobId}/applications`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(applicationId);
      expect(res.body.data[0].candidate.fullName).toBe('Nguyen Candidate A');
    });

    it('company HR views detailed application', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(applicationId);
      expect(res.body.data.status).toBe(ApplicationStatus.APPLIED);
    });
  });

  describe('BE-4-007, BE-4-008, BE-4-009 State Machine Transitions & Concurrency', () => {
    it('BE-4-009 rejects conflicting transition when expectedVersion is stale', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 99, // Stale
          targetStatus: ApplicationStatus.REVIEWING,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('BE-4-007 rejects invalid skip transition APPLIED -> PASSED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 1,
          targetStatus: ApplicationStatus.PASSED,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
    });

    it('successfully transitions APPLIED -> REVIEWING (version: 1 -> 2)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 1,
          targetStatus: ApplicationStatus.REVIEWING,
          reason: 'Initial CV screening passed',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ApplicationStatus.REVIEWING);
      expect(res.body.data.version).toBe(2);
      expect(res.body.data.history.length).toBe(2);
      expect(res.body.data.history[1].toStatus).toBe(ApplicationStatus.REVIEWING);
      expect(res.body.data.history[1].reason).toBe('Initial CV screening passed');
    });

    it('successfully transitions REVIEWING -> INTERVIEWING (version: 2 -> 3)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 2,
          targetStatus: ApplicationStatus.INTERVIEWING,
          reason: 'Scheduling technical interview',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ApplicationStatus.INTERVIEWING);
      expect(res.body.data.version).toBe(3);
    });

    it('successfully transitions INTERVIEWING -> PASSED (version: 3 -> 4)', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 3,
          targetStatus: ApplicationStatus.PASSED,
          reason: 'Candidate accepted offer',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ApplicationStatus.PASSED);
      expect(res.body.data.version).toBe(4);
    });

    it('BE-4-016 terminal immutability: PASSED status cannot transition to REJECTED', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 4,
          targetStatus: ApplicationStatus.REJECTED,
          reason: 'Attempting invalid post-terminal change',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
    });

    it('BE-4-016 no DELETE endpoint exists for applications', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(404);
    });
  });
});
