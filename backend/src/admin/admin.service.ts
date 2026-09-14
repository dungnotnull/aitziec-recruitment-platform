import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  JobStatus,
  User,
  Company,
  Job,
  AuditLog,
  Application,
  CandidateProfile,
  CandidateSkill,
  Skill,
  ApplicationStatusEvent,
} from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CompaniesService } from '../companies/companies.service';
import { JobsService } from '../jobs/jobs.service';
import { ApplicationsService } from '../applications/applications.service';
import { OutboxService } from '../outbox/outbox.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { ERROR_CODES } from '../common/constants/error-codes';
import { CollectionResponse } from '../common/dto/response.dto';
import { UserSummaryDto } from '../auth/dto/auth.dto';
import { CompanyDto } from '../companies/dto/company.dto';
import { JobDto } from '../jobs/dto/job.dto';
import { ApplicationStatus } from '../applications/dto/application.dto';
import { AdminUserQueryDto, UpdateUserStatusDto } from './dto/admin-user.dto';
import { UpdateCompanyStatusDto } from './dto/admin-company.dto';
import { ModerateJobDto } from './dto/admin-job.dto';
import { AuditLogDto, AuditLogQueryDto } from './dto/admin-audit.dto';
import { AdminCompanyQueryDto } from './dto/admin-company-query.dto';
import { AdminJobQueryDto } from './dto/admin-job-query.dto';
import {
  AdminApplicationDetailDto,
  AdminApplicationQueryDto,
  AdminApplicationStatusEventDto,
  AdminApplicationSummaryDto,
  ModerateApplicationDto,
} from './dto/admin-application.dto';

