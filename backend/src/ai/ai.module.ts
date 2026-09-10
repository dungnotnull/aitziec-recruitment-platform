import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { JobsModule } from '../jobs/jobs.module';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { OperationsController } from './operations.controller';
import { RecommendationsController } from './recommendations.controller';
import { AiService } from './ai.service';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { AI_PROVIDER_PORT } from './interfaces/ai-provider.port';
import { AiMetricsService } from './metrics/ai-metrics.service';

@Module({
  imports: [ConfigModule, DatabaseModule, AuditModule, JobsModule, AuthModule],
  controllers: [AiController, OperationsController, RecommendationsController],
  providers: [
    AiService,
    AiMetricsService,
    GeminiAdapter,
    {
      provide: AI_PROVIDER_PORT,
      useClass: GeminiAdapter,
    },
  ],
  exports: [AiService, AiMetricsService, AI_PROVIDER_PORT],
})
export class AiModule {}
