import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface RequestMetricRecord {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}

@Injectable()
export class MetricsService {
  private requestCount: Record<string, number> = {};
  private requestDurationSum: Record<string, number> = {};
  private queueMetrics: Record<string, { depth: number; active: number; failed: number }> = {
    email: { depth: 0, active: 0, failed: 0 },
    cv_extraction: { depth: 0, active: 0, failed: 0 },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Record HTTP request completion (BE-7-007).
   */
  recordHttpRequest(record: RequestMetricRecord): void {
    const label = `${record.method}_${record.route}_${record.statusCode}`;
    this.requestCount[label] = (this.requestCount[label] || 0) + 1;
    this.requestDurationSum[label] = (this.requestDurationSum[label] || 0) + record.durationMs;
  }

  /**
   * Record Queue and Worker state (BE-7-008).
   */
  updateQueueMetrics(
    queueName: string,
    metrics: { depth: number; active: number; failed: number },
  ): void {
    this.queueMetrics[queueName] = metrics;
  }

  /**
   * Get formatted Prometheus metrics string.
   */
  async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = [
      '# HELP http_requests_total Total number of HTTP requests processed',
      '# TYPE http_requests_total counter',
    ];

    for (const [key, count] of Object.entries(this.requestCount)) {
      const [method, route, status] = key.split('_');
      lines.push(
        `http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`,
      );
    }

    lines.push(
      '# HELP http_request_duration_ms_sum Total duration of HTTP requests in milliseconds',
      '# TYPE http_request_duration_ms_sum counter',
    );
    for (const [key, duration] of Object.entries(this.requestDurationSum)) {
      const [method, route, status] = key.split('_');
      lines.push(
        `http_request_duration_ms_sum{method="${method}",route="${route}",status="${status}"} ${duration}`,
      );
    }

    // Queue metrics (BE-7-008)
    lines.push('# HELP queue_depth Current waiting jobs in queue', '# TYPE queue_depth gauge');
    for (const [queue, m] of Object.entries(this.queueMetrics)) {
      lines.push(`queue_depth{queue="${queue}"} ${m.depth}`);
      lines.push(`queue_active{queue="${queue}"} ${m.active}`);
      lines.push(`queue_failed{queue="${queue}"} ${m.failed}`);
    }

    // Dependency health metrics (BE-7-007)
    const isDbHealthy = await this.prisma.isHealthy();
    const isRedisHealthy = await this.redisService.isHealthy();
    lines.push('# HELP dependency_up Health status of upstream dependencies (1 = up, 0 = down)');
    lines.push('# TYPE dependency_up gauge');
    lines.push(`dependency_up{dependency="database"} ${isDbHealthy ? 1 : 0}`);
    lines.push(`dependency_up{dependency="redis"} ${isRedisHealthy ? 1 : 0}`);

    return lines.join('\n') + '\n';
  }
}