type AdminApplicationWithRelations = Application & {
  candidate?:
    | (CandidateProfile & {
        skills?: (CandidateSkill & {
          skill?: Skill | null;
        })[];
      })
    | null;
  job?:
    | (Job & {
        company?: Company | null;
      })
    | null;
  history?: ApplicationStatusEvent[];
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly companiesService: CompaniesService,
    private readonly jobsService: JobsService,
    private readonly applicationsService: ApplicationsService,
    private readonly outboxService: OutboxService,
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
      users = users.filter((u) => u.email.toLowerCase().includes(searchLower));
    }

    // Sort newest first
    users.sort((a, b) => {
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

        const foundIdx = users.findIndex((u) => {
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
      data: pageItems.map((u) => this.mapUserToSummary(u)),
      meta: {
        page: {
          nextCursor,
          hasNextPage: hasMore,
          limit,
        },
      },
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
    const updatedUser = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    const updatedCompany = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    const updatedJob = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updateData: Prisma.JobUpdateInput = {
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

    let logs: AuditLog[] = [];
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
      },
    };
  }

  // --- MAPPERS ---

  private mapUserToSummary(user: User): UserSummaryDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private mapAuditLogToDto(log: AuditLog): AuditLogDto {
    let metadataObj: Record<string, unknown> = {};
    if (log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)) {
      metadataObj = log.metadata as Record<string, unknown>;
    } else if (typeof log.metadata === 'string') {
      try {
        const parsed = JSON.parse(log.metadata);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          metadataObj = parsed;
        }
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

  /**
   * List companies for admin with search, status filter and cursor pagination (BE-8-013).
   */
  async listCompanies(
    query: AdminCompanyQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<CompanyDto>> {
    const limit = query.limit || 20;

    const where: Prisma.CompanyWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const findArgs: Prisma.CompanyFindManyArgs = {
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };

    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const rows = await this.prisma.company.findMany(findArgs);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

    return {
      data: items.map((c) => this.mapCompanyToDto(c)),
      meta: {
        requestId: requestId || '',
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  /**
   * List jobs for admin with search, companyId, status, experienceLevel filter and cursor pagination (BE-8-013).
   */
  async listJobs(query: AdminJobQueryDto, requestId?: string): Promise<CollectionResponse<JobDto>> {
    const limit = query.limit || 20;

    const where: Prisma.JobWhereInput = {};
    if (query.companyId) {
      where.companyId = query.companyId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.experienceLevel) {
      where.experienceLevel = query.experienceLevel;
    }
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { company: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const findArgs: Prisma.JobFindManyArgs = {
      where,
      include: { company: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };

    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const rows = await this.prisma.job.findMany(findArgs);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

    return {
      data: items.map((j) => this.mapJobToDto(j)),
      meta: {
        requestId: requestId || '',
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  private mapCompanyToDto(company: Company): CompanyDto {
    return {
      id: company.id,
      slug: company.slug,
      name: company.name,
      description: company.description ?? null,
      websiteUrl: company.websiteUrl ?? null,
      logoUrl: company.logoUrl ?? null,
      location: company.location ?? null,
      status: company.status,
      version: company.version ?? 1,
      createdAt:
        company.createdAt instanceof Date ? company.createdAt.toISOString() : company.createdAt,
      updatedAt:
        company.updatedAt instanceof Date ? company.updatedAt.toISOString() : company.updatedAt,
    };
  }

  private mapJobToDto(job: Job & { company?: Company | null }): JobDto {
    return {
      id: job.id,
      company: {
        id: job.company?.id || job.companyId,
        slug: job.company?.slug || '',
        name: job.company?.name || '',
        logoUrl: job.company?.logoUrl ?? null,
      },
      title: job.title,
      slug: job.slug,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities ?? null,
      technologyNames: job.technologyNames || [],
      location: job.location,
      workplaceType: job.workplaceType,
      experienceLevel: job.experienceLevel,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      currency: job.currency,
      applicationDeadline:
        job.applicationDeadline instanceof Date
          ? job.applicationDeadline.toISOString()
          : job.applicationDeadline,
      status: job.status,
      publishedAt: job.publishedAt
        ? job.publishedAt instanceof Date
          ? job.publishedAt.toISOString()
          : job.publishedAt
        : null,
      closedAt: job.closedAt
        ? job.closedAt instanceof Date
          ? job.closedAt.toISOString()
          : job.closedAt
        : null,
      version: job.version,
      createdAt: job.createdAt instanceof Date ? job.createdAt.toISOString() : job.createdAt,
      updatedAt: job.updatedAt instanceof Date ? job.updatedAt.toISOString() : job.updatedAt,
    };
  }

  // --- APPLICATION REDACTION & MODERATION (BE-8-014, BE-8-015) ---

  public decodeApplicationCursor(cursorStr: string): { id: string; submittedAt?: string } {
    try {
      let decoded = '';
      try {
        decoded = Buffer.from(cursorStr, 'base64url').toString('utf8');
      } catch {
        decoded = Buffer.from(cursorStr, 'base64').toString('utf8');
      }
      try {
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed.id === 'string') {
          return parsed;
        }
      } catch {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)) {
          return { id: decoded };
        }
      }
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursorStr)) {
        return { id: cursorStr };
      }
      throw new Error();
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Invalid pagination cursor',
      });
    }
  }

  public encodeApplicationCursor(item: { id: string; submittedAt: string | Date }): string {
    const payload = {
      id: item.id,
      submittedAt:
        item.submittedAt instanceof Date ? item.submittedAt.toISOString() : item.submittedAt,
    };
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  }

  /**
   * List applications for admin with search, status/company/job filters, and cursor pagination (BE-8-014).
   * Strictly redacts CV text, storage keys, phone numbers, notes, feedback, and tokens.
   */
  async listApplications(
    query: AdminApplicationQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<AdminApplicationSummaryDto>> {
    const limit = query.limit || 20;

    const where: Prisma.ApplicationWhereInput = {};
    if (query.companyId) {
      where.job = { companyId: query.companyId };
    }
    if (query.jobId) {
      where.jobId = query.jobId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.submittedAfter || query.submittedBefore) {
      where.submittedAt = {
        ...(query.submittedAfter ? { gte: new Date(query.submittedAfter) } : {}),
        ...(query.submittedBefore ? { lte: new Date(query.submittedBefore) } : {}),
      };
    }
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { candidate: { fullName: { contains: term, mode: 'insensitive' } } },
        { job: { title: { contains: term, mode: 'insensitive' } } },
        { job: { slug: { contains: term, mode: 'insensitive' } } },
        { job: { company: { name: { contains: term, mode: 'insensitive' } } } },
        { job: { company: { slug: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const findArgs: Prisma.ApplicationFindManyArgs = {
      where,
      include: {
        candidate: {
          include: {
            skills: {
              include: {
                skill: true,
              },
            },
          },
        },
        job: {
          include: {
            company: true,
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };

    if (query.cursor) {
      const decoded = this.decodeApplicationCursor(query.cursor);
      findArgs.cursor = { id: decoded.id };
      findArgs.skip = 1;
    }

    const rows = await this.prisma.application.findMany(findArgs);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasNextPage && items.length > 0
        ? this.encodeApplicationCursor(items[items.length - 1])
        : null;

    return {
      data: items.map((app) => this.mapApplicationToSummary(app)),
      meta: {
        requestId: requestId || '',
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  /**
   * Get application detail for admin with ordered status history (BE-8-014).
   * Redacts sensitive personal notes, phone, CV storage keys, and recruiter feedback.
   */
  async getApplicationDetail(applicationId: string): Promise<AdminApplicationDetailDto> {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        candidate: {
          include: {
            skills: {
              include: {
                skill: true,
              },
            },
          },
        },
        job: {
          include: {
            company: true,
          },
        },
        history: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!app) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Application not found.',
      });
    }

    return this.mapApplicationToDetail(app);
  }

  /**
   * Audited admin application moderation with optimistic concurrency and shared state transition policy (BE-8-015).
   * Permitted even when the owning company is suspended.
   */
  async moderateApplication(
    adminUser: AuthenticatedUser,
    applicationId: string,
    dto: ModerateApplicationDto,
    requestId?: string,
  ): Promise<AdminApplicationDetailDto> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        job: {
          include: { company: true },
        },
        candidate: true,
      },
    });

    if (!application) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Application not found.',
      });
    }

    if (application.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but current version is ${application.version}.`,
      });
    }

    // Reuse shared transition logic
    this.applicationsService.validateStatusTransition(
      application.status as ApplicationStatus,
      dto.targetStatus,
    );

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Update application status & increment version
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: dto.targetStatus,
          version: { increment: 1 },
        },
      });

      // 2. Append ApplicationStatusEvent
      await tx.applicationStatusEvent.create({
        data: {
          applicationId,
          fromStatus: application.status,
          toStatus: dto.targetStatus,
          reason: dto.reason,
          actorId: adminUser.id,
        },
      });

      // 3. Record AuditLog
      await this.auditService.record(
        {
          actorId: adminUser.id,
          action: 'APPLICATION_MODERATED',
          targetType: 'Application',
          targetId: applicationId,
          requestId,
          metadata: {
            fromStatus: application.status,
            toStatus: dto.targetStatus,
            reason: dto.reason,
            expectedVersion: dto.expectedVersion,
            newVersion: application.version + 1,
          },
        },
        tx,
      );

      // 4. Emit outbox event
      await this.outboxService.recordEvent(tx, {
        eventName: 'ApplicationStatusChanged',
        aggregateType: 'Application',
        aggregateId: application.id,
        payload: {
          applicationId,
          candidateId: application.candidateId,
          candidateUserId: application.candidate?.userId || '',
          jobId: application.jobId,
          jobTitle: application.job.title,
          companyId: application.job.companyId,
          companyName: application.job.company.name,
          fromStatus: application.status,
          toStatus: dto.targetStatus,
          changedAt: new Date().toISOString(),
        },
        requestId,
        actorId: adminUser.id,
      });
    });

    return this.getApplicationDetail(applicationId);
  }

  // --- REDACTION MAPPERS (BE-8-014) ---

  private mapApplicationToSummary(app: AdminApplicationWithRelations): AdminApplicationSummaryDto {
    const skills: string[] = (app.candidate?.skills || [])
      .map((cs) => cs.skill?.name || cs.skillId)
      .filter(Boolean);

    return {
      id: app.id,
      jobId: app.jobId,
      candidateId: app.candidateId,
      status: app.status,
      version: app.version,
      submittedAt:
        app.submittedAt instanceof Date ? app.submittedAt.toISOString() : app.submittedAt,
      updatedAt: app.updatedAt instanceof Date ? app.updatedAt.toISOString() : app.updatedAt,
      candidate: {
        id: app.candidate?.id || app.candidateId,
        fullName: app.candidate?.fullName || '',
        headline: app.candidate?.headline ?? null,
        skills,
      },
      job: {
        id: app.job?.id || app.jobId,
        title: app.job?.title || '',
        slug: app.job?.slug || '',
      },
      company: {
        id: app.job?.company?.id || app.job?.companyId || '',
        name: app.job?.company?.name || '',
        slug: app.job?.company?.slug || '',
      },
    };
  }

  private mapApplicationToDetail(app: AdminApplicationWithRelations): AdminApplicationDetailDto {
    const summary = this.mapApplicationToSummary(app);
    const history: AdminApplicationStatusEventDto[] = (app.history || []).map((evt) => ({
      id: evt.id,
      fromStatus: evt.fromStatus ?? null,
      toStatus: evt.toStatus,
      reason: evt.reason ?? null,
      actorId: evt.actorId,
      occurredAt: evt.occurredAt instanceof Date ? evt.occurredAt.toISOString() : evt.occurredAt,
    }));

    return {
      ...summary,
      history,
    };
  }
}
