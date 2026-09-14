import { BadRequestException } from '@nestjs/common';
import { OutboxService } from '../../src/outbox/outbox.service';
import { OutboxDispatcherService } from '../../src/outbox/outbox-dispatcher.service';
import { NotificationProcessor } from '../../src/notifications/workers/notification.processor';
import { EmailProcessor } from '../../src/email/workers/email.processor';
import { QueueInfrastructureError } from '../../src/queues/queue.service';

describe('OutboxService (BE-1-012, BE-10-007)', () => {
  let service: OutboxService;
  let mockPrisma: any;
  let mockQueueService: any;

  beforeEach(() => {
    mockPrisma = {
      outboxEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    mockQueueService = {
      addJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };
    service = new OutboxService(mockPrisma, mockQueueService);
  });

  it('records an outbox event in the database within a transaction', async () => {
    const mockTx: any = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-rec-1', eventId: 'uuid-1' }),
      },
    };

    const event = await service.recordEvent(mockTx, {
      eventName: 'ApplicationSubmitted',
      aggregateType: 'Application',
      aggregateId: 'app-1',
      payload: {
        applicationId: 'app-1',
        candidateId: 'cand-1',
        candidateUserId: 'user-1',
        jobId: 'job-1',
        jobTitle: 'Engineer',
        companyId: 'comp-1',
        companyName: 'Acme',
        submittedAt: new Date().toISOString(),
      },
      requestId: 'req-1',
      actorId: 'user-1',
    });

    expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        eventId: expect.any(String),
        eventName: 'ApplicationSubmitted',
        eventVersion: 1,
        aggregateType: 'Application',
        aggregateId: 'app-1',
        payload: expect.objectContaining({ applicationId: 'app-1', candidateUserId: 'user-1' }),
        requestId: 'req-1',
        actorId: 'user-1',
      },
    });
    expect(event).toBeDefined();
  });

  it('rejects recording outbox event with unsupported event version', async () => {
    const mockTx: any = {
      outboxEvent: { create: jest.fn() },
    };

    await expect(
      service.recordEvent(mockTx, {
        eventName: 'ApplicationSubmitted',
        eventVersion: 2,
        aggregateType: 'Application',
        aggregateId: 'app-1',
        payload: {
          applicationId: 'app-1',
          candidateId: 'cand-1',
          candidateUserId: 'user-1',
          jobId: 'job-1',
          jobTitle: 'Engineer',
          companyId: 'comp-1',
          companyName: 'Acme',
          submittedAt: new Date().toISOString(),
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects recording outbox event containing prohibited private fields', async () => {
    const mockTx: any = {
      outboxEvent: { create: jest.fn() },
    };

    await expect(
      service.recordEvent(mockTx, {
        eventName: 'ApplicationStatusChanged',
        aggregateType: 'Application',
        aggregateId: 'app-1',
        payload: {
          applicationId: 'app-1',
          candidateId: 'cand-1',
          candidateUserId: 'user-1',
          jobId: 'job-1',
          jobTitle: 'Engineer',
          companyId: 'comp-1',
          companyName: 'Acme',
          fromStatus: 'APPLIED',
          toStatus: 'REJECTED',
          changedAt: new Date().toISOString(),
          note: 'Secret private recruiter internal note', // Prohibited!
        } as any,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('dispatches pending events to the queue and marks them dispatched', async () => {
    const mockEvents = [
      {
        id: 'db-id-1',
        eventId: 'evt-uuid-1',
        eventName: 'ApplicationSubmitted',
        eventVersion: 1,
        aggregateType: 'Application',
        aggregateId: 'app-1',
        payload: { candidateId: 'cand-1' },
        occurredAt: new Date(),
        requestId: 'req-1',
        actorId: 'cand-1',
      },
    ];

    mockPrisma.outboxEvent.findMany.mockResolvedValue(mockEvents);
    mockPrisma.outboxEvent.update.mockResolvedValue({});

    const dispatchedCount = await service.dispatchPendingEvents(10);

    expect(dispatchedCount).toBe(1);
    expect(mockQueueService.addJob).toHaveBeenCalledWith(
      'notification-queue',
      'ApplicationSubmitted',
      expect.objectContaining({
        eventId: 'evt-uuid-1',
      }),
      { jobId: 'evt-uuid-1' },
    );
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'db-id-1' },
      data: { dispatchedAt: expect.any(Date) },
    });
  });

  it('leaves outbox events pending if queue fails to accept the job (BE-10-009)', async () => {
    const mockEvents = [
      {
        id: 'db-id-2',
        eventId: 'evt-uuid-2',
        eventName: 'ApplicationSubmitted',
        eventVersion: 1,
        aggregateType: 'Application',
        aggregateId: 'app-2',
        payload: { candidateId: 'cand-2' },
        occurredAt: new Date(),
        requestId: 'req-2',
        actorId: 'cand-2',
      },
    ];

    mockPrisma.outboxEvent.findMany.mockResolvedValue(mockEvents);
    mockQueueService.addJob.mockRejectedValue(
      new QueueInfrastructureError('notification-queue', new Error('Redis connection refused')),
    );

    const dispatchedCount = await service.dispatchPendingEvents(10);

    expect(dispatchedCount).toBe(0);
    expect(mockPrisma.outboxEvent.update).not.toHaveBeenCalled();
  });

  it('routes CvUploaded to cv-extraction-queue with deterministic operation-based jobId (BE-10-009)', async () => {
    const mockCvEvents = [
      {
        id: 'db-id-cv-1',
        eventId: 'evt-cv-uuid-1',
        eventName: 'CvUploaded',
        eventVersion: 1,
        aggregateType: 'Cv',
        aggregateId: 'cv-123',
        payload: {
          cvId: 'cv-123',
          candidateId: 'cand-1',
          operationId: 'op-456',
        },
        occurredAt: new Date(),
        requestId: 'req-cv-1',
        actorId: 'user-1',
      },
    ];

    mockPrisma.outboxEvent.findMany.mockResolvedValue(mockCvEvents);
    mockPrisma.outboxEvent.update.mockResolvedValue({});
    mockQueueService.addJob.mockResolvedValue({ id: 'cv-extraction:op-456' });

    const dispatchedCount = await service.dispatchPendingEvents(10);

    expect(dispatchedCount).toBe(1);
    expect(mockQueueService.addJob).toHaveBeenCalledWith(
      'cv-extraction-queue',
      'CvUploaded',
      expect.objectContaining({
        eventId: 'evt-cv-uuid-1',
      }),
      { jobId: 'cv-extraction:op-456' },
    );
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'db-id-cv-1' },
      data: { dispatchedAt: expect.any(Date) },
    });
  });
});

describe('OutboxDispatcherService (BE-10-008)', () => {
  let dispatcher: any;
  let mockOutboxService: any;
  let mockConfigService: any;

  beforeEach(() => {
    mockOutboxService = {
      dispatchPendingEvents: jest.fn().mockResolvedValue(2),
    };
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        if (key === 'OUTBOX_POLL_INTERVAL_MS') return 1000;
        if (key === 'OUTBOX_DISPATCHER_ENABLED') return true;
        return defaultValue;
      }),
    };
    dispatcher = new OutboxDispatcherService(mockOutboxService, mockConfigService);
  });

  afterEach(() => {
    dispatcher.stop();
  });

  it('dispatches pending events when dispatch is invoked', async () => {
    const count = await dispatcher.dispatch(25);
    expect(count).toBe(2);
    expect(mockOutboxService.dispatchPendingEvents).toHaveBeenCalledWith(25);
  });

  it('prevents concurrent overlapping dispatch runs', async () => {
    let resolveFirst: () => void;
    const firstCallPromise = new Promise<number>((res) => {
      resolveFirst = () => res(5);
    });

    mockOutboxService.dispatchPendingEvents.mockImplementationOnce(() => firstCallPromise);

    const firstRun = dispatcher.dispatch(10);
    const secondRun = dispatcher.dispatch(10);

    const [secondResult] = await Promise.all([secondRun]);
    expect(secondResult).toBe(0); // skipped due to isPolling guard

    resolveFirst!();
    const firstResult = await firstRun;
    expect(firstResult).toBe(5);
  });

  it('gracefully handles and recovers from dispatch errors', async () => {
    mockOutboxService.dispatchPendingEvents.mockRejectedValueOnce(new Error('DB connection lost'));
    const count = await dispatcher.dispatch();
    expect(count).toBe(0);
  });

  it('can start and stop periodic polling timer cleanly', () => {
    jest.useFakeTimers();
    dispatcher.start(500);
    expect(dispatcher['timer']).not.toBeNull();

    dispatcher.stop();
    expect(dispatcher['timer']).toBeNull();
    jest.useRealTimers();
  });
});

