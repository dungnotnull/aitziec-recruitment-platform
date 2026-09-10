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

describe('Skill Catalog E2E (BE-8-006, BE-8-007)', () => {
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

    // Register Candidate
    const candRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'cand-skills@itziec.com',
      password: 'Password123!@#',
      role: 'CANDIDATE',
    });
    candidateToken = candRes.body.data.accessToken;

    // Register HR
    const hrRes = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'hr-skills@itziec.com',
      password: 'Password123!@#',
      role: 'HR',
    });
    hrToken = hrRes.body.data.accessToken;

    // Seed Skills
    const react = await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-react-id',
        name: 'React',
        normalizedName: 'react',
        active: true,
      },
    });
    await inMemoryPrisma.skillAlias.create({
      data: {
        skillId: react.id,
        alias: 'ReactJS',
        normalizedName: 'reactjs',
      },
    });
    await inMemoryPrisma.skillAlias.create({
      data: {
        skillId: react.id,
        alias: 'React.js',
        normalizedName: 'react.js',
      },
    });

    await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-ts-id',
        name: 'TypeScript',
        normalizedName: 'typescript',
        active: true,
      },
    });

    await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-inactive-id',
        name: 'ObsoleteSkill',
        normalizedName: 'obsoleteskill',
        active: false,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1. should reject unauthenticated (guest) requests with 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/skills');
    expect(res.status).toBe(401);
  });

  it('2. should allow CANDIDATE and HR to fetch skill catalog', async () => {
    const resCand = await request(app.getHttpServer())
      .get('/api/v1/skills')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(resCand.status).toBe(200);
    expect(resCand.body.data).toBeDefined();
    expect(Array.isArray(resCand.body.data)).toBe(true);
    expect(resCand.body.meta.page).toBeDefined();

    const resHr = await request(app.getHttpServer())
      .get('/api/v1/skills')
      .set('Authorization', `Bearer ${hrToken}`);
    expect(resHr.status).toBe(200);
    expect(resHr.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('3. should return identical skill ID for canonical and alias search', async () => {
    const resName = await request(app.getHttpServer())
      .get('/api/v1/skills?search=react')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(resName.status).toBe(200);
    expect(resName.body.data.length).toBe(1);
    expect(resName.body.data[0].id).toBe('skill-react-id');
    expect(resName.body.data[0].aliases).toEqual(['React.js', 'ReactJS']);

    const resAlias = await request(app.getHttpServer())
      .get('/api/v1/skills?search=reactjs')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(resAlias.status).toBe(200);
    expect(resAlias.body.data.length).toBe(1);
    expect(resAlias.body.data[0].id).toBe('skill-react-id');
  });

  it('4. should filter by active status properly', async () => {
    // Default active=true should not return obsolete skill
    const resActive = await request(app.getHttpServer())
      .get('/api/v1/skills')
      .set('Authorization', `Bearer ${candidateToken}`);
    const activeIds = resActive.body.data.map((s: { id: string }) => s.id);
    expect(activeIds).not.toContain('skill-inactive-id');

    // active=false should return only obsolete skill
    const resInactive = await request(app.getHttpServer())
      .get('/api/v1/skills?active=false')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(resInactive.status).toBe(200);
    expect(resInactive.body.data.length).toBe(1);
    expect(resInactive.body.data[0].id).toBe('skill-inactive-id');
  });

  it('5. should paginate skills with cursor', async () => {
    const page1 = await request(app.getHttpServer())
      .get('/api/v1/skills?limit=1')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(1);
    expect(page1.body.meta.page.hasNextPage).toBe(true);
    expect(page1.body.meta.page.nextCursor).toBeDefined();

    const page2 = await request(app.getHttpServer())
      .get(`/api/v1/skills?limit=1&cursor=${page1.body.meta.page.nextCursor}`)
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBe(1);
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
  });

  it('6. should return 400 for malformed cursor', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/skills?cursor=malformed_cursor_test')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.INVALID_CURSOR);
  });

  it('7. should return 400 for invalid limit exceeding maximum', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/skills?limit=1000')
      .set('Authorization', `Bearer ${candidateToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});
