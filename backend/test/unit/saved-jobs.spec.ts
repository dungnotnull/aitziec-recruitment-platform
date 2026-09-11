import { SavedJobsService } from '../../src/saved-jobs/saved-jobs.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';

describe('SavedJobsService (BE-3-018, BE-3-019, BE-3-020)', () => {
  let service: SavedJobsService;
  let mockPrisma: any;
  let mockJobsService: any;

  const candidateUser: AuthenticatedUser = {
    id: 'user-cand-1',
    email: 'cand@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const profile = {
    id: 'profile-1',
    userId: 'user-cand-1',
  };

  const job = {
    id: 'job-1',
    title: 'NestJS Developer',
    status: 'PUBLISHED',
    company: { id: 'c-1', name: 'Tech' },
  };

  beforeEach(() => {
    mockPrisma = {
      candidateProfile: {
        findUnique: jest.fn().mockResolvedValue(profile),
      },
      job: {
        findUnique: jest.fn().mockResolvedValue(job),
      },
      savedJob: {
        findUnique: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
      },
    };
    mockJobsService = {
      mapToDto: jest.fn((j) => j),
    };

    service = new SavedJobsService(mockPrisma, mockJobsService);
  });

  describe('idempotent save and unsave (BE-3-019)', () => {
    it('creates savedJob bookmark if not previously saved', async () => {
      mockPrisma.savedJob.findUnique.mockResolvedValue(null);

      await service.saveJob('job-1', candidateUser);

      expect(mockPrisma.savedJob.create).toHaveBeenCalledWith({
        data: { candidateProfileId: 'profile-1', jobId: 'job-1' },
      });
    });

    it('does not re-create or error if job already saved (idempotent PUT)', async () => {
      mockPrisma.savedJob.findUnique.mockResolvedValue({
        id: 'saved-1',
        candidateProfileId: 'profile-1',
        jobId: 'job-1',
      });

      await service.saveJob('job-1', candidateUser);

      expect(mockPrisma.savedJob.create).not.toHaveBeenCalled();
    });

    it('throws 404 if job does not exist', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);

      await expect(service.saveJob('non-existent', candidateUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('unsaves job idempotently without error if job was not saved', async () => {
      mockPrisma.savedJob.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.unsaveJob('job-1', candidateUser)).resolves.not.toThrow();
      expect(mockPrisma.savedJob.deleteMany).toHaveBeenCalledWith({
        where: { candidateProfileId: 'profile-1', jobId: 'job-1' },
      });
    });

    it('throws 403 if candidate profile does not exist', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(service.saveJob('job-1', candidateUser)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('list saved jobs (BE-3-020)', () => {
    it('returns saved jobs for candidate with cursor pagination', async () => {
      mockPrisma.savedJob.findMany.mockResolvedValue([{ id: 'saved-1', job }]);

      const result = await service.listSavedJobs(candidateUser, { limit: 10 });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('job-1');
      expect(result.meta.page.limit).toBe(10);
    });
  });

  describe('check saved job (BE-9-003)', () => {
    it('returns { isSaved: true } when bookmark exists', async () => {
      mockPrisma.savedJob.findUnique.mockResolvedValue({ id: 'saved-1' });

      const result = await service.checkSavedJob('job-1', candidateUser);

      expect(result).toEqual({ isSaved: true });
      expect(mockPrisma.savedJob.findUnique).toHaveBeenCalledWith({
        where: {
          candidateProfileId_jobId: {
            candidateProfileId: 'profile-1',
            jobId: 'job-1',
          },
        },
        select: { id: true },
      });
      expect(mockPrisma.job.findUnique).not.toHaveBeenCalled();
    });

    it('returns { isSaved: false } when bookmark does not exist', async () => {
      mockPrisma.savedJob.findUnique.mockResolvedValue(null);

      const result = await service.checkSavedJob('job-non-saved', candidateUser);

      expect(result).toEqual({ isSaved: false });
      expect(mockPrisma.savedJob.findUnique).toHaveBeenCalledWith({
        where: {
          candidateProfileId_jobId: {
            candidateProfileId: 'profile-1',
            jobId: 'job-non-saved',
          },
        },
        select: { id: true },
      });
      expect(mockPrisma.job.findUnique).not.toHaveBeenCalled();
    });

    it('throws 403 ForbiddenException if candidate profile does not exist', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(service.checkSavedJob('job-1', candidateUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
