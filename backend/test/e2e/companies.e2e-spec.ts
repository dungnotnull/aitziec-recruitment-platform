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
});
