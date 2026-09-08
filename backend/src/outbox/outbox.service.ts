import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { QueueService, QUEUES } from '../queues/queue.service';

export interface CreateOutboxEventParams {
  eventName: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, any>;
  requestId?: string;
  actorId?: string;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async recordEvent(tx: Prisma.TransactionClient | PrismaService, params: CreateOutboxEventParams) {
    const eventId = uuidv4();
    const event = await tx.outboxEvent.create({
      data: {
        eventId,
        eventName: params.eventName,
        eventVersion: 1,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        payload: params.payload,
        requestId: params.requestId || null,
        actorId: params.actorId || null,
      },
    });

    return event;
  }

  async dispatchPendingEvents(limit = 50): Promise<number> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: { dispatchedAt: null },
      orderBy: { occurredAt: 'asc' },
      take: limit,
    });

    let dispatchedCount = 0;

    for (const evt of pending) {
      try {
        // Map domain events to target queue based on event name
        const queueName = evt.eventName.toLowerCase().includes('email')
          ? QUEUES.EMAIL
          : QUEUES.NOTIFICATION;

        await this.queueService.addJob(
          queueName,
          evt.eventName,
          {
            eventId: evt.eventId,
            eventName: evt.eventName,
            eventVersion: evt.eventVersion,
            aggregateType: evt.aggregateType,
            aggregateId: evt.aggregateId,
            occurredAt: evt.occurredAt.toISOString(),
            requestId: evt.requestId,
            actorId: evt.actorId,
            payload: evt.payload,
          },
          { jobId: evt.eventId }, // Deduplicate by eventId
        );

        await this.prisma.outboxEvent.update({
          where: { id: evt.id },
          data: { dispatchedAt: new Date() },
        });

        dispatchedCount++;
      } catch (err) {
        this.logger.error(`Failed to dispatch outbox event ${evt.eventId}: ${err.message}`);
      }
    }

    return dispatchedCount;
  }
}
