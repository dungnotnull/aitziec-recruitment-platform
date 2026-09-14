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

    const created = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        body: dto.body,
        resourceType: dto.resourceType ?? null,
        resourceId: dto.resourceId ?? null,
      },
    });

    return this.toNotificationDto(created);
  }

  async routeEvent(
    eventType: string,
    payload: EventRoutingPayload,
    eventVersion: number = SUPPORTED_EVENT_VERSION,
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
          break;
        }

        case 'ApplicationStatusChanged': {
          if (payload.candidateUserId) {
            const isTerminal = payload.toStatus === 'PASSED' || payload.toStatus === 'REJECTED';
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
                idempotencyKey: `email-app-trans-${payload.applicationId}-${payload.toStatus}`,
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

        default:
          this.logger.debug(`Unhandled event type in NotificationsService: ${eventType}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error routing notification event ${eventType}: ${msg}`, stack);
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
}
