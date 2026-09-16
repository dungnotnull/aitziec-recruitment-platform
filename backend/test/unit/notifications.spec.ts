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
              if (key === 'FRONTEND_URL') return 'http://localhost:5173';
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

    it('should route ApplicationStatusChanged event: PASSED as status update and REJECTED as outcome', async () => {
      // Test PASSED: routes as APPLICATION_STATUS_CHANGED (not outcome)
      await service.routeEvent(
        'ApplicationStatusChanged',
        {
          applicationId: 'app-passed',
          candidateUserId: candidateUser.id,
          toStatus: 'PASSED',
          jobTitle: 'Senior Backend Engineer',
          companyName: 'Tech Corp',
        },
        1,
        'evt-pass-1',
      );

      const notifsPassed = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifsPassed.length).toBe(1);
      expect(notifsPassed[0].type).toBe(NotificationType.APPLICATION_STATUS_CHANGED);
      expect(notifsPassed[0].title).toContain('PASSED');

      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);
      const emailArgs = mockEmailService.sendEmail.mock.calls[0][0];
      expect(emailArgs.to).toBe(candidateUser.email);
      expect(emailArgs.subject).toContain('PASSED');
      expect(emailArgs.idempotencyKey).toBe('email-app-trans-app-passed-PASSED-evt-pass-1');

      // Test REJECTED: routes as APPLICATION_OUTCOME
      await service.routeEvent(
        'ApplicationStatusChanged',
        {
          applicationId: 'app-rej',
          candidateUserId: candidateUser.id,
          toStatus: 'REJECTED',
          jobTitle: 'Senior Backend Engineer',
          companyName: 'Tech Corp',
        },
        1,
        'evt-rej-1',
      );

      const notifsRej = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      expect(notifsRej.length).toBe(2);
      const rejNotif = notifsRej.find((n) => n.resourceId === 'app-rej');
      expect(rejNotif).toBeDefined();
      expect(rejNotif?.type).toBe(NotificationType.APPLICATION_OUTCOME);
    });

    it('BE-19-003 routes ApplicationOffered event: creates in-app notification and sends offer email', async () => {
      await service.routeEvent(
        'ApplicationOffered',
        {
          applicationId: 'app-offered',
          candidateUserId: candidateUser.id,
          jobTitle: 'Staff Engineer',
          companyName: 'Tech Corp',
          toStatus: 'OFFERED',
        },
        1,
        'evt-offer-1',
      );

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      const offerNotif = notifs.find((n) => n.title.includes('Offer'));
      expect(offerNotif).toBeDefined();
      expect(offerNotif?.type).toBe(NotificationType.APPLICATION_STATUS_CHANGED);

      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      const lastCall =
        mockEmailService.sendEmail.mock.calls[mockEmailService.sendEmail.mock.calls.length - 1][0];
      expect(lastCall.subject).toContain('Job Offer');
      expect(lastCall.idempotencyKey).toBe('email-app-offer-app-offered-evt-offer-1');
    });

    it('BE-19-003 routes ApplicationHired event: creates outcome notification and sends hire email', async () => {
      await service.routeEvent(
        'ApplicationHired',
        {
          applicationId: 'app-hired',
          candidateUserId: candidateUser.id,
          jobTitle: 'Staff Engineer',
          companyName: 'Tech Corp',
          toStatus: 'HIRED',
        },
        1,
        'evt-hire-1',
      );

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      const hireNotif = notifs.find((n) => n.title.includes('HIRED'));
      expect(hireNotif).toBeDefined();
      expect(hireNotif?.type).toBe(NotificationType.APPLICATION_OUTCOME);

      const lastCall =
        mockEmailService.sendEmail.mock.calls[mockEmailService.sendEmail.mock.calls.length - 1][0];
      expect(lastCall.subject).toContain('Congratulations! You are hired');
      expect(lastCall.idempotencyKey).toBe('email-app-hire-app-hired-evt-hire-1');
    });

    it('BE-19-003 routes ApplicationReconsidered event: creates status update notification and sends email', async () => {
      await service.routeEvent(
        'ApplicationReconsidered',
        {
          applicationId: 'app-reconsider',
          candidateUserId: candidateUser.id,
          jobTitle: 'Staff Engineer',
          companyName: 'Tech Corp',
          toStatus: 'REVIEWING',
        },
        1,
        'evt-reconsider-1',
      );

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: candidateUser.id },
      });
      const recNotif = notifs.find((n) => n.title.includes('Reconsidered'));
      expect(recNotif).toBeDefined();
      expect(recNotif?.type).toBe(NotificationType.APPLICATION_STATUS_CHANGED);

      const lastCall =
        mockEmailService.sendEmail.mock.calls[mockEmailService.sendEmail.mock.calls.length - 1][0];
      expect(lastCall.text).toContain('reopened and is being actively reconsidered');
      expect(lastCall.idempotencyKey).toBe('email-app-reconsider-app-reconsider-evt-reconsider-1');
    });

    it('BE-19-003 replay with same eventId is idempotent (deduplicates notification and email)', async () => {
      const payload = {
        applicationId: 'app-replay-test',
        candidateUserId: candidateUser.id,
        jobTitle: 'Backend Dev',
        companyName: 'Tech Corp',
        toStatus: 'OFFERED',
      };

      const initialNotifs = inMemoryPrisma.notifications.length;
      mockEmailService.sendEmail.mockClear();

      // First delivery
      await service.routeEvent('ApplicationOffered', payload, 1, 'evt-replay-key-1');
      expect(inMemoryPrisma.notifications.length).toBe(initialNotifs + 1);
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(1);

      // Replay same event
      await service.routeEvent('ApplicationOffered', payload, 1, 'evt-replay-key-1');
      expect(inMemoryPrisma.notifications.length).toBe(initialNotifs + 1); // No new notification row
      expect(mockEmailService.sendEmail).toHaveBeenCalledTimes(2); // Called with same key
    });

    it('BE-19-003 reconsider cycle REJECTED -> REVIEWING -> REJECTED sends notifications and emails for both rejections', async () => {
      const initialNotifs = inMemoryPrisma.notifications.length;

      // 1. First rejection
      await service.routeEvent(
        'ApplicationStatusChanged',
        {
          applicationId: 'app-cycle-1',
          candidateUserId: candidateUser.id,
          toStatus: 'REJECTED',
          jobTitle: 'Dev',
          companyName: 'Corp',
        },
        1,
        'evt-cycle-rej-1',
      );

      // 2. Reconsider
      await service.routeEvent(
        'ApplicationReconsidered',
        {
          applicationId: 'app-cycle-1',
          candidateUserId: candidateUser.id,
          toStatus: 'REVIEWING',
          jobTitle: 'Dev',
          companyName: 'Corp',
        },
        1,
        'evt-cycle-rec-2',
      );

      // 3. Second rejection
      await service.routeEvent(
        'ApplicationStatusChanged',
        {
          applicationId: 'app-cycle-1',
          candidateUserId: candidateUser.id,
          toStatus: 'REJECTED',
          jobTitle: 'Dev',
          companyName: 'Corp',
        },
        1,
        'evt-cycle-rej-3',
      );

      const appNotifs = inMemoryPrisma.notifications.filter((n) => n.resourceId === 'app-cycle-1');
      expect(inMemoryPrisma.notifications.length).toBe(initialNotifs + 3);
      expect(appNotifs.length).toBe(3); // All 3 events produced distinct in-app notifications
      expect(appNotifs[0].type).toBe(NotificationType.APPLICATION_OUTCOME);
      expect(appNotifs[1].type).toBe(NotificationType.APPLICATION_STATUS_CHANGED);
      expect(appNotifs[2].type).toBe(NotificationType.APPLICATION_OUTCOME);
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
      expect(emailArgs.html).toContain(
        `href="http://localhost:5173/company-invitations/${rawToken}/accept"`,
      );
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

    it('should route JobPendingApproval event: creates in-app notification for each unique owner (BE-14-001)', async () => {
      const owner1Id = 'owner-user-1';
      const owner2Id = 'owner-user-2';

      await service.routeEvent('JobPendingApproval', {
        jobId: 'job-101',
        jobTitle: 'Principal Architect',
        companyId: 'comp-1',
        companyName: 'Tech Corp',
        requesterUserId: 'recruiter-1',
        ownerUserIds: [owner1Id, owner2Id, owner1Id], // intentional duplicate to test dedupe
        jobVersion: 2,
        submittedAt: new Date().toISOString(),
      });

      const notifsOwner1 = await inMemoryPrisma.notification.findMany({
        where: { userId: owner1Id },
      });
      const notifsOwner2 = await inMemoryPrisma.notification.findMany({
        where: { userId: owner2Id },
      });

      expect(notifsOwner1.length).toBe(1);
      expect(notifsOwner1[0].type).toBe(NotificationType.JOB_PENDING_APPROVAL);
      expect(notifsOwner1[0].title).toBe('Job Approval Required');
      expect(notifsOwner1[0].body).toContain('Principal Architect');
      expect(notifsOwner1[0].body).toContain('version 2');
      expect(notifsOwner1[0].resourceType).toBe('JOB');
      expect(notifsOwner1[0].resourceId).toBe('job-101');
      expect(notifsOwner1[0].readAt).toBeNull();

      expect(notifsOwner2.length).toBe(1);
      expect(notifsOwner2[0].type).toBe(NotificationType.JOB_PENDING_APPROVAL);
      expect(notifsOwner2[0].resourceId).toBe('job-101');
    });

    it('should be idempotent on replay of same JobPendingApproval event (BE-14-001)', async () => {
      const ownerId = 'owner-user-replay';
      const submittedAt = new Date().toISOString();

      const payload = {
        jobId: 'job-102',
        jobTitle: 'Senior Dev',
        companyId: 'comp-1',
        companyName: 'Tech Corp',
        requesterUserId: 'recruiter-1',
        ownerUserIds: [ownerId],
        jobVersion: 1,
        submittedAt,
      };

      await service.routeEvent('JobPendingApproval', payload);
      await service.routeEvent('JobPendingApproval', payload);

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: ownerId },
      });
      expect(notifs.length).toBe(1);
    });

    it('should create new notification for a subsequent transition of the same job with a newer version (BE-14-001)', async () => {
      const ownerId = 'owner-user-subsequent';
      const now = Date.now();

      await service.routeEvent('JobPendingApproval', {
        jobId: 'job-103',
        jobTitle: 'Senior Dev',
        companyId: 'comp-1',
        companyName: 'Tech Corp',
        requesterUserId: 'recruiter-1',
        ownerUserIds: [ownerId],
        jobVersion: 2,
        submittedAt: new Date(now).toISOString(),
      });

      await service.routeEvent('JobPendingApproval', {
        jobId: 'job-103',
        jobTitle: 'Senior Dev',
        companyId: 'comp-1',
        companyName: 'Tech Corp',
        requesterUserId: 'recruiter-1',
        ownerUserIds: [ownerId],
        jobVersion: 3,
        submittedAt: new Date(now + 60000).toISOString(),
      });

      const notifs = await inMemoryPrisma.notification.findMany({
        where: { userId: ownerId },
      });
      expect(notifs.length).toBe(2);
    });

    it('should propagate errors when notification creation fails so worker can retry (BE-14-001)', async () => {
      jest
        .spyOn(inMemoryPrisma.notification, 'create')
        .mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(
        service.routeEvent('JobPendingApproval', {
          jobId: 'job-err',
          jobTitle: 'Fail Job',
          companyId: 'comp-1',
          requesterUserId: 'recruiter-1',
          ownerUserIds: ['owner-fail'],
          jobVersion: 1,
          submittedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow('Database connection lost');
    });
  });
});
