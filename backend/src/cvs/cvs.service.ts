import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { CompanyScopeService } from '../companies/company-scope.service';
import { QueueService, QUEUES } from '../queues/queue.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { Prisma, Cv, Operation } from '@prisma/client';
import { CollectionResponse } from '../common/dto/response.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CvDto, CvQueryDto, OperationDto, SignedDownloadDto, UploadedCvFile } from './dto/cv.dto';
import { IdempotencyService } from '../idempotency';

interface CursorData {
  id: string;
  createdAt: string;
}

@Injectable()
export class CvsService {
  private readonly logger = new Logger(CvsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly companyScopeService: CompanyScopeService,
    private readonly queueService: QueueService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private toIso(date: Date | string | null | undefined): string | null {
    if (!date) return null;
    const d = typeof date === 'string' ? new Date(date) : date;
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  private encodeCursor(cursor: CursorData): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  private decodeCursor(cursorStr: string): CursorData | null {
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.createdAt === 'string') {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  async uploadCv(
    user: AuthenticatedUser,
    file: UploadedCvFile,
    requestId?: string,
  ): Promise<{ cv: CvDto; operation: OperationDto }> {
    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    if (!candidateProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found. Please complete your profile first.',
      });
    }

    if (!file || !file.buffer) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'File is required in multipart field "file".',
      });
    }

    // 1. Max size: 10 MiB
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new PayloadTooLargeException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: `File size ${file.size} bytes exceeds 10 MiB limit.`,
      });
    }

    // 2. MIME type: application/pdf
    if (file.mimetype !== 'application/pdf') {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: 'Only application/pdf MIME type is supported.',
      });
    }

    // 3. Magic bytes: %PDF-
    const header = file.buffer.subarray(0, 5).toString('ascii');
    if (!header.startsWith('%PDF')) {
      throw new UnprocessableEntityException({
        code: ERROR_CODES.PDF_INVALID,
        message: 'Invalid PDF: File does not start with %PDF magic bytes.',
      });
    }

    // 4. SHA-256
    const checksumSha256 = crypto.createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = `cvs/${candidateProfile.id}/${uuidv4()}.pdf`;

    // 5. Store file in object storage
    await this.storageService.uploadFile(storageKey, file.buffer, 'application/pdf');

    // 6. Atomically persist CV and QUEUED Operation
    const { createdCv, createdOp } = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const existingCvs = await tx.cv.findMany({
          where: {
            candidateProfileId: candidateProfile.id,
            processingStatus: { not: 'DELETED' },
          },
        });

        const isDefault = existingCvs.length === 0;

        const cv = await tx.cv.create({
          data: {
            candidateProfileId: candidateProfile.id,
            originalFileName: file.originalname || 'document.pdf',
            mimeType: 'application/pdf',
            sizeBytes: file.size,
            checksumSha256,
            storageKey,
            processingStatus: 'UPLOADED',
            extractionAttempts: 1,
            isDefault,
            version: 1,
          },
        });

        if (isDefault) {
          await tx.candidateProfile.update({
            where: { id: candidateProfile.id },
            data: { defaultCvId: cv.id },
          });
        }

        const operation = await tx.operation.create({
          data: {
            userId: user.id,
            type: 'CV_TEXT_EXTRACTION',
            status: 'QUEUED',
            progressPercent: 0,
            resultResourceType: 'CV',
            resultResourceId: cv.id,
          },
        });

        await tx.cv.update({
          where: { id: cv.id },
          data: { latestOperationId: operation.id },
        });

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'CV_UPLOADED',
            targetType: 'CV',
            targetId: cv.id,
            requestId,
            metadata: {
              originalFileName: file.originalname,
              sizeBytes: file.size,
              checksumSha256,
              operationId: operation.id,
            },
          },
          tx,
        );

        await this.outboxService.recordEvent(tx, {
          eventName: 'CvUploaded',
          aggregateType: 'Cv',
          aggregateId: cv.id,
          payload: {
            cvId: cv.id,
            candidateId: candidateProfile.id,
            sizeBytes: file.size,
            checksumSha256,
            operationId: operation.id,
          },
          requestId,
          actorId: user.id,
        });

        return { createdCv: cv, createdOp: operation };
      },
    );

    // 7. Enqueue extraction job to BullMQ with deterministic operation-based job ID
    try {
      await this.queueService.addJob(
        QUEUES.CV_EXTRACTION,
        'extract-cv-text',
        {
          cvId: createdCv.id,
          operationId: createdOp.id,
          actorId: user.id,
          requestId,
        },
        {
          jobId: `cv-extraction:${createdOp.id}`,
        },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Immediate BullMQ enqueue failed for CV ${createdCv.id} (opId=${createdOp.id}): ${msg}. Outbox dispatcher will deliver job when queue is restored.`,
      );
    }

    return {
      cv: this.mapToDto(createdCv),
      operation: this.mapOperationToDto(createdOp),
    };
  }

  /**
   * Bounded and idempotent retry for failed CV text extraction (BE-8-017, BE-10-006).
   */
  async retryProcessing(
    user: AuthenticatedUser,
    cvId: string,
    idempotencyKey: string,
    requestId?: string,
  ): Promise<{ cv: CvDto; operation: OperationDto }> {
    const claim = await this.idempotencyService.claimOrReplay({
      actorId: user.id,
      method: 'POST',
      route: '/api/v1/cvs/:cvId/retry-processing',
      key: idempotencyKey,
      params: { cvId },
    });

    if (claim.type === 'REPLAY') {
      return claim.responseBody as { cv: CvDto; operation: OperationDto };
    }

    try {
      const cv = await this.prisma.cv.findUnique({
        where: { id: cvId },
        include: { candidateProfile: true },
      });

      if (!cv || cv.processingStatus === 'DELETED') {
        throw new NotFoundException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'CV not found.',
        });
      }

      // 1. Authorization: Only owner or admin
      if (user.role !== 'ADMIN' && cv.candidateProfile?.userId !== user.id) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You can only retry extraction for your own CV.',
        });
      }

      // 2. Legacy / fallback operation replay check
      const existingOp = await this.prisma.operation.findFirst({
        where: { idempotencyKey },
      });

      if (existingOp) {
        if (
          (existingOp.resultResourceId === cvId ||
            (existingOp as unknown as { entityId?: string }).entityId === cvId) &&
          (existingOp.type === 'CV_TEXT_EXTRACTION' || existingOp.type === 'CV_EXTRACTION')
        ) {
          const replayResult = {
            cv: this.mapToDto(cv),
            operation: this.mapOperationToDto(existingOp),
          };
          await this.idempotencyService.complete(claim.recordId, 202, replayResult).catch(() => {});
          return replayResult;
        }
        throw new ConflictException({
          code: ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
          message: 'Idempotency key has already been used for another operation.',
        });
      }

      // 3. State verification: Only FAILED CVs can be retried
      if (cv.processingStatus === 'UPLOADED' || cv.processingStatus === 'EXTRACTING') {
        throw new ConflictException({
          code: ERROR_CODES.CV_ALREADY_PROCESSING,
          message: 'CV extraction is currently in progress.',
        });
      }

      if (cv.processingStatus !== 'FAILED') {
        throw new ConflictException({
          code: ERROR_CODES.CV_EXTRACTION_NOT_RETRYABLE,
          message: `Cannot retry CV in status ${cv.processingStatus}. Only FAILED CVs can be retried.`,
        });
      }

      // 4. Attempt limit check (Max 3 attempts)
      const MAX_RETRY_ATTEMPTS = 3;
      if (cv.extractionAttempts >= MAX_RETRY_ATTEMPTS) {
        throw new ConflictException({
          code: ERROR_CODES.CV_RETRY_LIMIT_EXCEEDED,
          message: `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded for this CV.`,
        });
      }

      // 5. Transaction: create new QUEUED operation, reset CV status to UPLOADED, clear failureCode, increment attempts & version
      const { updatedCv, newOp } = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const operation = await tx.operation.create({
            data: {
              userId: user.id,
              type: 'CV_TEXT_EXTRACTION',
              status: 'QUEUED',
              progressPercent: 0,
              resultResourceType: 'CV',
              resultResourceId: cv.id,
              idempotencyKey,
            },
          });

          const updated = await tx.cv.update({
            where: { id: cv.id },
            data: {
              processingStatus: 'UPLOADED',
              failureCode: null,
              latestOperationId: operation.id,
              extractionAttempts: { increment: 1 },
              version: { increment: 1 },
            },
          });

          await this.outboxService.recordEvent(tx, {
            eventName: 'CvExtractionRetryQueued',
            aggregateType: 'Cv',
            aggregateId: cv.id,
            actorId: user.id,
            requestId,
            payload: {
              cvId: cv.id,
              candidateId: cv.candidateProfileId,
              operationId: operation.id,
              attempt: updated.extractionAttempts,
            },
          });

          await this.auditService.record(
            {
              actorId: user.id,
              action: 'CV_RETRY_INITIATED',
              targetType: 'CV',
              targetId: cv.id,
              requestId,
              metadata: {
                operationId: operation.id,
                attempts: updated.extractionAttempts,
                previousStatus: cv.processingStatus,
              },
            },
            tx,
          );

          return { updatedCv: updated, newOp: operation };
        },
      );

      // 6. Direct queue enqueue attempt with outbox fallback
      try {
        await this.queueService.addJob(
          QUEUES.CV_EXTRACTION,
          'extract-cv-text',
          {
            cvId: updatedCv.id,
            operationId: newOp.id,
            actorId: user.id,
            requestId,
          },
          {
            jobId: `cv-extraction:${newOp.id}`,
          },
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Immediate BullMQ enqueue failed for CV retry ${updatedCv.id} (opId=${newOp.id}): ${msg}. Outbox dispatcher will deliver job when queue is restored.`,
        );
      }

      const result = {
        cv: this.mapToDto(updatedCv),
        operation: this.mapOperationToDto(newOp),
      };

      await this.idempotencyService.complete(claim.recordId, 202, result);
      return result;
    } catch (error) {
      await this.idempotencyService.fail(claim.recordId).catch(() => {});
      throw error;
    }
  }

  private async extractCvText(
    cvId: string,
    buffer: Buffer,
    actorId: string,
    requestId?: string,
  ): Promise<void> {
    try {
      // Basic text extraction from buffer (filtering readable characters)
      const rawText = buffer.toString('utf8');
      const cleanText = rawText
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.cv.update({
          where: { id: cvId },
          data: {
            processingStatus: 'READY',
            extractedText: cleanText.substring(0, 5000),
          },
        });

        await this.outboxService.recordEvent(tx, {
          eventName: 'CvTextExtracted',
          aggregateType: 'Cv',
          aggregateId: cvId,
          payload: { cvId },
          requestId,
          actorId,
        });
      });
    } catch {
      await this.prisma.cv.update({
        where: { id: cvId },
        data: {
          processingStatus: 'FAILED',
          failureCode: 'EXTRACTION_ERROR',
        },
      });
    }
  }

  async listCandidateCvs(
    user: AuthenticatedUser,
    query: CvQueryDto,
  ): Promise<CollectionResponse<CvDto>> {
    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    if (!candidateProfile) {
      return {
        data: [],
        meta: { page: { nextCursor: null, hasNextPage: false, limit: query.limit || 20 } },
      };
    }

    let cursorCondition: Prisma.CvWhereUniqueInput | undefined = undefined;
    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      if (decoded) {
        cursorCondition = { id: decoded.id };
      }
    }

    const limit = query.limit || 20;
    const cvs = await this.prisma.cv.findMany({
      where: {
        candidateProfileId: candidateProfile.id,
        processingStatus: { not: 'DELETED' },
      },
      take: limit + 1,
      cursor: cursorCondition,
      skip: cursorCondition ? 1 : 0,
    });

    const hasNextPage = cvs.length > limit;
    const items = hasNextPage ? cvs.slice(0, limit) : cvs;

    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      const last = items[items.length - 1];
      nextCursor = this.encodeCursor({
        id: last.id,
        createdAt: this.toIso(last.createdAt) || new Date().toISOString(),
      });
    }

    return {
      data: items.map((c) => this.mapToDto(c)),
      meta: {
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  async getCvDetail(user: AuthenticatedUser, cvId: string): Promise<CvDto> {
    const cv = await this.prisma.cv.findUnique({
      where: { id: cvId },
    });

    if (!cv || cv.processingStatus === 'DELETED') {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'CV not found.',
      });
    }

    await this.assertCvAccess(user, cv);

    return this.mapToDto(cv);
  }

  async setDefaultCv(
    user: AuthenticatedUser,
    cvId: string,
    expectedVersion: number,
    requestId?: string,
  ): Promise<CvDto> {
    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    if (!candidateProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found.',
      });
    }

    const cv = await this.prisma.cv.findUnique({ where: { id: cvId } });
    if (!cv || cv.candidateProfileId !== candidateProfile.id || cv.processingStatus === 'DELETED') {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'CV not found.',
      });
    }

    if (cv.version !== expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: current version is ${cv.version}, expected ${expectedVersion}.`,
      });
    }

    if (cv.processingStatus !== 'READY') {
      throw new ConflictException({
        code: ERROR_CODES.CV_NOT_READY,
        message: 'The selected CV is not ready to be set as default.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Serialize concurrent requests and update authoritative profile defaultCvId
      await tx.candidateProfile.update({
        where: { id: candidateProfile.id },
        data: { defaultCvId: cvId },
      });

      // 2. Clear previous default
      await tx.cv.updateMany({
        where: {
          candidateProfileId: candidateProfile.id,
          id: { not: cvId },
        },
        data: { isDefault: false },
      });

      // 3. Set new default flag and increment version
      const res = await tx.cv.update({
        where: { id: cvId },
        data: {
          isDefault: true,
          version: { increment: 1 },
        },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'CV_SET_DEFAULT',
          targetType: 'CV',
          targetId: cvId,
          requestId,
          metadata: { version: res.version },
        },
        tx,
      );

      return res;
    });

    return this.mapToDto(updated);
  }

  async getSignedDownloadUrl(user: AuthenticatedUser, cvId: string): Promise<SignedDownloadDto> {
    const cv = await this.prisma.cv.findUnique({ where: { id: cvId } });
    if (!cv) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'CV not found.',
      });
    }

    if (cv.processingStatus === 'DELETED') {
      // BE-8-020: For soft-deleted CVs previously submitted to applications,
      // allow authorized HR or ADMIN to access the submitted record for hiring compliance/audit.
      if (user.role === 'ADMIN') {
        // ADMIN is permitted
      } else if (user.role === 'HR') {
        const app = await this.prisma.application.findFirst({
          where: { submittedCvId: cv.id },
          include: { job: true },
        });
        if (!app) {
          throw new NotFoundException({
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'CV not found or has been deleted.',
          });
        }
        await this.companyScopeService.assertMemberOrAdmin(app.job.companyId, user);
      } else {
        throw new NotFoundException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'CV not found or has been deleted.',
        });
      }
    } else {
      await this.assertCvAccess(user, cv);
    }

    const EXPIRES_IN_SECONDS = 900; // 15 minutes
    const url = await this.storageService.getSignedDownloadUrl(
      cv.storageKey,
      cv.originalFileName,
      EXPIRES_IN_SECONDS,
    );

    const expiresAt = new Date(Date.now() + EXPIRES_IN_SECONDS * 1000).toISOString();
    return { url, expiresAt };
  }

  async deleteCv(user: AuthenticatedUser, cvId: string, requestId?: string): Promise<void> {
    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });
    if (!candidateProfile) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Candidate profile not found.',
      });
    }

    const cv = await this.prisma.cv.findUnique({ where: { id: cvId } });
    if (!cv || cv.candidateProfileId !== candidateProfile.id || cv.processingStatus === 'DELETED') {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'CV not found.',
      });
    }

    // BEI-002: Check if referenced by active applications
    const referencedApp = await this.prisma.application.findFirst({
      where: { submittedCvId: cvId },
    });

    const wasDefault = cv.isDefault || candidateProfile.defaultCvId === cvId;

    if (referencedApp) {
      // Soft-delete to preserve application audit integrity
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.cv.update({
          where: { id: cvId },
          data: {
            processingStatus: 'DELETED',
            isDefault: false,
          },
        });

        if (wasDefault) {
          const nextDefaultCv = await tx.cv.findFirst({
            where: {
              candidateProfileId: candidateProfile.id,
              id: { not: cvId },
              processingStatus: 'READY',
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          });

          if (nextDefaultCv) {
            await tx.cv.update({
              where: { id: nextDefaultCv.id },
              data: {
                isDefault: true,
                version: { increment: 1 },
              },
            });
            await tx.candidateProfile.update({
              where: { id: candidateProfile.id },
              data: { defaultCvId: nextDefaultCv.id },
            });
          } else {
            await tx.candidateProfile.update({
              where: { id: candidateProfile.id },
              data: { defaultCvId: null },
            });
            await tx.cv.updateMany({
              where: {
                candidateProfileId: candidateProfile.id,
                id: { not: cvId },
              },
              data: { isDefault: false },
            });
          }
        }

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'CV_SOFT_DELETED',
            targetType: 'CV',
            targetId: cvId,
            requestId,
            metadata: { reason: 'Referenced by active applications' },
          },
          tx,
        );
      });
    } else {
      // Hard delete: remove DB record and audit first in transaction
      await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.cv.delete({ where: { id: cvId } });

        if (wasDefault) {
          const nextDefaultCv = await tx.cv.findFirst({
            where: {
              candidateProfileId: candidateProfile.id,
              processingStatus: 'READY',
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          });

          if (nextDefaultCv) {
            await tx.cv.update({
              where: { id: nextDefaultCv.id },
              data: {
                isDefault: true,
                version: { increment: 1 },
              },
            });
            await tx.candidateProfile.update({
              where: { id: candidateProfile.id },
              data: { defaultCvId: nextDefaultCv.id },
            });
          } else {
            await tx.candidateProfile.update({
              where: { id: candidateProfile.id },
              data: { defaultCvId: null },
            });
            await tx.cv.updateMany({
              where: {
                candidateProfileId: candidateProfile.id,
              },
              data: { isDefault: false },
            });
          }
        }

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'CV_DELETED',
            targetType: 'CV',
            targetId: cvId,
            requestId,
          },
          tx,
        );
      });

      // Storage deletion executed outside DB transaction to avoid holding DB lock open
      try {
        await this.storageService.deleteFile(cv.storageKey);
      } catch (storageErr) {
        this.logger.warn(`Failed to delete storage file ${cv.storageKey}: ${storageErr}`);
      }
    }
  }

  private async assertCvAccess(user: AuthenticatedUser, cv: Cv): Promise<void> {
    if (user.role === 'ADMIN') return;

    if (user.role === 'CANDIDATE') {
      const candidateProfile = await this.prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      if (!candidateProfile || candidateProfile.id !== cv.candidateProfileId) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You are not authorized to view this CV.',
        });
      }
      return;
    }

    if (user.role === 'HR') {
      // Recruiter must have an application from this candidate with this CV
      const app = await this.prisma.application.findFirst({
        where: {
          submittedCvId: cv.id,
        },
        include: {
          job: true,
        },
      });

      if (!app) {
        throw new ForbiddenException({
          code: ERROR_CODES.FORBIDDEN,
          message: 'You do not have access to this CV.',
        });
      }

      await this.companyScopeService.assertMemberOrAdmin(app.job.companyId, user);
      return;
    }

    throw new ForbiddenException({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Access denied.',
    });
  }

  /**
   * Reconciles stale QUEUED operations by republishing missing BullMQ jobs
   * from persisted operation state without creating a new logical run (BE-10-009).
   */
  async reconcileStaleQueuedOperations(staleThresholdMs = 60000): Promise<number> {
    const cutoff = new Date(Date.now() - staleThresholdMs);
    const staleOps = await this.prisma.operation.findMany({
      where: {
        type: { in: ['CV_TEXT_EXTRACTION', 'CV_EXTRACTION'] },
        status: 'QUEUED',
        createdAt: { lt: cutoff },
      },
    });

    let reconciled = 0;
    for (const op of staleOps) {
      if (!op.resultResourceId) continue;
      const cv = await this.prisma.cv.findUnique({
        where: { id: op.resultResourceId },
      });

      if (cv && cv.processingStatus !== 'DELETED' && cv.processingStatus !== 'READY') {
        try {
          await this.queueService.addJob(
            QUEUES.CV_EXTRACTION,
            'extract-cv-text',
            {
              cvId: cv.id,
              operationId: op.id,
              actorId: op.userId ?? undefined,
            },
            {
              jobId: `cv-extraction:${op.id}`,
            },
          );
          reconciled++;
          this.logger.log(
            `Reconciled and republished stale QUEUED operation ${op.id} for cvId=${cv.id}`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to republish stale operation ${op.id}: ${msg}`);
        }
      }
    }
    return reconciled;
  }

  private mapToDto(cv: Cv): CvDto {
    return {
      id: cv.id,
      candidateId: cv.candidateProfileId,
      originalFileName: cv.originalFileName,
      mimeType: cv.mimeType,
      sizeBytes: cv.sizeBytes,
      checksumSha256: cv.checksumSha256,
      processingStatus: cv.processingStatus,
      failureCode: cv.failureCode ?? null,
      isDefault: cv.isDefault,
      version: cv.version,
      latestOperationId: cv.latestOperationId ?? null,
      extractionAttempts: cv.extractionAttempts ?? 0,
      createdAt: this.toIso(cv.createdAt)!,
      updatedAt: this.toIso(cv.updatedAt)!,
    };
  }

  public mapOperationToDto(op: Operation): OperationDto {
    return {
      id: op.id,
      type: op.type,
      status: op.status,
      progressPercent: op.progressPercent ?? null,
      resultResource:
        op.resultResourceType && op.resultResourceId
          ? { type: op.resultResourceType, id: op.resultResourceId }
          : null,
      failure: op.failureCode ? { code: op.failureCode, message: op.failureMessage || '' } : null,
      idempotencyKey: op.idempotencyKey ?? null,
      createdAt: op.createdAt instanceof Date ? op.createdAt.toISOString() : op.createdAt,
      updatedAt: op.updatedAt instanceof Date ? op.updatedAt.toISOString() : op.updatedAt,
      completedAt: op.completedAt
        ? op.completedAt instanceof Date
          ? op.completedAt.toISOString()
          : op.completedAt
        : null,
    };
  }
}
