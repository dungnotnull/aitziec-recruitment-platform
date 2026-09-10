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
      const rec = res.data[0] as any;

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
      expect((res.meta as any).optedOut).toBe(true);
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
  });
});
