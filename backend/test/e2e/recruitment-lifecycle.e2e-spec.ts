import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { InMemoryPrismaService } from './in-memory-prisma';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ContractValidationPipe } from '../../src/common/pipes/contract-validation.pipe';
import { ResponseTransformInterceptor } from '../../src/common/interceptors/response-transform.interceptor';

describe('BE-7-021: Critical End-to-End Recruitment Suite (E2E)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let adminToken = '';
  let hrToken = '';
  let candidateToken = '';
  let companyId = '';
  let jobId = '';
  let cvId = '';
  let applicationId = '';
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
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ContractValidationPipe());
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseTransformInterceptor());

    await app.init();

    // 1. Seed Admin user directly in DB and generate token
    const adminUser = await inMemoryPrisma.user.create({
      data: {
        email: 'admin-master@itziec.com',
        passwordHash: 'argon2id_mock_hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const jwtService = moduleFixture.get(JwtService);
    adminToken = jwtService.sign({
      sub: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
    });

    // 2. Register HR
    const hrRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-master@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // 3. Register Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-master@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('executes full recruitment flow: Profile -> Job -> CV -> Apply -> Review -> Interview -> Outcome -> Admin Moderation', async () => {
    // Step 1: Update Candidate Profile
    const profileRes = await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        expectedVersion: 1,
        fullName: 'Nguyen Van A',
        headline: 'Lead Software Engineer',
        location: 'Ho Chi Minh',
        bio: '10 years building distributed high-concurrency systems',
      });
    expect(profileRes.status).toBe(200);

    // Step 2: Create Company by HR
    const compRes = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        name: 'Vanguard Systems Vietnam',
        slug: 'vanguard-systems',
        description: 'Elite software consultancy',
      });
    expect(compRes.status).toBe(201);
    companyId = compRes.body.data.id;

    // Step 3: Create Draft Job and Publish
    const jobRes = await request(app.getHttpServer())
      .post(`/api/v1/companies/${companyId}/jobs`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        title: 'Principal Backend Architect',
        description: 'Lead engineering teams and design high-scale event architectures',
        requirements: 'Requires 8+ years experience, NestJS, Kafka, and PostgreSQL',
        technologyNames: ['NestJS', 'PostgreSQL', 'Kafka', 'Docker'],
        location: 'Ho Chi Minh',
        workplaceType: 'HYBRID',
        experienceLevel: 'LEAD',
        employmentType: 'FULL_TIME',
        salaryMin: 50000000,
        salaryMax: 90000000,
        currency: 'VND',
        applicationDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      });
    expect(jobRes.status).toBe(201);
    jobId = jobRes.body.data.id;

    const pubRes = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/publish`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({ expectedVersion: 1 });
    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe('PUBLISHED');

    // Step 4: Candidate uploads CV
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\nNguyen Van A Resume: 10 years experience with NestJS, PostgreSQL, Kafka.',
    );
    const cvRes = await request(app.getHttpServer())
      .post('/api/v1/cvs')
      .set('Authorization', `Bearer ${candidateToken}`)
      .attach('file', pdfBuffer, 'resume.pdf');
    expect(cvRes.status).toBe(202);
    cvId = cvRes.body.data.cv.id;
    const cv1Record = inMemoryPrisma.cvs.find((c) => c.id === cvId);
    if (cv1Record) {
      cv1Record.processingStatus = 'READY';
    }

    // Step 5: Candidate submits application
    const appRes = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${candidateToken}`)
      .set('Idempotency-Key', 'master-recruitment-app-001')
      .send({
        cvId,
        candidateNote: 'Excited to contribute to high-scale architecture.',
      });
    expect(appRes.status).toBe(201);
    expect(appRes.body.data.status).toBe('APPLIED');
    applicationId = appRes.body.data.id;

    // Step 6: HR views applicant list and transitions: APPLIED -> REVIEWING
    const trans1Res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationId}/transitions`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 1,
        targetStatus: 'REVIEWING',
        reason: 'Profile matches requirements well',
      });
    expect(trans1Res.status).toBe(200);
    expect(trans1Res.body.data.status).toBe('REVIEWING');

    // Step 7: HR transitions: REVIEWING -> INTERVIEWING
    const trans2Res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationId}/transitions`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 2,
        targetStatus: 'INTERVIEWING',
        reason: 'Inviting to technical interview round',
      });
    expect(trans2Res.status).toBe(200);
    expect(trans2Res.body.data.status).toBe('INTERVIEWING');

    // Step 8: HR schedules interview
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();
    const interviewRes = await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationId}/interviews`)
      .set('Authorization', `Bearer ${hrToken}`)
      .set('Idempotency-Key', 'master-interview-001')
      .send({
        startsAt,
        endsAt,
        locationOrMeetingUrl: 'https://meet.google.com/xyz-abc-def',
        candidateInstructions: 'Please prepare a 15-minute system design presentation',
        recruiterPrivateNotes: 'Candidate asked for 70m gross.',
      });
    expect(interviewRes.status).toBe(201);
    interviewId = interviewRes.body.data.id;

    // Step 9: Candidate views interview (private notes must be redacted)
    const candInterviewRes = await request(app.getHttpServer())
      .get(`/api/v1/applications/${applicationId}/interviews`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(candInterviewRes.status).toBe(200);
    expect(candInterviewRes.body.data[0].recruiterPrivateNotes).toBeUndefined();

    // Step 10: HR completes interview
    const completeRes = await request(app.getHttpServer())
      .post(`/api/v1/interviews/${interviewId}/complete`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 1,
        recruiterFeedback: 'Outstanding architectural depth. Strong hire.',
      });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.data.status).toBe('COMPLETED');

    // Step 11: HR transitions: INTERVIEWING -> PASSED
    const trans3Res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationId}/transitions`)
      .set('Authorization', `Bearer ${hrToken}`)
      .send({
        expectedVersion: 3,
        targetStatus: 'PASSED',
        reason: 'Offer accepted',
      });
    expect(trans3Res.status).toBe(200);
    expect(trans3Res.body.data.status).toBe('PASSED');

    // Step 12: Admin lists users
    const adminUsersRes = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminUsersRes.status).toBe(200);
    expect(adminUsersRes.body.data.length).toBeGreaterThan(0);

    // Step 13: Admin moderates company
    const adminCompRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/companies/${companyId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ACTIVE',
        reason: 'Verified company authenticity',
        expectedVersion: 1,
      });
    expect(adminCompRes.status).toBe(200);

    // Step 14: Admin queries append-only audit logs
    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThan(0);

    // Step 15: Denial variant: Candidate cannot access Admin endpoints
    const forbiddenRes = await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(forbiddenRes.status).toBe(403);

    // Step 16 (BE-8-013): Admin lists companies
    const adminCompaniesRes = await request(app.getHttpServer())
      .get('/api/v1/admin/companies?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminCompaniesRes.status).toBe(200);
    expect(Array.isArray(adminCompaniesRes.body.data)).toBe(true);
    expect(adminCompaniesRes.body.data.length).toBeGreaterThan(0);
    expect(adminCompaniesRes.body.data[0].version).toBeDefined();
    expect(adminCompaniesRes.body.data[0].status).toBe('ACTIVE');

    // Step 17 (BE-8-013): Admin lists jobs across companies
    const adminJobsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/jobs?status=PUBLISHED')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminJobsRes.status).toBe(200);
    expect(Array.isArray(adminJobsRes.body.data)).toBe(true);
    expect(adminJobsRes.body.data.length).toBeGreaterThan(0);
    expect(adminJobsRes.body.data[0].version).toBeDefined();
    expect(adminJobsRes.body.data[0].company).toBeDefined();

    // Step 18 (BE-8-013): Non-admin callers denied (HR: 403, Guest: 401)
    await request(app.getHttpServer())
      .get('/api/v1/admin/companies')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/jobs')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(403);

    await request(app.getHttpServer()).get('/api/v1/admin/companies').expect(401);

    // Step 19 (BE-8-013): Invalid filter values return 400 VALIDATION_ERROR
    await request(app.getHttpServer())
      .get('/api/v1/admin/companies?status=INVALID_STATUS')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .get('/api/v1/admin/jobs?experienceLevel=SUPER_SENIOR')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    // Step 20 (BE-8-014): Admin lists applications with safe redaction
    const adminAppsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/applications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAppsRes.status).toBe(200);
    expect(Array.isArray(adminAppsRes.body.data)).toBe(true);
    expect(adminAppsRes.body.data.length).toBeGreaterThan(0);
    const firstApp = adminAppsRes.body.data[0];
    expect(firstApp.id).toBeDefined();
    expect(firstApp.version).toBeDefined();
    expect(firstApp.candidate).toBeDefined();
    expect(firstApp.job).toBeDefined();
    expect(firstApp.company).toBeDefined();
    // Verify globally banned fields are absent
    expect(firstApp.rawCv).toBeUndefined();
    expect(firstApp.extractedText).toBeUndefined();
    expect(firstApp.storageKey).toBeUndefined();
    expect(firstApp.candidateNote).toBeUndefined();
    expect(firstApp.candidate.phone).toBeUndefined();
    expect(firstApp.candidate.email).toBeUndefined();

    // Step 21 (BE-8-014): Admin gets application detail with ordered history
    const adminAppDetailRes = await request(app.getHttpServer())
      .get(`/api/v1/admin/applications/${applicationId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAppDetailRes.status).toBe(200);
    expect(adminAppDetailRes.body.data.id).toBe(applicationId);
    expect(Array.isArray(adminAppDetailRes.body.data.history)).toBe(true);
    expect(adminAppDetailRes.body.data.history.length).toBeGreaterThan(0);
    expect(adminAppDetailRes.body.data.candidateNote).toBeUndefined();

    // Step 22 (BE-8-014): Non-admin callers denied
    await request(app.getHttpServer())
      .get('/api/v1/admin/applications')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/applications')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(403);

    await request(app.getHttpServer()).get('/api/v1/admin/applications').expect(401);

    // Step 23 (BE-8-015): Seed a fresh application for moderation tests
    const cand2Res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'cand-mod-e2e@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    const cand2Token = cand2Res.body.data.accessToken;

    await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${cand2Token}`)
      .send({
        expectedVersion: 1,
        fullName: 'Candidate Mod E2E',
        headline: 'Frontend Engineer',
      });

    // BE-10-001: Deny candidate 2 from submitting another candidate's cvId (404 RESOURCE_NOT_FOUND, no existence leakage)
    const crossOwnerAppRes = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${cand2Token}`)
      .send({
        cvId, // Candidate 1's CV
        candidateNote: 'Attempting to reuse candidate 1 CV',
      });
    expect(crossOwnerAppRes.status).toBe(404);
    expect(crossOwnerAppRes.body.error.code).toBe('RESOURCE_NOT_FOUND');

    // Candidate 2 uploads their own CV
    const cand2CvRes = await request(app.getHttpServer())
      .post('/api/v1/cvs')
      .set('Authorization', `Bearer ${cand2Token}`)
      .attach('file', pdfBuffer, 'resume-cand2.pdf');
    expect(cand2CvRes.status).toBe(202);
    const cand2CvId = cand2CvRes.body.data.cv.id;

    const cand2CvRecord = inMemoryPrisma.cvs.find((c) => c.id === cand2CvId);
    if (cand2CvRecord) {
      cand2CvRecord.processingStatus = 'READY';
    }

    const cand2AppRes = await request(app.getHttpServer())
      .post(`/api/v1/jobs/${jobId}/applications`)
      .set('Authorization', `Bearer ${cand2Token}`)
      .send({
        cvId: cand2CvId,
        candidateNote: 'Excited for moderation',
      });
    expect(cand2AppRes.status).toBe(201);
    const modAppId = cand2AppRes.body.data.id;
    expect(cand2AppRes.body.data.status).toBe('APPLIED');
    expect(cand2AppRes.body.data.version).toBe(1);

    // Step 24 (BE-8-015): Stale version returns 409 VERSION_CONFLICT
    const staleRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${modAppId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetStatus: 'REVIEWING',
        reason: 'Stale attempt',
        expectedVersion: 99,
      });
    expect(staleRes.status).toBe(409);
    expect(staleRes.body.error.code).toBe('VERSION_CONFLICT');

    // Step 25 (BE-8-015): Invalid transition returns 409 INVALID_APPLICATION_TRANSITION
    const invalidTransRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${modAppId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetStatus: 'PASSED',
        reason: 'Direct pass from APPLIED is invalid',
        expectedVersion: 1,
      });
    expect(invalidTransRes.status).toBe(409);
    expect(invalidTransRes.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');

    // Step 26 (BE-8-015): Valid admin moderation succeeds
    const modSuccessRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/applications/${modAppId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        targetStatus: 'REVIEWING',
        reason: 'Admin approved application for next stage',
        expectedVersion: 1,
      });
    expect(modSuccessRes.status).toBe(200);
    expect(modSuccessRes.body.data.status).toBe('REVIEWING');
    expect(modSuccessRes.body.data.version).toBe(2);
    expect(modSuccessRes.body.data.candidateNote).toBeUndefined();
    expect(modSuccessRes.body.data.history.length).toBeGreaterThan(0);
    const latestEvent = modSuccessRes.body.data.history[modSuccessRes.body.data.history.length - 1];
    expect(latestEvent.toStatus).toBe('REVIEWING');
  });
});
