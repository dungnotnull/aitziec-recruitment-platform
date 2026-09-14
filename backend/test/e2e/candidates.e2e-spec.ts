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

describe('Candidate Profiles E2E (BE-2-011 to BE-2-014)', () => {
  let app: INestApplication;
  let inMemoryPrisma: InMemoryPrismaService;
  let candidateToken = '';
  let hrToken = '';

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

    // Register a Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'candidate-profile@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;

    // Register an HR
    const hrRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-user@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // Seed canonical skills for BE-10-002
    await inMemoryPrisma.skill.create({
      data: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'TypeScript',
        normalizedName: 'typescript',
        active: true,
      },
    });
    await inMemoryPrisma.skill.create({
      data: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Node.js',
        normalizedName: 'nodejs',
        active: true,
      },
    });
    await inMemoryPrisma.skill.create({
      data: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Legacy Tech',
        normalizedName: 'legacytech',
        active: false,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/candidates/me retrieves candidate profile', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .expect(200);

    expect(res.body.data.fullName).toBe('candidate-profile');
    expect(res.body.data.version).toBe(1);
    expect(Array.isArray(res.body.data.skills)).toBe(true);
    expect(Array.isArray(res.body.data.experiences)).toBe(true);
  });

  describe('BE-10-002 Canonical Skills and Date Validations', () => {
    it('rejects non-UUID skillId with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          expectedVersion: 1,
          skills: [{ skillId: 'not-a-uuid', yearsOfExperience: 3 }],
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects unknown skillId with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          expectedVersion: 1,
          skills: [{ skillId: '44444444-4444-4444-8444-444444444444', yearsOfExperience: 3 }],
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects inactive skillId with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          expectedVersion: 1,
          skills: [{ skillId: '33333333-3333-4333-8333-333333333333', yearsOfExperience: 3 }],
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects duplicate skillIds in payload with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          expectedVersion: 1,
          skills: [
            { skillId: '11111111-1111-4111-8111-111111111111', yearsOfExperience: 2 },
            { skillId: '11111111-1111-4111-8111-111111111111', yearsOfExperience: 5 },
          ],
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects malformed ISO date in experience with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          expectedVersion: 1,
          experiences: [
            {
              companyName: 'Tech Corp',
              title: 'Dev',
              startDate: '2021-not-a-date',
            },
          ],
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('rejects experience where endDate < startDate with 400 VALIDATION_ERROR', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .send({
          expectedVersion: 1,
          experiences: [
            {
              companyName: 'Tech Corp',
              title: 'Dev',
              startDate: '2024-01-01T00:00:00.000Z',
              endDate: '2022-01-01T00:00:00.000Z',
            },
          ],
        })
        .expect(400);

      expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('verifies profile remains unchanged at version 1 after rejected validations', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/candidates/me')
        .set('Authorization', `Bearer ${candidateToken}`)
        .expect(200);

      expect(res.body.data.version).toBe(1);
      expect(res.body.data.fullName).toBe('candidate-profile');
    });
  });

  it('PATCH /api/v1/candidates/me updates profile, skills, and experiences with optimistic concurrency', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        expectedVersion: 1,
        fullName: 'Le Van Candidate',
        headline: 'Senior Cloud Engineer',
        phone: '+84901234567',
        location: 'Ho Chi Minh City',
        bio: 'Experienced in AWS, Kubernetes, NestJS',
        skills: [
          { skillId: '11111111-1111-4111-8111-111111111111', yearsOfExperience: 5 },
          { skillId: '22222222-2222-4222-8222-222222222222', yearsOfExperience: 4 },
        ],
        experiences: [
          {
            companyName: 'FPT Software',
            title: 'Software Engineer',
            startDate: '2021-01-01T00:00:00.000Z',
            endDate: '2023-12-31T00:00:00.000Z',
            description: 'Backend engineer',
          },
        ],
      })
      .expect(200);

    expect(res.body.data.fullName).toBe('Le Van Candidate');
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.profileCompleteness).toBe(100);
    expect(res.body.data.skills.length).toBe(2);
    expect(res.body.data.experiences.length).toBe(1);
  });

  it('PATCH /api/v1/candidates/me rejects stale expectedVersion with 409 VERSION_CONFLICT', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${candidateToken}`)
      .send({
        expectedVersion: 1, // Stale! Current version is 2
        fullName: 'Trying to overwrite with stale version',
      })
      .expect(409);

    expect(res.body.error.code).toBe(ERROR_CODES.VERSION_CONFLICT);
  });

  it('GET /api/v1/candidates/me denies access to HR user with 403 FORBIDDEN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/candidates/me')
      .set('Authorization', `Bearer ${hrToken}`)
      .expect(403);

    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });
});
