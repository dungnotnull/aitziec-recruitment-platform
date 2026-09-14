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
  let mockIdempotency: any;

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
      cv: {
        findUnique: jest.fn(),
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

    mockIdempotency = {
      validateKey: jest.fn((key?: string) => key),
      claimOrReplay: jest.fn().mockResolvedValue({ type: 'CLAIMED', recordId: 'idem-rec-1' }),
      complete: jest.fn().mockResolvedValue(undefined),
      fail: jest.fn().mockResolvedValue(undefined),
    };

    service = new ApplicationsService(
      mockPrisma,
      mockAudit,
      mockOutbox,
      mockCompanyScope,
      mockIdempotency,
    );
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
      mockPrisma.cv.findUnique.mockResolvedValue({
        id: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        candidateProfileId: 'prof-1',
        processingStatus: 'READY',
      });

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

  describe('BE-10-001 Submitted-CV Ownership & Readiness Enforcement', () => {
    const validJob = {
      id: 'job-1',
      companyId: 'comp-1',
      status: 'PUBLISHED',
      applicationDeadline: new Date(Date.now() + 86400000),
      company: { id: 'comp-1', status: 'ACTIVE' },
    };

    beforeEach(() => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-1' });
      mockPrisma.job.findUnique.mockResolvedValue(validJob);
      mockPrisma.application.findUnique.mockResolvedValue(null);
    });

    it('fails with 404 RESOURCE_NOT_FOUND when CV does not exist (no existence leakage)', async () => {
      mockPrisma.cv.findUnique.mockResolvedValue(null);

      await expect(
        service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.application.create).not.toHaveBeenCalled();
      expect(mockAudit.record).not.toHaveBeenCalled();
      expect(mockOutbox.recordEvent).not.toHaveBeenCalled();
    });

    it('fails with 404 RESOURCE_NOT_FOUND when CV belongs to another candidate (no existence leakage)', async () => {
      mockPrisma.cv.findUnique.mockResolvedValue({
        id: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        candidateProfileId: 'prof-other-candidate',
        processingStatus: 'READY',
      });

      await expect(
        service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.application.create).not.toHaveBeenCalled();
      expect(mockAudit.record).not.toHaveBeenCalled();
      expect(mockOutbox.recordEvent).not.toHaveBeenCalled();
    });

    it('fails with 404 RESOURCE_NOT_FOUND when CV is soft-deleted', async () => {
      mockPrisma.cv.findUnique.mockResolvedValue({
        id: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        candidateProfileId: 'prof-1',
        processingStatus: 'DELETED',
      });

      await expect(
        service.submitApplication(candidateUser, 'job-1', {
          cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockPrisma.application.create).not.toHaveBeenCalled();
    });

    it.each(['UPLOADED', 'EXTRACTING', 'FAILED'])(
      'fails with 409 CV_NOT_READY when CV status is %s',
      async (status) => {
        mockPrisma.cv.findUnique.mockResolvedValue({
          id: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
          candidateProfileId: 'prof-1',
          processingStatus: status,
        });

        try {
          await service.submitApplication(candidateUser, 'job-1', {
            cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
          });
          fail('Should have thrown ConflictException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(ConflictException);
          expect(err.getResponse().code).toBe(ERROR_CODES.CV_NOT_READY);
        }

        expect(mockPrisma.application.create).not.toHaveBeenCalled();
        expect(mockAudit.record).not.toHaveBeenCalled();
        expect(mockOutbox.recordEvent).not.toHaveBeenCalled();
      },
    );

    it('succeeds when CV belongs to candidate and is READY', async () => {
      mockPrisma.cv.findUnique.mockResolvedValue({
        id: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        candidateProfileId: 'prof-1',
        processingStatus: 'READY',
      });
      mockPrisma.application.create.mockResolvedValue({
        id: 'app-valid',
        candidateId: 'prof-1',
        jobId: 'job-1',
        submittedCvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
        status: 'APPLIED',
        version: 1,
        submittedAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.applicationStatusEvent.create.mockResolvedValue({ id: 'evt-valid' });

      const res = await service.submitApplication(candidateUser, 'job-1', {
        cvId: 'b9d363b9-3bf6-4b20-8012-70b135bc87d1',
      });

      expect(res.id).toBe('app-valid');
      expect(mockPrisma.application.create).toHaveBeenCalledTimes(1);
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

  describe('BE-10-005 Application Submission & Transition Idempotency', () => {
    const validJob = {
      id: 'job-idem',
      companyId: 'comp-1',
      status: 'PUBLISHED',
      applicationDeadline: new Date(Date.now() + 86400000),
      company: { id: 'comp-1', status: 'ACTIVE' },
    };

    const idempotencyKey = 'idempotency-key-test-123456';

    beforeEach(() => {
      mockPrisma.candidateProfile.findUnique.mockResolvedValue({ id: 'prof-idem' });
      mockPrisma.job.findUnique.mockResolvedValue(validJob);
      mockPrisma.application.findUnique.mockResolvedValue(null);
      mockPrisma.cv.findUnique.mockResolvedValue({
        id: 'cv-idem',
        candidateProfileId: 'prof-idem',
        processingStatus: 'READY',
      });
      mockPrisma.application.create.mockResolvedValue({
        id: 'app-created-idem',
        candidateId: 'prof-idem',
        jobId: 'job-idem',
        submittedCvId: 'cv-idem',
        status: 'APPLIED',
        version: 1,
        submittedAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.applicationStatusEvent.create.mockResolvedValue({ id: 'evt-idem' });
    });

    describe('submitApplication Idempotency', () => {
      it('claims key and completes idempotency record on successful submission', async () => {
        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'CLAIMED',
          recordId: 'rec-sub-1',
        });

        const res = await service.submitApplication(
          candidateUser,
          'job-idem',
          { cvId: 'cv-idem', candidateNote: 'Hello' },
          'req-1',
          idempotencyKey,
        );

        expect(res.id).toBe('app-created-idem');
        expect(mockIdempotency.claimOrReplay).toHaveBeenCalledWith({
          actorId: candidateUser.id,
          method: 'POST',
          route: '/api/v1/jobs/:jobId/applications',
          key: idempotencyKey,
          params: { jobId: 'job-idem' },
          body: { cvId: 'cv-idem', candidateNote: 'Hello' },
        });
        expect(mockIdempotency.complete).toHaveBeenCalledWith(
          'rec-sub-1',
          201,
          expect.objectContaining({ id: 'app-created-idem', status: 'APPLIED' }),
        );
        expect(mockIdempotency.fail).not.toHaveBeenCalled();
      });

      it('replays cached response directly without database mutation when replaying', async () => {
        const cachedApplication = {
          id: 'app-cached',
          candidateId: 'prof-idem',
          jobId: 'job-idem',
          submittedCvId: 'cv-idem',
          status: 'APPLIED',
          version: 1,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'REPLAY',
          recordId: 'rec-sub-cached',
          responseStatus: 201,
          responseBody: cachedApplication,
        });

        const res = await service.submitApplication(
          candidateUser,
          'job-idem',
          { cvId: 'cv-idem' },
          'req-2',
          idempotencyKey,
        );

        expect(res).toEqual(cachedApplication);
        expect(mockPrisma.application.create).not.toHaveBeenCalled();
        expect(mockPrisma.applicationStatusEvent.create).not.toHaveBeenCalled();
        expect(mockAudit.record).not.toHaveBeenCalled();
        expect(mockOutbox.recordEvent).not.toHaveBeenCalled();
        expect(mockIdempotency.complete).not.toHaveBeenCalled();
      });

      it('fails idempotency record when application submission fails (e.g. CV not ready)', async () => {
        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'CLAIMED',
          recordId: 'rec-sub-fail',
        });
        mockPrisma.cv.findUnique.mockResolvedValue({
          id: 'cv-idem',
          candidateProfileId: 'prof-idem',
          processingStatus: 'EXTRACTING',
        });

        await expect(
          service.submitApplication(
            candidateUser,
            'job-idem',
            { cvId: 'cv-idem' },
            'req-3',
            idempotencyKey,
          ),
        ).rejects.toThrow(ConflictException);

        expect(mockIdempotency.fail).toHaveBeenCalledWith('rec-sub-fail');
        expect(mockIdempotency.complete).not.toHaveBeenCalled();
      });

      it('fails claim and throws APPLICATION_ALREADY_EXISTS when candidate already applied (business duplicate)', async () => {
        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'CLAIMED',
          recordId: 'rec-sub-dup',
        });
        mockPrisma.application.findUnique.mockResolvedValue({
          id: 'existing-app-id',
          candidateId: 'prof-idem',
          jobId: 'job-idem',
        });

        try {
          await service.submitApplication(
            candidateUser,
            'job-idem',
            { cvId: 'cv-idem' },
            'req-4',
            'another-key-1234567890',
          );
          fail('Should have thrown ConflictException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(ConflictException);
          expect(err.getResponse().code).toBe(ERROR_CODES.APPLICATION_ALREADY_EXISTS);
        }

        expect(mockIdempotency.fail).toHaveBeenCalledWith('rec-sub-dup');
        expect(mockIdempotency.complete).not.toHaveBeenCalled();
        expect(mockPrisma.application.create).not.toHaveBeenCalled();
      });

      it('propagates 409 IDEMPOTENCY_KEY_REUSED if claimOrReplay rejects payload reuse', async () => {
        mockIdempotency.claimOrReplay.mockRejectedValue(
          new ConflictException({
            code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
            message: 'Idempotency key has already been used with a different request payload.',
          }),
        );

        try {
          await service.submitApplication(
            candidateUser,
            'job-idem',
            { cvId: 'cv-idem', candidateNote: 'Changed note' },
            'req-5',
            idempotencyKey,
          );
          fail('Should have thrown ConflictException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(ConflictException);
          expect(err.getResponse().code).toBe(ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
        }

        expect(mockPrisma.candidateProfile.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.application.create).not.toHaveBeenCalled();
      });
    });

    describe('transitionApplication Idempotency', () => {
      const existingApp = {
        id: 'app-trans-idem',
        candidateId: 'prof-idem',
        jobId: 'job-idem',
        version: 1,
        status: 'APPLIED',
        submittedCvId: 'cv-idem',
        job: { id: 'job-idem', companyId: 'comp-1', company: { id: 'comp-1' } },
        candidate: { id: 'prof-idem', fullName: 'Candidate A', skills: [] },
        history: [],
      };

      it('claims key and completes idempotency record on successful transition', async () => {
        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'CLAIMED',
          recordId: 'rec-trans-1',
        });

        mockPrisma.application.findUnique.mockResolvedValueOnce(existingApp).mockResolvedValueOnce({
          ...existingApp,
          status: 'REVIEWING',
          version: 2,
          history: [
            {
              id: 'h-1',
              fromStatus: 'APPLIED',
              toStatus: 'REVIEWING',
              reason: 'Good fit',
              actorId: hrUser.id,
              occurredAt: new Date(),
            },
          ],
        });
        mockPrisma.application.update.mockResolvedValue({
          ...existingApp,
          status: 'REVIEWING',
          version: 2,
        });

        const res = await service.transitionApplication(
          hrUser,
          'app-trans-idem',
          {
            expectedVersion: 1,
            targetStatus: ApplicationStatus.REVIEWING,
            reason: 'Good fit',
          },
          'req-trans-1',
          idempotencyKey,
        );

        expect(res.status).toBe('REVIEWING');
        expect(res.version).toBe(2);
        expect(mockIdempotency.claimOrReplay).toHaveBeenCalledWith({
          actorId: hrUser.id,
          method: 'POST',
          route: '/api/v1/applications/:applicationId/transitions',
          key: idempotencyKey,
          params: { applicationId: 'app-trans-idem' },
          body: {
            expectedVersion: 1,
            targetStatus: ApplicationStatus.REVIEWING,
            reason: 'Good fit',
          },
        });
        expect(mockIdempotency.complete).toHaveBeenCalledWith(
          'rec-trans-1',
          200,
          expect.objectContaining({ id: 'app-trans-idem', status: 'REVIEWING' }),
        );
      });

      it('replays cached response directly without updating application on retry', async () => {
        const cachedDetail = {
          id: 'app-trans-idem',
          candidateId: 'prof-idem',
          jobId: 'job-idem',
          version: 2,
          status: 'REVIEWING',
          history: [],
          job: { id: 'job-idem', title: 'Engineer' },
          candidate: { id: 'prof-idem', fullName: 'Candidate A' },
        };

        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'REPLAY',
          recordId: 'rec-trans-cached',
          responseStatus: 200,
          responseBody: cachedDetail,
        });

        const res = await service.transitionApplication(
          hrUser,
          'app-trans-idem',
          {
            expectedVersion: 1,
            targetStatus: ApplicationStatus.REVIEWING,
          },
          'req-trans-2',
          idempotencyKey,
        );

        expect(res).toEqual(cachedDetail);
        expect(mockPrisma.application.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.application.update).not.toHaveBeenCalled();
        expect(mockPrisma.applicationStatusEvent.create).not.toHaveBeenCalled();
        expect(mockIdempotency.complete).not.toHaveBeenCalled();
      });

      it('fails idempotency record when version conflict occurs', async () => {
        mockIdempotency.claimOrReplay.mockResolvedValue({
          type: 'CLAIMED',
          recordId: 'rec-trans-conflict',
        });

        mockPrisma.application.findUnique.mockResolvedValue({
          ...existingApp,
          version: 3,
        });

        try {
          await service.transitionApplication(
            hrUser,
            'app-trans-idem',
            {
              expectedVersion: 1,
              targetStatus: ApplicationStatus.REVIEWING,
            },
            'req-trans-3',
            idempotencyKey,
          );
          fail('Should have thrown ConflictException');
        } catch (err: any) {
          expect(err).toBeInstanceOf(ConflictException);
          expect(err.getResponse().code).toBe(ERROR_CODES.VERSION_CONFLICT);
        }

        expect(mockIdempotency.fail).toHaveBeenCalledWith('rec-trans-conflict');
        expect(mockIdempotency.complete).not.toHaveBeenCalled();
        expect(mockPrisma.application.update).not.toHaveBeenCalled();
      });
    });
  });
});
