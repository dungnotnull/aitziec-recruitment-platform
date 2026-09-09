import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { CompanyScopeService } from '../companies/company-scope.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  ApplicationDetailDto,
  ApplicationDto,
  ApplicationQueryDto,
  ApplicationStatus,
  SubmitApplicationDto,
  TransitionApplicationDto,
} from './dto/application.dto';

interface CursorData {
  id: string;
  submittedAt: string;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly companyScopeService: CompanyScopeService,
  ) {}

  private toIso(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  private encodeCursor(cursor: CursorData): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeCursor(cursorStr: string): CursorData | null {
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.submittedAt === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async submitApplication(
    user: AuthenticatedUser,
    jobId: string,
    dto: SubmitApplicationDto,
    requestId?: string,
  ): Promise<ApplicationDto> {
    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    if (!candidateProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found. Please complete your profile first.',
      });
    }

    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });
    if (!job || job.status === 'DRAFT' || job.status === 'UNPUBLISHED') {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found or inaccessible.',
      });
    }
    if (job.status === 'CLOSED') {
      throw new ConflictException({
        code: ERROR_CODES.JOB_NOT_OPEN,
        message: 'Job is closed and no longer accepting applications.',
      });
    }

    const now = new Date();
    if (new Date(job.applicationDeadline) < now) {
      throw new ConflictException({
        code: ERROR_CODES.JOB_DEADLINE_PASSED,
        message: 'Application deadline for this job has passed.',
      });
    }

    if (job.company.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Company has been suspended and cannot accept applications.',
      });
    }

    const existing = await this.prisma.application.findUnique({
      where: {
        candidateId_jobId: {
          candidateId: candidateProfile.id,
          jobId: job.id,
        },
      },
    });
    if (existing) {
      throw new ConflictException({
        code: ERROR_CODES.APPLICATION_ALREADY_EXISTS,
        message: 'You have already submitted an application for this job.',
      });
    }

    const created = await this.prisma.$transaction(async (tx: any) => {
      const application = await tx.application.create({
        data: {
          candidateId: candidateProfile.id,
          jobId: job.id,
          submittedCvId: dto.cvId,
          status: 'APPLIED',
          candidateNote: dto.candidateNote ?? null,
          version: 1,
        },
      });

      await tx.applicationStatusEvent.create({
        data: {
          applicationId: application.id,
          fromStatus: null,
          toStatus: 'APPLIED',
          reason: null,
          actorId: user.id,
        },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'APPLICATION_SUBMITTED',
          targetType: 'APPLICATION',
          targetId: application.id,
          requestId,
          metadata: {
            jobId: job.id,
            companyId: job.companyId,
            candidateProfileId: candidateProfile.id,
            submittedCvId: dto.cvId,
          },
        },
        tx,
      );

      await this.outboxService.recordEvent(tx, {
        eventName: 'ApplicationSubmitted',
        aggregateType: 'Application',
        aggregateId: application.id,
        payload: {
          applicationId: application.id,
          candidateId: candidateProfile.id,
          jobId: job.id,
          companyId: job.companyId,
          submittedAt: this.toIso(application.submittedAt),
        },
        requestId,
        actorId: user.id,
      });

      return application;
    });

    return this.mapToApplicationDto(created);
  }

  async transitionApplication(
    user: AuthenticatedUser,
    applicationId: string,
    dto: TransitionApplicationDto,
    requestId?: string,
  ): Promise<ApplicationDetailDto> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          include: { company: true },
        },
      },
    });

    if (!application) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Application not found.',
      });
    }

    // Authorization via CompanyScopeService
    await this.companyScopeService.assertMemberOrAdmin(application.job.companyId, user);

    if (application.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: current version is ${application.version}, expected ${dto.expectedVersion}.`,
      });
    }

    this.validateStatusTransition(application.status as ApplicationStatus, dto.targetStatus);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: dto.targetStatus,
          version: { increment: 1 },
        },
      });

      await tx.applicationStatusEvent.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: dto.targetStatus,
          reason: dto.reason ?? null,
          actorId: user.id,
        },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'APPLICATION_STATUS_TRANSITIONED',
          targetType: 'APPLICATION',
          targetId: applicationId,
          requestId,
          metadata: {
            fromStatus: application.status,
            toStatus: dto.targetStatus,
            reason: dto.reason ?? null,
            expectedVersion: dto.expectedVersion,
            newVersion: application.version + 1,
          },
        },
        tx,
      );

      await this.outboxService.recordEvent(tx, {
        eventName: 'ApplicationStatusChanged',
        aggregateType: 'Application',
        aggregateId: application.id,
        payload: {
          applicationId,
          candidateId: application.candidateId,
          jobId: application.jobId,
          fromStatus: application.status,
          toStatus: dto.targetStatus,
          changedAt: new Date().toISOString(),
        },
        requestId,
        actorId: user.id,
      });
    });

    return this.getApplicationDetail(user, applicationId);
  }

  validateStatusTransition(
    currentStatus: ApplicationStatus,
    targetStatus: ApplicationStatus,
  ): void {
    if (currentStatus === 'PASSED' || currentStatus === 'REJECTED') {
      throw new ConflictException({
        code: ERROR_CODES.INVALID_APPLICATION_TRANSITION,
        message: `Cannot transition application from terminal status ${currentStatus}.`,
      });
    }

    if (currentStatus === targetStatus) {
      throw new ConflictException({
        code: ERROR_CODES.INVALID_APPLICATION_TRANSITION,
        message: `Application is already in ${targetStatus} status.`,
      });
    }

    const allowedTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
      APPLIED: [ApplicationStatus.REVIEWING],
      REVIEWING: [ApplicationStatus.INTERVIEWING],
      INTERVIEWING: [ApplicationStatus.PASSED, ApplicationStatus.REJECTED],
      PASSED: [],
      REJECTED: [],
    };

    const validTargets = allowedTransitions[currentStatus] || [];
    if (!validTargets.includes(targetStatus)) {
      throw new ConflictException({
        code: ERROR_CODES.INVALID_APPLICATION_TRANSITION,
        message: `Invalid status transition from ${currentStatus} to ${targetStatus}.`,
      });
    }
  }

  async getCandidateApplications(
    user: AuthenticatedUser,
    query: ApplicationQueryDto,
  ): Promise<{ data: ApplicationDetailDto[]; meta: any }> {
    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    if (!candidateProfile) {
      return {
        data: [],
        meta: {
          page: {
            nextCursor: null,
            hasNextPage: false,
            limit: query.limit || 20,
          },
        },
      };
    }

    const where: any = {
      candidateId: candidateProfile.id,
    };
    if (query.status) {
      where.status = query.status;
    }

    let cursorCondition: any = undefined;
    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      if (decoded) {
        cursorCondition = { id: decoded.id };
      }
    }

    const limit = query.limit || 20;
    const applications = await this.prisma.application.findMany({
      where,
      take: limit + 1,
      cursor: cursorCondition,
      skip: cursorCondition ? 1 : 0,
      include: {
        job: {
          include: { company: true },
        },
        candidate: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
        history: true,
      },
    });

    const hasNextPage = applications.length > limit;
    const items = hasNextPage ? applications.slice(0, limit) : applications;

    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor({
        id: last.id,
        submittedAt: this.toIso(last.submittedAt) || new Date().toISOString(),
      });
    }

    return {
      data: items.map((app: any) => this.mapToApplicationDetailDto(app)),
      meta: {
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  async getApplicationDetail(
    user: AuthenticatedUser,
    applicationId: string,
  ): Promise<ApplicationDetailDto> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          include: { company: true },
        },
        candidate: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
        history: true,
      },
    });

    if (!application) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Application not found.',
      });
    }

    if (user.role === 'CANDIDATE') {
      const candidateProfile = await this.prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      if (!candidateProfile || candidateProfile.id !== application.candidateId) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You are not authorized to view this application.',
        });
      }
    } else {
      // HR or Admin
      await this.companyScopeService.assertMemberOrAdmin(application.job.companyId, user);
    }

    return this.mapToApplicationDetailDto(application);
  }

  async getJobApplications(
    user: AuthenticatedUser,
    jobId: string,
    query: ApplicationQueryDto,
  ): Promise<{ data: ApplicationDetailDto[]; meta: any }> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!job) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found.',
      });
    }

    await this.companyScopeService.assertMemberOrAdmin(job.companyId, user);

    const where: any = { jobId };
    if (query.status) {
      where.status = query.status;
    }

    let cursorCondition: any = undefined;
    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      if (decoded) {
        cursorCondition = { id: decoded.id };
      }
    }

    const limit = query.limit || 20;
    const applications = await this.prisma.application.findMany({
      where,
      take: limit + 1,
      cursor: cursorCondition,
      skip: cursorCondition ? 1 : 0,
      include: {
        job: {
          include: { company: true },
        },
        candidate: {
          include: {
            skills: {
              include: { skill: true },
            },
          },
        },
        history: true,
      },
    });

    const hasNextPage = applications.length > limit;
    const items = hasNextPage ? applications.slice(0, limit) : applications;

    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor({
        id: last.id,
        submittedAt: this.toIso(last.submittedAt) || new Date().toISOString(),
      });
    }

    return {
      data: items.map((app: any) => this.mapToApplicationDetailDto(app)),
      meta: {
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  private mapToApplicationDto(app: any): ApplicationDto {
    return {
      id: app.id,
      candidateId: app.candidateId,
      jobId: app.jobId,
      submittedCvId: app.submittedCvId,
      status: app.status,
      candidateNote: app.candidateNote ?? null,
      version: app.version,
      submittedAt: this.toIso(app.submittedAt)!,
      updatedAt: this.toIso(app.updatedAt)!,
    };
  }

  private mapToApplicationDetailDto(app: any): ApplicationDetailDto {
    const base = this.mapToApplicationDto(app);

    const history = (app.history || []).map((h: any) => ({
      id: h.id,
      fromStatus: h.fromStatus ?? null,
      toStatus: h.toStatus,
      reason: h.reason ?? null,
      actorId: h.actorId,
      occurredAt: this.toIso(h.occurredAt)!,
    }));

    const skills = (app.candidate?.skills || []).map((cs: any) => ({
      skillId: cs.skillId,
      name: cs.skill?.name || '',
      yearsOfExperience: cs.yearsOfExperience ?? null,
    }));

    return {
      ...base,
      job: {
        id: app.job?.id || app.jobId,
        title: app.job?.title || '',
        slug: app.job?.slug || '',
        company: app.job?.company
          ? {
              id: app.job.company.id,
              slug: app.job.company.slug,
              name: app.job.company.name,
              logoUrl: app.job.company.logoUrl ?? null,
            }
          : undefined,
      },
      candidate: {
        id: app.candidate?.id || app.candidateId,
        fullName: app.candidate?.fullName || '',
        headline: app.candidate?.headline ?? null,
        skills,
      },
      history,
    };
  }
}
