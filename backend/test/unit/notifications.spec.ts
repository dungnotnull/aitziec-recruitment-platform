import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { EmailService } from '../../src/email/email.service';
import { PrismaService } from '../../src/database/prisma.service';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { NotificationType } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvitationSecretAdapter } from '../../src/companies/adapters/invitation-secret.adapter';
import { InvitationDeliveryWorker } from '../../src/companies/workers/invitation-delivery.worker';
import { EmailTemplates } from '../../src/email/email-templates';

describe('NotificationsService (Unit)', () => {
  let service: NotificationsService;
  let inMemoryPrisma: InMemoryPrismaService;
  let secretAdapter: InvitationSecretAdapter;
  let deliveryWorker: InvitationDeliveryWorker;

  const mockEmailService = {
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'unit-test-message' }),
  };

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
    mockEmailService.sendEmail.mockClear();

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
        InvitationSecretAdapter,
        InvitationDeliveryWorker,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal?: unknown) => {
              if (key === 'EMAIL_FROM') return 'no-reply@test.internal';
              if (key === 'INVITATION_TOKEN_ENCRYPTION_KEY')
                return Buffer.alloc(32, 'k').toString('base64');
              if (key === 'FRONTEND_URL') return 'http://localhost:3000';
              return defaultVal;
            }),
          },
        },
        { provide: PrismaService, useValue: inMemoryPrisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    secretAdapter = module.get<InvitationSecretAdapter>(InvitationSecretAdapter);
    deliveryWorker = module.get<InvitationDeliveryWorker>(InvitationDeliveryWorker);
  });

  afterEach(() => {
    inMemoryPrisma.reset();
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
          resourceType: 'APPLICATION',
          resourceId: 'app-1',
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
          resourceType: 'INTERVIEW',
          resourceId: 'int-2',
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
      expect(allRes.meta.page.limit).toBe(10);

      // Exact-key check on returned notification: canonical projection without userId or flat resource fields
      const notifItem = allRes.data[0];
      const keys = Object.keys(notifItem).sort();
      expect(keys).toEqual(
        ['body', 'createdAt', 'id', 'readAt', 'resource', 'title', 'type'].sort(),
      );
      const flatNotif = notifItem as unknown as Record<string, unknown>;
      expect(flatNotif.userId).toBeUndefined();
      expect(flatNotif.resourceType).toBeUndefined();
      expect(flatNotif.resourceId).toBeUndefined();
      expect(notifItem.resource).toEqual({ type: 'APPLICATION', id: 'app-1' });

      // Filter unread only
      const unreadRes = await service.listNotifications(candidateUser, { read: false });
      expect(unreadRes.data.length).toBe(1);
      expect(unreadRes.data[0].id).toBe('notif-2');

      // Filter read only
      const readRes = await service.listNotifications(candidateUser, { read: true });
      expect(readRes.data.length).toBe(1);
      expect(readRes.data[0].id).toBe('notif-1');
    });

    it('should paginate deterministically with opaque cursor and reject invalid cursor', async () => {
      // Seed notifications with staggered createdAt
      for (let i = 1; i <= 5; i++) {
        await inMemoryPrisma.notification.create({
          data: {
            id: `notif-page-${i}`,
            userId: candidateUser.id,
            type: NotificationType.APPLICATION_SUBMITTED,
            title: `Title ${i}`,
            body: `Body ${i}`,
            readAt: null,
          },
        });
      }

      const page1 = await service.listNotifications(candidateUser, { limit: 2 });
      expect(page1.data.length).toBe(2);
      expect(page1.meta.page.hasNextPage).toBe(true);
      expect(page1.meta.page.nextCursor).toBeDefined();

      // Next cursor is opaque base64 string
      const cursor = page1.meta.page.nextCursor!;
      expect(typeof cursor).toBe('string');
      expect(cursor).not.toBe('notif-page-2'); // not raw ID

      const page2 = await service.listNotifications(candidateUser, { limit: 2, cursor });
      expect(page2.data.length).toBe(2);

      // Verify no overlap between pages
      const page1Ids = new Set(page1.data.map((n) => n.id));
      for (const item of page2.data) {
        expect(page1Ids.has(item.id)).toBe(false);
      }

      // Reject malformed cursor
      await expect(
        service.listNotifications(candidateUser, { cursor: 'invalid-base64-format@@' }),
      ).rejects.toThrow(BadRequestException);

      // Reject cursor for another user
      const otherUserCursor = Buffer.from(`${new Date().toISOString()}|notif-3`).toString('base64');
      await expect(
        service.listNotifications(candidateUser, { cursor: otherUserCursor }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('markAsRead', () => {
    it('should mark unread notification as read and replay deterministically', async () => {
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

      const updated = await service.markAsRead(candidateUser, notif.id, { read: true });
      expect(updated.readAt).not.toBeNull();
      expect(updated.id).toBe('notif-to-read');
      const flat = updated as unknown as Record<string, unknown>;
      expect(flat.userId).toBeUndefined();

      // Deterministic replay
      const replayed = await service.markAsRead(candidateUser, notif.id, { read: true });
      expect(replayed.readAt).toBe(updated.readAt);

      // Unmark read
      const unread = await service.markAsRead(candidateUser, notif.id, { read: false });
      expect(unread.readAt).toBeNull();

      // Deterministic replay unread
      const replayedUnread = await service.markAsRead(candidateUser, notif.id, { read: false });
      expect(replayedUnread.readAt).toBeNull();
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

      await expect(service.markAsRead(candidateUser, notif.id, { read: true })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException for non-existent notification', async () => {
      await expect(
        service.markAsRead(candidateUser, 'non-existent', { read: true }),
      ).rejects.toThrow(NotFoundException);
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

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe(candidateUser.email);
      expect(emailArgs.subject).toContain('Senior Backend Engineer');
      expect(emailArgs.text).toBeDefined();
      expect(emailArgs.idempotencyKey).toBe('email-app-sub-app-1');
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

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe(candidateUser.email);
      expect(emailArgs.subject).toContain('PASSED');
      expect(emailArgs.text).toBeDefined();
      expect(emailArgs.idempotencyKey).toBe('email-app-trans-app-1-PASSED');
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

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe(candidateUser.email);
      expect(emailArgs.subject).toContain('DevOps Engineer');
      expect(emailArgs.text).toBeDefined();
      expect(emailArgs.idempotencyKey).toBe('email-int-sched-int-1');
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

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe(candidateUser.email);
      expect(emailArgs.subject).toContain('Cancelled');
      expect(emailArgs.text).toBeDefined();
      expect(emailArgs.idempotencyKey).toBe('email-int-cancel-int-1');
    });

    it('should route CompanyMemberAdded event: creates in-app notification and sends email', async () => {
      await service.routeEvent('CompanyMemberAdded', {
        companyId: 'comp-1',
        companyName: 'Tech Corp',
        userId: candidateUser.id,
        role: 'RECRUITER',
        addedById: 'owner-user-1',
      });

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifs.length).toBe(1);
      expect(notifs[0].type).toBe(NotificationType.COMPANY_MEMBER_ADDED);
      expect(notifs[0].body).toContain('RECRUITER');

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe(candidateUser.email);
      expect(emailArgs.subject).toContain('Added to Tech Corp');
      expect(emailArgs.idempotencyKey).toBe('email-comp-member-comp-1-cand-user-1');
    });

    it('renders companyInvitation template with acceptUrl containing token', () => {
      const tmpl = EmailTemplates.companyInvitation(
        'Tech Corp',
        'RECRUITER',
        'http://localhost:3000/company-invitations/raw-token-xyz-123/accept',
      );

      expect(tmpl.subject).toContain('Invitation to join Tech Corp as RECRUITER');
      expect(tmpl.text).toContain('/company-invitations/raw-token-xyz-123/accept');
      expect(tmpl.html).toContain(
        'href="http://localhost:3000/company-invitations/raw-token-xyz-123/accept"',
      );
    });

    it('should route CompanyInvitationCreated event: decrypts one-time token, sends accept link and deletes delivery secret row', async () => {
      const rawToken = 'one-time-raw-secret-token-456';
      const encrypted = secretAdapter.encryptToken(rawToken);

      await inMemoryPrisma.companyInvitationDeliverySecret.create({
        data: {
          invitationId: 'inv-123',
          encryptedToken: encrypted.encryptedToken,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
        },
      });

      await service.routeEvent('CompanyInvitationCreated', {
        companyId: 'comp-1',
        companyName: 'Tech Corp',
        email: 'guest.invitee@test.com',
        role: 'RECRUITER',
        invitedById: 'owner-user-1',
        invitationId: 'inv-123',
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe('guest.invitee@test.com');
      expect(emailArgs.subject).toContain('Invitation to join Tech Corp');
      expect(emailArgs.idempotencyKey).toBe('email-comp-inv-inv-123');
      expect(emailArgs.text).toContain(`/company-invitations/${rawToken}/accept`);
      expect(emailArgs.html).toContain(`/company-invitations/${rawToken}/accept`);

      // Secret row must be deleted after confirmed delivery
      const remainingSecret = await inMemoryPrisma.companyInvitationDeliverySecret.findUnique({
        where: { invitationId: 'inv-123' },
      });
      expect(remainingSecret).toBeNull();
    });

    it('cleanupExpiredSecrets deletes secrets belonging to expired invitations', async () => {
      // Seed an expired invitation and an active invitation
      await inMemoryPrisma.companyInvitation.create({
        data: {
          id: 'inv-expired',
          companyId: 'comp-1',
          email: 'expired@test.com',
          role: 'RECRUITER',
          tokenHash: 'hash-exp',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 10000), // expired
        },
      });

      await inMemoryPrisma.companyInvitation.create({
        data: {
          id: 'inv-active',
          companyId: 'comp-1',
          email: 'active@test.com',
          role: 'RECRUITER',
          tokenHash: 'hash-act',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000), // active
        },
      });

      const enc1 = secretAdapter.encryptToken('token-exp');
      const enc2 = secretAdapter.encryptToken('token-act');

      await inMemoryPrisma.companyInvitationDeliverySecret.create({
        data: {
          invitationId: 'inv-expired',
          encryptedToken: enc1.encryptedToken,
          iv: enc1.iv,
          authTag: enc1.authTag,
        },
      });

      await inMemoryPrisma.companyInvitationDeliverySecret.create({
        data: {
          invitationId: 'inv-active',
          encryptedToken: enc2.encryptedToken,
          iv: enc2.iv,
          authTag: enc2.authTag,
        },
      });

      const deletedCount = await deliveryWorker.cleanupExpiredSecrets();
      expect(deletedCount).toBe(1);

      const expiredSec = await inMemoryPrisma.companyInvitationDeliverySecret.findUnique({
        where: { invitationId: 'inv-expired' },
      });
      expect(expiredSec).toBeNull();

      const activeSec = await inMemoryPrisma.companyInvitationDeliverySecret.findUnique({
        where: { invitationId: 'inv-active' },
      });
      expect(activeSec).not.toBeNull();
    });

    it('should reject unknown event version with BadRequestException', async () => {
      await expect(
        service.routeEvent(
          'ApplicationSubmitted',
          {
            applicationId: 'app-1',
            candidateUserId: candidateUser.id,
          },
          2, // unsupported version
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should silently skip creating notifications when candidateUserId is missing', async () => {
      const initialCount = (
        await inMemoryPrisma.notification.findMany({ where: { userId: candidateUser.id } })
      ).length;

      await service.routeEvent('ApplicationSubmitted', {
        applicationId: 'app-1',
        candidateId: 'profile-id-only',
        // candidateUserId missing
      });

      const afterCount = (
        await inMemoryPrisma.notification.findMany({ where: { userId: candidateUser.id } })
      ).length;
      expect(afterCount).toBe(initialCount);
    });
  });
});
