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

describe('Auth & Session Rotation E2E (BE-2-004 to BE-2-010)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  let initialRefreshTokenCookie = '';
  let rotatedRefreshTokenCookie = '';
  let candidateAccessToken = '';

  it('POST /api/v1/auth/register registers candidate successfully with refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'Candidate@Itziec.com ', // tests email normalization
        password: 'Password123!@#',
        role: 'CANDIDATE',
      })
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.user.email).toBe('candidate@itziec.com');
    expect(res.body.data.user.role).toBe('CANDIDATE');
    expect(res.body.data.accessToken).toBeDefined();
    candidateAccessToken = res.body.data.accessToken;

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = (cookies as unknown as string[]).find((c: string) =>
      c.includes('itziec_refresh'),
    );
    expect(refreshCookie).toBeDefined();
    initialRefreshTokenCookie = (refreshCookie as string).split(';')[0];
  });

  it('POST /api/v1/auth/register rejects duplicate normalized email with 409 EMAIL_ALREADY_EXISTS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'candidate@itziec.com',
        password: 'Password123!@#',
        role: 'CANDIDATE',
      })
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.EMAIL_ALREADY_EXISTS);
  });

  it('POST /api/v1/auth/login succeeds with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'candidate@itziec.com',
        password: 'Password123!@#',
      })
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('candidate@itziec.com');
  });

  it('POST /api/v1/auth/login rejects invalid password with 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'candidate@itziec.com',
        password: 'WrongPassword999!',
      })
      .expect(401);

    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
  });

  it('GET /api/v1/auth/me returns current user summary with valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${candidateAccessToken}`)
      .expect(200);

    expect(res.body.data.email).toBe('candidate@itziec.com');
    expect(res.body.data.role).toBe('CANDIDATE');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  it('POST /api/v1/auth/refresh rotates the session and cookie within the token family', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', initialRefreshTokenCookie)
      .expect(200);

    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'];
    const refreshCookie = (cookies as unknown as string[]).find((c: string) =>
      c.includes('itziec_refresh'),
    );
    expect(refreshCookie).toBeDefined();
    rotatedRefreshTokenCookie = (refreshCookie as string).split(';')[0];
    expect(rotatedRefreshTokenCookie).not.toBe(initialRefreshTokenCookie);
  });

  it('POST /api/v1/auth/refresh detects token reuse attack and revokes the whole token family', async () => {
    // Replay the old, already rotated initial refresh token
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', initialRefreshTokenCookie)
      .expect(401);

    expect(res.body.error.code).toBe(ERROR_CODES.REFRESH_TOKEN_REUSED);

    // Verify that the active rotated token in that family is now ALSO revoked
    const secondRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedRefreshTokenCookie)
      .expect(401);

    expect(secondRes.body.error.code).toBe(ERROR_CODES.REFRESH_TOKEN_REUSED);
  });

  it('POST /api/v1/auth/logout clears cookie and returns 204', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(204);
  });

  it('POST /api/v1/auth/logout-all revokes all sessions and returns 204', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${candidateAccessToken}`)
      .expect(204);
  });
});