describe('NotificationProcessor & EmailProcessor (BE-10-008)', () => {
  let notificationProcessor: any;
  let emailProcessor: any;
  let mockQueueService: any;
  let mockNotificationsService: any;
  let mockEmailService: any;

  beforeEach(() => {
    mockQueueService = {
      registerWorker: jest.fn(),
    };
    mockNotificationsService = {
      routeEvent: jest.fn().mockResolvedValue(undefined),
    };
    mockEmailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
    };

    notificationProcessor = new NotificationProcessor(mockQueueService, mockNotificationsService);
    emailProcessor = new EmailProcessor(mockQueueService, mockEmailService);
  });

  it('NotificationProcessor registers on notification queue and routes event on process', async () => {
    notificationProcessor.onModuleInit();
    expect(mockQueueService.registerWorker).toHaveBeenCalledWith(
      'notification-queue',
      expect.any(Function),
    );

    const mockJob = {
      data: {
        eventId: 'evt-1',
        eventName: 'ApplicationSubmitted',
        eventVersion: 1,
        aggregateType: 'Application',
        aggregateId: 'app-1',
        occurredAt: new Date().toISOString(),
        payload: { applicationId: 'app-1', candidateUserId: 'user-1' },
      },
    };

    await notificationProcessor.process(mockJob);
    expect(mockNotificationsService.routeEvent).toHaveBeenCalledWith(
      'ApplicationSubmitted',
      mockJob.data.payload,
      1,
    );
  });

  it('EmailProcessor registers on email queue and sends email on process', async () => {
    emailProcessor.onModuleInit();
    expect(mockQueueService.registerWorker).toHaveBeenCalledWith(
      'email-queue',
      expect.any(Function),
    );

    const mockJob = {
      data: {
        to: 'candidate@test.com',
        subject: 'Application received',
        html: '<p>Welcome</p>',
        idempotencyKey: 'email-key-1',
      },
    };

    const result = await emailProcessor.process(mockJob);
    expect(result.success).toBe(true);
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith(mockJob.data);
  });

  it('EmailProcessor throws error when email sending fails so BullMQ can retry', async () => {
    mockEmailService.sendEmail.mockResolvedValueOnce({
      success: false,
      error: 'SMTP connection timeout',
    });

    const mockJob = {
      data: {
        to: 'candidate@test.com',
        subject: 'Application received',
        html: '<p>Welcome</p>',
      },
    };

    await expect(emailProcessor.process(mockJob)).rejects.toThrow(
      'Email delivery failed: SMTP connection timeout',
    );
  });
});
