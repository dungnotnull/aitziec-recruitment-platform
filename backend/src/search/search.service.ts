import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ExperienceLevel, EmploymentType, WorkplaceType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { JobsService } from '../jobs/jobs.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { JobSearchQueryDto, ParseSearchQueryDto } from './dto/search.dto';
import { JobDto } from '../jobs/dto/job.dto';
import { CollectionResponse } from '../common/dto/response.dto';
import * as crypto from 'crypto';

interface DecodedCursor {
  id: string;
  sortValue?: string | number | null;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly jobsService: JobsService,
  ) {}

  public normalizeQuery(q?: string): string {
    if (!q) return '';
    return q
      .replace(/[^\w\s\u00C0-\u1EF9]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public encodeCursor(id: string, sortValue?: string | number | null): string {
    const payload = JSON.stringify({ id, sortValue });
    return Buffer.from(payload, 'utf8').toString('base64url');
  }

  public decodeCursor(cursor?: string): DecodedCursor | null {
    if (!cursor) return null;
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed = JSON.parse(decoded);
      if (!parsed || typeof parsed.id !== 'string') {
        throw new Error('Invalid cursor schema');
      }
      return parsed;
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Invalid pagination cursor.',
      });
    }
  }

  async searchJobs(query: JobSearchQueryDto): Promise<CollectionResponse<JobDto>> {
    const limit = query.limit ?? 20;
    const sort = query.sort ?? (query.q ? 'RELEVANCE' : 'NEWEST');
    const normalizedQ = this.normalizeQuery(query.q);

    // Safe search caching (BE-3-017)
    const cacheKey = this.generateCacheKey(query);
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const decodedCursor = this.decodeCursor(query.cursor);
    const now = new Date();

    // Query published, non-expired jobs with active companies
    const rawJobs = await this.prisma.job.findMany({
      where: {
        status: 'PUBLISHED',
        applicationDeadline: { gt: now },
        company: { status: 'ACTIVE' },
        ...(query.companyId && { companyId: query.companyId }),
        ...(query.experienceLevel &&
          query.experienceLevel.length > 0 && {
            experienceLevel: { in: query.experienceLevel as ExperienceLevel[] },
          }),
        ...(query.employmentType &&
          query.employmentType.length > 0 && {
            employmentType: { in: query.employmentType as EmploymentType[] },
          }),
        ...(query.workplaceType &&
          query.workplaceType.length > 0 && {
            workplaceType: { in: query.workplaceType as WorkplaceType[] },
          }),
        ...(query.publishedAfter && {
          publishedAt: { gte: new Date(query.publishedAfter) },
        }),
      },
      include: { company: true },
    });

    // In-memory filter for text, arrays, salary range
    const filtered = rawJobs.filter((job) => {
      // Full-text query match
      if (normalizedQ) {
        const words = normalizedQ.toLowerCase().split(' ').filter(Boolean);
        const searchableText =
          `${job.title} ${job.description} ${job.requirements} ${job.location} ${(job.technologyNames || []).join(' ')}`.toLowerCase();
        const matchesAll = words.every((w) => searchableText.includes(w));
        if (!matchesAll) return false;
      }

      // Technology filter (match any requested)
      if (query.technology && query.technology.length > 0) {
        const jobTechs = (job.technologyNames || []).map((t: string) => t.toLowerCase());
        const hasTech = query.technology.some((reqTech) =>
          jobTechs.some((jt: string) => jt.includes(reqTech.toLowerCase())),
        );
        if (!hasTech) return false;
      }

      // Location filter (match any requested)
      if (query.location && query.location.length > 0) {
        const jobLoc = job.location.toLowerCase();
        const hasLoc = query.location.some((loc) => jobLoc.includes(loc.toLowerCase()));
        if (!hasLoc) return false;
      }

      // Salary filters
      if (
        query.salaryMin !== undefined &&
        job.salaryMax !== null &&
        job.salaryMax < query.salaryMin
      ) {
        return false;
      }
      if (
        query.salaryMax !== undefined &&
        job.salaryMin !== null &&
        job.salaryMin > query.salaryMax
      ) {
        return false;
      }
      if (query.currency && job.currency.toUpperCase() !== query.currency.toUpperCase()) {
        return false;
      }

      return true;
    });

    // Deterministic sorting (BE-3-012)
    filtered.sort((a, b) => {
      if (sort === 'NEWEST') {
        const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        if (timeA !== timeB) return timeB - timeA;
        return a.id.localeCompare(b.id);
      }
      if (sort === 'SALARY_ASC') {
        const salA = a.salaryMin ?? 0;
        const salB = b.salaryMin ?? 0;
        if (salA !== salB) return salA - salB;
        return a.id.localeCompare(b.id);
      }
      if (sort === 'SALARY_DESC') {
        const salA = a.salaryMax ?? a.salaryMin ?? 0;
        const salB = b.salaryMax ?? b.salaryMin ?? 0;
        if (salA !== salB) return salB - salA;
        return a.id.localeCompare(b.id);
      }
      // RELEVANCE: prioritize title matches, then newest
      const titleMatchesA =
        normalizedQ && a.title.toLowerCase().includes(normalizedQ.toLowerCase()) ? 1 : 0;
      const titleMatchesB =
        normalizedQ && b.title.toLowerCase().includes(normalizedQ.toLowerCase()) ? 1 : 0;
      if (titleMatchesA !== titleMatchesB) return titleMatchesB - titleMatchesA;

      const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      if (timeA !== timeB) return timeB - timeA;
      return a.id.localeCompare(b.id);
    });

    // Opaque cursor pagination (BE-3-013)
    let startIndex = 0;
    if (decodedCursor) {
      const idx = filtered.findIndex((j) => j.id === decodedCursor.id);
      if (idx !== -1) {
        startIndex = idx + 1;
      }
    }

    const pageItems = filtered.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < filtered.length;
    const lastItem = pageItems[pageItems.length - 1];

    let nextCursor: string | null = null;
    if (hasMore && lastItem) {
      let sortVal: string | number | null = null;
      if (sort === 'NEWEST')
        sortVal = lastItem.publishedAt ? lastItem.publishedAt.toISOString() : null;
      else if (sort === 'SALARY_ASC') sortVal = lastItem.salaryMin;
      else if (sort === 'SALARY_DESC') sortVal = lastItem.salaryMax;
      nextCursor = this.encodeCursor(lastItem.id, sortVal);
    }

    const response: CollectionResponse<JobDto> = {
      data: pageItems.map((j) => this.jobsService.mapToDto(j)),
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      },
    };

    // Cache results for 60s
    await this.setInCache(cacheKey, response, 60);

    return response;
  }

  async parseSearchQuery(dto: ParseSearchQueryDto): Promise<Record<string, unknown>> {
    const raw = dto.query.toLowerCase();
    const result: Record<string, unknown> = {};

    // Detect workplace type
    if (raw.includes('remote')) result.workplaceType = ['REMOTE'];
    else if (raw.includes('hybrid')) result.workplaceType = ['HYBRID'];
    else if (raw.includes('onsite') || raw.includes('on-site')) result.workplaceType = ['ONSITE'];

    // Detect experience level
    if (raw.includes('intern') || raw.includes('thực tập')) result.experienceLevel = ['INTERN'];
    else if (raw.includes('fresher')) result.experienceLevel = ['FRESHER'];
    else if (raw.includes('junior')) result.experienceLevel = ['JUNIOR'];
    else if (raw.includes('senior')) result.experienceLevel = ['SENIOR'];
    else if (raw.includes('lead')) result.experienceLevel = ['LEAD'];
    else if (raw.includes('manager') || raw.includes('quản lý'))
      result.experienceLevel = ['MANAGER'];

    // Detect employment type
    if (raw.includes('part-time') || raw.includes('part time'))
      result.employmentType = ['PART_TIME'];
    else if (raw.includes('contract')) result.employmentType = ['CONTRACT'];
    else if (raw.includes('full-time') || raw.includes('full time'))
      result.employmentType = ['FULL_TIME'];

    // Detect location keywords
    const locations = [];
    if (raw.includes('hồ chí minh') || raw.includes('hcm') || raw.includes('saigon'))
      locations.push('Ho Chi Minh');
    if (raw.includes('hà nội') || raw.includes('hanoi')) locations.push('Hanoi');
    if (raw.includes('đà nẵng') || raw.includes('da nang')) locations.push('Da Nang');
    if (locations.length > 0) result.location = locations;

    // Detect salary numbers (e.g. 20 triệu, 30m)
    const salaryMatch = raw.match(/(\d+)\s*(triệu|m|tr)/i);
    if (salaryMatch) {
      const num = parseInt(salaryMatch[1], 10);
      result.salaryMin = num * 1_000_000;
      result.currency = 'VND';
    }

    // Technology keywords
    const techKeywords = [
      'react',
      'vue',
      'angular',
      'node',
      'nestjs',
      'python',
      'java',
      'golang',
      'rust',
      'c#',
      '.net',
      'flutter',
    ];
    const detectedTechs = techKeywords.filter((t) => raw.includes(t));
    if (detectedTechs.length > 0) {
      result.technology = detectedTechs;
    }

    // Clean remaining query
    result.q = this.normalizeQuery(dto.query);

    return result;
  }

  private generateCacheKey(query: JobSearchQueryDto): string {
    const sorted = Object.keys(query)
      .sort()
      .reduce((acc: Record<string, unknown>, key: string) => {
        acc[key] = (query as unknown as Record<string, unknown>)[key];
        return acc;
      }, {});
    const hash = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex');
    return `search:jobs:${hash}`;
  }

  private async getFromCache(key: string): Promise<CollectionResponse<JobDto> | null> {
    try {
      const client = this.redisService.getClient();
      if (!client || client.status !== 'ready') return null;
      const cachedStr = await client.get(key);
      if (cachedStr) {
        return JSON.parse(cachedStr);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Cache read error: ${msg}`);
    }
    return null;
  }

  private async setInCache(key: string, data: unknown, ttlSeconds: number): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client || client.status !== 'ready') return;
      await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Cache write error: ${msg}`);
    }
  }

  async invalidateSearchCache(): Promise<void> {
    try {
      const client = this.redisService.getClient();
      if (!client || client.status !== 'ready') return;
      const keys = await client.keys('search:jobs:*');
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.debug(`Cache invalidation error: ${msg}`);
    }
  }
}
