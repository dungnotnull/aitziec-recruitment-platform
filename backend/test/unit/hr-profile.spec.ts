import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { HrService } from '../../src/hr/hr.service';
import { PrismaService } from '../../src/database/prisma.service';
import { AuditService } from '../../src/audit/audit.service';
import { ERROR_CODES } from '../../src/common/constants/error-codes';

describe('HrService (Unit)', () => {
  let service: HrService;
  let prisma: Record<string, any>;
  let auditService: Record<string, any>;

  const mockHrUser = {
    id: 'hr-user-uuid',
    email: 'hr@itziec.com',
    role: 'HR',
    status: 'ACTIVE',
  };

  const mockCandidateUser = {
    id: 'candidate-user-uuid',
    email: 'candidate@itziec.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const mockExistingProfile = {
    id: 'profile-uuid',
    userId: 'hr-user-uuid',
    firstName: 'Jane',
    lastName: 'Smith',
    avatarUrl: 'https://cdn.itziec.com/avatars/hr.png',
    phone: '+84987654321',
    version: 1,
    createdAt: new Date('2026-09-14T08:00:00.000Z'),
    updatedAt: new Date('2026-09-14T08:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      hrProfile: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    auditService = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HrService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<HrService>(HrService);
  });

  describe('getProfile', () => {
    it('returns existing HR profile mapped to DTO', async () => {
      prisma.hrProfile.findUnique.mockResolvedValue(mockExistingProfile);

      const result = await service.getProfile(mockHrUser.id);

      expect(result).toEqual({
        id: 'profile-uuid',
        userId: 'hr-user-uuid',
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: 'https://cdn.itziec.com/avatars/hr.png',
        phone: '+84987654321',
        version: 1,
        createdAt: '2026-09-14T08:00:00.000Z',
        updatedAt: '2026-09-14T08:00:00.000Z',
      });
      expect(prisma.hrProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockHrUser.id },
      });
    });

    it('safely backfills on-the-fly when HR profile is missing for a legacy HR account', async () => {
      prisma.hrProfile.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockHrUser);
      const createdBackfill = {
        id: 'new-profile-uuid',
        userId: mockHrUser.id,
        firstName: null,
        lastName: null,
        avatarUrl: null,
        phone: null,
        version: 1,
        createdAt: new Date('2026-09-14T08:00:00.000Z'),
        updatedAt: new Date('2026-09-14T08:00:00.000Z'),
      };
      prisma.hrProfile.create.mockResolvedValue(createdBackfill);

      const result = await service.getProfile(mockHrUser.id);

      expect(result.id).toBe('new-profile-uuid');
      expect(result.userId).toBe(mockHrUser.id);
      expect(result.version).toBe(1);
      expect(prisma.hrProfile.create).toHaveBeenCalledWith({
        data: { userId: mockHrUser.id, version: 1 },
      });
    });

    it('throws 404 RESOURCE_NOT_FOUND when user does not exist or is not HR', async () => {
      prisma.hrProfile.findUnique.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(mockCandidateUser);

      await expect(service.getProfile(mockCandidateUser.id)).rejects.toThrow(NotFoundException);
      try {
        await service.getProfile(mockCandidateUser.id);
      } catch (err: any) {
        expect(err.getResponse().code).toBe(ERROR_CODES.RESOURCE_NOT_FOUND);
      }
    });
  });

  describe('updateProfile', () => {
    it('updates whitelisted personal fields, increments version, and writes safe audit log', async () => {
      prisma.hrProfile.findUnique.mockResolvedValue(mockExistingProfile);
      const updatedProfile = {
        ...mockExistingProfile,
        firstName: 'Alice',
        lastName: 'Wonderland',
        phone: '+84912345678',
        version: 2,
        updatedAt: new Date('2026-09-14T09:00:00.000Z'),
      };
      prisma.hrProfile.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(mockHrUser.id, {
        firstName: 'Alice',
        lastName: 'Wonderland',
        phone: '+84912345678',
        expectedVersion: 1,
      });

      expect(result.firstName).toBe('Alice');
      expect(result.lastName).toBe('Wonderland');
      expect(result.phone).toBe('+84912345678');
      expect(result.version).toBe(2);

      expect(prisma.hrProfile.update).toHaveBeenCalledWith({
        where: { id: mockExistingProfile.id },
        data: {
          firstName: 'Alice',
          lastName: 'Wonderland',
          phone: '+84912345678',
          version: { increment: 1 },
        },
      });

      // Assert audit log was recorded without PII
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockHrUser.id,
          action: 'HR_PROFILE_UPDATED',
          targetType: 'HrProfile',
          targetId: mockExistingProfile.id,
          metadata: {
            version: 2,
            changedFields: ['firstName', 'lastName', 'phone'],
          },
        }),
        prisma,
      );
    });

    it('rejects stale expectedVersion with 409 VERSION_CONFLICT', async () => {
      prisma.hrProfile.findUnique.mockResolvedValue(mockExistingProfile); // version = 1

      await expect(
        service.updateProfile(mockHrUser.id, {
          firstName: 'Alice',
          expectedVersion: 0, // stale version
        }),
      ).rejects.toThrow(ConflictException);

      try {
        await service.updateProfile(mockHrUser.id, {
          firstName: 'Alice',
          expectedVersion: 99,
        });
      } catch (err: any) {
        expect(err.getResponse().code).toBe(ERROR_CODES.VERSION_CONFLICT);
      }

      expect(prisma.hrProfile.update).not.toHaveBeenCalled();
    });
  });

  describe('listInvitations', () => {
    const mockUser = {
      id: 'hr-user-uuid',
      email: 'hr@itziec.com',
      role: 'HR',
    };

    const mockCompany = {
      id: 'comp-1',
      slug: 'techcorp',
      name: 'TechCorp',
      logoUrl: 'https://cdn.itziec.com/logo.png',
    };

    const mockInvitations = [
      {
        id: 'inv-1',
        companyId: 'comp-1',
        company: mockCompany,
        email: 'hr@itziec.com',
        role: 'RECRUITER',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date('2026-09-14T08:00:00.000Z'),
      },
    ];

    it('returns pending unexpired invitations for authenticated HR email', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.companyInvitation = {
        findMany: jest.fn().mockResolvedValue(mockInvitations),
      };

      const result = await service.listInvitations(
        { id: mockUser.id, email: mockUser.email, role: 'HR', status: 'ACTIVE' },
        { limit: 20 },
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('inv-1');
      expect(result.data[0].company.slug).toBe('techcorp');
      expect(result.data[0].role).toBe('RECRUITER');
      expect(result.data[0].status).toBe('PENDING');
      expect(result.meta.page.hasNextPage).toBe(false);
      expect(result.meta.page.nextCursor).toBeNull();
    });

    it('rejects malformed cursor with 400 INVALID_CURSOR', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.listInvitations(
          { id: mockUser.id, email: mockUser.email, role: 'HR', status: 'ACTIVE' },
          { cursor: 'not-valid-base64-json' },
        ),
      ).rejects.toThrow();
    });

    it('returns empty collection when no invitations exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.companyInvitation = {
        findMany: jest.fn().mockResolvedValue([]),
      };

      const result = await service.listInvitations(
        { id: mockUser.id, email: mockUser.email, role: 'HR', status: 'ACTIVE' },
        { limit: 20 },
      );

      expect(result.data).toEqual([]);
      expect(result.meta.page.hasNextPage).toBe(false);
      expect(result.meta.page.nextCursor).toBeNull();
    });
  });
});
