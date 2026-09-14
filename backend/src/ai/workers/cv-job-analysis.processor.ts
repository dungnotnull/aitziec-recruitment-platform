import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { QueueService, QUEUES } from '../../queues/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../../outbox/outbox.service';
import {
  AI_PROVIDER_PORT,
  IAiProviderPort,
  CvGapAnalysisResult,
} from '../interfaces/ai-provider.port';
import { AiMetricsService } from '../metrics/ai-metrics.service';
import { AiRateLimitedException } from '../errors/ai.errors';

export interface CvJobAnalysisJobData {
  operationId: string;
  cvId: string;
  jobId: string;
  analyses: Array<'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS'>;
  actorId?: string;
  requestId?: string;
  payload?: {
    operationId?: string;
    cvId?: string;
    jobId?: string;
    analyses?: Array<'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS'>;
  };
}

@Injectable()
export class CvJobAnalysisProcessor implements OnModuleInit {
  private readonly logger = new Logger(CvJobAnalysisProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    @Inject(AI_PROVIDER_PORT)
    private readonly aiProvider: IAiProviderPort,
    private readonly metricsService: AiMetricsService,
  ) {}

  onModuleInit(): void {
    this.queueService.registerWorker<CvJobAnalysisJobData>(
      QUEUES.AI_ANALYSIS,
      this.processJob.bind(this),
    );
    this.logger.log('Registered BullMQ worker for AI analysis queue');
  }

  async processJob(job: Job<CvJobAnalysisJobData | Record<string, unknown>>): Promise<void> {
    const rawData = job.data as Record<string, unknown>;
    const payload = rawData.payload as Record<string, unknown> | undefined;
    const operationId = (rawData.operationId as string) || (payload?.operationId as string);
    const cvId = (rawData.cvId as string) || (payload?.cvId as string);
    const jobId = (rawData.jobId as string) || (payload?.jobId as string);
    const analyses = (rawData.analyses as Array<'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS'>) ||
      (payload?.analyses as Array<'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS'>) || ['CV_JOB_MATCH'];
    const actorId = rawData.actorId as string | undefined;
    const requestId = rawData.requestId as string | undefined;

    this.logger.log(
      `Processing AI analysis job=${job.id} for cvId=${cvId} jobId=${jobId} opId=${operationId}`,
    );

    if (!operationId || !cvId || !jobId) {
      this.logger.warn(`Missing required parameters in job ${job.id}, skipping.`);
      return;
    }

    const operation = await this.prisma.operation.findUnique({
      where: { id: operationId },
    });

    if (!operation) {
      this.logger.warn(`Operation ${operationId} not found`);
      return;
    }

    // Monotonic state idempotency: skip if already terminal
    if (operation.status === 'SUCCEEDED' || operation.status === 'FAILED') {
      this.logger.log(
        `Operation ${operationId} is already in terminal status ${operation.status}, skipping.`,
      );
      return;
    }

    // Acquire concurrency slot in all paths
    if (actorId) {
      this.metricsService.acquireSlot(actorId);
    }
    const startTime = Date.now();

    try {
      // Transition QUEUED -> PROCESSING
      await this.prisma.operation.update({
        where: { id: operationId },
        data: {
          status: 'PROCESSING',
          progressPercent: 25,
        },
      });

      // Load private inputs by ID from database
      const cv = await this.prisma.cv.findUnique({
        where: { id: cvId },
      });
      const jobRecord = await this.prisma.job.findUnique({
        where: { id: jobId },
      });

      if (!cv || cv.processingStatus === 'DELETED' || !cv.extractedText || !jobRecord) {
        throw new Error('CV or Job data missing or unreadable for analysis');
      }

      const cvText = cv.extractedText;
      const matchResult = await this.aiProvider.matchCvJob(
        cvText,
        jobRecord.title,
        jobRecord.description,
        jobRecord.requirements,
        jobRecord.technologyNames || [],
      );

      let gapResult: CvGapAnalysisResult | null = null;
      if (analyses.includes('CV_GAP_ANALYSIS')) {
        gapResult = await this.aiProvider.gapAnalysisCvJob(
          cvText,
          jobRecord.title,
          jobRecord.description,
          jobRecord.requirements,
          jobRecord.technologyNames || [],
        );
      }

      let analysisType: 'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS' | 'CV_JOB_ANALYSIS' = 'CV_JOB_ANALYSIS';
      if (analyses.length === 1) {
        analysisType = analyses[0];
      }

      const now = new Date();
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const createdAnalysis = await tx.aiAnalysis.create({
          data: {
            type: analysisType,
            candidateId: cv.candidateProfileId,
            cvId: cv.id,
            jobId: jobRecord.id,
            status: 'SUCCEEDED',
            overallScore: matchResult.overallScore,
            components: matchResult.components as unknown as Prisma.InputJsonValue,
            matchedSkills: matchResult.matchedSkills,
            missingSkills: gapResult ? gapResult.missingSkills : matchResult.missingSkills,
            unmetRequirements: gapResult ? gapResult.unmetRequirements : [],
            suggestions: gapResult ? gapResult.suggestions : [],
            limitations: gapResult ? gapResult.limitations : [],
            model: matchResult.model,
            promptVersion: matchResult.promptVersion,
            schemaVersion: matchResult.schemaVersion,
          },
        });

        await tx.operation.update({
          where: { id: operationId },
          data: {
            status: 'SUCCEEDED',
            progressPercent: 100,
            resultResourceType: 'AI_ANALYSIS',
            resultResourceId: createdAnalysis.id,
            completedAt: now,
          },
        });

        await this.auditService.record(
          {
            actorId: actorId || undefined,
            action: 'AI_ANALYSIS_COMPLETED',
            targetType: 'AiAnalysis',
            targetId: createdAnalysis.id,
            requestId,
            metadata: {
              operationId,
              cvId,
              jobId,
              score: matchResult.overallScore,
            },
          },
          tx,
        );

        await this.outboxService.recordEvent(tx, {
          eventName: 'AiAnalysisCompleted',
          aggregateType: 'AiAnalysis',
          aggregateId: createdAnalysis.id,
          payload: {
            analysisId: createdAnalysis.id,
            operationId,
            cvId,
            jobId,
            overallScore: matchResult.overallScore,
          },
          requestId,
          actorId,
        });
      });

