import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      this.logger.warn(`Redis client error: ${err.message}`);
    });
  }

  async onModuleInit() {
    try {
      await this.client.connect();
      this.logger.log('Connected to Redis');
    } catch (err) {
      this.logger.warn(`Could not immediately connect to Redis: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
      this.logger.log('Disconnected from Redis');
    } catch (err) {
      this.logger.warn(`Error during Redis disconnect: ${err.message}`);
    }
  }

  getClient(): Redis {
    return this.client;
  }

  async isHealthy(): Promise<boolean> {
    try {
      const pingRes = await this.client.ping();
      return pingRes === 'PONG';
    } catch {
      return false;
    }
  }
}
