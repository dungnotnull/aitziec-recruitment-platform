import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from '../../src/admin/admin.service';
import { PrismaService } from '../../src/database/prisma.service';
import { AuditService } from '../../src/audit/audit.service';
import { CompaniesService } from '../../src/companies/companies.service';
import { JobsService } from '../../src/jobs/jobs.service';
import { ApplicationsService } from '../../src/applications/applications.service';
import { OutboxService } from '../../src/outbox/outbox.service';
import { ApplicationStatus } from '../../src/applications/dto/application.dto';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { ERROR_CODES } from '../../src/common/constants/error-codes';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';

describe('Admin Collections (Unit - BE-8-013, BE-8-014, BE-8-015)', () => {
  let adminService: AdminService;
  let inMemoryPrisma: InMemoryPrismaService;
  let auditServiceMock: any;
  let outboxServiceMock: any;
  let applicationsServiceMock: any;

  const mockAdminUser: AuthenticatedUser = {
    id: 'admin-uuid-1',
    email: 'admin@itziec.com',
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  function assertNoBannedFields(obj: any) {
    const bannedFields = [
      'rawCv',
      'extractedText',
      'storageKey',
      'objectKey',
      'signedUrl',
      'downloadUrl',
      'email',
      'userEmail',
      'phone',
      'phoneNumber',
      'address',
      'street',
      'candidateAddress',
      'candidateNote',
      'recruiterPrivateNotes',
      'privateNote',
      'recruiterNote',
      'recruiterFeedback',
      'feedback',
      'token',
      'tokenHash',
      'passwordHash',
      'secret',
    ];

    function check(value: any, path: string = '') {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach((item, idx) => check(item, `${path}[${idx}]`));
        return;
      }
      for (const key of Object.keys(value)) {
        const currentPath = path ? `${path}.${key}` : key;
        expect(bannedFields).not.toContain(key);
        if (typeof value[key] === 'object' && value[key] !== null) {
          check(value[key], currentPath);
        }
      }
    }

    check(obj);
  }

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();
    inMemoryPrisma.reset();

    auditServiceMock = { record: jest.fn().mockResolvedValue({}) };
    outboxServiceMock = { recordEvent: jest.fn().mockResolvedValue({}) };
    applicationsServiceMock = {
      validateStatusTransition: jest.fn((current: ApplicationStatus, target: ApplicationStatus) => {
        if (current === 'PASSED' || current === 'REJECTED' || current === target) {
          throw new ConflictException({
            code: ERROR_CODES.INVALID_APPLICATION_TRANSITION,
            message: 'Invalid transition',
          });
        }
        const allowed: Record<string, string[]> = {
          APPLIED: ['REVIEWING'],
          REVIEWING: ['INTERVIEWING'],
          INTERVIEWING: ['PASSED', 'REJECTED'],
        };
        if (!allowed[current]?.includes(target)) {
          throw new ConflictException({
            code: ERROR_CODES.INVALID_APPLICATION_TRANSITION,
            message: 'Invalid transition',
          });
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: inMemoryPrisma,
        },
        {
          provide: AuditService,
          useValue: auditServiceMock,
        },
        {
          provide: CompaniesService,
          useValue: {},
        },
        {
          provide: JobsService,
          useValue: {},
        },
        {
          provide: ApplicationsService,
          useValue: applicationsServiceMock,
        },
        {
          provide: OutboxService,
          useValue: outboxServiceMock,
        },
      ],
    }).compile();

    adminService = module.get<AdminService>(AdminService);
  });

  describe('listCompanies', () => {
    it('returns empty collection when no companies exist', async () => {
      const res = await adminService.listCompanies({});
      expect(res.data).toEqual([]);
      expect(res.meta.page.hasNextPage).toBe(false);
      expect(res.meta.page.nextCursor).toBeNull();
    });

    it('filters companies by status and searches by name/slug', async () => {
      const comp1 = await inMemoryPrisma.company.create({
        data: {
          id: 'c1',
          name: 'Acme Corporation',
          slug: 'acme-corp',
          status: 'ACTIVE',
        },
      });

      await inMemoryPrisma.company.create({
        data: {
          id: 'c2',
          name: 'Beta Global',
          slug: 'beta-global',
          status: 'SUSPENDED',
        },
      });

      // Filter by ACTIVE
      const activeRes = await adminService.listCompanies({ status: 'ACTIVE' });
      expect(activeRes.data.length).toBe(1);
      expect(activeRes.data[0].id).toBe(comp1.id);
      expect(activeRes.data[0].version).toBeDefined();

      // Search by name (case-insensitive)
      const searchRes = await adminService.listCompanies({ search: 'acme' });
      expect(searchRes.data.length).toBe(1);
      expect(searchRes.data[0].name).toBe('Acme Corporation');

      // Search by slug
      const slugRes = await adminService.listCompanies({ search: 'beta-global' });
      expect(slugRes.data.length).toBe(1);
      expect(slugRes.data[0].status).toBe('SUSPENDED');
    });

    it('paginates companies with limit and cursor', async () => {
      for (let i = 1; i <= 5; i++) {
        await inMemoryPrisma.company.create({
          data: {
            id: `comp-page-${i}`,
            name: `Company ${i}`,
            slug: `company-${i}`,
            status: 'ACTIVE',
          },
        });
      }

      const page1 = await adminService.listCompanies({ limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.meta.page.hasNextPage).toBe(true);
      expect(page1.meta.page.nextCursor).toBeDefined();

      const page2 = await adminService.listCompanies({
        limit: 2,
        cursor: page1.meta.page.nextCursor!,
      });
      expect(page2.data.length).toBe(2);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);
    });
  });

  describe('listJobs', () => {
    it('returns empty collection when no jobs exist', async () => {
      const res = await adminService.listJobs({});
      expect(res.data).toEqual([]);
      expect(res.meta.page.hasNextPage).toBe(false);
      expect(res.meta.page.nextCursor).toBeNull();
    });

    it('filters jobs across lifecycle states, companies and experience levels', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: { id: 'comp-job-1', name: 'Ziec Corp', slug: 'ziec-corp', status: 'ACTIVE' },
      });

      const draftJob = await inMemoryPrisma.job.create({
        data: {
          id: 'j1',
          companyId: comp.id,
          title: 'Draft Node Engineer',
          slug: 'draft-node-engineer',
          description: 'Desc',
          requirements: 'Reqs',
          status: 'DRAFT',
          workplaceType: 'REMOTE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const publishedJob = await inMemoryPrisma.job.create({
        data: {
          id: 'j2',
          companyId: comp.id,
          title: 'Published Frontend Dev',
          slug: 'published-frontend-dev',
          description: 'Desc',
          requirements: 'Reqs',
          status: 'PUBLISHED',
          workplaceType: 'ONSITE',
          experienceLevel: 'FRESHER',
          employmentType: 'FULL_TIME',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      // Admin sees DRAFT jobs
      const draftRes = await adminService.listJobs({ status: 'DRAFT' });
      expect(draftRes.data.length).toBe(1);
      expect(draftRes.data[0].id).toBe(draftJob.id);
      expect(draftRes.data[0].company.name).toBe('Ziec Corp');
      expect(draftRes.data[0].version).toBeDefined();

      // Filter by experience level FRESHER
      const fresherRes = await adminService.listJobs({ experienceLevel: 'FRESHER' });
      expect(fresherRes.data.length).toBe(1);
      expect(fresherRes.data[0].id).toBe(publishedJob.id);

      // Search by title
      const searchRes = await adminService.listJobs({ search: 'frontend' });
      expect(searchRes.data.length).toBe(1);
      expect(searchRes.data[0].id).toBe(publishedJob.id);

      // Search by company name
      const compSearchRes = await adminService.listJobs({ search: 'Ziec' });
      expect(compSearchRes.data.length).toBe(2);
    });
  });

  describe('listApplications (BE-8-014)', () => {
    it('returns empty collection when no applications exist', async () => {
      const res = await adminService.listApplications({});
      expect(res.data).toEqual([]);
      expect(res.meta.page.hasNextPage).toBe(false);
      expect(res.meta.page.nextCursor).toBeNull();
    });

    it('filters applications across active and suspended companies, status, and search with safe redaction', async () => {
      const compActive = await inMemoryPrisma.company.create({
        data: { id: 'c-act', name: 'Active Corp', slug: 'active-corp', status: 'ACTIVE' },
      });
      const compSuspended = await inMemoryPrisma.company.create({
        data: { id: 'c-susp', name: 'Suspended Inc', slug: 'suspended-inc', status: 'SUSPENDED' },
      });

      const candUser1 = await inMemoryPrisma.user.create({
        data: { id: 'u-c1', email: 'alice@candidate.com', role: 'CANDIDATE' },
      });
      const cand1 = await inMemoryPrisma.candidateProfile.create({
        data: {
          id: 'cand-1',
          userId: candUser1.id,
          fullName: 'Alice Nguyen',
          headline: 'Senior Backend Engineer',
          phone: '+84901234567',
        },
      });

      const candUser2 = await inMemoryPrisma.user.create({
        data: { id: 'u-c2', email: 'bob@candidate.com', role: 'CANDIDATE' },
      });
      const cand2 = await inMemoryPrisma.candidateProfile.create({
        data: {
          id: 'cand-2',
          userId: candUser2.id,
          fullName: 'Bob Tran',
          headline: 'Product Designer',
          phone: '+84909876543',
        },
      });

      const job1 = await inMemoryPrisma.job.create({
        data: {
          id: 'j-act-1',
          companyId: compActive.id,
          title: 'Staff Platform Engineer',
          slug: 'staff-platform-engineer',
          status: 'PUBLISHED',
          workplaceType: 'REMOTE',
          experienceLevel: 'LEAD',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const job2 = await inMemoryPrisma.job.create({
        data: {
          id: 'j-susp-2',
          companyId: compSuspended.id,
          title: 'UI/UX Specialist',
          slug: 'ui-ux-specialist',
          status: 'PUBLISHED',
          workplaceType: 'ONSITE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const app1 = await inMemoryPrisma.application.create({
        data: {
          id: 'app-1',
          candidateId: cand1.id,
          jobId: job1.id,
          submittedCvId: 'cv-1',
          status: 'APPLIED',
          candidateNote: 'Private candidate motivation note',
          version: 1,
        },
      });

      const app2 = await inMemoryPrisma.application.create({
        data: {
          id: 'app-2',
          candidateId: cand2.id,
          jobId: job2.id,
          submittedCvId: 'cv-2',
          status: 'REVIEWING',
          candidateNote: 'Another private candidate note',
          version: 1,
        },
      });

      // Admin sees application from SUSPENDED company
      const allRes = await adminService.listApplications({});
      expect(allRes.data.length).toBe(2);
      assertNoBannedFields(allRes);

      // Filter by status APPLIED
      const appliedRes = await adminService.listApplications({ status: ApplicationStatus.APPLIED });
      expect(appliedRes.data.length).toBe(1);
      expect(appliedRes.data[0].id).toBe(app1.id);
      expect(appliedRes.data[0].candidate.fullName).toBe('Alice Nguyen');
      expect(appliedRes.data[0].version).toBe(1);
      assertNoBannedFields(appliedRes);

      // Filter by companyId
      const compRes = await adminService.listApplications({ companyId: compSuspended.id });
      expect(compRes.data.length).toBe(1);
      expect(compRes.data[0].id).toBe(app2.id);
      expect(compRes.data[0].company.name).toBe('Suspended Inc');

      // Search by candidate name
      const searchCandRes = await adminService.listApplications({ search: 'Alice' });
      expect(searchCandRes.data.length).toBe(1);
      expect(searchCandRes.data[0].id).toBe(app1.id);

      // Search by job title
      const searchJobRes = await adminService.listApplications({ search: 'UI/UX' });
      expect(searchJobRes.data.length).toBe(1);
      expect(searchJobRes.data[0].id).toBe(app2.id);

      // Search by company name
      const searchCompRes = await adminService.listApplications({ search: 'Suspended' });
      expect(searchCompRes.data.length).toBe(1);
      expect(searchCompRes.data[0].id).toBe(app2.id);

      // Strict check: no banned fields present anywhere in the payload
      assertNoBannedFields(allRes);
    });

    it('paginates applications with cursor and throws 400 on invalid cursor', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: { id: 'c-page', name: 'Page Corp', slug: 'page-corp', status: 'ACTIVE' },
      });
      const candUser = await inMemoryPrisma.user.create({
        data: { id: 'u-page', email: 'page@c.com', role: 'CANDIDATE' },
      });
      const cand = await inMemoryPrisma.candidateProfile.create({
        data: { id: 'cand-page', userId: candUser.id, fullName: 'Page Candidate' },
      });

      for (let i = 1; i <= 3; i++) {
        const pJob = await inMemoryPrisma.job.create({
          data: {
            id: `j-page-${i}`,
            companyId: comp.id,
            title: `Job Page ${i}`,
            slug: `job-page-${i}`,
            status: 'PUBLISHED',
            workplaceType: 'REMOTE',
            experienceLevel: 'JUNIOR',
            employmentType: 'FULL_TIME',
            description: 'Desc',
            requirements: 'Reqs',
            applicationDeadline: new Date(Date.now() + 86400000),
          },
        });

        await inMemoryPrisma.application.create({
          data: {
            id: `app-p-${i}`,
            candidateId: cand.id,
            jobId: pJob.id,
            submittedCvId: `cv-${i}`,
            status: 'APPLIED',
            version: 1,
          },
        });
      }

      const page1 = await adminService.listApplications({ limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.meta.page.hasNextPage).toBe(true);
      expect(page1.meta.page.nextCursor).toBeDefined();

      const page2 = await adminService.listApplications({
        limit: 2,
        cursor: page1.meta.page.nextCursor!,
      });
      expect(page2.data.length).toBe(1);
      expect(page2.data[0].id).not.toBe(page1.data[0].id);

      // Invalid cursor throws BadRequestException with INVALID_CURSOR
      await expect(
        adminService.listApplications({ cursor: '@@not-a-valid-cursor@@' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getApplicationDetail (BE-8-014)', () => {
    it('returns application detail with ordered status history and safe redaction', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: { id: 'c-det', name: 'Detail Corp', slug: 'detail-corp', status: 'ACTIVE' },
      });
      const candUser = await inMemoryPrisma.user.create({
        data: { id: 'u-det', email: 'det@c.com', role: 'CANDIDATE' },
      });
      const cand = await inMemoryPrisma.candidateProfile.create({
        data: {
          id: 'cand-det',
          userId: candUser.id,
          fullName: 'Detail Candidate',
          headline: 'Fullstack Dev',
          phone: '+84911223344',
        },
      });
      const job = await inMemoryPrisma.job.create({
        data: {
          id: 'j-det',
          companyId: comp.id,
          title: 'Detail Job',
          slug: 'detail-job',
          status: 'PUBLISHED',
          workplaceType: 'REMOTE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const app = await inMemoryPrisma.application.create({
        data: {
          id: 'app-det-1',
          candidateId: cand.id,
          jobId: job.id,
          submittedCvId: 'cv-det-1',
          status: 'APPLIED',
          candidateNote: 'Strictly secret candidate note',
          version: 1,
        },
      });

      await inMemoryPrisma.applicationStatusEvent.create({
        data: {
          id: 'evt-1',
          applicationId: app.id,
          fromStatus: null,
          toStatus: 'APPLIED',
          reason: 'Initial submission',
          actorId: candUser.id,
        },
      });

      const detail = await adminService.getApplicationDetail(app.id);
      expect(detail.id).toBe(app.id);
      expect(detail.status).toBe('APPLIED');
      expect(detail.version).toBe(1);
      expect(detail.history.length).toBe(1);
      expect(detail.history[0].toStatus).toBe('APPLIED');
      expect(detail.history[0].actorId).toBe(candUser.id);

      assertNoBannedFields(detail);
    });

    it('throws NotFoundException when application does not exist', async () => {
      await expect(
        adminService.getApplicationDetail('00000000-0000-0000-0000-000000000099'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('moderateApplication (BE-8-015)', () => {
    it('moderates application successfully, updates status/version, records audit and outbox', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: { id: 'c-mod', name: 'Moderate Corp', slug: 'mod-corp', status: 'ACTIVE' },
      });
      const candUser = await inMemoryPrisma.user.create({
        data: { id: 'u-mod', email: 'mod@c.com', role: 'CANDIDATE' },
      });
      const cand = await inMemoryPrisma.candidateProfile.create({
        data: { id: 'cand-mod', userId: candUser.id, fullName: 'Moderate Candidate' },
      });
      const job = await inMemoryPrisma.job.create({
        data: {
          id: 'j-mod',
          companyId: comp.id,
          title: 'Mod Job',
          slug: 'mod-job',
          status: 'PUBLISHED',
          workplaceType: 'REMOTE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const app = await inMemoryPrisma.application.create({
        data: {
          id: 'app-mod-1',
          candidateId: cand.id,
          jobId: job.id,
          submittedCvId: 'cv-mod-1',
          status: 'APPLIED',
          version: 1,
        },
      });

      const result = await adminService.moderateApplication(
        mockAdminUser,
        app.id,
        {
          targetStatus: ApplicationStatus.REVIEWING,
          reason: 'Admin reviewed and approved candidate profile',
          expectedVersion: 1,
        },
        'req-mod-123',
      );

      expect(result.id).toBe(app.id);
      expect(result.status).toBe(ApplicationStatus.REVIEWING);
      expect(result.version).toBe(2);
      expect(result.history.length).toBe(1);
      expect(result.history[0].fromStatus).toBe(ApplicationStatus.APPLIED);
      expect(result.history[0].toStatus).toBe(ApplicationStatus.REVIEWING);
      expect(result.history[0].actorId).toBe(mockAdminUser.id);

      // Audit recorded
      expect(auditServiceMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: mockAdminUser.id,
          action: 'APPLICATION_MODERATED',
          targetType: 'Application',
          targetId: app.id,
          requestId: 'req-mod-123',
          metadata: expect.objectContaining({
            fromStatus: 'APPLIED',
            toStatus: 'REVIEWING',
            expectedVersion: 1,
            newVersion: 2,
          }),
        }),
        expect.anything(),
      );

      // Outbox event recorded
      expect(outboxServiceMock.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventName: 'ApplicationStatusChanged',
          aggregateType: 'Application',
          aggregateId: app.id,
          payload: expect.objectContaining({
            applicationId: app.id,
            fromStatus: 'APPLIED',
            toStatus: 'REVIEWING',
          }),
        }),
      );

      assertNoBannedFields(result);
    });

    it('throws ConflictException on stale version (VERSION_CONFLICT)', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: { id: 'c-stale', name: 'Stale Corp', slug: 'stale-corp', status: 'ACTIVE' },
      });
      const candUser = await inMemoryPrisma.user.create({
        data: { id: 'u-stale', email: 'stale@c.com', role: 'CANDIDATE' },
      });
      const cand = await inMemoryPrisma.candidateProfile.create({
        data: { id: 'cand-stale', userId: candUser.id, fullName: 'Stale Cand' },
      });
      const job = await inMemoryPrisma.job.create({
        data: {
          id: 'j-stale',
          companyId: comp.id,
          title: 'Stale Job',
          slug: 'stale-job',
          status: 'PUBLISHED',
          workplaceType: 'REMOTE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const app = await inMemoryPrisma.application.create({
        data: {
          id: 'app-stale-1',
          candidateId: cand.id,
          jobId: job.id,
          submittedCvId: 'cv-stale-1',
          status: 'APPLIED',
          version: 2,
        },
      });

      await expect(
        adminService.moderateApplication(mockAdminUser, app.id, {
          targetStatus: ApplicationStatus.REVIEWING,
          reason: 'Stale update attempt',
          expectedVersion: 1, // Stale! Current is 2
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on invalid transition (INVALID_APPLICATION_TRANSITION)', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: { id: 'c-inv', name: 'Inv Corp', slug: 'inv-corp', status: 'ACTIVE' },
      });
      const candUser = await inMemoryPrisma.user.create({
        data: { id: 'u-inv', email: 'inv@c.com', role: 'CANDIDATE' },
      });
      const cand = await inMemoryPrisma.candidateProfile.create({
        data: { id: 'cand-inv', userId: candUser.id, fullName: 'Inv Cand' },
      });
      const job = await inMemoryPrisma.job.create({
        data: {
          id: 'j-inv',
          companyId: comp.id,
          title: 'Inv Job',
          slug: 'inv-job',
          status: 'PUBLISHED',
          workplaceType: 'REMOTE',
          experienceLevel: 'SENIOR',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const app = await inMemoryPrisma.application.create({
        data: {
          id: 'app-inv-1',
          candidateId: cand.id,
          jobId: job.id,
          submittedCvId: 'cv-inv-1',
          status: 'APPLIED',
          version: 1,
        },
      });

      // APPLIED -> PASSED is invalid in state machine
      await expect(
        adminService.moderateApplication(mockAdminUser, app.id, {
          targetStatus: ApplicationStatus.PASSED,
          reason: 'Direct pass is illegal',
          expectedVersion: 1,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows admin moderation even when the owning company is suspended', async () => {
      const comp = await inMemoryPrisma.company.create({
        data: {
          id: 'c-susp-mod',
          name: 'Susp Mod Corp',
          slug: 'susp-mod-corp',
          status: 'SUSPENDED',
        },
      });
      const candUser = await inMemoryPrisma.user.create({
        data: { id: 'u-susp-mod', email: 'suspmod@c.com', role: 'CANDIDATE' },
      });
      const cand = await inMemoryPrisma.candidateProfile.create({
        data: { id: 'cand-susp-mod', userId: candUser.id, fullName: 'Susp Mod Cand' },
      });
      const job = await inMemoryPrisma.job.create({
        data: {
          id: 'j-susp-mod',
          companyId: comp.id,
          title: 'Susp Mod Job',
          slug: 'susp-mod-job',
          status: 'PUBLISHED',
          workplaceType: 'REMOTE',
          experienceLevel: 'MID',
          employmentType: 'FULL_TIME',
          description: 'Desc',
          requirements: 'Reqs',
          applicationDeadline: new Date(Date.now() + 86400000),
        },
      });

      const app = await inMemoryPrisma.application.create({
        data: {
          id: 'app-susp-mod-1',
          candidateId: cand.id,
          jobId: job.id,
          submittedCvId: 'cv-susp-mod-1',
          status: 'APPLIED',
          version: 1,
        },
      });

      const res = await adminService.moderateApplication(mockAdminUser, app.id, {
        targetStatus: ApplicationStatus.REVIEWING,
        reason: 'Admin moderating application for suspended company',
        expectedVersion: 1,
      });

      expect(res.status).toBe(ApplicationStatus.REVIEWING);
      expect(res.version).toBe(2);
    });
  });
});
