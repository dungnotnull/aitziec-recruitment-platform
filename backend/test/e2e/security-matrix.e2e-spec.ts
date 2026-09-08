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

describe('Security & RBAC Matrix E2E (BE-2-021)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let candidateToken = '';
  let hrToken = '';
  let suspendedUserToken = '';

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

    // Register Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'matrix-candidate@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;

    // Register HR
    const hrRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'matrix-hr@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // Register user that will be suspended
    const suspRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'suspended-user@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    suspendedUserToken = suspRes.body.data.accessToken;
    const suspendedUserId = suspRes.body.data.user.id;

    // Suspend the user in DB
    const userInDb = inMemoryPrisma.users.find((u) => u.id === suspendedUserId);
    userInDb.status = 'SUSPENDED';
  });

  afterAll(async () => {
    await app.close();
  });

  it('unauthenticated requests to protected endpoints return 401 AUTHENTICATION_REQUIRED', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/candidates/me').expect(401);

    expect(res.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_REQUIRED);
  });

  it('candidates attempting HR-only endpoints return 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/companies')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        name: 'Unauthorized Company',
      })
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('HR attempting candidate-only endpoints return 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('suspended user requests are blocked with 403 ACCOUNT_SUSPENDED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${suspendedUserToken}`)
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
  });

  it('suspended user login is blocked with 403 ACCOUNT_SUSPENDED', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'suspended-user@itziec.com',
        password: 'Password123!@#',
      })
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.ACCOUNT_SUSPENDED);
  });
});
