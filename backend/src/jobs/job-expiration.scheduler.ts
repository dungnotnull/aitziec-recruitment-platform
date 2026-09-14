import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

export const JOB_EXPIRATION_CLOCK = 'JOB_EXPIRATION_CLOCK';

@Injectable()
export class JobExpirationScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobExpirationScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Optional() @Inject(JOB_EXPIRATION_CLOCK) private readonly customClock?: () => Date,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.get<number>('JOB_EXPIRATION_INTERVAL_MS', 3600000); // 1 hour
    const enabled = this.configService.get<boolean>('JOB_EXPIRATION_ENABLED', true);
    const isTest = process.env.NODE_ENV === 'test';

    if (enabled && !isTest) {
      this.start(intervalMs);
    }
  }

  start(intervalMs = 3600000): void {
    if (this.timer) return;
    this.logger.log(`Starting JobExpirationScheduler with interval ${intervalMs}ms`);
    this.timer = setInterval(async () => {
      await this.expireOverdueJobs();
    }, intervalMs);

    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('JobExpirationScheduler stopped');
    }
  }

  public getNow(asOf?: Date): Date {
    if (asOf) return asOf;
    if (this.customClock) return this.customClock();
    return new Date();
  }

  async expireOverdueJobs(asOf?: Date, limit = 100): Promise<number> {
    if (this.isProcessing) {
      this.logger.debug('Job expiration is already processing in another cycle. Skipping.');
      return 0;
    }

    this.isProcessing = true;
    const now = this.getNow(asOf);
    let totalExpired = 0;

    try {
      // Find candidate published jobs where deadline has passed
      const overdueJobs = await this.prisma.job.findMany({
        where: {
          status: 'PUBLISHED',
          applicationDeadline: { lt: now },
        },
        select: {
          id: true,
          version: true,
          companyId: true,
          applicationDeadline: true,
        },
        take: limit,
      });

      if (overdueJobs.length === 0) {
        return 0;
      }

      for (const job of overdueJobs) {
        // Atomic conditional update to prevent race conditions with unpublish/close/approve
        const updateResult = await this.prisma.job.updateMany({
          where: {
            id: job.id,
            status: 'PUBLISHED',
            applicationDeadline: { lt: now },
            version: job.version,
          },
          data: {
            status: 'EXPIRED',
            version: job.version + 1,
          },
        });

        if (updateResult.count > 0) {
          totalExpired++;
          await this.auditService.record({
            actorId: 'system-job-expiration-scheduler',
            action: 'JOB_EXPIRED',
            targetType: 'JOB',
            targetId: job.id,
            metadata: {
              companyId: job.companyId,
              previousStatus: 'PUBLISHED',
              newStatus: 'EXPIRED',
              applicationDeadline:
                job.applicationDeadline instanceof Date
                  ? job.applicationDeadline.toISOString()
                  : job.applicationDeadline,
              asOf: now.toISOString(),
              previousVersion: job.version,
              newVersion: job.version + 1,
            },
          });
        }
      }

      if (totalExpired > 0) {
        this.logger.log(
          `JobExpirationScheduler expired ${totalExpired} jobs as of ${now.toISOString()}`,
        );
      }

      return totalExpired;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error during job expiration check: ${msg}`, stack);
      return totalExpired;
    } finally {
      this.isProcessing = false;
    }
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
