import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailTemplates } from '../email/email-templates';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CompanyMemberRole, Notification, NotificationType, Prisma } from '@prisma/client';
import { ERROR_CODES } from '../common/constants/error-codes';
import { CollectionResponse } from '../common/dto/response.dto';
import {
  CreateNotificationDto,
  MarkNotificationReadDto,
  NotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';
import { validateEventVersion, SUPPORTED_EVENT_VERSION } from '../outbox/domain-events';
import { InvitationDeliveryWorker } from '../companies/workers/invitation-delivery.worker';

export interface EventRoutingPayload {
  candidateUserId?: string;
  applicationId?: string;
  jobTitle?: string;
  companyName?: string;
  companyId?: string;
  toStatus?: string;
  interviewId?: string;
  startsAt?: string;
  endsAt?: string;
  locationOrMeetingUrl?: string;
  candidateInstructions?: string;
  reason?: string;
  userId?: string;
  role?: string;
  email?: string;
  invitationId?: string;
  jobId?: string;
  requesterUserId?: string;
  ownerUserIds?: string[];
  jobVersion?: number;
  submittedAt?: string;
  managerUserIds?: string[];
  [key: string]: unknown;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    @Optional() private readonly invitationDeliveryWorker?: InvitationDeliveryWorker,
  ) {}

  async listNotifications(
    user: AuthenticatedUser,
    query: NotificationQueryDto,
  ): Promise<CollectionResponse<NotificationDto>> {
    const limit = query.limit ?? 20;
    const where: Prisma.NotificationWhereInput = { userId: user.id };

    if (query.read === true) {
      where.readAt = { not: null };
    } else if (query.read === false) {
      where.readAt = null;
    }

    const unreadCount = this.prisma.notification?.count
      ? await this.prisma.notification.count({
          where: { userId: user.id, readAt: null },
        })
      : 0;

    const findArgs: Prisma.NotificationFindManyArgs = {
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    };

    if (query.cursor) {
      const { createdAt: cursorCreatedAt, id: cursorId } = this.decodeCursor(query.cursor);

      const cursorRecord = await this.prisma.notification.findUnique({
        where: { id: cursorId },
      });

      if (
        !cursorRecord ||
        cursorRecord.userId !== user.id ||
        new Date(cursorRecord.createdAt).getTime() !== cursorCreatedAt.getTime()
      ) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Pagination cursor is invalid, expired, or belongs to another user.',
        });
      }

      if (query.read === true && !cursorRecord.readAt) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Pagination cursor does not match the active filter.',
        });
      }

      if (query.read === false && cursorRecord.readAt) {
        throw new BadRequestException({
          code: ERROR_CODES.INVALID_CURSOR,
          message: 'Pagination cursor does not match the active filter.',
        });
      }

      findArgs.cursor = { id: cursorId };
      findArgs.skip = 1;
    }

    const items = await this.prisma.notification.findMany(findArgs);
    const hasMore = items.length > limit;
    const dataItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor =
      hasMore && dataItems.length > 0
        ? this.encodeCursor(
            dataItems[dataItems.length - 1].createdAt,
            dataItems[dataItems.length - 1].id,
          )
        : null;

    return {
      data: dataItems.map((n) => this.toNotificationDto(n)),
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
        unreadCount,
      },
    };
  }

  async markAsRead(
    user: AuthenticatedUser,
    notificationId: string,
    body?: MarkNotificationReadDto,
  ): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: `Notification with ID ${notificationId} not found`,
      });
    }

    if (notification.userId !== user.id) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You do not have permission to modify this notification',
      });
    }

    const shouldRead = body ? body.read : true;

    if (shouldRead) {
      if (notification.readAt) {
        return this.toNotificationDto(notification);
      }
      const updated = await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
      return this.toNotificationDto(updated);
    } else {
      if (!notification.readAt) {
        return this.toNotificationDto(notification);
      }
      const updated = await this.prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: null },
      });
      return this.toNotificationDto(updated);
    }
  }

  async createNotification(dto: CreateNotificationDto): Promise<NotificationDto> {
    if (dto.deliveryKey) {
      const existing = await this.prisma.notification.findUnique({
        where: { deliveryKey: dto.deliveryKey },
      });
      if (existing) {
        return this.toNotificationDto(existing);
      }
    } else {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId: dto.userId,
          type: dto.type,
          resourceType: dto.resourceType ?? null,
          resourceId: dto.resourceId ?? null,
        },
      });

      if (existing) {
        return this.toNotificationDto(existing);
      }
    }

    try {
      const created = await this.prisma.notification.create({
        data: {
          userId: dto.userId,
          type: dto.type,
          title: dto.title,
          body: dto.body,
          resourceType: dto.resourceType ?? null,
          resourceId: dto.resourceId ?? null,
          sourceEventId: dto.sourceEventId ?? null,
          deliveryKey: dto.deliveryKey ?? null,
        },
      });

      return this.toNotificationDto(created);
    } catch (err: unknown) {
      if (dto.deliveryKey && err instanceof Error && (err as { code?: string }).code === 'P2002') {
        const fallback = await this.prisma.notification.findUnique({
          where: { deliveryKey: dto.deliveryKey },
        });
        if (fallback) {
          return this.toNotificationDto(fallback);
        }
      }
      throw err;
    }
  }

  async routeEvent(
    eventType: string,
    payload: EventRoutingPayload,
    eventVersion: number = SUPPORTED_EVENT_VERSION,
    eventId?: string,
  ): Promise<void> {
    validateEventVersion(eventVersion);
    try {
      switch (eventType) {
        case 'ApplicationSubmitted': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.APPLICATION_SUBMITTED,
              title: 'Application Submitted',
              body: `Your application for ${payload.jobTitle || 'the position'} has been submitted.`,
              resourceType: 'APPLICATION',
              resourceId: payload.applicationId,
              sourceEventId: eventId,
              deliveryKey: eventId ? `notif-${eventId}-${payload.candidateUserId}` : undefined,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.applicationSubmitted(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-app-sub-${payload.applicationId}`,
              });
            }
          }

          // Fan-out in-app notification to job managers (BE-21-001)
          await this.fanOutRecruiterApplicationNotification(
            'ApplicationSubmitted',
            NotificationType.APPLICATION_SUBMITTED,
            'New Application Received',
            `A new application has been submitted for ${payload.jobTitle || 'the position'}.`,
            payload,
            eventId,
          );
          break;
        }

        case 'ApplicationStatusChanged': {
          if (payload.candidateUserId) {
            const isTerminal = payload.toStatus === 'REJECTED';
            const notifType = isTerminal
              ? NotificationType.APPLICATION_OUTCOME
              : NotificationType.APPLICATION_STATUS_CHANGED;

            await this.createNotification({
              userId: payload.candidateUserId,
              type: notifType,
              title: `Application Status: ${payload.toStatus}`,
              body: `Your application for ${payload.jobTitle || 'the position'} is now ${payload.toStatus}.`,
              resourceType: 'APPLICATION',
              resourceId: payload.applicationId,
              sourceEventId: eventId,
              deliveryKey: eventId ? `notif-${eventId}-${payload.candidateUserId}` : undefined,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.applicationStatusChanged(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
                payload.toStatus || 'UPDATED',
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-app-trans-${payload.applicationId}-${payload.toStatus}-${eventId || ''}`,
              });
            }
          }
          break;
        }

        case 'ApplicationOffered': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.APPLICATION_STATUS_CHANGED,
              title: `Application Offer: ${payload.jobTitle || 'Position'}`,
              body: `Congratulations! You have received a job offer for ${payload.jobTitle || 'the position'} at ${payload.companyName || 'the company'}.`,
              resourceType: 'APPLICATION',
              resourceId: payload.applicationId,
              sourceEventId: eventId,
              deliveryKey: eventId ? `notif-${eventId}-${payload.candidateUserId}` : undefined,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.applicationOffered(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-app-offer-${payload.applicationId}-${eventId || ''}`,
              });
            }
          }
          break;
        }

        case 'ApplicationHired': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.APPLICATION_OUTCOME,
              title: 'Application Outcome: HIRED',
              body: `Congratulations! You have been officially hired for ${payload.jobTitle || 'the position'} at ${payload.companyName || 'the company'}.`,
              resourceType: 'APPLICATION',
              resourceId: payload.applicationId,
              sourceEventId: eventId,
              deliveryKey: eventId ? `notif-${eventId}-${payload.candidateUserId}` : undefined,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.applicationHired(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-app-hire-${payload.applicationId}-${eventId || ''}`,
              });
            }
          }

          // Fan-out in-app notification to job managers (BE-21-001)
          await this.fanOutRecruiterApplicationNotification(
            'ApplicationHired',
            NotificationType.APPLICATION_OUTCOME,
            'Candidate Hired',
            `A candidate has been officially hired for ${payload.jobTitle || 'the position'}.`,
            payload,
            eventId,
          );
          break;
        }

        case 'ApplicationReconsidered': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.APPLICATION_STATUS_CHANGED,
              title: `Application Reconsidered: ${payload.jobTitle || 'Position'}`,
              body: `Your application for ${payload.jobTitle || 'the position'} at ${payload.companyName || 'the company'} is being reconsidered.`,
              resourceType: 'APPLICATION',
              resourceId: payload.applicationId,
              sourceEventId: eventId,
              deliveryKey: eventId ? `notif-${eventId}-${payload.candidateUserId}` : undefined,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.applicationReconsidered(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-app-reconsider-${payload.applicationId}-${eventId || ''}`,
              });
            }
          }
          break;
        }

        case 'InterviewScheduled': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.INTERVIEW_SCHEDULED,
              title: 'Interview Scheduled',
              body: `An interview for ${payload.jobTitle || 'the job'} has been scheduled on ${payload.startsAt}.`,
              resourceType: 'INTERVIEW',
              resourceId: payload.interviewId,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.interviewScheduled(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
                payload.startsAt || '',
                payload.endsAt || '',
                payload.locationOrMeetingUrl || 'TBD',
                payload.candidateInstructions,
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-int-sched-${payload.interviewId}`,
              });
            }
          }
          break;
        }

        case 'InterviewRescheduled': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.INTERVIEW_RESCHEDULED,
              title: 'Interview Rescheduled',
              body: `Your interview for ${payload.jobTitle || 'the job'} has been rescheduled to ${payload.startsAt}.`,
              resourceType: 'INTERVIEW',
              resourceId: payload.interviewId,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.interviewRescheduled(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
                payload.startsAt || '',
                payload.endsAt || '',
                payload.locationOrMeetingUrl || 'TBD',
                payload.candidateInstructions,
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-int-resched-${payload.interviewId}-${payload.startsAt}`,
              });
            }
          }
          break;
        }

        case 'InterviewCancelled': {
          if (payload.candidateUserId) {
            await this.createNotification({
              userId: payload.candidateUserId,
              type: NotificationType.INTERVIEW_CANCELLED,
              title: 'Interview Cancelled',
              body: `Your interview for ${payload.jobTitle || 'the job'} has been cancelled. Reason: ${payload.reason || 'Not specified'}`,
              resourceType: 'INTERVIEW',
              resourceId: payload.interviewId,
            });

            const candidateUser = await this.prisma.user.findUnique({
              where: { id: payload.candidateUserId },
            });
            if (candidateUser?.email) {
              const tmpl = EmailTemplates.interviewCancelled(
                payload.jobTitle || 'Job',
                payload.companyName || 'Company',
                payload.reason || 'N/A',
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-int-cancel-${payload.interviewId}`,
              });
            }
          }
          break;
        }

        case 'CompanyMemberAdded': {
          if (payload.userId) {
            await this.createNotification({
              userId: payload.userId,
              type: NotificationType.COMPANY_MEMBER_ADDED,
              title: 'Joined Company Workspace',
              body: `You have been added as ${payload.role || 'a member'} to ${payload.companyName || 'the company'}.`,
              resourceType: 'COMPANY',
              resourceId: payload.companyId,
            });

            const targetUser = await this.prisma.user.findUnique({
              where: { id: payload.userId },
            });
            if (targetUser?.email) {
              const tmpl = EmailTemplates.companyMemberAdded(
                payload.companyName || 'Company',
                payload.role || 'RECRUITER',
              );
              await this.emailService.sendEmail({
                to: targetUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-comp-member-${payload.companyId}-${payload.userId}`,
              });
            }
          }
          break;
        }

        case 'CompanyInvitationCreated': {
          if (payload.email) {
            if (this.invitationDeliveryWorker) {
              await this.invitationDeliveryWorker.deliverInvitation({
                invitationId: payload.invitationId || '',
                companyName: payload.companyName || 'Company',
                role: (payload.role as CompanyMemberRole) || 'RECRUITER',
                email: payload.email,
              });
            } else {
              const tmpl = EmailTemplates.companyInvitation(
                payload.companyName || 'Company',
                payload.role || 'RECRUITER',
              );
              await this.emailService.sendEmail({
                to: payload.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-comp-inv-${payload.invitationId}`,
              });
            }
          }
          break;
        }

        case 'JobPendingApproval': {
          const ownerIds = payload.ownerUserIds;
          if (Array.isArray(ownerIds) && ownerIds.length > 0 && payload.jobId) {
            const uniqueOwnerIds = Array.from(new Set(ownerIds));
            const submittedAtDate = payload.submittedAt
              ? new Date(payload.submittedAt)
              : new Date();
            for (const ownerId of uniqueOwnerIds) {
              const existing = await this.prisma.notification.findFirst({
                where: {
                  userId: ownerId,
                  type: NotificationType.JOB_PENDING_APPROVAL,
                  resourceType: 'JOB',
                  resourceId: payload.jobId,
                  OR: [
                    payload.jobVersion !== undefined
                      ? { body: { contains: `version ${payload.jobVersion}` } }
                      : { createdAt: { gte: submittedAtDate } },
                    { createdAt: { gte: submittedAtDate } },
                  ],
                },
              });

              if (!existing) {
                await this.prisma.notification.create({
                  data: {
                    userId: ownerId,
                    type: NotificationType.JOB_PENDING_APPROVAL,
                    title: 'Job Approval Required',
                    body: `A job posting "${payload.jobTitle || 'Job'}" (version ${payload.jobVersion ?? 1}) requires your approval.`,
                    resourceType: 'JOB',
                    resourceId: payload.jobId,
                  },
                });
              }
            }
          }
          break;
        }

        default:
          this.logger.debug(`Unhandled event type in NotificationsService: ${eventType}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error routing notification event ${eventType}: ${msg}`, stack);
      throw err;
    }
  }

  private toNotificationDto(n: Notification): NotificationDto {
    const resource =
      n.resourceType && n.resourceId ? { type: n.resourceType, id: n.resourceId } : null;

    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      resource,
      readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
      createdAt: new Date(n.createdAt).toISOString(),
    };
  }

  private encodeCursor(createdAt: Date | string, id: string): string {
    const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
    return Buffer.from(`${date.toISOString()}|${id}`).toString('base64');
  }

  private decodeCursor(cursor: string): { createdAt: Date; id: string } {
    if (!cursor || typeof cursor !== 'string') {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Con trỏ phân trang không hợp lệ.',
      });
    }

    let decoded: string;
    try {
      const buf = Buffer.from(cursor, 'base64');
      decoded = buf.toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64') !== cursor) {
        throw new Error('Not canonical base64');
      }
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Con trỏ phân trang sai định dạng base64.',
      });
    }

    const parts = decoded.split('|');
    if (parts.length !== 2) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Con trỏ phân trang sai cấu trúc.',
      });
    }

    const [isoDate, id] = parts;
    const createdAt = new Date(isoDate);
    if (isNaN(createdAt.getTime()) || !id || id.trim().length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Con trỏ phân trang chứa dữ liệu không hợp lệ.',
      });
    }

    return { createdAt, id };
  }

  /**
   * Fans out in-app notifications to active job managers (BE-21-001).
   */
  private async fanOutRecruiterApplicationNotification(
    eventName: string,
    notifType: NotificationType,
    title: string,
    body: string,
    payload: EventRoutingPayload,
    eventId?: string,
  ): Promise<void> {
    const rawManagerIds = Array.isArray(payload.managerUserIds) ? payload.managerUserIds : [];

    const uniqueManagerIds = Array.from(new Set(rawManagerIds)).filter(
      (id) => !payload.candidateUserId || id !== payload.candidateUserId,
    );

    if (uniqueManagerIds.length === 0) {
      this.logger.warn(
        `No active managers found for application event ${eventName} (jobId: ${payload.jobId}, companyId: ${payload.companyId}, eventId: ${eventId})`,
      );
      return;
    }

    if (!payload.jobId || !payload.companyId || !payload.applicationId) {
      this.logger.warn(
        `Missing required fields for recruiter notification fan-out on ${eventName} (jobId: ${payload.jobId}, companyId: ${payload.companyId})`,
      );
      return;
    }

    const job = await this.prisma.job.findUnique({
      where: { id: payload.jobId },
      select: { creatorId: true, companyId: true },
    });

    if (!job || job.companyId !== payload.companyId) {
      this.logger.warn(
        `Job not found or company mismatch for recruiter notification fan-out on ${eventName} (jobId: ${payload.jobId})`,
      );
      return;
    }

    for (const managerUserId of uniqueManagerIds) {
      try {
        const membership = await this.prisma.companyMembership.findFirst({
          where: {
            companyId: payload.companyId,
            userId: managerUserId,
          },
          include: {
            user: true,
          },
        });

        if (
          !membership ||
          membership.user?.status !== 'ACTIVE' ||
          (membership.role !== CompanyMemberRole.OWNER &&
            !(membership.role === CompanyMemberRole.RECRUITER && job.creatorId === managerUserId))
        ) {
          continue;
        }

        await this.createNotification({
          userId: managerUserId,
          type: notifType,
          title,
          body,
          resourceType: 'APPLICATION',
          resourceId: payload.applicationId,
          sourceEventId: eventId,
          deliveryKey: eventId ? `notif-${eventId}-${managerUserId}` : undefined,
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to create recruiter notification for manager ${managerUserId} on event ${eventName}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
