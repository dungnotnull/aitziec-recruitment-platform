import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService, QUEUES } from '../../queues/queue.service';
import { NotificationsService } from '../notifications.service';

export interface NotificationJobData {
  eventId: string;
  eventName: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  requestId?: string;
  actorId?: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationProcessor implements OnModuleInit {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker<NotificationJobData>(
      QUEUES.NOTIFICATION,
      async (job: Job<NotificationJobData>) => {
        return this.process(job);
      },
    );
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { eventName, payload, eventVersion, eventId } = job.data;
    this.logger.debug(
      `Processing notification event ${eventName} (id=${eventId}, version=${eventVersion})`,
    );
    await this.notificationsService.routeEvent(eventName, payload, eventVersion);
  }
}
