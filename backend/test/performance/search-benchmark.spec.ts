import * as fs from 'fs';
import * as path from 'path';
import { SearchService } from '../../src/search/search.service';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';

describe('SearchPerformanceAndCorpusBenchmark (BE-8-024 / BEI-006)', () => {
  let searchService: SearchService;
  let inMemoryPrisma: InMemoryPrismaService;
  let corpus: any;

  beforeAll(() => {
    const fixturePath = path.join(__dirname, '..', 'fixtures', 'search-corpus.json');
    const raw = fs.readFileSync(fixturePath, 'utf8');
    corpus = JSON.parse(raw);
  });

  beforeEach(() => {
    inMemoryPrisma = new InMemoryPrismaService();

    // 1. Seed companies from corpus
    const uniqueCompanies = new Map<string, any>();
    for (const job of corpus.jobs) {
      if (!uniqueCompanies.has(job.companyId)) {
        uniqueCompanies.set(job.companyId, {
          id: job.companyId,
          name: job.companyId.replace(/-/g, ' ').toUpperCase(),
          slug: job.companyId,
          status: job.companyStatus || 'ACTIVE',
        });
      }
    }
    inMemoryPrisma.companies.push(...Array.from(uniqueCompanies.values()));

    // 2. Seed jobs
    for (const j of corpus.jobs) {
      inMemoryPrisma.jobs.push({
        id: j.id,
        companyId: j.companyId,
        title: j.title,
        slug: j.slug,
        description: j.description,
        requirements: j.requirements,
        technologyNames: j.technologyNames,
        location: j.location,
        workplaceType: j.workplaceType,
        experienceLevel: j.experienceLevel,
        employmentType: j.employmentType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryNegotiable: j.salaryNegotiable,
        status: j.status,
        version: 1,
        applicationDeadline: j.isExpired
          ? new Date(Date.now() - 86400000)
          : new Date(Date.now() + 86400000),
        publishedAt: new Date(Date.now() - 3600000),
        createdAt: new Date(Date.now() - 7200000),
        updatedAt: new Date(),
      });
    }

    const mockRedis: any = {
      getClient: jest.fn().mockReturnValue(null),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    const mockJobsService: any = {
      mapToDto: jest.fn((job: any) => ({
        id: job.id,
        title: job.title,
        slug: job.slug,
        companyId: job.companyId,
        company: { id: job.companyId, name: job.companyId, status: 'ACTIVE' },
        status: job.status,
        experienceLevel: job.experienceLevel,
        location: job.location,
        version: job.version || 1,
      })),
    };

    searchService = new SearchService(inMemoryPrisma as any, mockRedis, mockJobsService);
  });

  describe('Corpus Integrity & Public Visibility Enforcement', () => {
    it('never surfaces draft, expired, or suspended-company jobs in public search', async () => {
      const result = await searchService.searchJobs({ limit: 50 });

      // job-corpus-007 is DRAFT
      expect(result.data.some((j) => j.id === 'job-corpus-007')).toBe(false);

      // job-corpus-008 is from SUSPENDED company
      expect(result.data.some((j) => j.id === 'job-corpus-008')).toBe(false);

      // job-corpus-009 is EXPIRED
      expect(result.data.some((j) => j.id === 'job-corpus-009')).toBe(false);

      // Only 6 published, non-expired, active company jobs
      expect(result.data).toHaveLength(6);
    });

    it('filters accurately by experience level (e.g. FRESHER)', async () => {
      const result = await searchService.searchJobs({
        experienceLevel: ['FRESHER'],
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('job-corpus-002');
    });
  });

  describe('Latency and Throughput Benchmark (BEI-006 Resolution)', () => {
    it('executes 50 search operations within p95 < 200ms latency budget', async () => {
      const latencies: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const suite = corpus.benchmarkQuerySuites[i % corpus.benchmarkQuerySuites.length];
        const start = performance.now();
        await searchService.searchJobs({
          q: suite.query,
          experienceLevel: suite.filter?.experienceLevel
            ? [suite.filter.experienceLevel]
            : undefined,
          limit: 10,
        });
        const duration = performance.now() - start;
        latencies.push(duration);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(iterations * 0.5)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const max = latencies[latencies.length - 1];

      // Console summary for handoff transparency
      // eslint-disable-next-line no-console
      console.log(
        `[SearchBenchmark] p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms, max: ${max.toFixed(2)}ms`,
      );

      expect(p95).toBeLessThan(200); // 200ms budget per NFR-PERF-001
    });
  });
});
