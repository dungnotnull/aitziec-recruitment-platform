import { OutboxService } from '../../src/outbox/outbox.service';

describe('OutboxService (BE-1-012)', () => {
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
      payload: { applicationId: 'app-1' },
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
        payload: { applicationId: 'app-1' },
        requestId: 'req-1',
        actorId: 'user-1',
      },
    });
    expect(event).toBeDefined();
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
});
