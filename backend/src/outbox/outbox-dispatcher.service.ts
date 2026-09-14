import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.configService.get<number>('OUTBOX_POLL_INTERVAL_MS', 2000);
    const enabled = this.configService.get<boolean>('OUTBOX_DISPATCHER_ENABLED', true);
    const isTest = process.env.NODE_ENV === 'test';

    if (enabled && !isTest) {
      this.start(intervalMs);
    }
  }

  start(intervalMs = 2000): void {
    if (this.timer) return;
    this.logger.log(`Starting Outbox dispatcher with interval ${intervalMs}ms`);
    this.timer = setInterval(async () => {
      await this.dispatch();
    }, intervalMs);

    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.log('Outbox dispatcher stopped');
    }
  }

  async dispatch(limit = 50): Promise<number> {
    if (this.isPolling) return 0;
    this.isPolling = true;
    try {
      return await this.outboxService.dispatchPendingEvents(limit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Error during outbox event dispatch: ${msg}`, stack);
      return 0;
    } finally {
      this.isPolling = false;
    }
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
