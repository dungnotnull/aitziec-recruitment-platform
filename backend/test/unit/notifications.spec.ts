import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { EmailService } from '../../src/email/email.service';
import { PrismaService } from '../../src/database/prisma.service';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

describe('NotificationsService (Unit)', () => {
  let service: NotificationsService;
  let inMemoryPrisma: InMemoryPrismaService;
  let emailService: EmailService;

  const candidateUser: AuthenticatedUser = {
    id: 'cand-user-1',
    email: 'cand@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  const otherUser: AuthenticatedUser = {
    id: 'cand-user-2',
    email: 'cand2@test.com',
    role: 'CANDIDATE',
    status: 'ACTIVE',
  };

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();

    inMemoryPrisma.users.push({
      id: candidateUser.id,
      email: candidateUser.email,
      role: 'CANDIDATE',
      status: 'ACTIVE',
      passwordHash: 'hash',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: any) => {
              if (key === 'EMAIL_FROM') return 'no-reply@test.internal';
              return defaultVal;
            }),
          },
        },
        { provide: PrismaService, useValue: inMemoryPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    inMemoryPrisma.reset();
    emailService.clearSentEmails();
  });

  describe('listNotifications & filtering', () => {
    it('should list notifications for current user with unread count and read filtering', async () => {
      // Create 1 read and 1 unread notification for candidateUser
      await inMemoryPrisma.notification.create({
        data: {
          id: 'notif-1',
          userId: candidateUser.id,
          type: NotificationType.APPLICATION_SUBMITTED,
          title: 'Submitted 1',
          body: 'Body 1',
          readAt: new Date(),
        },
      });

      await inMemoryPrisma.notification.create({
        data: {
          id: 'notif-2',
          userId: candidateUser.id,
          type: NotificationType.INTERVIEW_SCHEDULED,
          title: 'Interview 1',
          body: 'Body 2',
          readAt: null,
        },
      });

      // Notification for another user
      await inMemoryPrisma.notification.create({
        data: {
          id: 'notif-3',
          userId: otherUser.id,
          type: NotificationType.APPLICATION_SUBMITTED,
          title: 'Other',
          body: 'Other body',
          readAt: null,
        },
      });

      // List all candidateUser notifications
      const allRes = await service.listNotifications(candidateUser, { limit: 10 });
      expect(allRes.data.length).toBe(2);
      expect(allRes.meta.unreadCount).toBe(1);

      // Filter unread only
      const unreadRes = await service.listNotifications(candidateUser, { read: false });
      expect(unreadRes.data.length).toBe(1);
      expect(unreadRes.data[0].id).toBe('notif-2');

      // Filter read only
      const readRes = await service.listNotifications(candidateUser, { read: true });
      expect(readRes.data.length).toBe(1);
      expect(readRes.data[0].id).toBe('notif-1');
    });
  });

  describe('markAsRead', () => {
    it('should mark unread notification as read', async () => {
      const notif = await inMemoryPrisma.notification.create({
        data: {
          id: 'notif-to-read',
          userId: candidateUser.id,
          type: NotificationType.APPLICATION_SUBMITTED,
          title: 'Test',
          body: 'Body',
          readAt: null,
        },
      });

      const updated = await service.markAsRead(candidateUser, notif.id);
      expect(updated.readAt).not.toBeNull();
    });

    it('should forbid user from reading another user notification', async () => {
      const notif = await inMemoryPrisma.notification.create({
        data: {
          id: 'notif-other',
          userId: otherUser.id,
          type: NotificationType.APPLICATION_SUBMITTED,
          title: 'Test',
          body: 'Body',
          readAt: null,
        },
      });

      await expect(service.markAsRead(candidateUser, notif.id)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      await expect(service.markAsRead(candidateUser, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('routeEvent', () => {
    it('should route ApplicationSubmitted event: creates in-app notification and sends email', async () => {
      await service.routeEvent('ApplicationSubmitted', {
        applicationId: 'app-1',
        candidateUserId: candidateUser.id,
        jobTitle: 'Senior Backend Engineer',
        companyName: 'Tech Corp',
      });

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe(NotificationType.APPLICATION_SUBMITTED);

      const sentEmails = emailService.getSentEmails();
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].to).toBe(candidateUser.email);
      expect(sentEmails[0].subject).toContain('Senior Backend Engineer');
    });

    it('should route ApplicationStatusChanged event to PASSED outcome', async () => {
      await service.routeEvent('ApplicationStatusChanged', {
        applicationId: 'app-1',
        candidateUserId: candidateUser.id,
        toStatus: 'PASSED',
        jobTitle: 'Senior Backend Engineer',
        companyName: 'Tech Corp',
      });

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe(NotificationType.APPLICATION_OUTCOME);
      expect(notifs[0].title).toContain('PASSED');
    });

    it('should route InterviewScheduled event', async () => {
      await service.routeEvent('InterviewScheduled', {
        interviewId: 'int-1',
        candidateUserId: candidateUser.id,
        jobTitle: 'DevOps Engineer',
        companyName: 'Cloud Inc',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 90000000).toISOString(),
        locationOrMeetingUrl: 'https://meet.google.com/test',
      });

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe(NotificationType.INTERVIEW_SCHEDULED);
      expect(emailService.getSentEmails().length).toBe(1);
    });

    it('should route InterviewCancelled event', async () => {
      await service.routeEvent('InterviewCancelled', {
        interviewId: 'int-1',
        candidateUserId: candidateUser.id,
        jobTitle: 'DevOps Engineer',
        companyName: 'Cloud Inc',
        reason: 'Position put on hold',
      });

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe(NotificationType.INTERVIEW_CANCELLED);
      expect(notifs[0].body).toContain('Position put on hold');
    });
  });
});
