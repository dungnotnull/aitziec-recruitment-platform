import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { redactSensitiveData } from '../logging/logging.service';

export interface RecordAuditParams {
  actorId?: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(params: RecordAuditParams, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;
    const sanitizedMetadata = params.metadata ? redactSensitiveData(params.metadata) : undefined;

    try {
      return await client.auditLog.create({
        data: {
          actorId: params.actorId || null,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          requestId: params.requestId || null,
          metadata: sanitizedMetadata ?? undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${err.message}`);
      return null;
    }
  }
}
