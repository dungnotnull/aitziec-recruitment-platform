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
import { ApplicationStatus } from '@prisma/client';
import { NotificationsService } from '../../src/notifications/notifications.service';

describe('Phase 5: CVs, Interviews, and Notifications (E2E)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let hrToken = '';
  let candidateToken = '';
  let companyId = '';
  let jobId = '';
  let applicationId = '';
  let cvId = '';
  let interviewId = '';

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
      email: 'hr-phase5@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // 2. Create Company
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Phase 5 Tech Corp',
        slug: 'phase-5-tech-corp',
        description: 'Tech company for phase 5 tests',
      });
    companyId = compRes.body.data.id;

    // 3. Create Draft Job and Publish it
    const jobRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Senior Cloud Engineer',
        description: 'Design and deploy scalable cloud systems',
        requirements: 'Kubernetes, AWS, TypeScript',
        technologyNames: ['AWS', 'Kubernetes'],
        location: 'Remote',
        workplaceType: 'REMOTE',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        currency: 'VND',
        applicationDeadline: new Date(Date.now() + 86400000 * 30).toISOString(),
      });
    jobId = jobRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 1 });

    // 4. Register Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-phase5@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;

    // Initialize candidate profile
    await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        expectedVersion: 1,
        fullName: 'Phase 5 Candidate',
        headline: 'Senior Cloud Engineer',
      });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('CV Upload and Lifecycle', () => {
    it('POST /api/v1/cvs — should upload valid PDF with %PDF magic bytes', async () => {
      const validPdfBuffer = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Title (Candidate Resume) >>\nendobj\n%%EOF',
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/cvs')
        .set('Authorization', `Bearer ${candidateToken}`)
        .attach('file', validPdfBuffer, 'resume.pdf');

      expect(res.status).toBe(202);
      expect(res.body.data.cv).toBeDefined();
      expect(res.body.data.cv.originalFileName).toBe('resume.pdf');
      expect(['READY', 'UPLOADED']).toContain(res.body.data.cv.processingStatus);
      expect(res.body.data.operation).toBeDefined();

      cvId = res.body.data.cv.id;
    });

    it('GET /api/v1/cvs — candidate should list uploaded CVs', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cvs')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].id).toBe(cvId);
    });

    it('POST /api/v1/cvs/:cvId/download-url — should return presigned download URL', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cvs/${cvId}/download-url`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.url).toBeDefined();
      expect(res.body.data.expiresAt).toBeDefined();
    });

    it('POST /api/v1/cvs/:cvId/default — should set CV as default', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/cvs/${cvId}/default`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({ expectedVersion: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.isDefault).toBe(true);
    });
  });

  describe('Application Submission and Interview Scheduling', () => {
    it('POST /api/v1/jobs/:jobId/applications — candidate submits application using uploaded CV', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/jobs/${jobId}/applications`)
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          cvId: cvId,
          candidateNote: 'Excited about this opportunity!',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe(ApplicationStatus.APPLIED);
      applicationId = res.body.data.id;
    });

    it('POST /api/v1/applications/:applicationId/transitions — HR transitions to INTERVIEWING', async () => {
      // APPLIED -> REVIEWING
      await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          targetStatus: ApplicationStatus.REVIEWING,
          expectedVersion: 1,
        });

      // REVIEWING -> INTERVIEWING
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/transitions`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          targetStatus: ApplicationStatus.INTERVIEWING,
          expectedVersion: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(ApplicationStatus.INTERVIEWING);
    });

    it('POST /api/v1/applications/:applicationId/interviews — HR schedules interview', async () => {
      const startsAt = new Date(Date.now() + 86400000).toISOString();
      const endsAt = new Date(Date.now() + 90000000).toISOString();

      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationId}/interviews`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          startsAt,
          endsAt,
          locationOrMeetingUrl: 'https://meet.google.com/phase5-interview',
          candidateInstructions: 'Please prepare live coding setup',
          recruiterPrivateNotes: 'Candidate has strong background in Node.js',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('SCHEDULED');
      expect(res.body.data.recruiterPrivateNotes).toBe(
        'Candidate has strong background in Node.js',
      );
      interviewId = res.body.data.id;
    });

    it('GET /api/v1/applications/:applicationId/interviews — candidate role omits private notes', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}/interviews`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].recruiterPrivateNotes).toBeUndefined();
      expect(res.body.data[0].candidateInstructions).toBe('Please prepare live coding setup');
    });

    it('PATCH /api/v1/interviews/:interviewId — HR updates interview instructions', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/interviews/${interviewId}`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 1,
          candidateInstructions: 'Updated instructions: live coding in TypeScript',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.version).toBe(2);
      expect(res.body.data.candidateInstructions).toBe(
        'Updated instructions: live coding in TypeScript',
      );
    });

    it('POST /api/v1/interviews/:interviewId/complete — HR marks interview completed without changing application status', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/interviews/${interviewId}/complete`)
        .set('Authorization', `Bearer ${hrToken}`)
        .send({
          expectedVersion: 2,
          recruiterFeedback: 'Excellent performance in architecture round',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('COMPLETED');
      expect(res.body.data.recruiterFeedback).toBe('Excellent performance in architecture round');

      // Application status remains INTERVIEWING
      const appRes = await request(app.getHttpServer())
        .get(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${hrToken}`);

      expect(appRes.body.data.status).toBe(ApplicationStatus.INTERVIEWING);
    });
  });

  describe('Notifications and Read State', () => {
    it('GET /api/v1/notifications — candidate views in-app notifications', async () => {
      // First create a notification to test API contract
      const notificationService = app.get(NotificationsService);
      await notificationService.createNotification({
        userId: inMemoryPrisma.users.find((u) => u.email === 'candidate-phase5@itziec.com').id,
        type: 'APPLICATION_SUBMITTED',
        title: 'Application Received',
        body: 'Your application has been received.',
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.meta.unreadCount).toBeGreaterThanOrEqual(1);

      const notifId = res.body.data[0].id;

      // Mark as read
      const readRes = await request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.readAt).not.toBeNull();
    });
  });

  describe('CV Retention Policy (BEI-002)', () => {
    it('DELETE /api/v1/cvs/:cvId — should soft-delete to DELETED because CV was used in application', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/cvs/${cvId}`)
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(res.status).toBe(204);

      // Verify CV record is retained with DELETED status
      const cvInDb = inMemoryPrisma.cvs.find((c: any) => c.id === cvId);
      expect(cvInDb).toBeDefined();
      expect(cvInDb.processingStatus).toBe('DELETED');
      expect(cvInDb.isDefault).toBe(false);
    });
  });
});