      this.metricsService.recordMetric({
        model: matchResult.model,
        operation: 'CV_JOB_ANALYSIS',
        durationMs: Date.now() - startTime,
        status: 'SUCCESS',
        estimatedTokens: 850,
      });
      this.logger.log(`AI analysis succeeded for opId=${operationId}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`AI analysis failed for opId=${operationId}: ${msg}`, stack);

      const isRateLimit = err instanceof AiRateLimitedException || msg.includes('RATE_LIMIT');
      const failureCode = isRateLimit ? 'RATE_LIMITED' : 'AI_PROCESSING_FAILED';
      const now = new Date();

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.operation.update({
          where: { id: operationId },
          data: {
            status: 'FAILED',
            progressPercent: 100,
            failureCode,
            failureMessage: msg || 'AI analysis processing failed',
            completedAt: now,
          },
        });

        await this.auditService.record(
          {
            actorId: actorId || undefined,
            action: 'AI_ANALYSIS_FAILED',
            targetType: 'Operation',
            targetId: operationId,
            requestId,
            metadata: {
              failureCode,
              error: err instanceof Error ? err.message : String(err),
            },
          },
          tx,
        );
      });

      this.metricsService.recordMetric({
        model: 'gemini-1.5-flash',
        operation: 'CV_JOB_ANALYSIS',
        durationMs: Date.now() - startTime,
        status: 'FAILURE',
        estimatedTokens: 0,
      });
    } finally {
      if (actorId) {
        this.metricsService.releaseSlot();
      }
    }
  }
}
