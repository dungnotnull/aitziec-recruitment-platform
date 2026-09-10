import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueService, QUEUES } from '../../queues/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AuditService } from '../../audit/audit.service';
import { OutboxService } from '../../outbox/outbox.service';

export interface CvExtractionJobData {
  cvId: string;
  operationId: string;
  actorId?: string;
  requestId?: string;
}

@Injectable()
export class CvExtractionProcessor implements OnModuleInit {
  private readonly logger = new Logger(CvExtractionProcessor.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
  ) {}

  onModuleInit() {
    this.queueService.registerWorker<CvExtractionJobData>(
      QUEUES.CV_EXTRACTION,
      this.processJob.bind(this),
    );
    this.logger.log('Registered BullMQ worker for CV extraction queue');
  }

  async processJob(job: Job<CvExtractionJobData>): Promise<void> {
    const { cvId, operationId, actorId, requestId } = job.data;
    this.logger.log(`Processing CV extraction job=${job.id} for cvId=${cvId} opId=${operationId}`);

    const cv = await this.prisma.cv.findUnique({
      where: { id: cvId },
    });

    if (!cv || cv.processingStatus === 'DELETED') {
      this.logger.warn(`CV ${cvId} not found or marked deleted, skipping extraction`);
      return;
    }

    const operation = await this.prisma.operation.findUnique({
      where: { id: operationId },
    });

    if (!operation) {
      this.logger.warn(`Operation ${operationId} not found for CV ${cvId}`);
      return;
    }

    try {
      // Update status to PROCESSING / EXTRACTING
      await this.prisma.cv.update({
        where: { id: cvId },
        data: { processingStatus: 'EXTRACTING' },
      });

      await this.prisma.operation.update({
        where: { id: operationId },
        data: {
          status: 'PROCESSING',
          progressPercent: 30,
        },
      });

      // Download private PDF from storage
      const buffer = await this.storageService.getFile(cv.storageKey);

      // Extract text
      const rawText = buffer.toString('utf8');
      const cleanText = rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText || cleanText.length < 5) {
        throw new Error('PDF extracted text is empty or unreadable');
      }

      const now = new Date();

      await this.prisma.$transaction(async (tx: any) => {
        await tx.cv.update({
          where: { id: cvId },
          data: {
            extractedText: cleanText,
            processingStatus: 'READY',
            failureCode: null,
          },
        });

        await tx.operation.update({
          where: { id: operationId },
          data: {
            status: 'SUCCEEDED',
            progressPercent: 100,
            completedAt: now,
          },
        });

        await this.auditService.record(
          {
            actorId: actorId || undefined,
            action: 'CV_TEXT_EXTRACTED',
            targetType: 'Cv',
            targetId: cvId,
            requestId,
            metadata: {
              operationId,
              textLength: cleanText.length,
            },
          },
          tx,
        );

        await this.outboxService.recordEvent(tx, {
          eventName: 'CvTextExtracted',
          aggregateType: 'Cv',
          aggregateId: cvId,
          payload: {
            cvId,
            candidateId: cv.candidateProfileId,
            operationId,
            extractedLength: cleanText.length,
          },
          requestId,
          actorId,
        });
      });

      this.logger.log(`CV extraction succeeded for cvId=${cvId} opId=${operationId}`);
    } catch (err: any) {
      this.logger.error(`CV extraction failed for cvId=${cvId}: ${err.message}`);
      const now = new Date();
      const failureCode = err.message?.includes('empty or unreadable')
        ? 'EXTRACTION_EMPTY_TEXT'
        : 'EXTRACTION_FAILED';

      await this.prisma.$transaction(async (tx: any) => {
        await tx.cv.update({
          where: { id: cvId },
          data: {
            processingStatus: 'FAILED',
            failureCode,
          },
        });

        await tx.operation.update({
          where: { id: operationId },
          data: {
            status: 'FAILED',
            progressPercent: 100,
            failureCode,
            failureMessage: err.message || 'CV text extraction failed',
            completedAt: now,
          },
        });

        await this.auditService.record(
          {
            actorId: actorId || undefined,
            action: 'CV_EXTRACTION_FAILED',
            targetType: 'Cv',
            targetId: cvId,
            requestId,
            metadata: {
              operationId,
              failureCode,
              error: err.message,
            },
          },
          tx,
        );
      });
    }
  }
}
