import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queues/queue.module';
import { OutboxModule } from '../outbox/outbox.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { AiController } from './ai.controller';
import { OperationsController } from './operations.controller';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationPreferencesController } from './recommendation-preferences.controller';
import { AiService } from './ai.service';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { AI_PROVIDER_PORT } from './interfaces/ai-provider.port';
import { AiMetricsService } from './metrics/ai-metrics.service';
import { CvJobAnalysisProcessor } from './workers/cv-job-analysis.processor';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AuditModule,
    JobsModule,
    AuthModule,
    QueueModule,
    OutboxModule,
    IdempotencyModule,
  ],
  controllers: [
    AiController,
    OperationsController,
    RecommendationsController,
    RecommendationPreferencesController,
  ],
  providers: [
    AiService,
    AiMetricsService,
    GeminiAdapter,
    CvJobAnalysisProcessor,
    {
      provide: AI_PROVIDER_PORT,
      useClass: GeminiAdapter,
    },
  ],
  exports: [AiService, AiMetricsService, AI_PROVIDER_PORT, CvJobAnalysisProcessor],
})
export class AiModule {}
