import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../companies/company-scope.service';
import { AuditService } from '../audit/audit.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CollectionResponse } from '../common/dto/response.dto';
import { CompanyJobQueryDto } from './dto/company-job-query.dto';
import {
  CloseJobDto,
  CreateJobDto,
  JobDto,
  ModerateJobDto,
  PublishJobDto,
  UnpublishJobDto,
  UpdateJobDto,
} from './dto/job.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScopeService: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private toIso(date: any): string | null {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  public mapToDto(job: any): JobDto {
    return {
      id: job.id,
      company: {
        id: job.company?.id ?? job.companyId,
        slug: job.company?.slug ?? '',
        name: job.company?.name ?? '',
        logoUrl: job.company?.logoUrl ?? null,
      },
      title: job.title,
      slug: job.slug,
      description: job.description,
      requirements: job.requirements,
      responsibilities: job.responsibilities ?? null,
      technologyNames: job.technologyNames ?? [],
      location: job.location,
      workplaceType: job.workplaceType,
      experienceLevel: job.experienceLevel,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      currency: job.currency,
      applicationDeadline: this.toIso(job.applicationDeadline) ?? new Date().toISOString(),
      status: job.status,
      publishedAt: this.toIso(job.publishedAt),
      closedAt: this.toIso(job.closedAt),
      version: job.version,
      createdAt: this.toIso(job.createdAt) ?? new Date().toISOString(),
      updatedAt: this.toIso(job.updatedAt) ?? new Date().toISOString(),
    };
  }

  async listCompanyJobs(
    companyId: string,
    user: AuthenticatedUser,
    query: CompanyJobQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<JobDto>> {
    const company = await this.companyScopeService.assertMemberOrAdminReadOnly(companyId, user);

    const limit = query.limit ?? 20;
    const where: Prisma.JobWhereInput = { companyId: company.id };

    if (query.status && query.status.length > 0) {
      where.status = { in: query.status };
    }

    if (query.experienceLevel && query.experienceLevel.length > 0) {
      where.experienceLevel = { in: query.experienceLevel };
    }

    if (query.employmentType && query.employmentType.length > 0) {
      where.employmentType = { in: query.employmentType };
    }

    if (query.workplaceType && query.workplaceType.length > 0) {
      where.workplaceType = { in: query.workplaceType };
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { requirements: { contains: term, mode: 'insensitive' } },
      ];
    }

    type OrderDirection = 'asc' | 'desc';
    const orderBy: Array<Record<string, OrderDirection>> = [{ createdAt: 'desc' }, { id: 'desc' }];
    if (query.sort) {
      const [field, dir] = query.sort.split(':');
      const direction: OrderDirection = dir?.toLowerCase() === 'asc' ? 'asc' : 'desc';
      if (field === 'title') {
        orderBy.unshift({ title: direction });
      } else if (field === 'createdAt') {
        orderBy.unshift({ createdAt: direction });
      }
    }

    const findArgs: Prisma.JobFindManyArgs = {
      where,
      include: { company: true },
      orderBy,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };

    const jobs = await this.prisma.job.findMany(findArgs);
    const hasNextPage = jobs.length > limit;
    const items = hasNextPage ? jobs.slice(0, limit) : jobs;

    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      nextCursor = items[items.length - 1].id;
    }

    return {
      data: items.map((j) => this.mapToDto(j)),
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

  async createDraftJob(
    companyId: string,
    user: AuthenticatedUser,
    dto: CreateJobDto,
  ): Promise<JobDto> {
    // Check company scope (OWNER, RECRUITER, or ADMIN) and active company status
    const company = await this.companyScopeService.assertMemberOrAdmin(companyId, user);

    // Validate salary constraints (JOB-006)
    if (
      dto.salaryMin !== undefined &&
      dto.salaryMin !== null &&
      dto.salaryMax !== undefined &&
      dto.salaryMax !== null &&
      dto.salaryMin > dto.salaryMax
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'salaryMin must be less than or equal to salaryMax.',
      });
    }

    // Validate deadline constraint
    const deadline = new Date(dto.applicationDeadline);
    if (isNaN(deadline.getTime()) || deadline.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'applicationDeadline must be a valid future ISO UTC date.',
      });
    }

    // Generate unique slug
    const baseSlug = this.slugify(dto.title);
    const uniqueSuffix = uuidv4().slice(0, 8);
    const slug = `${baseSlug || 'job'}-${uniqueSuffix}`;

    const job = await this.prisma.job.create({
      data: {
        companyId: company.id,
        title: dto.title,
        slug,
        description: dto.description,
        requirements: dto.requirements,
        responsibilities: dto.responsibilities ?? null,
        technologyNames: dto.technologyNames ?? [],
        location: dto.location,
        workplaceType: dto.workplaceType,
        experienceLevel: dto.experienceLevel,
        employmentType: dto.employmentType,
        salaryMin: dto.salaryMin ?? null,
        salaryMax: dto.salaryMax ?? null,
        currency: dto.currency || 'VND',
        applicationDeadline: deadline,
        status: 'DRAFT',
        version: 1,
      },
      include: { company: true },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'JOB_CREATED',
      targetType: 'JOB',
      targetId: job.id,
      metadata: { companyId: company.id, slug: job.slug, status: job.status },
    });

    return this.mapToDto(job);
  }

  async getJobDetail(jobIdOrSlug: string, user?: AuthenticatedUser): Promise<JobDto> {
    const job = await this.prisma.job.findFirst({
      where: {
        OR: [{ id: jobIdOrSlug }, { slug: jobIdOrSlug }],
      },
      include: { company: true },
    });

    if (!job) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found.',
      });
    }

    const now = new Date();
    const isPubliclyVisible =
      job.status === 'PUBLISHED' &&
      job.company?.status === 'ACTIVE' &&
      new Date(job.applicationDeadline) > now;

    if (isPubliclyVisible) {
      return this.mapToDto(job);
    }

    // Non-public job: check authorization
    if (!user) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Job not found.',
      });
    }

    if (user.role === 'ADMIN') {
      return this.mapToDto(job);
    }

    if (user.role === 'HR') {
      const membership = await this.prisma.companyMembership.findUnique({
        where: {
          companyId_userId: {
            companyId: job.companyId,
            userId: user.id,
          },
        },
      });

      if (membership) {
        return this.mapToDto(job);
      }
    }

    // Hide existence for unauthorized users (CANDIDATE or unrelated HR)
    throw new NotFoundException({
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
      message: 'Job not found.',
    });
  }

  async updateJob(jobId: string, user: AuthenticatedUser, dto: UpdateJobDto): Promise<JobDto> {
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

    await this.companyScopeService.assertMemberOrAdmin(job.companyId, user);

    if (job.status === 'CLOSED') {
      throw new ConflictException({
        code: ERROR_CODES.JOB_NOT_OPEN,
        message: 'Cannot update a closed job.',
      });
    }

    if (job.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but job is at version ${job.version}.`,
      });
    }

    const newSalaryMin = dto.salaryMin !== undefined ? dto.salaryMin : job.salaryMin;
    const newSalaryMax = dto.salaryMax !== undefined ? dto.salaryMax : job.salaryMax;
    if (
      newSalaryMin !== null &&
      newSalaryMin !== undefined &&
      newSalaryMax !== null &&
      newSalaryMax !== undefined &&
      newSalaryMin > newSalaryMax
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'salaryMin must be less than or equal to salaryMax.',
      });
    }

    let newDeadline = job.applicationDeadline;
    if (dto.applicationDeadline) {
      const parsedDeadline = new Date(dto.applicationDeadline);
      if (isNaN(parsedDeadline.getTime()) || parsedDeadline.getTime() <= Date.now()) {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'applicationDeadline must be a valid future ISO UTC date.',
        });
      }
      newDeadline = parsedDeadline;
    }

    const updatedJob = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        title: dto.title ?? job.title,
        description: dto.description ?? job.description,
        requirements: dto.requirements ?? job.requirements,
        responsibilities:
          dto.responsibilities !== undefined ? dto.responsibilities : job.responsibilities,
        technologyNames: dto.technologyNames ?? job.technologyNames,
        location: dto.location ?? job.location,
        workplaceType: dto.workplaceType ?? job.workplaceType,
        experienceLevel: dto.experienceLevel ?? job.experienceLevel,
        employmentType: dto.employmentType ?? job.employmentType,
        salaryMin: newSalaryMin,
        salaryMax: newSalaryMax,
        currency: dto.currency ?? job.currency,
        applicationDeadline: newDeadline,
        version: job.version + 1,
      },
      include: { company: true },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'JOB_UPDATED',
      targetType: 'JOB',
      targetId: job.id,
      metadata: { previousVersion: job.version, newVersion: updatedJob.version },
    });

    return this.mapToDto(updatedJob);
  }

  async publishJob(jobId: string, user: AuthenticatedUser, dto: PublishJobDto): Promise<JobDto> {
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

    await this.companyScopeService.assertMemberOrAdmin(job.companyId, user);

    if (job.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but job is at version ${job.version}.`,
      });
    }

    // Publish eligibility policy (BE-3-005)
    if (job.status === 'PUBLISHED') {
      throw new BadRequestException({
        code: ERROR_CODES.JOB_NOT_PUBLISHABLE,
        message: 'Job is already published.',
      });
    }

    if (job.status === 'CLOSED') {
      throw new BadRequestException({
        code: ERROR_CODES.JOB_NOT_PUBLISHABLE,
        message: 'Closed job cannot be published.',
      });
    }

    if (job.company?.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Company is suspended. Cannot publish job.',
      });
    }

    if (new Date(job.applicationDeadline).getTime() <= Date.now()) {
      throw new BadRequestException({
        code: ERROR_CODES.JOB_NOT_PUBLISHABLE,
        message: 'Job application deadline has already passed.',
      });
    }

    if (
      !job.title ||
      !job.description ||
      !job.requirements ||
      !job.location ||
      !job.technologyNames ||
      job.technologyNames.length === 0
    ) {
      throw new BadRequestException({
        code: ERROR_CODES.JOB_NOT_PUBLISHABLE,
        message:
          'Job is missing required fields (title, description, requirements, location, technologies).',
      });
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        version: job.version + 1,
      },
      include: { company: true },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'JOB_PUBLISHED',
      targetType: 'JOB',
      targetId: job.id,
      metadata: { publishedAt: updated.publishedAt, version: updated.version },
    });

    return this.mapToDto(updated);
  }

  async unpublishJob(
    jobId: string,
    user: AuthenticatedUser,
    dto: UnpublishJobDto,
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

    await this.companyScopeService.assertMemberOrAdmin(job.companyId, user);

    if (job.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but job is at version ${job.version}.`,
      });
    }

    if (job.status !== 'PUBLISHED') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Only published jobs can be unpublished.',
      });
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'UNPUBLISHED',
        version: job.version + 1,
      },
      include: { company: true },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'JOB_UNPUBLISHED',
      targetType: 'JOB',
      targetId: job.id,
      metadata: { version: updated.version },
    });

    return this.mapToDto(updated);
  }

  async closeJob(jobId: string, user: AuthenticatedUser, dto: CloseJobDto): Promise<JobDto> {
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

    await this.companyScopeService.assertMemberOrAdmin(job.companyId, user);

    if (job.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: Expected version ${dto.expectedVersion}, but job is at version ${job.version}.`,
      });
    }

    if (job.status === 'CLOSED') {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Job is already closed.',
      });
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closeReason: dto.reason ?? null,
        version: job.version + 1,
      },
      include: { company: true },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'JOB_CLOSED',
      targetType: 'JOB',
      targetId: job.id,
      metadata: {
        closedAt: updated.closedAt,
        reason: dto.reason ?? null,
        version: updated.version,
      },
    });

    return this.mapToDto(updated);
  }

  async moderateJob(jobId: string, user: AuthenticatedUser, dto: ModerateJobDto): Promise<JobDto> {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only administrators can moderate jobs.',
      });
    }

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
        message: `Version conflict: Expected version ${dto.expectedVersion}, but job is at version ${job.version}.`,
      });
    }

    let updatedStatus: 'UNPUBLISHED' | 'CLOSED';
    const updateData: any = {
      version: job.version + 1,
    };

    if (dto.action === 'UNPUBLISH') {
      if (job.status !== 'PUBLISHED') {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Only published jobs can be unpublished.',
        });
      }
      updatedStatus = 'UNPUBLISHED';
      updateData.status = updatedStatus;
    } else {
      if (job.status === 'CLOSED') {
        throw new BadRequestException({
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Job is already closed.',
        });
      }
      updatedStatus = 'CLOSED';
      updateData.status = updatedStatus;
      updateData.closedAt = new Date();
      updateData.closeReason = dto.reason;
    }

    const updated = await this.prisma.job.update({
      where: { id: jobId },
      data: updateData,
      include: { company: true },
    });

    await this.auditService.record({
      actorId: user.id,
      action: `JOB_MODERATED_${dto.action}`,
      targetType: 'JOB',
      targetId: job.id,
      metadata: {
        action: dto.action,
        reason: dto.reason,
        previousStatus: job.status,
        newStatus: updated.status,
        version: updated.version,
      },
    });

    return this.mapToDto(updated);
  }
}
