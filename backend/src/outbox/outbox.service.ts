import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { QueueService, QUEUES } from '../queues/queue.service';
import {
  DomainEventPayloadMap,
  SUPPORTED_EVENT_VERSION,
  validateEventVersion,
  validateSafePayload,
} from './domain-events';

export interface CreateOutboxEventParams<T extends string = string> {
  eventName: T;
  eventVersion?: number;
  aggregateType: string;
  aggregateId: string;
  payload: T extends keyof DomainEventPayloadMap
    ? DomainEventPayloadMap[T]
    : Record<string, unknown>;
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

  async recordEvent<T extends string = string>(
    tx: Prisma.TransactionClient | PrismaService,
    params: CreateOutboxEventParams<T>,
  ) {
    const version = params.eventVersion ?? SUPPORTED_EVENT_VERSION;
    validateEventVersion(version);
    validateSafePayload(params.payload as Record<string, unknown>);

    const eventId = uuidv4();
    const event = await tx.outboxEvent.create({
      data: {
        eventId,
        eventName: params.eventName,
        eventVersion: version,
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        payload: params.payload as Prisma.InputJsonValue,
        requestId: params.requestId || null,
        actorId: params.actorId || null,
      },
    });

    return event;
  }

  async emitEvent<T extends string = string>(params: {
    aggregateType: string;
    aggregateId: string;
    eventType: T;
    eventVersion?: number;
    payload: T extends keyof DomainEventPayloadMap
      ? DomainEventPayloadMap[T]
      : Record<string, unknown>;
    requestId?: string;
    actorId?: string;
    idempotencyKey?: string;
  }) {
    return this.recordEvent(this.prisma, {
      eventName: params.eventType,
      eventVersion: params.eventVersion,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      payload: params.payload,
      requestId: params.requestId || params.idempotencyKey,
      actorId: params.actorId,
    });
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
        let targetQueue: string = QUEUES.NOTIFICATION;
        let deterministicJobId: string = evt.eventId;

        if (evt.eventName.toLowerCase().includes('email')) {
          targetQueue = QUEUES.EMAIL;
        } else if (
          evt.eventName === 'CvUploaded' ||
          evt.eventName === 'CvExtractionRetryQueued' ||
          evt.eventName === 'CvTextExtracted'
        ) {
          targetQueue = QUEUES.CV_EXTRACTION;
          const payload = evt.payload as Record<string, unknown> | null;
          if (payload && typeof payload.operationId === 'string') {
            deterministicJobId = `cv-extraction:${payload.operationId}`;
          }
        } else if (evt.eventName === 'CvJobAnalysisQueued') {
          targetQueue = QUEUES.AI_ANALYSIS;
          const payload = evt.payload as Record<string, unknown> | null;
          if (payload && typeof payload.operationId === 'string') {
            deterministicJobId = `ai-analysis:${payload.operationId}`;
          }
        }

        const job = await this.queueService.addJob(
          targetQueue,
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
          { jobId: deterministicJobId },
        );

        if (!job) {
          this.logger.warn(
            `Queue addJob returned null for event ${evt.eventId} (queue ${targetQueue}); leaving event pending.`,
          );
          continue;
        }

        await this.prisma.outboxEvent.update({
          where: { id: evt.id },
          data: { dispatchedAt: new Date() },
        });

        dispatchedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to dispatch outbox event ${evt.eventId}: ${msg}`);
      }
    }

    return dispatchedCount;
  }
}
