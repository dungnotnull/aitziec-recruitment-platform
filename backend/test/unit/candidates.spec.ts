import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { CandidatesService } from '../../src/candidates/candidates.service';
import { CompletenessService } from '../../src/candidates/completeness.service';
import { ERROR_CODES } from '../../src/common/constants/error-codes';

describe('CandidatesService (Unit - BE-10-002)', () => {
  let service: CandidatesService;
  let mockPrisma: any;
  let mockStorage: any;
  let mockAudit: any;
  let completenessService: CompletenessService;

  const validSkill1Id = '11111111-1111-4111-8111-111111111111';
  const validSkill2Id = '22222222-2222-4222-8222-222222222222';
  const inactiveSkillId = '33333333-3333-4333-8333-333333333333';
  const unknownSkillId = '44444444-4444-4444-8444-444444444444';

  const existingProfile = {
    id: 'cand-prof-1',
    userId: 'user-cand-1',
    fullName: 'Nguyen Van A',
    headline: 'Senior Backend Engineer',
    phone: '+84987654321',
    location: 'Ho Chi Minh City',
    bio: 'Passionate developer',
    isSearchable: true,
    profileCompleteness: 80,
    defaultCvId: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    skills: [],
    experiences: [],
  };

  beforeEach(() => {
    mockPrisma = {
      candidateProfile: {
        findUnique: jest.fn().mockResolvedValue({ ...existingProfile }),
        update: jest.fn().mockImplementation((args: any) => ({
          ...existingProfile,
          ...args.data,
          skills: [],
          experiences: [],
          updatedAt: new Date(),
        })),
      },
      skill: {
        findMany: jest.fn().mockImplementation((args: any) => {
          const ids: string[] = args.where.id.in;
          const activeOnly = args.where.active;
          const catalog = [
            { id: validSkill1Id, name: 'TypeScript', active: true },
            { id: validSkill2Id, name: 'NestJS', active: true },
            { id: inactiveSkillId, name: 'Legacy Pascal', active: false },
          ];
          return catalog.filter(
            (s) => ids.includes(s.id) && (activeOnly === undefined || s.active === activeOnly),
          );
        }),
        create: jest.fn(),
      },
      candidateSkill: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'cs-1' }),
      },
      workExperience: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'we-1' }),
      },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    mockStorage = {
      uploadPublicAsset: jest
        .fn()
        .mockResolvedValue('http://assets.test/candidates/cand-prof-1/avatar.png'),
      deletePublicAsset: jest.fn().mockResolvedValue(undefined),
      getAssetsBucket: jest.fn().mockReturnValue('itziec-assets'),
    };
    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    completenessService = new CompletenessService();
    service = new CandidatesService(mockPrisma, completenessService, mockStorage, mockAudit);
  });

  describe('getProfile', () => {
    it('returns candidate profile when found', async () => {
      const result = await service.getProfile('user-cand-1');
      expect(result.id).toBe('cand-prof-1');
      expect(result.fullName).toBe('Nguyen Van A');
    });

    it('throws NotFoundException when profile not found', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('non-existent-user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile - BE-10-002 Canonical Skills & Date Validations', () => {
    it('rejects stale expectedVersion with ConflictException (VERSION_CONFLICT)', async () => {
      await expect(
        service.updateProfile('user-cand-1', {
          expectedVersion: 99,
          fullName: 'Stale Attempt',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects duplicate skillIds in payload with BadRequestException (VALIDATION_ERROR)', async () => {
      try {
        await service.updateProfile('user-cand-1', {
          expectedVersion: 1,
          skills: [
            { skillId: validSkill1Id, yearsOfExperience: 3 },
            { skillId: validSkill1Id, yearsOfExperience: 5 },
          ],
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe(ERROR_CODES.VALIDATION_ERROR);
      }

      // Assert no destructive deletes executed
      expect(mockPrisma.candidateSkill.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.skill.create).not.toHaveBeenCalled();
    });

    it('rejects unknown skillId with BadRequestException (VALIDATION_ERROR)', async () => {
      try {
        await service.updateProfile('user-cand-1', {
          expectedVersion: 1,
          skills: [{ skillId: unknownSkillId, yearsOfExperience: 2 }],
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe(ERROR_CODES.VALIDATION_ERROR);
      }

      expect(mockPrisma.candidateSkill.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.skill.create).not.toHaveBeenCalled();
    });

    it('rejects inactive skillId with BadRequestException (VALIDATION_ERROR)', async () => {
      try {
        await service.updateProfile('user-cand-1', {
          expectedVersion: 1,
          skills: [{ skillId: inactiveSkillId, yearsOfExperience: 2 }],
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe(ERROR_CODES.VALIDATION_ERROR);
      }

      expect(mockPrisma.candidateSkill.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.skill.create).not.toHaveBeenCalled();
    });

    it('rejects experience where endDate is earlier than startDate with BadRequestException (VALIDATION_ERROR)', async () => {
      try {
        await service.updateProfile('user-cand-1', {
          expectedVersion: 1,
          experiences: [
            {
              companyName: 'Tech Corp',
              title: 'Engineer',
              startDate: '2024-01-01T00:00:00.000Z',
              endDate: '2023-01-01T00:00:00.000Z', // earlier than startDate
            },
          ],
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().code).toBe(ERROR_CODES.VALIDATION_ERROR);
      }

      expect(mockPrisma.workExperience.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.candidateProfile.update).not.toHaveBeenCalled();
    });

    it('successfully updates profile with canonical active skills and valid experiences', async () => {
      const result = await service.updateProfile('user-cand-1', {
        expectedVersion: 1,
        fullName: 'Nguyen Van Updated',
        skills: [
          { skillId: validSkill1Id, yearsOfExperience: 4 },
          { skillId: validSkill2Id, yearsOfExperience: 3 },
        ],
        experiences: [
          {
            companyName: 'ABC Corp',
            title: 'Fullstack Dev',
            startDate: '2022-01-01T00:00:00.000Z',
            endDate: '2024-01-01T00:00:00.000Z',
          },
          {
            companyName: 'XYZ Corp',
            title: 'Lead Architect',
            startDate: '2024-02-01T00:00:00.000Z',
            endDate: null, // current role
          },
        ],
      });

      expect(result.fullName).toBe('Nguyen Van Updated');
      expect(mockPrisma.skill.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.skill.create).not.toHaveBeenCalled();
      expect(mockPrisma.candidateSkill.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.candidateSkill.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.workExperience.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.workExperience.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.candidateProfile.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('uploadAvatar - BE-16-003', () => {
    const validPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(32),
    ]);

    it('uploads a valid PNG, increments profile version, and records a safe audit event', async () => {
      const result = await service.uploadAvatar(
        'user-cand-1',
        {
          originalname: 'avatar.png',
          mimetype: 'image/png',
          size: validPng.length,
          buffer: validPng,
        },
        { expectedVersion: 1 },
      );

      expect(result).toEqual({
        avatarUrl: 'http://assets.test/candidates/cand-prof-1/avatar.png',
        version: 2,
      });
      expect(mockStorage.uploadPublicAsset).toHaveBeenCalledWith(
        expect.stringMatching(/^candidates\/cand-prof-1\/[\w-]+\.png$/),
        validPng,
        'image/png',
      );
      expect(mockPrisma.candidateProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cand-prof-1', version: 1 },
          data: expect.objectContaining({
            avatarUrl: 'http://assets.test/candidates/cand-prof-1/avatar.png',
          }),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CANDIDATE_AVATAR_UPDATED',
          targetType: 'CandidateProfile',
          targetId: 'cand-prof-1',
        }),
        mockPrisma,
      );
    });

    it('rejects a MIME/signature mismatch before uploading', async () => {
      await expect(
        service.uploadAvatar(
          'user-cand-1',
          {
            originalname: 'avatar.jpg',
            mimetype: 'image/jpeg',
            size: validPng.length,
            buffer: validPng,
          },
          { expectedVersion: 1 },
        ),
      ).rejects.toThrow(UnsupportedMediaTypeException);

      expect(mockStorage.uploadPublicAsset).not.toHaveBeenCalled();
    });

    it('rejects a stale version before uploading', async () => {
      await expect(
        service.uploadAvatar(
          'user-cand-1',
          {
            originalname: 'avatar.png',
            mimetype: 'image/png',
            size: validPng.length,
            buffer: validPng,
          },
          { expectedVersion: 2 },
        ),
      ).rejects.toThrow(ConflictException);

      expect(mockStorage.uploadPublicAsset).not.toHaveBeenCalled();
    });
  });
});
