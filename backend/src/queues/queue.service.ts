import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from '../redis/redis.service';

export const QUEUES = {
  EMAIL: 'email-queue',
  NOTIFICATION: 'notification-queue',
  CV_EXTRACTION: 'cv-extraction-queue',
  AI_ANALYSIS: 'ai-analysis-queue',
} as const;

export interface StandardJobOptions {
  attempts?: number;
  backoffDelayMs?: number;
  jobId?: string;
}

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();

  constructor(private readonly redisService: RedisService) {}

  getOrCreateQueue(queueName: string): Queue | null {
    let queue = this.queues.get(queueName);
    if (!queue) {
      const redisConnection = this.redisService.getClient();
      if (!redisConnection || typeof redisConnection.on !== 'function') {
        this.logger.warn(`Redis client not available, queue ${queueName} not created`);
        return null;
      }
      queue = new Queue(queueName, {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
      this.queues.set(queueName, queue);
    }
    return queue;
  }

  async addJob<T = any>(
    queueName: string,
    jobName: string,
    data: T,
    options?: StandardJobOptions,
  ): Promise<Job<T> | null> {
    try {
      const queue = this.getOrCreateQueue(queueName);
      if (!queue) return null;
      return await queue.add(jobName, data, {
        attempts: options?.attempts ?? 3,
        backoff: {
          type: 'exponential',
          delay: options?.backoffDelayMs ?? 1000,
        },
        jobId: options?.jobId,
      });
    } catch (err: any) {
      this.logger.warn(`Failed to add job to queue ${queueName}: ${err.message}`);
      return null;
    }
  }

  registerWorker<T = any>(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>,
  ): Worker | null {
    const redisConnection = this.redisService.getClient();
    if (!redisConnection || typeof redisConnection.on !== 'function') {
      this.logger.warn(`Redis client not available, worker for queue ${queueName} not registered`);
      return null;
    }
    const worker = new Worker(queueName, processor, {
      connection: redisConnection,
      concurrency: 5,
    });

    worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} in ${queueName} failed: ${err.message}`);
    });

    this.workers.set(queueName, worker);
    return worker;
  }

  async onModuleDestroy() {
    this.logger.log('Closing all BullMQ workers and queues gracefully');
    for (const [name, worker] of this.workers.entries()) {
      try {
        await worker.close();
      } catch (err) {
        this.logger.warn(`Error closing worker ${name}: ${err.message}`);
      }
    }
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
      } catch (err) {
        this.logger.warn(`Error closing queue ${name}: ${err.message}`);
      }
    }
  }
}
