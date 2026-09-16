import { JobsService } from '../../src/jobs/jobs.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';

describe('JobsService Lifecycle (BE-3-001 to BE-3-008, BE-3-021)', () => {
  let service: JobsService;
  let mockPrisma: any;
  let mockScopeService: any;
  let mockAuditService: any;
  let mockOutboxService: any;

  const hrUser: AuthenticatedUser = {
    id: 'user-hr-1',
    email: 'hr@techcorp.vn',
    role: 'HR',
    status: 'ACTIVE',
  };

  const adminUser: AuthenticatedUser = {
    id: 'user-admin-1',
    email: 'admin@itziec.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  const activeCompany = {
    id: 'comp-1',
    slug: 'techcorp',
    name: 'TechCorp',
    status: 'ACTIVE',
    logoUrl: null,
  };

  const futureDate = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const pastDate = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((fn: any) => fn(mockPrisma)),
      job: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      companyMembership: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ userId: 'owner-user-1' }]),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    mockScopeService = {
      assertMemberOrAdmin: jest.fn().mockResolvedValue(activeCompany),
      assertMemberOrAdminReadOnly: jest.fn().mockResolvedValue(activeCompany),
      assertMemberOrAdminWithRole: jest
        .fn()
        .mockResolvedValue({ company: activeCompany, role: 'OWNER' }),
      assertOwnerOrAdmin: jest.fn().mockResolvedValue(activeCompany),
    };
    mockAuditService = {
      record: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    mockOutboxService = {
      recordEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
    };

    service = new JobsService(mockPrisma, mockScopeService, mockAuditService, mockOutboxService);
  });

  describe('createDraftJob (BE-3-002)', () => {
    it('creates a draft job with valid data and records audit', async () => {
      const dto = {
        title: 'Senior Backend Engineer',
        description: 'Design robust APIs',
        requirements: '3+ years experience with NestJS',
        technologyNames: ['Node.js', 'NestJS'],
        location: 'Ho Chi Minh',
        workplaceType: 'HYBRID' as const,
        experienceLevel: 'SENIOR' as const,
        employmentType: 'FULL_TIME' as const,
        salaryMin: 25000000,
        salaryMax: 40000000,
        currency: 'VND',
        applicationDeadline: futureDate,
      };

      mockPrisma.job.create.mockImplementation((args: any) => ({
        id: 'job-1',
        ...args.data,
        company: activeCompany,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const result = await service.createDraftJob('comp-1', hrUser, dto);

      expect(result).toBeDefined();
      expect(result.creatorId).toBe('user-hr-1');
      expect(result.status).toBe('DRAFT');
      expect(result.version).toBe(1);
      expect(result.slug).toContain('senior-backend-engineer');
      expect(mockPrisma.job.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ creatorId: 'user-hr-1' }),
        }),
      );
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'JOB_CREATED', targetId: 'job-1' }),
      );
    });

    it('rejects creation when salaryMin > salaryMax (JOB-006)', async () => {
      const dto = {
        title: 'Backend Engineer',
        description: 'Desc',
        requirements: 'Reqs',
        technologyNames: ['Node.js'],
        location: 'HCM',
        workplaceType: 'ONSITE' as const,
        experienceLevel: 'MID' as const,
        employmentType: 'FULL_TIME' as const,
        salaryMin: 50000000,
        salaryMax: 30000000,
        currency: 'VND',
        applicationDeadline: futureDate,
      };

      await expect(service.createDraftJob('comp-1', hrUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects creation when applicationDeadline is in the past', async () => {
      const dto = {
        title: 'Backend Engineer',
        description: 'Desc',
        requirements: 'Reqs',
        technologyNames: ['Node.js'],
        location: 'HCM',
        workplaceType: 'ONSITE' as const,
        experienceLevel: 'MID' as const,
        employmentType: 'FULL_TIME' as const,
        currency: 'VND',
        applicationDeadline: pastDate,
      };

      await expect(service.createDraftJob('comp-1', hrUser, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getJobDetail projections (BE-3-003)', () => {
    it('returns open published job for public guest without auth', async () => {
      const publishedJob = {
        id: 'job-1',
        slug: 'senior-dev',
        title: 'Senior Dev',
        description: 'Desc',
        requirements: 'Reqs',
        location: 'HCM',
        technologyNames: ['Node'],
        status: 'PUBLISHED',
        applicationDeadline: new Date(Date.now() + 86400000),
        company: activeCompany,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.job.findFirst.mockResolvedValue(publishedJob);

      const result = await service.getJobDetail('senior-dev');
      expect(result).toBeDefined();
      expect(result.id).toBe('job-1');
    });

    it('returns 404 for public guest when job is in DRAFT to avoid existence leak', async () => {
      const draftJob = {
        id: 'job-1',
        slug: 'draft-job',
        status: 'DRAFT',
        applicationDeadline: new Date(Date.now() + 86400000),
        company: activeCompany,
      };
      mockPrisma.job.findFirst.mockResolvedValue(draftJob);

      await expect(service.getJobDetail('draft-job')).rejects.toThrow(NotFoundException);
    });

    it('allows scoped HR of the same company to read their draft job', async () => {
      const draftJob = {
        id: 'job-1',
        companyId: 'comp-1',
        status: 'DRAFT',
        applicationDeadline: new Date(Date.now() + 86400000),
        company: activeCompany,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.job.findFirst.mockResolvedValue(draftJob);
      mockPrisma.companyMembership.findUnique.mockResolvedValue({ role: 'RECRUITER' });

      const result = await service.getJobDetail('job-1', hrUser);
      expect(result).toBeDefined();
    });
  });

  describe('updateJob & version conflict (BE-3-004)', () => {
    it('updates draft job with expectedVersion and increments version', async () => {
      const existingJob = {
        id: 'job-1',
        companyId: 'comp-1',
        title: 'Old Title',
        status: 'DRAFT',
        version: 1,
        applicationDeadline: new Date(Date.now() + 86400000),
        company: activeCompany,
      };
      mockPrisma.job.findUnique.mockResolvedValue(existingJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...existingJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.updateJob('job-1', hrUser, {
        title: 'New Title',
        expectedVersion: 1,
      });

      expect(result.title).toBe('New Title');
      expect(result.version).toBe(2);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'JOB_UPDATED' }),
      );
    });

    it('rejects update with 409 VERSION_CONFLICT if expectedVersion does not match', async () => {
      const existingJob = {
        id: 'job-1',
        companyId: 'comp-1',
        status: 'DRAFT',
        version: 2,
      };
      mockPrisma.job.findUnique.mockResolvedValue(existingJob);

      await expect(
        service.updateJob('job-1', hrUser, {
          title: 'New Title',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects update on a CLOSED job with 409 JOB_NOT_OPEN', async () => {
      const closedJob = {
        id: 'job-1',
        companyId: 'comp-1',
        status: 'CLOSED',
        version: 1,
      };
      mockPrisma.job.findUnique.mockResolvedValue(closedJob);

      await expect(
        service.updateJob('job-1', hrUser, {
          title: 'New Title',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('publish eligibility and publish action (BE-3-005, BE-3-006)', () => {
    const validDraftJob = {
      id: 'job-1',
      companyId: 'comp-1',
      title: 'Senior Backend Engineer',
      description: 'Solid description',
      requirements: 'Solid requirements',
      location: 'HCM',
      technologyNames: ['Node.js'],
      status: 'DRAFT',
      version: 1,
      applicationDeadline: new Date(Date.now() + 86400000),
      company: activeCompany,
    };

    it('successfully publishes an eligible draft job when caller is OWNER', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'OWNER',
      });
      mockPrisma.job.findUnique.mockResolvedValue(validDraftJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...validDraftJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.publishJob('job-1', hrUser, { expectedVersion: 1 });
      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeDefined();
      expect(result.version).toBe(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'JOB_PUBLISHED' }),
        }),
      );
      expect(mockOutboxService.recordEvent).not.toHaveBeenCalled();
    });

    it('transitions to PENDING_APPROVAL and records JobPendingApproval outbox event when caller is RECRUITER (BE-11-003, BE-14-001)', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'RECRUITER',
      });
      mockPrisma.job.findUnique.mockResolvedValue(validDraftJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...validDraftJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.publishJob('job-1', hrUser, { expectedVersion: 1 });
      expect(result.status).toBe('PENDING_APPROVAL');
      expect(result.publishedAt).toBeNull();
      expect(result.version).toBe(2);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'JOB_PENDING_APPROVAL' }),
        }),
      );
      expect(mockOutboxService.recordEvent).toHaveBeenCalledWith(
        mockPrisma,
        expect.objectContaining({
          eventName: 'JobPendingApproval',
          aggregateType: 'Job',
          aggregateId: 'job-1',
          actorId: hrUser.id,
          payload: expect.objectContaining({
            jobId: 'job-1',
            jobTitle: 'Senior Backend Engineer',
            companyId: 'comp-1',
            requesterUserId: hrUser.id,
            ownerUserIds: ['owner-user-1'],
            jobVersion: 2,
          }),
        }),
      );
    });

    it('rejects recruiter publishing when company has no active owners (BE-14-001)', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'RECRUITER',
      });
      mockPrisma.job.findUnique.mockResolvedValue(validDraftJob);
      mockPrisma.companyMembership.findMany.mockResolvedValue([]);

      await expect(service.publishJob('job-1', hrUser, { expectedVersion: 1 })).rejects.toThrow(
        BadRequestException,
      );
      expect(mockOutboxService.recordEvent).not.toHaveBeenCalled();
    });

    it('rejects recruiter publishing when job is already PENDING_APPROVAL (BE-11-003)', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'RECRUITER',
      });
      mockPrisma.job.findUnique.mockResolvedValue({
        ...validDraftJob,
        status: 'PENDING_APPROVAL',
      });

      await expect(service.publishJob('job-1', hrUser, { expectedVersion: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects publishing if deadline has already passed', async () => {
      const expiredJob = {
        ...validDraftJob,
        applicationDeadline: new Date(Date.now() - 1000),
      };
      mockPrisma.job.findUnique.mockResolvedValue(expiredJob);

      await expect(service.publishJob('job-1', hrUser, { expectedVersion: 1 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects publishing if company is suspended', async () => {
      const suspendedJob = {
        ...validDraftJob,
        company: { ...activeCompany, status: 'SUSPENDED' },
      };
      mockPrisma.job.findUnique.mockResolvedValue(suspendedJob);

      await expect(service.publishJob('job-1', hrUser, { expectedVersion: 1 })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('unpublish and close actions (BE-3-007, BE-3-008)', () => {
    it('unpublishes a published job successfully', async () => {
      const publishedJob = {
        id: 'job-1',
        companyId: 'comp-1',
        status: 'PUBLISHED',
        version: 2,
        company: activeCompany,
      };
      mockPrisma.job.findUnique.mockResolvedValue(publishedJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...publishedJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.unpublishJob('job-1', hrUser, { expectedVersion: 2 });
      expect(result.status).toBe('UNPUBLISHED');
      expect(result.version).toBe(3);
    });

    it('closes an open job with a reason and terminal status', async () => {
      const publishedJob = {
        id: 'job-1',
        companyId: 'comp-1',
        status: 'PUBLISHED',
        version: 2,
        company: activeCompany,
      };
      mockPrisma.job.findUnique.mockResolvedValue(publishedJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...publishedJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.closeJob('job-1', hrUser, {
        expectedVersion: 2,
        reason: 'Hired ideal candidate',
      });
      expect(result.status).toBe('CLOSED');
      expect(result.closedAt).toBeDefined();
    });
  });

  describe('admin moderation hooks (BE-3-021)', () => {
    it('allows administrator to moderate (close) a job with reason', async () => {
      const openJob = {
        id: 'job-1',
        status: 'PUBLISHED',
        version: 1,
        company: activeCompany,
      };
      mockPrisma.job.findUnique.mockResolvedValue(openJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...openJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.moderateJob('job-1', adminUser, {
        action: 'CLOSE',
        expectedVersion: 1,
        reason: 'Violated terms of service',
      });

      expect(result.status).toBe('CLOSED');
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'JOB_MODERATED_CLOSE' }),
      );
    });

    it('rejects moderation by non-admin user', async () => {
      await expect(
        service.moderateJob('job-1', hrUser, {
          action: 'CLOSE',
          expectedVersion: 1,
          reason: 'Attempt',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listCompanyJobs scoping (BE-11-002)', () => {
    it('scopes query to creatorId when caller is RECRUITER', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'RECRUITER',
      });
      mockPrisma.job.findMany = jest.fn().mockResolvedValue([]);

      await service.listCompanyJobs('comp-1', hrUser, {});

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            creatorId: hrUser.id,
          }),
        }),
      );
    });

    it('does NOT scope query to creatorId when caller is OWNER', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'OWNER',
      });
      mockPrisma.job.findMany = jest.fn().mockResolvedValue([]);

      await service.listCompanyJobs('comp-1', hrUser, {});

      const callArgs = mockPrisma.job.findMany.mock.calls[0][0];
      expect(callArgs.where.companyId).toBe('comp-1');
      expect(callArgs.where.creatorId).toBeUndefined();
    });

    it('does NOT scope query to creatorId when caller is ADMIN', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'ADMIN',
      });
      mockPrisma.job.findMany = jest.fn().mockResolvedValue([]);

      await service.listCompanyJobs('comp-1', adminUser, {});

      const callArgs = mockPrisma.job.findMany.mock.calls[0][0];
      expect(callArgs.where.companyId).toBe('comp-1');
      expect(callArgs.where.creatorId).toBeUndefined();
    });
  });

  describe('approveJob (BE-11-003)', () => {
    const pendingJob = {
      id: 'job-pending-1',
      companyId: 'comp-1',
      title: 'Senior DevOps Engineer',
      description: 'Kubernetes and CI/CD',
      requirements: 'AWS, Terraform',
      location: 'HN',
      technologyNames: ['Kubernetes', 'AWS'],
      status: 'PENDING_APPROVAL',
      version: 2,
      applicationDeadline: new Date(Date.now() + 86400000 * 10),
      company: activeCompany,
    };

    it('successfully approves a PENDING_APPROVAL job by company OWNER', async () => {
      mockScopeService.assertOwnerOrAdmin.mockResolvedValue(activeCompany);
      mockPrisma.job.findUnique.mockResolvedValue(pendingJob);
      mockPrisma.job.update.mockImplementation((args: any) => ({
        ...pendingJob,
        ...args.data,
        company: activeCompany,
      }));

      const result = await service.approveJob('comp-1', 'job-pending-1', hrUser, {
        expectedVersion: 2,
      });

      expect(result.status).toBe('PUBLISHED');
      expect(result.publishedAt).toBeDefined();
      expect(result.version).toBe(3);
      expect(mockAuditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'JOB_APPROVED' }),
      );
    });

    it('rejects approval when job is in DRAFT instead of PENDING_APPROVAL', async () => {
      mockScopeService.assertOwnerOrAdmin.mockResolvedValue(activeCompany);
      mockPrisma.job.findUnique.mockResolvedValue({
        ...pendingJob,
        status: 'DRAFT',
      });

      await expect(
        service.approveJob('comp-1', 'job-pending-1', hrUser, { expectedVersion: 2 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects approval with 409 VERSION_CONFLICT if expectedVersion does not match', async () => {
      mockScopeService.assertOwnerOrAdmin.mockResolvedValue(activeCompany);
      mockPrisma.job.findUnique.mockResolvedValue(pendingJob);

      await expect(
        service.approveJob('comp-1', 'job-pending-1', hrUser, { expectedVersion: 1 }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects approval with 404 if job does not belong to path company', async () => {
      mockScopeService.assertOwnerOrAdmin.mockResolvedValue(activeCompany);
      mockPrisma.job.findUnique.mockResolvedValue({
        ...pendingJob,
        companyId: 'comp-other',
      });

      await expect(
        service.approveJob('comp-1', 'job-pending-1', hrUser, { expectedVersion: 2 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Company Job Creator Identity Projection (BE-18-001)', () => {
    const baseJob: any = {
      id: 'job-18-1',
      companyId: 'comp-1',
      creatorId: 'user-hr-1',
      title: 'Senior Backend Engineer',
      slug: 'senior-backend-engineer',
      description: 'Desc',
      requirements: 'Reqs',
      responsibilities: null,
      technologyNames: ['NestJS', 'PostgreSQL'],
      location: 'HCM',
      workplaceType: 'HYBRID',
      experienceLevel: 'SENIOR',
      employmentType: 'FULL_TIME',
      salaryMin: 25000000,
      salaryMax: 40000000,
      currency: 'VND',
      applicationDeadline: new Date(Date.now() + 86400000 * 10),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      closedAt: null,
      isHot: false,
      benefits: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      company: activeCompany,
    };

    it('projects creatorName "firstName lastName" and creatorEmail when full profile exists', () => {
      const jobWithCreator = {
        ...baseJob,
        creator: {
          email: 'recruiter@techcorp.vn',
          hrProfile: {
            firstName: '  Nguyen  ',
            lastName: '  Van A  ',
          },
        },
      };

      const dto = service.mapToDto(jobWithCreator, { includeCreator: true });
      expect(dto.creatorName).toBe('Nguyen Van A');
      expect(dto.creatorEmail).toBe('recruiter@techcorp.vn');
      expect(dto.creatorId).toBe('user-hr-1');
    });

    it('trims and handles single name parts correctly', () => {
      // Only firstName
      const jobFirstNameOnly = {
        ...baseJob,
        creator: {
          email: 'first@techcorp.vn',
          hrProfile: {
            firstName: '  Nguyen  ',
            lastName: '   ',
          },
        },
      };
      const dtoFirst = service.mapToDto(jobFirstNameOnly, { includeCreator: true });
      expect(dtoFirst.creatorName).toBe('Nguyen');
      expect(dtoFirst.creatorEmail).toBe('first@techcorp.vn');

      // Only lastName
      const jobLastNameOnly = {
        ...baseJob,
        creator: {
          email: 'last@techcorp.vn',
          hrProfile: {
            firstName: null,
            lastName: '  Tran  ',
          },
        },
      };
      const dtoLast = service.mapToDto(jobLastNameOnly, { includeCreator: true });
      expect(dtoLast.creatorName).toBe('Tran');
      expect(dtoLast.creatorEmail).toBe('last@techcorp.vn');
    });

    it('returns creatorName: null but preserves creatorEmail when HR profile has empty names or creator has no profile', () => {
      // Empty names in profile
      const jobEmptyProfile = {
        ...baseJob,
        creator: {
          email: 'noname@techcorp.vn',
          hrProfile: {
            firstName: '   ',
            lastName: '',
          },
        },
      };
      const dtoEmpty = service.mapToDto(jobEmptyProfile, { includeCreator: true });
      expect(dtoEmpty.creatorName).toBeNull();
      expect(dtoEmpty.creatorEmail).toBe('noname@techcorp.vn');

      // No hrProfile (e.g. Admin creator)
      const jobNoProfile = {
        ...baseJob,
        creator: {
          email: 'admin@itziec.com',
          hrProfile: null,
        },
      };
      const dtoNoProfile = service.mapToDto(jobNoProfile, { includeCreator: true });
      expect(dtoNoProfile.creatorName).toBeNull();
      expect(dtoNoProfile.creatorEmail).toBe('admin@itziec.com');
    });

    it('returns null for both creatorName and creatorEmail on legacy job or deleted creator', () => {
      const legacyJob = {
        ...baseJob,
        creatorId: null,
        creator: null,
      };
      const dto = service.mapToDto(legacyJob, { includeCreator: true });
      expect(dto.creatorId).toBeNull();
      expect(dto.creatorName).toBeNull();
      expect(dto.creatorEmail).toBeNull();
    });

    it('isolates PII: returns null for creatorName and creatorEmail when includeCreator is false/omitted', () => {
      const jobWithCreator = {
        ...baseJob,
        creator: {
          email: 'recruiter@techcorp.vn',
          hrProfile: {
            firstName: 'Nguyen',
            lastName: 'Van A',
          },
        },
      };

      const dto = service.mapToDto(jobWithCreator);
      expect(dto.creatorName).toBeNull();
      expect(dto.creatorEmail).toBeNull();
    });

    it('listCompanyJobs passes relation select without passwordHash/phone and projects identity', async () => {
      mockScopeService.assertMemberOrAdminWithRole.mockResolvedValue({
        company: activeCompany,
        role: 'OWNER',
      });
      const dbJob = {
        ...baseJob,
        creator: {
          email: 'owner@techcorp.vn',
          hrProfile: {
            firstName: 'Le',
            lastName: 'Owner',
          },
        },
      };
      mockPrisma.job.findMany = jest.fn().mockResolvedValue([dbJob]);

      const result = await service.listCompanyJobs('comp-1', hrUser, {});

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            company: true,
            creator: {
              select: {
                email: true,
                hrProfile: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          }),
        }),
      );

      expect(result.data.length).toBe(1);
      expect(result.data[0].creatorName).toBe('Le Owner');
      expect(result.data[0].creatorEmail).toBe('owner@techcorp.vn');
    });
  });
});
