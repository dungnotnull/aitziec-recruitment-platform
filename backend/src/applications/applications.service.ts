import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Prisma,
  Application,
  ApplicationStatusEvent,
  CandidateProfile,
  CandidateSkill,
  Skill,
  Job,
  Company,
} from '@prisma/client';
import { CollectionResponse } from '../common/dto/response.dto';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { CompanyScopeService } from '../companies/company-scope.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { ClaimResult } from '../idempotency/idempotency.types';
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

export type ApplicationWithRelations = Application & {
  job?: (Job & { company?: Company | null }) | null;
  candidate?:
    | (CandidateProfile & {
        skills?: (CandidateSkill & { skill?: Skill | null })[];
      })
    | null;
  history?: ApplicationStatusEvent[];
};

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly companyScopeService: CompanyScopeService,
    private readonly idempotencyService: IdempotencyService,
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
    idempotencyKey?: string,
  ): Promise<ApplicationDto> {
    let claim: ClaimResult | null = null;
    if (idempotencyKey !== undefined) {
      claim = await this.idempotencyService.claimOrReplay({
        actorId: user.id,
        method: 'POST',
        route: '/api/v1/jobs/:jobId/applications',
        key: idempotencyKey,
        params: { jobId },
        body: dto,
      });

      if (claim.type === 'REPLAY') {
        return claim.responseBody as ApplicationDto;
      }
    }

    try {
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

      const created = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const cv = await tx.cv.findUnique({
          where: { id: dto.cvId },
        });

        if (
          !cv ||
          cv.candidateProfileId !== candidateProfile.id ||
          cv.processingStatus === 'DELETED'
        ) {
          throw new NotFoundException({
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'CV not found or inaccessible.',
          });
        }

        if (cv.processingStatus !== 'READY') {
          throw new ConflictException({
            code: ERROR_CODES.CV_NOT_READY,
            message:
              'CV text extraction has not completed or has failed. Only READY CVs can be submitted.',
          });
        }

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
            candidateUserId: user.id,
            jobId: job.id,
            jobTitle: job.title,
            companyId: job.companyId,
            companyName: job.company.name,
            submittedAt: this.toIso(application.submittedAt) || new Date().toISOString(),
          },
          requestId,
          actorId: user.id,
        });

        return application;
      });

      const resultDto = this.mapToApplicationDto(created);
      if (claim) {
        await this.idempotencyService.complete(claim.recordId, 201, resultDto);
      }
      return resultDto;
    } catch (error) {
      if (claim) {
        await this.idempotencyService.fail(claim.recordId).catch(() => {});
      }
      throw error;
    }
  }

  async transitionApplication(
    user: AuthenticatedUser,
    applicationId: string,
    dto: TransitionApplicationDto,
    requestId?: string,
    idempotencyKey?: string,
  ): Promise<ApplicationDetailDto> {
    let claim: ClaimResult | null = null;
    if (idempotencyKey !== undefined) {
      claim = await this.idempotencyService.claimOrReplay({
        actorId: user.id,
        method: 'POST',
        route: '/api/v1/applications/:applicationId/transitions',
        key: idempotencyKey,
        params: { applicationId },
        body: dto,
      });

      if (claim.type === 'REPLAY') {
        return claim.responseBody as ApplicationDetailDto;
      }
    }

    try {
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: { company: true },
          },
          candidate: true,
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

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
            candidateUserId: application.candidate?.userId || '',
            jobId: application.jobId,
            jobTitle: application.job.title,
            companyId: application.job.companyId,
            companyName: application.job.company.name,
            fromStatus: application.status,
            toStatus: dto.targetStatus,
            changedAt: new Date().toISOString(),
          },
          requestId,
          actorId: user.id,
        });
      });

      const detailDto = await this.getApplicationDetail(user, applicationId);
      if (claim) {
        await this.idempotencyService.complete(claim.recordId, 200, detailDto);
      }
      return detailDto;
    } catch (error) {
      if (claim) {
        await this.idempotencyService.fail(claim.recordId).catch(() => {});
      }
      throw error;
    }
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
      APPLIED: [ApplicationStatus.REVIEWING, ApplicationStatus.REJECTED],
      REVIEWING: [ApplicationStatus.INTERVIEWING, ApplicationStatus.REJECTED],
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
  ): Promise<CollectionResponse<ApplicationDetailDto>> {
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

    const where: Prisma.ApplicationWhereInput = {
      candidateId: candidateProfile.id,
    };
    if (query.status) {
      where.status = query.status;
    }

    let cursorCondition: Prisma.ApplicationWhereUniqueInput | undefined = undefined;
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
      data: items.map((app) => this.mapToApplicationDetailDto(app)),
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
  ): Promise<CollectionResponse<ApplicationDetailDto>> {
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

    const where: Prisma.ApplicationWhereInput = { jobId };
    if (query.status) {
      where.status = query.status;
    }

    let cursorCondition: Prisma.ApplicationWhereUniqueInput | undefined = undefined;
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
      data: items.map((app) => this.mapToApplicationDetailDto(app)),
      meta: {
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  private mapToApplicationDto(app: Application): ApplicationDto {
    return {
      id: app.id,
      candidateId: app.candidateId,
      jobId: app.jobId,
      submittedCvId: app.submittedCvId,
      status: app.status as ApplicationStatus,
      candidateNote: app.candidateNote ?? null,
      version: app.version,
      submittedAt: this.toIso(app.submittedAt)!,
      updatedAt: this.toIso(app.updatedAt)!,
    };
  }

  private mapToApplicationDetailDto(app: ApplicationWithRelations): ApplicationDetailDto {
    const base = this.mapToApplicationDto(app);

    const history = (app.history || []).map((h: ApplicationStatusEvent) => ({
      id: h.id,
      fromStatus: (h.fromStatus as ApplicationStatus) ?? null,
      toStatus: h.toStatus as ApplicationStatus,
      reason: h.reason ?? null,
      actorId: h.actorId,
      occurredAt: this.toIso(h.occurredAt)!,
    }));

    const skills = (app.candidate?.skills || []).map((cs) => ({
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
