import { Test, TestingModule } from '@nestjs/testing';
import { InterviewsService } from '../../src/interviews/interviews.service';
import { PrismaService } from '../../src/database/prisma.service';
import { CompanyScopeService } from '../../src/companies/company-scope.service';
import { AuditService } from '../../src/audit/audit.service';
import { OutboxService } from '../../src/outbox/outbox.service';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';
import { ApplicationStatus, InterviewStatus } from '@prisma/client';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('InterviewsService (Unit)', () => {
  let service: InterviewsService;
  let inMemoryPrisma: InMemoryPrismaService;
  let mockOutbox: { emitEvent: jest.Mock };

  const companyId = 'comp-1';
  const hrUser: AuthenticatedUser = {
    id: 'hr-user-1',
    email: 'hr@comp.com',
    role: 'HR',
    status: 'ACTIVE',
  };

  const outsiderHr: AuthenticatedUser = {
    id: 'outsider-hr',
    email: 'outsider@other.com',
    role: 'HR',
    status: 'ACTIVE',
  };

  const candidateUser: AuthenticatedUser = {
    id: 'cand-user-1',
    email: 'cand@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const candidateProfile = {
    id: 'cand-prof-1',
    userId: 'cand-user-1',
    fullName: 'Test Candidate',
  };

  let testApplication: any;

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();
    mockOutbox = { emitEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }) };

    // Setup company, member, candidate, job, application
    inMemoryPrisma.companies.push({
      id: companyId,
      slug: 'tech-corp',
      name: 'Tech Corp',
      status: 'ACTIVE',
    });

    inMemoryPrisma.companyMemberships.push({
      id: 'mem-1',
      companyId,
      userId: hrUser.id,
      role: 'RECRUITER',
    });

    inMemoryPrisma.candidateProfiles.push({ ...candidateProfile });

    const job = await inMemoryPrisma.job.create({
      data: {
        id: 'job-1',
        companyId,
        title: 'Software Engineer',
        slug: 'software-engineer',
        description: 'Job desc',
        requirements: 'Job reqs',
        location: 'Remote',
        workplaceType: 'REMOTE',
        experienceLevel: 'SENIOR',
        employmentType: 'FULL_TIME',
        applicationDeadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      },
    });

    testApplication = await inMemoryPrisma.application.create({
      data: {
        id: 'app-1',
        candidateId: candidateProfile.id,
        jobId: job.id,
        submittedCvId: 'cv-1',
        status: ApplicationStatus.INTERVIEWING,
      },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterviewsService,
        CompanyScopeService,
        AuditService,
        { provide: OutboxService, useValue: mockOutbox },
        { provide: PrismaService, useValue: inMemoryPrisma },
      ],
    }).compile();

    service = module.get<InterviewsService>(InterviewsService);
  });

  afterEach(() => {
    inMemoryPrisma.reset();
  });

  describe('scheduleInterview', () => {
    it('should reject scheduling if application is not in INTERVIEWING status', async () => {
      await inMemoryPrisma.application.update({
        where: { id: testApplication.id },
        data: { status: ApplicationStatus.APPLIED },
      });

      await expect(
        service.scheduleInterview(hrUser, testApplication.id, {
          startsAt: new Date(Date.now() + 3600000).toISOString(),
          endsAt: new Date(Date.now() + 7200000).toISOString(),
          locationOrMeetingUrl: 'https://meet.google.com/xyz',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject scheduling if endsAt is before startsAt', async () => {
      await expect(
        service.scheduleInterview(hrUser, testApplication.id, {
          startsAt: new Date(Date.now() + 7200000).toISOString(),
          endsAt: new Date(Date.now() + 3600000).toISOString(),
          locationOrMeetingUrl: 'https://meet.google.com/xyz',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject scheduling if user is outsider HR', async () => {
      await expect(
        service.scheduleInterview(outsiderHr, testApplication.id, {
          startsAt: new Date(Date.now() + 3600000).toISOString(),
          endsAt: new Date(Date.now() + 7200000).toISOString(),
          locationOrMeetingUrl: 'https://meet.google.com/xyz',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully schedule interview and emit InterviewScheduled event', async () => {
      const startsAt = new Date(Date.now() + 3600000).toISOString();
      const endsAt = new Date(Date.now() + 7200000).toISOString();

      const res = await service.scheduleInterview(hrUser, testApplication.id, {
        startsAt,
        endsAt,
        locationOrMeetingUrl: 'https://meet.google.com/xyz',
        candidateInstructions: 'Please prepare your portfolio',
        recruiterPrivateNotes: 'Evaluate system design skills',
      });

      expect(res.id).toBeDefined();
      expect(res.status).toBe(InterviewStatus.SCHEDULED);
      expect(res.recruiterPrivateNotes).toBe('Evaluate system design skills');

      // Check Outbox event emitted
      expect(mockOutbox.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InterviewScheduled',
          aggregateType: 'INTERVIEW',
          payload: expect.objectContaining({
            applicationId: testApplication.id,
            candidateUserId: candidateUser.id,
          }),
        }),
      );
    });
  });

  describe('listApplicationInterviews & role projection', () => {
    it('should omit private notes and feedback for candidate', async () => {
      await inMemoryPrisma.interview.create({
        data: {
          id: 'int-1',
          applicationId: testApplication.id,
          status: InterviewStatus.SCHEDULED,
          startsAt: new Date(Date.now() + 3600000),
          endsAt: new Date(Date.now() + 7200000),
          locationOrMeetingUrl: 'https://meet.google.com/xyz',
          candidateInstructions: 'Candidate instruction',
          recruiterPrivateNotes: 'SECRET RECRUITER NOTE',
          recruiterFeedback: 'CANDIDATE SHOULD NOT SEE YET',
        },
      });

      // Candidate request
      const candidateList = await service.listApplicationInterviews(
        candidateUser,
        testApplication.id,
        {
          limit: 10,
        },
      );

      expect(candidateList.data.length).toBe(1);
      expect(candidateList.data[0].recruiterPrivateNotes).toBeUndefined();
      expect(candidateList.data[0].recruiterFeedback).toBeUndefined();
      expect(candidateList.data[0].candidateInstructions).toBe('Candidate instruction');

      // HR request
      const hrList = await service.listApplicationInterviews(hrUser, testApplication.id, {
        limit: 10,
      });

      expect(hrList.data[0].recruiterPrivateNotes).toBe('SECRET RECRUITER NOTE');
      expect(hrList.data[0].recruiterFeedback).toBe('CANDIDATE SHOULD NOT SEE YET');
    });
  });

  describe('updateInterview & reschedule', () => {
    it('should detect reschedule and emit InterviewRescheduled event', async () => {
      const interview = await inMemoryPrisma.interview.create({
        data: {
          id: 'int-resched',
          applicationId: testApplication.id,
          status: InterviewStatus.SCHEDULED,
          startsAt: new Date(Date.now() + 3600000),
          endsAt: new Date(Date.now() + 7200000),
          locationOrMeetingUrl: 'https://meet.google.com/old',
          version: 1,
        },
      });

      // Version conflict check
      await expect(
        service.updateInterview(hrUser, interview.id, {
          expectedVersion: 99,
          locationOrMeetingUrl: 'https://meet.google.com/new',
        }),
      ).rejects.toThrow(ConflictException);

      // Reschedule update
      const newStartsAt = new Date(Date.now() + 10000000).toISOString();
      const newEndsAt = new Date(Date.now() + 14000000).toISOString();

      const updated = await service.updateInterview(hrUser, interview.id, {
        expectedVersion: 1,
        startsAt: newStartsAt,
        endsAt: newEndsAt,
      });

      expect(updated.version).toBe(2);
      expect(mockOutbox.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InterviewRescheduled',
        }),
      );
    });
  });

  describe('completeInterview', () => {
    it('should mark interview completed and record feedback without changing application status', async () => {
      const interview = await inMemoryPrisma.interview.create({
        data: {
          id: 'int-complete',
          applicationId: testApplication.id,
          status: InterviewStatus.SCHEDULED,
          startsAt: new Date(Date.now() - 7200000),
          endsAt: new Date(Date.now() - 3600000),
          locationOrMeetingUrl: 'https://meet.google.com/xyz',
          version: 1,
        },
      });

      const updated = await service.completeInterview(hrUser, interview.id, {
        expectedVersion: 1,
        recruiterFeedback: 'Great culture fit and problem solving',
      });

      expect(updated.status).toBe(InterviewStatus.COMPLETED);
      expect(updated.recruiterFeedback).toBe('Great culture fit and problem solving');

      // Application status remains INTERVIEWING
      const app = await inMemoryPrisma.application.findUnique({
        where: { id: testApplication.id },
      });
      expect(app.status).toBe(ApplicationStatus.INTERVIEWING);
    });
  });

  describe('cancelInterview', () => {
    it('should cancel interview with reason and emit InterviewCancelled', async () => {
      const interview = await inMemoryPrisma.interview.create({
        data: {
          id: 'int-cancel',
          applicationId: testApplication.id,
          status: InterviewStatus.SCHEDULED,
          startsAt: new Date(Date.now() + 3600000),
          endsAt: new Date(Date.now() + 7200000),
          locationOrMeetingUrl: 'https://meet.google.com/xyz',
          version: 1,
        },
      });

      const updated = await service.cancelInterview(hrUser, interview.id, {
        expectedVersion: 1,
        reason: 'Interviewer emergency leave',
      });

      expect(updated.status).toBe(InterviewStatus.CANCELLED);
      expect(mockOutbox.emitEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InterviewCancelled',
          payload: expect.objectContaining({
            reason: 'Interviewer emergency leave',
          }),
        }),
      );
    });
  });
});
