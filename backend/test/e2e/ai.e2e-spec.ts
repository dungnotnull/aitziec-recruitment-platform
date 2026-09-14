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
import { ERROR_CODES } from '../../src/common/constants/error-codes';
import { CvJobAnalysisProcessor } from '../../src/ai/workers/cv-job-analysis.processor';

describe('Phase 6: AI Recruitment Capabilities (E2E)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let hrToken = '';
  let candidateToken = '';
  let otherCandidateToken = '';
  let companyId = '';
  let jobId = '';
  let readyCvId = '';
  let notReadyCvId = '';
  let operationId = '';
  let analysisId = '';

  beforeAll(async () => {
    inMemoryPrisma = new InMemoryPrismaService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(inMemoryPrisma)
      .overrideProvider(RedisService)
      .useValue({
        getClient: () => null,
        isHealthy: async () => true,
        onModuleDestroy: jest.fn(),
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
      email: 'hr-ai-test@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // 2. Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'AI Intelligence Corp',
        slug: 'ai-corp',
        description: 'Pioneering recruitment AI',
      });
    companyId = compRes.body.data.id;

    // 3. Create & Publish Job
    const jobRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Senior NestJS & TypeScript Engineer',
        description: 'Building world class scalable microservices',
        requirements: 'Requires NestJS, TypeScript, PostgreSQL, and Docker experience',
        technologyNames: ['NestJS', 'TypeScript', 'PostgreSQL', 'Docker'],
        location: 'Ho Chi Minh',
        workplaceType: 'REMOTE',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        salaryMin: 35000000,
        salaryMax: 60000000,
        currency: 'VND',
        applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
    jobId = jobRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 1 });

    // 4. Register Candidate 1
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-ai-test@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;

    // 5. Register Candidate 2 (for authorization matrix test)
    const otherRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-other@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    otherCandidateToken = otherRes.body.data.accessToken;

    // 6. Upload CV for Candidate 1
    const mockPdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Title (Resume) >>\nendobj\nSenior Engineer with 5 years experience in NestJS, TypeScript, PostgreSQL, Docker.',
    );

    const cvUploadRes = await request(app.getHttpServer())
      .post('/api/v1/cvs')
      .set('Authorization', `Bearer ${candidateToken}`)
      .attach('file', mockPdfBuffer, 'resume.pdf');

    expect(cvUploadRes.status).toBe(202);
    readyCvId = cvUploadRes.body.data.cv.id;

    // With asynchronous extraction, mark the uploaded test CV as READY with extractedText for AI analysis tests
    await inMemoryPrisma.cv.update({
      where: { id: readyCvId },
      data: {
        processingStatus: 'READY',
        extractedText:
          'Senior Engineer with 5 years experience in NestJS, TypeScript, PostgreSQL, Docker.',
      },
    });

    // 7. Create a Not-Ready CV in inMemoryPrisma to test 409 CV_NOT_READY
    const candProfile = inMemoryPrisma.candidateProfiles.find(
      (cp) => cp.userId === candRes.body.data.user.id,
    );
    const notReadyCv = await inMemoryPrisma.cv.create({
      data: {
        candidateProfileId: candProfile.id,
        originalFileName: 'processing.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        checksumSha256: 'abc123notready',
        storageKey: 'cvs/test/notready.pdf',
        processingStatus: 'UPLOADED',
      },
    });
    notReadyCvId = notReadyCv.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('BE-6-008 & BE-6-011: POST /ai/cv-job-analyses', () => {
    it('returns 409 CV_NOT_READY if CV extraction is not yet complete', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/cv-job-analyses')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          cvId: notReadyCvId,
          jobId,
          analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CV_NOT_READY');
    });

    it('successfully accepts valid CV analysis request with 202 and Operation representation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/cv-job-analyses')
        .set('Authorization', `Bearer ${candidateToken}`)
        .set('Idempotency-Key', 'ai-eval-key-001-abc')
        .send({
          cvId: readyCvId,
          jobId,
          analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
        });

      expect(res.status).toBe(202);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.type).toBe('CV_JOB_ANALYSIS');
      expect(res.body.data.status).toBe('QUEUED');
      expect(res.body.data.progressPercent).toBe(0);

      operationId = res.body.data.id;

      // Asynchronous BullMQ worker processes the job (BE-10-010)
      const processor = app.get(CvJobAnalysisProcessor);
      await processor.processJob({
        id: `ai-analysis:${operationId}`,
        data: {
          operationId,
          cvId: readyCvId,
          jobId,
          analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
        },
      } as any);

      const opRecord = await inMemoryPrisma.operation.findUnique({
        where: { id: operationId },
      });
      expect(opRecord?.status).toBe('SUCCEEDED');
      analysisId = opRecord?.resultResourceId ?? '';
    });

    it('handles idempotency key replay safely', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/ai/cv-job-analyses')
        .set('Authorization', `Bearer ${candidateToken}`)
        .set('Idempotency-Key', 'ai-eval-key-001-abc')
        .send({
          cvId: readyCvId,
          jobId,
          analyses: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
        });

      expect(res.status).toBe(202);
      expect(res.body.data.id).toBe(operationId);
    });
  });

  describe('BE-6-011: GET /operations/:operationId', () => {
    it('returns operation status for the owner', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/operations/${operationId}`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(operationId);
      expect(res.body.data.status).toBe('SUCCEEDED');
      expect(res.body.data.progressPercent).toBe(100);
      expect(res.body.data.resultResource.id).toBe(analysisId);
    });

    it('denies access to an unrelated user with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/operations/${operationId}`)
        .set('Authorization', `Bearer ${otherCandidateToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('BE-6-010 & BE-6-011: GET /ai/analyses/:analysisId', () => {
    it('returns comprehensive AI analysis with score bounds, components, and suggestions', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/ai/analyses/${analysisId}`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      const analysis = res.body.data;
      expect(analysis.id).toBe(analysisId);
      expect(analysis.status).toBe('SUCCEEDED');
      expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
      expect(analysis.overallScore).toBeLessThanOrEqual(100);
      expect(analysis.components.length).toBeGreaterThan(0);
      expect(analysis.matchedSkills).toEqual(
        expect.arrayContaining(['NestJS', 'TypeScript', 'PostgreSQL', 'Docker']),
      );
      expect(analysis.model).toBeDefined();
      expect(analysis.promptVersion).toBeDefined();
      expect(analysis.schemaVersion).toBe('v1.0');
    });

    it('permits authorized HR of the company that posted the job to read the analysis', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/ai/analyses/${analysisId}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(analysisId);
    });

    it('denies access to an unauthorized candidate with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/ai/analyses/${analysisId}`)
        .set('Authorization', `Bearer ${otherCandidateToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('BE-6-015, BE-6-016 & BE-6-017: GET /recommendations/jobs', () => {
    it('returns explainable job recommendations for authenticated candidate', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta.page).toBeDefined();
      expect(res.body.data.some((j: any) => j.job?.id === jobId)).toBe(true);

      // Exact-key verification: only job, score, reasonCodes, evidence, limitations
      const firstItem = res.body.data[0];
      expect(Object.keys(firstItem).sort()).toEqual(
        ['evidence', 'job', 'limitations', 'reasonCodes', 'score'].sort(),
      );
      expect(firstItem.id).toBeUndefined();
      expect(firstItem.title).toBeUndefined();
      expect(firstItem.slug).toBeUndefined();
      expect(firstItem.companyId).toBeUndefined();
    });

    it('excludes jobs that candidate has already applied to', async () => {
      // 1. Submit application for jobId
      await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .set('Idempotency-Key', 'app-submit-ai-rec-001')
        .send({ cvId: readyCvId });

      // 2. Fetch recommendations again -> jobId must now be excluded
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.some((j: any) => j.job?.id === jobId)).toBe(false);
    });

    it('rejects non-candidate roles with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(403);
    });

    it('BE-9-001 & BE-9-004: accepts ?limit=20 and returns 200 with meta.page', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs?limit=20')
        .set('Authorization', `Bearer ${otherCandidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.meta.page.limit).toBe(20);
      expect(res.body.meta.requestId).toBeDefined();
    });

    it('BE-9-001 & BE-9-004: rejects ?limit=0 and ?limit=51 with 400 VALIDATION_ERROR', async () => {
      const resMin = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs?limit=0')
        .set('Authorization', `Bearer ${otherCandidateToken}`);
      expect(resMin.status).toBe(400);
      expect(resMin.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

      const resMax = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs?limit=51')
        .set('Authorization', `Bearer ${otherCandidateToken}`);
      expect(resMax.status).toBe(400);
      expect(resMax.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('BE-9-001 & BE-9-004: rejects malformed cursor with 400 INVALID_CURSOR', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs?cursor=invalid-cursor-payload')
        .set('Authorization', `Bearer ${otherCandidateToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CURSOR);
    });
  });

  describe('BE-8-021: GET & PATCH /recommendation-preferences', () => {
    it('GET returns default recommendation preferences for candidate', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendation-preferences')
        .set('Authorization', `Bearer ${otherCandidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.consentPolicyVersion).toBe('v1.0');
      expect(res.body.data.version).toBe(1);
    });

    it('PATCH updates preference and causes recommendation opt-out', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/recommendation-preferences')
        .set('Authorization', `Bearer ${otherCandidateToken}`)
        .send({
          enabled: false,
          expectedVersion: 1,
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.data.enabled).toBe(false);
      expect(patchRes.body.data.version).toBe(2);

      // Now query recommendations -> should return empty with optedOut flag
      const recRes = await request(app.getHttpServer())
        .get('/api/v1/recommendations/jobs')
        .set('Authorization', `Bearer ${otherCandidateToken}`);

      expect(recRes.status).toBe(200);
      expect(recRes.body.data).toHaveLength(0);
      expect(recRes.body.meta.optedOut).toBe(true);
    });

    it('PATCH rejects version conflict with 409', async () => {
      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/recommendation-preferences')
        .set('Authorization', `Bearer ${otherCandidateToken}`)
        .send({
          enabled: true,
          expectedVersion: 1, // now version is 2
        });

      expect(patchRes.status).toBe(409);
      expect(patchRes.body.error.code).toBe('VERSION_CONFLICT');
    });

    it('rejects non-candidate role with 403 Forbidden', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/recommendation-preferences')
        .set('Authorization', `Bearer ${hrToken}`);

      expect(res.status).toBe(403);
    });
  });
});
