import { SearchService } from '../../src/search/search.service';
import { BadRequestException } from '@nestjs/common';

describe('SearchService (BE-3-010 to BE-3-013, BE-3-017)', () => {
  let service: SearchService;
  let mockPrisma: any;
  let mockRedisService: any;
  let mockJobsService: any;

  beforeEach(() => {
    mockPrisma = {
      job: {
        findMany: jest.fn(),
      },
    };
    mockRedisService = {
      getClient: jest.fn().mockReturnValue(null), // simulate cold/disabled cache
    };
    mockJobsService = {
      mapToDto: jest.fn((job: any) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        company: job.company,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        publishedAt: job.publishedAt,
      })),
    };

    service = new SearchService(mockPrisma, mockRedisService, mockJobsService);
  });

  describe('query normalization (BE-3-010)', () => {
    it('strips punctuation and unsafe symbols', () => {
      const input = 'Senior & Node.js | Developer (NestJS)!; DROP TABLE users;--';
      const normalized = service.normalizeQuery(input);
      expect(normalized).toBe('Senior Node js Developer NestJS DROP TABLE users');
    });

    it('returns empty string for empty or whitespace query', () => {
      expect(service.normalizeQuery('')).toBe('');
      expect(service.normalizeQuery('   ')).toBe('');
      expect(service.normalizeQuery(undefined)).toBe('');
    });
  });

  describe('cursor encoding and decoding (BE-3-013)', () => {
    it('encodes and decodes valid opaque cursor payload', () => {
      const cursor = service.encodeCursor('job-123', '2026-09-08T00:00:00.000Z');
      expect(typeof cursor).toBe('string');

      const decoded = service.decodeCursor(cursor);
      expect(decoded).toEqual({
        id: 'job-123',
        sortValue: '2026-09-08T00:00:00.000Z',
      });
    });

    it('throws BadRequestException for malformed cursor', () => {
      expect(() => service.decodeCursor('invalid-base64-random-string!')).toThrow(
        BadRequestException,
      );
    });

    it('returns null when cursor is empty', () => {
      expect(service.decodeCursor(undefined)).toBeNull();
      expect(service.decodeCursor('')).toBeNull();
    });
  });

  describe('deterministic search filtering and pagination (BE-3-011, BE-3-012, BE-3-013)', () => {
    const mockJobs = [
      {
        id: 'job-1',
        title: 'Senior Node.js Engineer',
        description: 'Backend API development',
        requirements: 'NestJS, PostgreSQL',
        location: 'Ho Chi Minh',
        technologyNames: ['Node.js', 'NestJS'],
        salaryMin: 30000000,
        salaryMax: 50000000,
        currency: 'VND',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-09-01T00:00:00Z'),
        applicationDeadline: new Date(Date.now() + 86400000),
        company: { id: 'c-1', name: 'Tech', status: 'ACTIVE' },
      },
      {
        id: 'job-2',
        title: 'Junior Frontend Developer',
        description: 'React SPA development',
        requirements: 'React, TypeScript',
        location: 'Hanoi',
        technologyNames: ['React', 'TypeScript'],
        salaryMin: 15000000,
        salaryMax: 20000000,
        currency: 'VND',
        status: 'PUBLISHED',
        publishedAt: new Date('2026-09-05T00:00:00Z'),
        applicationDeadline: new Date(Date.now() + 86400000),
        company: { id: 'c-2', name: 'Dev', status: 'ACTIVE' },
      },
    ];

    it('filters jobs by keyword query across title, description, requirements', async () => {
      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.searchJobs({ q: 'NestJS' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('job-1');
    });

    it('filters jobs by technology list', async () => {
      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.searchJobs({ technology: ['React'] });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('job-2');
    });

    it('sorts by SALARY_DESC deterministically with id tie-breaker', async () => {
      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const result = await service.searchJobs({ sort: 'SALARY_DESC' });
      expect(result.data[0].id).toBe('job-1'); // 50m > 20m
      expect(result.data[1].id).toBe('job-2');
    });

    it('paginates correctly using cursor and limit', async () => {
      mockPrisma.job.findMany.mockResolvedValue(mockJobs);

      const page1 = await service.searchJobs({ limit: 1 });
      expect(page1.data).toHaveLength(1);
      expect(page1.meta.page.hasNextPage).toBe(true);
      expect(page1.meta.page.nextCursor).toBeDefined();

      const page2 = await service.searchJobs({
        limit: 1,
        cursor: page1.meta.page.nextCursor!,
      });
      expect(page2.data).toHaveLength(1);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);
    });
  });

  describe('natural language search parser (BE-3-014, API-JOB-008)', () => {
    it('parses workplace, experience level, salary and location from natural language', async () => {
      const parsed = await service.parseSearchQuery({
        query: 'Tuyển Senior backend remote lương 30 triệu tại Hồ Chí Minh',
      });

      expect(parsed.experienceLevel).toEqual(['SENIOR']);
      expect(parsed.workplaceType).toEqual(['REMOTE']);
      expect(parsed.location).toEqual(['Ho Chi Minh']);
      expect(parsed.salaryMin).toBe(30000000);
      expect(parsed.currency).toBe('VND');
      expect(parsed.q).toBeDefined();
    });
  });
});
