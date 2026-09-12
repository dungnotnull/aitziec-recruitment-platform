import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../companies/company-scope.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ApplicationStatus, InterviewStatus, Interview, Prisma } from '@prisma/client';
import {
  CancelInterviewDto,
  CompleteInterviewDto,
  CreateInterviewDto,
  InterviewDto,
  InterviewQueryDto,
  UpdateInterviewDto,
} from './dto/interview.dto';
import { IdempotencyService, ClaimResult } from '../idempotency';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScopeService: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async scheduleInterview(
    user: AuthenticatedUser,
    applicationId: string,
    dto: CreateInterviewDto,
    requestId?: string,
    idempotencyKey?: string,
  ): Promise<InterviewDto> {
    let claim: ClaimResult | null = null;
    if (idempotencyKey !== undefined) {
      claim = await this.idempotencyService.claimOrReplay({
        actorId: user.id,
        method: 'POST',
        route: '/api/v1/applications/:applicationId/interviews',
        key: idempotencyKey,
        params: { applicationId },
        body: dto,
      });

      if (claim.type === 'REPLAY') {
        return claim.responseBody as InterviewDto;
      }
    }

    try {
      const application = await this.prisma.application.findUnique({
        where: { id: applicationId },
        include: {
          job: {
            include: {
              company: true,
            },
          },
          candidate: true,
        },
      });

      if (!application) {
        throw new NotFoundException(`Application with ID ${applicationId} not found`);
      }

      await this.companyScopeService.assertMemberOrAdmin(application.job.companyId, user);

      if (application.status !== ApplicationStatus.INTERVIEWING) {
        throw new BadRequestException({
          code: 'INVALID_APPLICATION_STATUS',
          message: 'Cannot schedule interview: application must be in INTERVIEWING status',
        });
      }

      const startsAt = new Date(dto.startsAt);
      const endsAt = new Date(dto.endsAt);

      if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime())) {
        throw new BadRequestException('Invalid startsAt or endsAt date format');
      }

      if (endsAt <= startsAt) {
        throw new BadRequestException('endsAt must be strictly after startsAt');
      }

      const interview = await this.prisma.interview.create({
        data: {
          applicationId,
          status: InterviewStatus.SCHEDULED,
          startsAt,
          endsAt,
          locationOrMeetingUrl: dto.locationOrMeetingUrl,
          candidateInstructions: dto.candidateInstructions ?? null,
          recruiterPrivateNotes: dto.recruiterPrivateNotes ?? null,
          version: 1,
        },
      });

      await this.auditService.recordAudit({
        actorId: user.id,
        actorRole: user.role,
        action: 'INTERVIEW_SCHEDULED',
        targetType: 'INTERVIEW',
        targetId: interview.id,
        metadata: {
          applicationId,
          startsAt: interview.startsAt.toISOString(),
          endsAt: interview.endsAt.toISOString(),
          locationOrMeetingUrl: interview.locationOrMeetingUrl,
        },
        requestId,
      });

      await this.outboxService.emitEvent({
        aggregateType: 'INTERVIEW',
        aggregateId: interview.id,
        eventType: 'InterviewScheduled',
        payload: {
          interviewId: interview.id,
          applicationId,
          candidateUserId: application.candidate.userId,
          jobTitle: application.job.title,
          companyName: application.job.company.name,
          startsAt: interview.startsAt.toISOString(),
          endsAt: interview.endsAt.toISOString(),
          locationOrMeetingUrl: interview.locationOrMeetingUrl,
          candidateInstructions: interview.candidateInstructions,
        },
        idempotencyKey: requestId ? `interview-sched-${interview.id}-${requestId}` : undefined,
      });

      const result = this.toInterviewDto(interview, false);
      if (claim) {
        await this.idempotencyService.complete(claim.recordId, 201, result);
      }
      return result;
    } catch (error) {
      if (claim) {
        await this.idempotencyService.fail(claim.recordId).catch(() => {});
      }
      throw error;
    }
  }

  async listApplicationInterviews(
    user: AuthenticatedUser,
    applicationId: string,
    query: InterviewQueryDto,
  ): Promise<{
    data: InterviewDto[];
    meta: { hasMore: boolean; nextCursor: string | null; total: number };
  }> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: true,
        candidate: true,
      },
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${applicationId} not found`);
    }

    let isCandidate = false;
    if (user.role === 'CANDIDATE') {
      if (application.candidate.userId !== user.id) {
        throw new ForbiddenException(
          'You do not have permission to view interviews for this application',
        );
      }
      isCandidate = true;
    } else {
      await this.companyScopeService.assertMemberOrAdmin(application.job.companyId, user);
    }

    const limit = query.limit || 20;
    const where: Prisma.InterviewWhereInput = { applicationId };

    const total = this.prisma.interview?.count ? await this.prisma.interview.count({ where }) : 0;

    const findArgs: Prisma.InterviewFindManyArgs = {
      where,
      orderBy: { startsAt: 'desc' },
      take: limit + 1,
    };

    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const items = await this.prisma.interview.findMany(findArgs);
    const hasMore = items.length > limit;
    const dataItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? dataItems[dataItems.length - 1].id : null;

    return {
      data: dataItems.map((item) => this.toInterviewDto(item, isCandidate)),
      meta: {
        hasMore,
        nextCursor,
        total: total || dataItems.length,
      },
    };
  }

  async getInterviewDetail(user: AuthenticatedUser, interviewId: string): Promise<InterviewDto> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            job: true,
            candidate: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    let isCandidate = false;
    if (user.role === 'CANDIDATE') {
      if (interview.application.candidate.userId !== user.id) {
        throw new ForbiddenException('You do not have permission to view this interview');
      }
      isCandidate = true;
    } else {
      await this.companyScopeService.assertMemberOrAdmin(interview.application.job.companyId, user);
    }

    return this.toInterviewDto(interview, isCandidate);
  }

  async updateInterview(
    user: AuthenticatedUser,
    interviewId: string,
    dto: UpdateInterviewDto,
    requestId?: string,
  ): Promise<InterviewDto> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            job: {
              include: { company: true },
            },
            candidate: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    await this.companyScopeService.assertMemberOrAdmin(interview.application.job.companyId, user);

    if (interview.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: `Expected version ${dto.expectedVersion} does not match current interview version ${interview.version}`,
      });
    }

    if (dto.startsAt || dto.endsAt) {
      if (interview.status !== InterviewStatus.SCHEDULED) {
        throw new BadRequestException('Cannot reschedule a non-scheduled interview');
      }
    }

    const nextStartsAt = dto.startsAt ? new Date(dto.startsAt) : interview.startsAt;
    const nextEndsAt = dto.endsAt ? new Date(dto.endsAt) : interview.endsAt;

    if (nextEndsAt <= nextStartsAt) {
      throw new BadRequestException('endsAt must be strictly after startsAt');
    }

    const scheduleChanged =
      (dto.startsAt && nextStartsAt.getTime() !== interview.startsAt.getTime()) ||
      (dto.endsAt && nextEndsAt.getTime() !== interview.endsAt.getTime()) ||
      (dto.locationOrMeetingUrl && dto.locationOrMeetingUrl !== interview.locationOrMeetingUrl);

    const updateData: Prisma.InterviewUpdateInput = {
      version: { increment: 1 },
      updatedAt: new Date(),
    };

    if (dto.startsAt) updateData.startsAt = nextStartsAt;
    if (dto.endsAt) updateData.endsAt = nextEndsAt;
    if (dto.locationOrMeetingUrl !== undefined)
      updateData.locationOrMeetingUrl = dto.locationOrMeetingUrl;
    if (dto.candidateInstructions !== undefined)
      updateData.candidateInstructions = dto.candidateInstructions;
    if (dto.recruiterPrivateNotes !== undefined)
      updateData.recruiterPrivateNotes = dto.recruiterPrivateNotes;
    if (dto.recruiterFeedback !== undefined) updateData.recruiterFeedback = dto.recruiterFeedback;

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: updateData,
    });

    await this.auditService.recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'INTERVIEW_UPDATED',
      targetType: 'INTERVIEW',
      targetId: interviewId,
      metadata: {
        applicationId: interview.applicationId,
        scheduleChanged,
      },
      requestId,
    });

    if (scheduleChanged) {
      await this.outboxService.emitEvent({
        aggregateType: 'INTERVIEW',
        aggregateId: interviewId,
        eventType: 'InterviewRescheduled',
        payload: {
          interviewId,
          applicationId: interview.applicationId,
          candidateUserId: interview.application.candidate.userId,
          jobTitle: interview.application.job.title,
          companyName: interview.application.job.company.name,
          startsAt: updated.startsAt.toISOString(),
          endsAt: updated.endsAt.toISOString(),
          locationOrMeetingUrl: updated.locationOrMeetingUrl,
          candidateInstructions: updated.candidateInstructions,
        },
        idempotencyKey: requestId ? `interview-resched-${interviewId}-${requestId}` : undefined,
      });
    }

    return this.toInterviewDto(updated, false);
  }

  async completeInterview(
    user: AuthenticatedUser,
    interviewId: string,
    dto: CompleteInterviewDto,
    requestId?: string,
  ): Promise<InterviewDto> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            job: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    await this.companyScopeService.assertMemberOrAdmin(interview.application.job.companyId, user);

    if (interview.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: `Expected version ${dto.expectedVersion} does not match current version ${interview.version}`,
      });
    }

    if (interview.status !== InterviewStatus.SCHEDULED) {
      throw new BadRequestException('Only SCHEDULED interviews can be marked as COMPLETED');
    }

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: InterviewStatus.COMPLETED,
        recruiterFeedback:
          dto.recruiterFeedback !== undefined ? dto.recruiterFeedback : interview.recruiterFeedback,
        version: { increment: 1 },
      },
    });

    await this.auditService.recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'INTERVIEW_COMPLETED',
      targetType: 'INTERVIEW',
      targetId: interviewId,
      metadata: {
        applicationId: interview.applicationId,
      },
      requestId,
    });

    return this.toInterviewDto(updated, false);
  }

  async cancelInterview(
    user: AuthenticatedUser,
    interviewId: string,
    dto: CancelInterviewDto,
    requestId?: string,
  ): Promise<InterviewDto> {
    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        application: {
          include: {
            job: {
              include: { company: true },
            },
            candidate: true,
          },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Interview with ID ${interviewId} not found`);
    }

    await this.companyScopeService.assertMemberOrAdmin(interview.application.job.companyId, user);

    if (interview.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: `Expected version ${dto.expectedVersion} does not match current version ${interview.version}`,
      });
    }

    if (interview.status !== InterviewStatus.SCHEDULED) {
      throw new BadRequestException('Only SCHEDULED interviews can be cancelled');
    }

    const updated = await this.prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: InterviewStatus.CANCELLED,
        cancelReason: dto.reason,
        version: { increment: 1 },
      },
    });

    await this.auditService.recordAudit({
      actorId: user.id,
      actorRole: user.role,
      action: 'INTERVIEW_CANCELLED',
      targetType: 'INTERVIEW',
      targetId: interviewId,
      metadata: {
        applicationId: interview.applicationId,
        reason: dto.reason,
      },
      requestId,
    });

    await this.outboxService.emitEvent({
      aggregateType: 'INTERVIEW',
      aggregateId: interviewId,
      eventType: 'InterviewCancelled',
      payload: {
        interviewId,
        applicationId: interview.applicationId,
        candidateUserId: interview.application.candidate.userId,
        jobTitle: interview.application.job.title,
        companyName: interview.application.job.company.name,
        reason: dto.reason,
      },
      idempotencyKey: requestId ? `interview-cancel-${interviewId}-${requestId}` : undefined,
    });

    return this.toInterviewDto(updated, false);
  }

  private toInterviewDto(interview: Interview, isCandidate: boolean): InterviewDto {
    const dto: InterviewDto = {
      id: interview.id,
      applicationId: interview.applicationId,
      status: interview.status,
      startsAt: new Date(interview.startsAt).toISOString(),
      endsAt: new Date(interview.endsAt).toISOString(),
      locationOrMeetingUrl: interview.locationOrMeetingUrl,
      candidateInstructions: interview.candidateInstructions ?? null,
      version: interview.version,
      createdAt: new Date(interview.createdAt).toISOString(),
      updatedAt: new Date(interview.updatedAt).toISOString(),
    };

    if (!isCandidate) {
      dto.recruiterPrivateNotes = interview.recruiterPrivateNotes ?? null;
      dto.recruiterFeedback = interview.recruiterFeedback ?? null;
    }

    return dto;
  }
}
