import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EmailService } from '../email/email.service';
import { EmailTemplates } from '../email/email-templates';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';
import {
  CreateNotificationDto,
  NotificationDto,
  NotificationQueryDto,
} from './dto/notification.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async listNotifications(
    user: AuthenticatedUser,
    query: NotificationQueryDto,
  ): Promise<{
    data: NotificationDto[];
    meta: { hasMore: boolean; nextCursor: string | null; total: number; unreadCount: number };
  }> {
    const limit = query.limit || 20;
    const where: any = { userId: user.id };

    if (query.read === true) {
      where.readAt = { not: null };
    } else if (query.read === false) {
      where.readAt = null;
    }

    const unreadCount = (this.prisma.notification as any).count
      ? await (this.prisma.notification as any).count({
          where: { userId: user.id, readAt: null },
        })
      : 0;

    const total = (this.prisma.notification as any).count
      ? await (this.prisma.notification as any).count({ where })
      : 0;

    const findArgs: any = {
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    };

    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const items = await this.prisma.notification.findMany(findArgs);
    const hasMore = items.length > limit;
    const dataItems = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? dataItems[dataItems.length - 1].id : null;

    return {
      data: dataItems.map(this.toNotificationDto),
      meta: {
        hasMore,
        nextCursor,
        total: total || dataItems.length,
        unreadCount,
      },
    };
  }

  async markAsRead(user: AuthenticatedUser, notificationId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${notificationId} not found`);
    }

    if (notification.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to modify this notification');
    }

    if (notification.readAt) {
      return this.toNotificationDto(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return this.toNotificationDto(updated);
  }

  async createNotification(dto: CreateNotificationDto): Promise<NotificationDto> {
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

  async routeEvent(eventType: string, payload: any): Promise<void> {
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
                payload.toStatus,
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
                payload.startsAt,
                payload.endsAt,
                payload.locationOrMeetingUrl,
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
                payload.startsAt,
                payload.endsAt,
                payload.locationOrMeetingUrl,
                payload.candidateInstructions,
              );
              await this.emailService.sendEmail({
                to: candidateUser.email,
                subject: tmpl.subject,
                text: tmpl.text,
                html: tmpl.html,
                idempotencyKey: `email-int-resched-${payload.interviewId}-${Date.now()}`,
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
          break;
        }

        default:
          this.logger.debug(`Unhandled event type in NotificationsService: ${eventType}`);
      }
    } catch (err: any) {
      this.logger.error(`Error routing notification event ${eventType}: ${err.message}`, err.stack);
    }
  }

  private toNotificationDto(n: any): NotificationDto {
    return {
      id: n.id,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      resourceType: n.resourceType ?? null,
      resourceId: n.resourceId ?? null,
      readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
      createdAt: new Date(n.createdAt).toISOString(),
    };
  }
}
