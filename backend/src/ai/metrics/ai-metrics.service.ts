import { Injectable, Logger } from '@nestjs/common';
import { AiRateLimitedException } from '../errors/ai.errors';

export interface AiMetricEntry {
  model: string;
  operation: string;
  durationMs: number;
  status: 'SUCCESS' | 'FAILURE';
  estimatedTokens: number;
  timestamp: Date;
}

@Injectable()
export class AiMetricsService {
  private readonly logger = new Logger(AiMetricsService.name);
  private readonly metricsLog: AiMetricEntry[] = [];
  private readonly userDailyCounts = new Map<string, { date: string; count: number }>();
  private readonly MAX_DAILY_REQUESTS_PER_USER = 100;
  private readonly MAX_CONCURRENT_REQUESTS = 10;
  private currentActiveRequests = 0;

  /**
   * Concurrency and per-user budget control (BE-6-018).
   */
  acquireSlot(userId: string): void {
    if (this.currentActiveRequests >= this.MAX_CONCURRENT_REQUESTS) {
      throw new AiRateLimitedException('AI processing capacity saturated. Please retry shortly.');
    }

    const today = new Date().toISOString().slice(0, 10);
    const userRecord = this.userDailyCounts.get(userId);

    if (userRecord && userRecord.date === today) {
      if (userRecord.count >= this.MAX_DAILY_REQUESTS_PER_USER) {
        throw new AiRateLimitedException('Daily AI quota exceeded for this user.');
      }
      userRecord.count++;
    } else {
      this.userDailyCounts.set(userId, { date: today, count: 1 });
    }

    this.currentActiveRequests++;
  }

  releaseSlot(): void {
    if (this.currentActiveRequests > 0) {
      this.currentActiveRequests--;
    }
  }

  /**
   * Record privacy-safe AI execution metrics (BE-6-019).
   * Strictly avoids storing raw CV text, raw prompts, or PII.
   */
  recordMetric(entry: Omit<AiMetricEntry, 'timestamp'>): void {
    const fullEntry: AiMetricEntry = {
      ...entry,
      timestamp: new Date(),
    };
    this.metricsLog.push(fullEntry);
    this.logger.log(
      `[AI Metric] op=${entry.operation} model=${entry.model} duration=${entry.durationMs}ms tokens=${entry.estimatedTokens} status=${entry.status}`,
    );
  }

  getMetricsSummary(): {
    totalCalls: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
  } {
    if (this.metricsLog.length === 0) {
      return { totalCalls: 0, successRate: 100, avgLatencyMs: 0, totalTokens: 0 };
    }

    const successes = this.metricsLog.filter((m) => m.status === 'SUCCESS').length;
    const totalDuration = this.metricsLog.reduce((sum, m) => sum + m.durationMs, 0);
    const totalTokens = this.metricsLog.reduce((sum, m) => sum + m.estimatedTokens, 0);

    return {
      totalCalls: this.metricsLog.length,
      successRate: Math.round((successes / this.metricsLog.length) * 100),
      avgLatencyMs: Math.round(totalDuration / this.metricsLog.length),
      totalTokens,
    };
  }
}
