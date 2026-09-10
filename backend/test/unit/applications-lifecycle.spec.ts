import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationsService } from '../../src/applications/applications.service';
import { ApplicationStatus } from '../../src/applications/dto/application.dto';
import { ERROR_CODES } from '../../src/common/constants/error-codes';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';

describe('ApplicationsLifecycle (Unit)', () => {
  let service: ApplicationsService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockOutbox: any;
  let mockCompanyScope: any;

  const candidateUser: AuthenticatedUser = {
    id: 'cand-user-1',
    email: 'cand@itziec.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const hrUser: AuthenticatedUser = {
    id: 'hr-user-1',
    email: 'hr@itziec.com',
    role: 'HR',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    mockPrisma = {
      candidateProfile: {
        findUnique: jest.fn(),
      },
      job: {
        findUnique: jest.fn(),
      },
      application: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      applicationStatusEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    mockAudit = {
      record: jest.fn().mockResolvedValue(undefined),
    };

    mockOutbox = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockCompanyScope = {
      assertMemberOrAdmin: jest.fn().mockResolvedValue(undefined),
    };

    service = new ApplicationsService(mockPrisma, mockAudit, mockOutbox, mockCompanyScope);
  });

  describe('BE-4-001 & BE-4-007 State Machine Transition Policy', () => {
    it('allows valid transitions including early rejection', () => {
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.REVIEWING),
      ).not.toThrow();
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.REJECTED),
      ).not.toThrow();
      expect(() =>
        service.validateStatusTransition(
          ApplicationStatus.REVIEWING,
          ApplicationStatus.INTERVIEWING,
        ),
      ).not.toThrow();
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.REVIEWING, ApplicationStatus.REJECTED),
      ).not.toThrow();
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.INTERVIEWING, ApplicationStatus.PASSED),
      ).not.toThrow();
      expect(() =>
        service.validateStatusTransition(
          ApplicationStatus.INTERVIEWING,
          ApplicationStatus.REJECTED,
        ),
      ).not.toThrow();
    });

    it('rejects invalid skipping or backward transitions', () => {
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.INTERVIEWING),
      ).toThrow(ConflictException);

      expect(() =>
        service.validateStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.PASSED),
      ).toThrow(ConflictException);

      expect(() =>
        service.validateStatusTransition(ApplicationStatus.REVIEWING, ApplicationStatus.APPLIED),
      ).toThrow(ConflictException);

      expect(() =>
        service.validateStatusTransition(ApplicationStatus.INTERVIEWING, ApplicationStatus.APPLIED),
      ).toThrow(ConflictException);

      expect(() =>
        service.validateStatusTransition(
          ApplicationStatus.INTERVIEWING,
          ApplicationStatus.REVIEWING,
        ),
      ).toThrow(ConflictException);
    });

    it('rejects self-transitions', () => {
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.APPLIED, ApplicationStatus.APPLIED),
      ).toThrow(ConflictException);
      expect(() =>
        service.validateStatusTransition(ApplicationStatus.REVIEWING, ApplicationStatus.REVIEWING),
      ).toThrow(ConflictException);
    });

    it('BE-4-016 enforces terminal state immutability (PASSED and REJECTED cannot transition)', () => {
      const allStatuses: ApplicationStatus[] = [
        ApplicationStatus.APPLIED,
        ApplicationStatus.REVIEWING,
        ApplicationStatus.INTERVIEWING,
        ApplicationStatus.PASSED,
        ApplicationStatus.REJECTED,
      ];

      for (const target of allStatuses) {
        expect(() => service.validateStatusTransition(ApplicationStatus.PASSED, target)).toThrow(
          ConflictException,
        );

        expect(() => service.validateStatusTransition(ApplicationStatus.REJECTED, target)).toThrow(
          ConflictException,
        );
      }
    });
  });

  describe('BE-4-004 Application Eligibility Policy', () => {
    const validJob = {
      id: 'job-1',
      companyId: 'comp-1',
      status: 'PUBLISHED',
      applicationDeadline: new Date(Date.now() + 86400000), // tomorrow
      company: { id: 'comp-1', status: 'ACTIVE' },
    };

    it('fails if candidate profile not found', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails if job is draft or unpublished', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue({ ...validJob, status: 'DRAFT' });

      await expect(
        service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('fails if job is closed', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue({ ...validJob, status: 'CLOSED' });

      try {
        await service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(ERROR_CODES.JOB_NOT_OPEN);
      }
    });

    it('fails if application deadline has passed', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue({
        ...validJob,
        applicationDeadline: new Date(Date.now() - 3600000), // 1 hour ago
      });

      try {
        await service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(ERROR_CODES.JOB_DEADLINE_PASSED);
      }
    });

    it('fails if company is suspended', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue({
        ...validJob,
        company: { id: 'comp-1', status: 'SUSPENDED' },
      });

      await expect(
        service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('fails if duplicate application exists for candidate and job', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue(validJob);
      mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-existing' });

      try {
        await service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(ERROR_CODES.APPLICATION_ALREADY_EXISTS);
      }
    });
  });

  describe('BE-4-005 Application Submission & Outbox / Audit', () => {
    it('creates application, initial history event, audit record, and outbox event', async () => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'job-1',
        companyId: 'comp-1',
        status: 'PUBLISHED',
        applicationDeadline: new Date(Date.now() + 86400000),
        company: { id: 'comp-1', status: 'ACTIVE' },
      });
      mockPrisma.application.findUnique.mockResolvedValue(null);

      const createdApp = {
        id: 'app-1',
        candidateId: 'prof-1',
        jobId: 'job-1',
        submittedCvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        status: 'APPLIED',
        candidateNote: 'Excited to apply!',
        version: 1,
        submittedAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.application.create.mockResolvedValue(createdApp);
      mockPrisma.applicationStatusEvent.create.mockResolvedValue({ id: 'evt-1' });

      const result = await service.submitApplication(
        candidateUser,
        'job-1',
        { cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1', candidateNote: 'Excited to apply!' },
        'req-123',
      );

      expect(result.id).toBe('app-1');
      expect(result.status).toBe('APPLIED');
      expect(result.version).toBe(1);

      // Verify Audit record
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPLICATION_SUBMITTED',
          actorId: candidateUser.id,
          targetId: 'app-1',
        }),
        expect.anything(),
      );

      // Verify Outbox event
      expect(mockOutbox.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventName: 'ApplicationSubmitted',
          aggregateType: 'Application',
          aggregateId: 'app-1',
          payload: expect.objectContaining({
            applicationId: 'app-1',
            jobId: 'job-1',
            companyId: 'comp-1',
          }),
        }),
      );
    });
  });

  describe('BE-4-008 Optimistic Transition & Concurrency Conflict', () => {
    it('fails with VERSION_CONFLICT when expectedVersion does not match', async () => {
      mockPrisma.application.findUnique.mockResolvedValue({
        id: 'app-1',
        version: 2,
        status: 'APPLIED',
        job: { companyId: 'comp-1' },
      });

      try {
        await service.transitionApplication(
          hrUser,
          'app-1',
          { expectedVersion: 1, targetStatus: ApplicationStatus.REVIEWING },
          'req-456',
        );
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        expect(err.getResponse().code).toBe(ERROR_CODES.VERSION_CONFLICT);
      }
    });

    it('successfully transitions from APPLIED to REVIEWING and updates version', async () => {
      const existingApp = {
        id: 'app-1',
        candidateId: 'prof-1',
        jobId: 'job-1',
        version: 1,
        status: 'APPLIED',
        submittedCvId: 'cv-1',
        job: { id: 'job-1', companyId: 'comp-1', company: { id: 'comp-1' } },
        candidate: { id: 'prof-1', fullName: 'Candidate A', skills: [] },
        history: [],
      };

      mockPrisma.application.findUnique
        .mockResolvedValueOnce(existingApp) // first lookup
        .mockResolvedValueOnce({
          ...existingApp,
          status: 'REVIEWING',
          version: 2,
          history: [
            {
              id: 'hist-1',
              fromStatus: 'APPLIED',
              toStatus: 'REVIEWING',
              reason: 'Valid qualifications',
              actorId: hrUser.id,
              occurredAt: new Date(),
            },
          ],
        }); // reload detail

      mockPrisma.application.update.mockResolvedValue({
        ...existingApp,
        status: 'REVIEWING',
        version: 2,
      });

      const result = await service.transitionApplication(
        hrUser,
        'app-1',
        {
          expectedVersion: 1,
          targetStatus: ApplicationStatus.REVIEWING,
          reason: 'Valid qualifications',
        },
        'req-789',
      );

      expect(result.status).toBe('REVIEWING');
      expect(result.version).toBe(2);

      // Verify Audit record
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPLICATION_STATUS_TRANSITIONED',
          actorId: hrUser.id,
          targetId: 'app-1',
        }),
        expect.anything(),
      );

      // Verify Outbox event
      expect(mockOutbox.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          eventName: 'ApplicationStatusChanged',
          aggregateType: 'Application',
          aggregateId: 'app-1',
          payload: expect.objectContaining({
            fromStatus: 'APPLIED',
            toStatus: 'REVIEWING',
          }),
        }),
      );
    });
  });
});
