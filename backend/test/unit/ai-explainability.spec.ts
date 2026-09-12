import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { AiService } from '../../src/ai/ai.service';
import { PrismaService } from '../../src/database/prisma.service';
import { JobsService } from '../../src/jobs/jobs.service';
import { AuditService } from '../../src/audit/audit.service';
import { AiMetricsService } from '../../src/ai/metrics/ai-metrics.service';
import { AI_PROVIDER_PORT } from '../../src/ai/interfaces/ai-provider.port';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { QueueService } from '../../src/queues/queue.service';
import { OutboxService } from '../../src/outbox/outbox.service';
import { IdempotencyService } from '../../src/idempotency';

describe('AiExplainabilityAndConsent (Unit - BE-8-021 & BE-8-022)', () => {
  let service: AiService;
  let inMemoryPrisma: InMemoryPrismaService;
  let mockAudit: { record: jest.Mock };
  let mockAiProvider: any;
  let mockJobsService: any;

  const candidateUser: AuthenticatedUser = {
    id: 'cand-explain-1',
    email: 'cand.explain@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const candidateProfile = {
    id: 'prof-explain-1',
    userId: 'cand-explain-1',
    fullName: 'Explainable Candidate',
    headline: 'Senior Backend Engineer',
  };

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();
    mockAudit = { record: jest.fn().mockResolvedValue(undefined) };
    mockAiProvider = { generateText: jest.fn() };
    mockJobsService = {
      mapToDto: jest.fn((job: any) => ({
        id: job.id,
        title: job.title,
        slug: job.slug,
        companyId: job.companyId,
        company: { id: job.companyId, name: job.company?.name || 'Tech Corp', status: 'ACTIVE' },
        status: job.status,
        version: job.version || 1,
      })),
    };

    inMemoryPrisma.candidateProfiles.push({ ...candidateProfile });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: PrismaService, useValue: inMemoryPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: JobsService, useValue: mockJobsService },
        {
          provide: AiMetricsService,
          useValue: {
            recordAnalysisDuration: jest.fn(),
            incrementEvaluations: jest.fn(),
          },
        },
        {
          provide: QueueService,
          useValue: {
            addJob: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
          },
        },
        {
          provide: OutboxService,
          useValue: {
            recordEvent: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
          },
        },
        {
          provide: IdempotencyService,
          useValue: {
            claimOrReplay: jest.fn().mockResolvedValue({ type: 'CLAIMED', recordId: 'mock-claim' }),
            complete: jest.fn().mockResolvedValue(undefined),
            fail: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AI_PROVIDER_PORT, useValue: mockAiProvider },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    (service as any).prisma = inMemoryPrisma;
  });

  describe('BE-8-021: Versioned Recommendation Preferences', () => {
    it('returns default enabled preference when none exists', async () => {
      const pref = await service.getRecommendationPreferences(candidateUser);

      expect(pref.userId).toBe(candidateUser.id);
      expect(pref.enabled).toBe(true);
      expect(pref.consentPolicyVersion).toBe('v1.0');
      expect(pref.version).toBe(1);
    });

    it('updates recommendation preference with optimistic concurrency and audit logging', async () => {
      const initial = await service.getRecommendationPreferences(candidateUser);

      const updated = await service.updateRecommendationPreferences(
        candidateUser,
        {
          enabled: false,
          expectedVersion: initial.version,
        },
        'req-pref-123',
      );

      expect(updated.enabled).toBe(false);
      expect(updated.version).toBe(2);

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RECOMMENDATION_PREFERENCE_UPDATED',
          actorId: candidateUser.id,
          targetType: 'USER',
          targetId: candidateUser.id,
          requestId: 'req-pref-123',
        }),
      );
    });

    it('rejects stale version update with 409 VERSION_CONFLICT', async () => {
      await service.getRecommendationPreferences(candidateUser);

      await expect(
        service.updateRecommendationPreferences(candidateUser, {
          enabled: false,
          expectedVersion: 999, // wrong version
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('BE-8-022: Explainable Job Recommendations & Public Eligibility', () => {
    let activeCompany: any;
    let suspendedCompany: any;
    let eligibleJob: any;

    beforeEach(async () => {
      activeCompany = {
        id: 'comp-active',
        name: 'Active Corp',
        slug: 'active-corp',
        status: 'ACTIVE',
      };
      suspendedCompany = {
        id: 'comp-suspended',
        name: 'Suspended Corp',
        slug: 'suspended-corp',
        status: 'SUSPENDED',
      };

      inMemoryPrisma.companies.push(activeCompany, suspendedCompany);

      eligibleJob = await inMemoryPrisma.job.create({
        data: {
          id: 'job-rec-1',
          companyId: activeCompany.id,
          title: 'Senior Backend Engineer',
          slug: 'senior-backend-engineer',
          description: 'Great backend role',
          requirements: 'TypeScript and Node.js',
          technologyNames: ['TypeScript', 'Node.js', 'PostgreSQL'],
          location: 'Remote',
          workplaceType: 'REMOTE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          applicationDeadline: new Date(Date.now() + 86400000),
          status: 'PUBLISHED',
          company: activeCompany,
        },
      });

      // Add candidate skills
      const skill1 = await inMemoryPrisma.skill.create({
        data: { id: 'sk-1', name: 'TypeScript', normalizedName: 'typescript', active: true },
      });
      const skill2 = await inMemoryPrisma.skill.create({
        data: { id: 'sk-2', name: 'Node.js', normalizedName: 'nodejs', active: true },
      });

      inMemoryPrisma.candidateSkills.push(
        { candidateProfileId: candidateProfile.id, skillId: skill1.id, skill: skill1 },
        { candidateProfileId: candidateProfile.id, skillId: skill2.id, skill: skill2 },
      );

      // Link candidateProfile skills relation in memory
      (candidateProfile as any).skills = [
        { candidateProfileId: candidateProfile.id, skillId: skill1.id, skill: skill1 },
        { candidateProfileId: candidateProfile.id, skillId: skill2.id, skill: skill2 },
      ];
    });

    it('returns explainable recommendations with bounded score, reason codes, and limitations', async () => {
      const res = await service.getJobRecommendations(candidateUser, { limit: 10 });

      expect(res.data.length).toBeGreaterThanOrEqual(1);
      const rec = res.data[0];

      // Exact-key check: verify exact keys match RecommendedJobDto and no flat JobDto fields leak
      const keys = Object.keys(rec).sort();
      expect(keys).toEqual(['evidence', 'job', 'limitations', 'reasonCodes', 'score'].sort());

      // Verify no flat JobDto compatibility fields exist on the root object
      const flatRec = rec as unknown as Record<string, unknown>;
      expect(flatRec.id).toBeUndefined();
      expect(flatRec.title).toBeUndefined();
      expect(flatRec.slug).toBeUndefined();
      expect(flatRec.companyId).toBeUndefined();
      expect(flatRec.company).toBeUndefined();
      expect(flatRec.status).toBeUndefined();
      expect(flatRec.technologyNames).toBeUndefined();

      expect(rec.job.id).toBe(eligibleJob.id);
      expect(rec.score).toBeGreaterThanOrEqual(50);
      expect(rec.score).toBeLessThanOrEqual(100);
      expect(rec.reasonCodes).toContain('ACTIVE_ELIGIBLE_JOB');
      expect(rec.reasonCodes).toContain('SKILL_MATCH');
      expect(rec.reasonCodes).toContain('HEADLINE_MATCH');
      expect(rec.evidence.length).toBeGreaterThan(0);
      expect(rec.limitations.length).toBeGreaterThan(0);
    });

    it('returns empty result without computing when candidate has opted out', async () => {
      await service.updateRecommendationPreferences(candidateUser, {
        enabled: false,
        expectedVersion: 1,
      });

      const res = await service.getJobRecommendations(candidateUser, { limit: 10 });

      expect(res.data).toHaveLength(0);
      expect(res.meta.optedOut).toBe(true);
    });

    it('does not recommend jobs from suspended companies', async () => {
      await inMemoryPrisma.job.create({
        data: {
          id: 'job-suspended-comp',
          companyId: suspendedCompany.id,
          title: 'Senior Backend Engineer',
          slug: 'senior-backend-suspended',
          description: 'Desc',
          requirements: 'Reqs',
          technologyNames: ['TypeScript'],
          location: 'Remote',
          workplaceType: 'REMOTE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          applicationDeadline: new Date(Date.now() + 86400000),
          status: 'PUBLISHED',
          company: suspendedCompany,
        },
      });

      const res = await service.getJobRecommendations(candidateUser, { limit: 10 });
      expect(res.data.some((j: any) => j.job.id === 'job-suspended-comp')).toBe(false);
    });

    it('rejects malformed pagination cursor with 400 INVALID_CURSOR', async () => {
      await expect(
        service.getJobRecommendations(candidateUser, {
          cursor: 'not-valid-base64-format@@!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects stale cursor with 400 INVALID_CURSOR', async () => {
      const staleCursor = Buffer.from('99:non-existent-job-id').toString('base64');

      await expect(
        service.getJobRecommendations(candidateUser, {
          cursor: staleCursor,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    describe('BE-9-001: Comprehensive stability, pagination, and edge-case investigation', () => {
      it('handles 0 jobs dataset gracefully with empty array and null nextCursor', async () => {
        // Clear all jobs
        inMemoryPrisma.jobs = [];

        const res = await service.getJobRecommendations(candidateUser, { limit: 20 });
        expect(res.data).toHaveLength(0);
        expect(res.meta.page.nextCursor).toBeNull();
        expect(res.meta.page.hasNextPage).toBe(false);
      });

      it('handles >20 jobs dataset (e.g. 25 jobs) with limit=20 deterministically across 20 iterations', async () => {
        // Clear existing jobs and seed 25 published jobs
        inMemoryPrisma.jobs = [];
        for (let i = 1; i <= 25; i++) {
          await inMemoryPrisma.job.create({
            data: {
              id: `job-bulk-${String(i).padStart(3, '0')}`,
              companyId: activeCompany.id,
              title: `Engineer Role ${i}`,
              slug: `engineer-role-${i}`,
              description: `Description ${i}`,
              requirements: 'TypeScript',
              technologyNames: ['TypeScript', 'Node.js'],
              location: 'Remote',
              workplaceType: 'REMOTE',
              experienceLevel: 'MID',
              employmentType: 'FULL_TIME',
              applicationDeadline: new Date(Date.now() + 86400000),
              publishedAt: new Date(Date.now() - i * 1000),
              status: 'PUBLISHED',
              company: activeCompany,
            },
          });
        }

        // Loop 20 times to detect any intermittent failure or instability
        for (let iter = 0; iter < 20; iter++) {
          const res = await service.getJobRecommendations(candidateUser, { limit: 20 });
          expect(res.data).toHaveLength(20);
          expect(res.meta.page.hasNextPage).toBe(true);
          expect(res.meta.page.nextCursor).toBeDefined();

          // Fetch page 2 using cursor
          const page2 = await service.getJobRecommendations(candidateUser, {
            limit: 20,
            cursor: res.meta.page.nextCursor!,
          });
          expect(page2.data).toHaveLength(5);
          expect(page2.meta.page.hasNextPage).toBe(false);
          expect(page2.meta.page.nextCursor).toBeNull();

          // Ensure no duplicate IDs between page 1 and page 2
          const page1Ids = new Set(res.data.map((j: any) => j.job.id));
          for (const item of page2.data as any[]) {
            expect(page1Ids.has(item.job.id)).toBe(false);
          }
        }
      });

      it('rejects cursor with non-numeric score with 400 INVALID_CURSOR', async () => {
        const invalidCursor = Buffer.from('notanumber:job-id-1').toString('base64');
        await expect(
          service.getJobRecommendations(candidateUser, { cursor: invalidCursor }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects cursor with missing jobId with 400 INVALID_CURSOR', async () => {
        const invalidCursor = Buffer.from('50:').toString('base64');
        await expect(
          service.getJobRecommendations(candidateUser, { cursor: invalidCursor }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects cursor with extra components (length > 2) with 400 INVALID_CURSOR', async () => {
        const invalidCursor = Buffer.from('50:job-id-1:extra').toString('base64');
        await expect(
          service.getJobRecommendations(candidateUser, { cursor: invalidCursor }),
        ).rejects.toThrow(BadRequestException);
      });

      it('handles job technologyNames containing null safely without throwing 500 / TypeError', async () => {
        inMemoryPrisma.jobs = [];
        await inMemoryPrisma.job.create({
          data: {
            id: 'job-null-tech',
            companyId: activeCompany.id,
            title: 'Engineer with Dirty Data',
            slug: 'engineer-dirty-data',
            description: 'Description',
            requirements: 'TypeScript',
            technologyNames: ['TypeScript', null as any, 'Node.js'],
            location: 'Remote',
            workplaceType: 'REMOTE',
            experienceLevel: 'MID',
            employmentType: 'FULL_TIME',
            applicationDeadline: new Date(Date.now() + 86400000),
            status: 'PUBLISHED',
            company: activeCompany,
          },
        });

        const res = await service.getJobRecommendations(candidateUser, { limit: 20 });
        expect(res.data).toHaveLength(1);
        expect((res.data[0] as any).job.id).toBe('job-null-tech');
      });
    });
  });
});
