import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CompaniesService } from '../companies/companies.service';
import { JobsService } from '../jobs/jobs.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ERROR_CODES } from '../common/constants/error-codes';
import { CollectionResponse } from '../common/dto/response.dto';
import { UserSummaryDto } from '../auth/dto/auth.dto';
import { CompanyDto } from '../companies/dto/company.dto';
import { JobDto } from '../jobs/dto/job.dto';
import { AdminUserQueryDto, UpdateUserStatusDto } from './dto/admin-user.dto';
import { UpdateCompanyStatusDto } from './dto/admin-company.dto';
import { ModerateJobDto } from './dto/admin-job.dto';
import { AuditLogDto, AuditLogQueryDto } from './dto/admin-audit.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly companiesService: CompaniesService,
    private readonly jobsService: JobsService,
  ) {}

  /**
   * List users with filters and cursor pagination (BE-7-001).
   */
  async listUsers(query: AdminUserQueryDto): Promise<CollectionResponse<UserSummaryDto>> {
    const limit = query.limit || 20;

    let users = await this.prisma.user.findMany({
      where: {
        ...(query.role ? { role: query.role } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
    });

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      users = users.filter((u: any) => u.email.toLowerCase().includes(searchLower));
    }

    // Sort newest first
    users.sort((a: any, b: any) => {
      const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    // Cursor pagination
    let startIndex = 0;
    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
        const [cursorTimeStr, cursorId] = decoded.split(':');
        const cursorTime = parseInt(cursorTimeStr, 10);

        const foundIdx = users.findIndex((u: any) => {
          return new Date(u.createdAt).getTime() === cursorTime && u.id === cursorId;
        });

        if (foundIdx !== -1) {
          startIndex = foundIdx + 1;
        }
      } catch {
        // Fall back to beginning on bad cursor
      }
    }

    const pageItems = users.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < users.length;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      const time = new Date(lastItem.createdAt).getTime();
      nextCursor = Buffer.from(`${time}:${lastItem.id}`).toString('base64');
    }

    return {
      data: pageItems.map((u: any) => this.mapUserToSummary(u)),
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      } as any,
    };
  }

  /**
   * Audited user status moderation with session revocation (BE-7-002).
   */
  async moderateUserStatus(
    adminUser: AuthenticatedUser,
    targetUserId: string,
    dto: UpdateUserStatusDto,
    requestId?: string,
  ): Promise<UserSummaryDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'User not found.',
      });
    }

    const fromStatus = user.status;
    const toStatus = dto.status;

    // Execute atomic update & session revocation in transaction
    const updatedUser = await this.prisma.$transaction(async (tx: any) => {
      // 1. If suspending or disabling, revoke active sessions immediately
      if (toStatus === 'SUSPENDED' || toStatus === 'DISABLED') {
        await tx.refreshSession.updateMany({
          where: { userId: targetUserId, isRevoked: false },
          data: { isRevoked: true },
        });
      }

      // 2. Update status
      const updated = await tx.user.update({
        where: { id: targetUserId },
        data: { status: toStatus },
      });

      // 3. Record audit
      await this.auditService.record(
        {
          actorId: adminUser.id,
          action: 'USER_STATUS_MODERATED',
          targetType: 'User',
          targetId: targetUserId,
          requestId,
          metadata: {
            fromStatus,
            toStatus,
            reason: dto.reason,
          },
        },
        tx,
      );

      return updated;
    });

    return this.mapUserToSummary(updatedUser);
  }

  /**
   * Audited company status moderation with optimistic concurrency (BE-7-003).
   */
  async moderateCompanyStatus(
    adminUser: AuthenticatedUser,
    companyId: string,
    dto: UpdateCompanyStatusDto,
    requestId?: string,
  ): Promise<CompanyDto> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    if (company.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but current version is ${company.version}.`,
      });
    }

    const updatedCompany = await this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.company.update({
        where: { id: companyId },
        data: {
          status: dto.status,
          version: { increment: 1 },
        },
      });

      await this.auditService.record(
        {
          actorId: adminUser.id,
          action: 'COMPANY_STATUS_MODERATED',
          targetType: 'Company',
          targetId: companyId,
          requestId,
          metadata: {
            fromStatus: company.status,
            toStatus: dto.status,
            reason: dto.reason,
            expectedVersion: dto.expectedVersion,
          },
        },
        tx,
      );

      return updated;
    });

    return this.companiesService.mapToDto(updatedCompany);
  }

  /**
   * Audited job moderation (unpublish or close) with optimistic concurrency (BE-7-004).
   */
  async moderateJob(
    adminUser: AuthenticatedUser,
    jobId: string,
    dto: ModerateJobDto,
    requestId?: string,
  ): Promise<JobDto> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { company: true },
    });

    if (!job) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found.',
      });
    }

    if (job.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but current version is ${job.version}.`,
      });
    }

    const targetStatus = dto.action === 'UNPUBLISH' ? JobStatus.UNPUBLISHED : JobStatus.CLOSED;

    const updatedJob = await this.prisma.$transaction(async (tx: any) => {
      const updateData: any = {
        status: targetStatus,
        version: { increment: 1 },
      };

      if (dto.action === 'CLOSE') {
        updateData.closeReason = dto.reason;
        updateData.closedAt = new Date();
      }

      const updated = await tx.job.update({
        where: { id: jobId },
        data: updateData,
        include: { company: true },
      });

      await this.auditService.record(
        {
          actorId: adminUser.id,
          action: 'JOB_MODERATED',
          targetType: 'Job',
          targetId: jobId,
          requestId,
          metadata: {
            action: dto.action,
            reason: dto.reason,
            fromStatus: job.status,
            toStatus: targetStatus,
            expectedVersion: dto.expectedVersion,
          },
        },
        tx,
      );

      return updated;
    });

    return this.jobsService.mapToDto(updatedJob);
  }

  /**
   * Authorized query endpoint for append-only audit records (BE-7-005, BE-7-006).
   */
  async queryAuditLogs(query: AuditLogQueryDto): Promise<CollectionResponse<AuditLogDto>> {
    const limit = query.limit || 20;

    let logs: any[] = [];
    if (this.prisma.auditLog && typeof this.prisma.auditLog.findMany === 'function') {
      logs = await this.prisma.auditLog.findMany({
        where: {
          ...(query.actorId ? { actorId: query.actorId } : {}),
          ...(query.action ? { action: query.action } : {}),
          ...(query.targetType ? { targetType: query.targetType } : {}),
          ...(query.targetId ? { targetId: query.targetId } : {}),
        },
      });
    }

    // Date filters
    if (query.startDate) {
      const startTime = new Date(query.startDate).getTime();
      logs = logs.filter((l) => new Date(l.occurredAt).getTime() >= startTime);
    }
    if (query.endDate) {
      const endTime = new Date(query.endDate).getTime();
      logs = logs.filter((l) => new Date(l.occurredAt).getTime() <= endTime);
    }

    // Sort newest first
    logs.sort((a, b) => {
      const timeDiff = new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    });

    // Cursor pagination
    let startIndex = 0;
    if (query.cursor) {
      try {
        const decoded = Buffer.from(query.cursor, 'base64').toString('utf8');
        const [cursorTimeStr, cursorId] = decoded.split(':');
        const cursorTime = parseInt(cursorTimeStr, 10);

        const foundIdx = logs.findIndex((l) => {
          return new Date(l.occurredAt).getTime() === cursorTime && l.id === cursorId;
        });

        if (foundIdx !== -1) {
          startIndex = foundIdx + 1;
        }
      } catch {
        // Fallback to start
      }
    }

    const pageItems = logs.slice(startIndex, startIndex + limit);
    const hasMore = startIndex + limit < logs.length;

    let nextCursor: string | null = null;
    if (hasMore && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      const time = new Date(lastItem.occurredAt).getTime();
      nextCursor = Buffer.from(`${time}:${lastItem.id}`).toString('base64');
    }

    return {
      data: pageItems.map((l) => this.mapAuditLogToDto(l)),
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      } as any,
    };
  }

  // --- MAPPERS ---

  private mapUserToSummary(user: any): UserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private mapAuditLogToDto(log: any): AuditLogDto {
    let metadataObj = log.metadata || {};
    if (typeof metadataObj === 'string') {
      try {
        metadataObj = JSON.parse(metadataObj);
      } catch {
        metadataObj = {};
      }
    }

    return {
      id: log.id,
      actorId: log.actorId ?? null,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      requestId: log.requestId ?? null,
      metadata: metadataObj,
      occurredAt: log.occurredAt instanceof Date ? log.occurredAt.toISOString() : log.occurredAt,
    };
  }
}
