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
  });
});
