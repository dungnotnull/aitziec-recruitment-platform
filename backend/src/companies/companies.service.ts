import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  Logger,
} from '@nestjs/common';
import { Company, CompanyMemberRole, CompanyMembership, User, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from './company-scope.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
import { StorageService } from '../storage/storage.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto, CollectionResponse } from '../common/dto/response.dto';
import {
  AddCompanyMemberDto,
  CompanyDto,
  CompanyMembershipDto,
  CreateCompanyDto,
  UpdateCompanyDto,
  CallerCompanyMembershipDto,
  UploadedLogoFile,
  UploadCompanyLogoDto,
  UploadCompanyLogoResponseDto,
  CompanyReasonToJoinDto,
  CompanyPerkDto,
  CompanyDirectoryQueryDto,
  CompanySummaryItemDto,
  CompanyDashboardStatsDto,
} from './dto/company.dto';
import { CompanyInvitationDto, maskEmail } from './dto/company-invitation.dto';
import { InvitationSecretAdapter } from './adapters/invitation-secret.adapter';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly secretAdapter: InvitationSecretAdapter,
    private readonly storageService: StorageService,
  ) {}

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async createCompany(user: AuthenticatedUser, dto: CreateCompanyDto): Promise<CompanyDto> {
    const rawSlug = dto.slug ? dto.slug : this.slugify(dto.name);
    const slug = rawSlug || `company-${Date.now()}`;

    const existingSlug = await this.prisma.company.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      throw new ConflictException({
        code: ERROR_CODES.COMPANY_SLUG_EXISTS,
        message: 'A company with this slug already exists.',
      });
    }

    const company = await this.prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: {
          slug,
          name: dto.name,
          description: dto.description ?? null,
          websiteUrl: dto.websiteUrl ?? null,
          logoUrl: dto.logoUrl ?? null,
          location: dto.location ?? null,
          companyModel: dto.companyModel ?? null,
          companySize: dto.companySize ?? null,
          country: dto.country ?? null,
          workingTime: dto.workingTime ?? null,
          overtimePolicy: dto.overtimePolicy ?? null,
          techStack: dto.techStack ?? [],
          reasonsToJoin:
            dto.reasonsToJoin !== undefined
              ? (dto.reasonsToJoin as unknown as Prisma.InputJsonValue)
              : [],
          perks: dto.perks !== undefined ? (dto.perks as unknown as Prisma.InputJsonValue) : [],
          status: 'ACTIVE',
          version: 1,
        },
      });

      await tx.companyMembership.create({
        data: {
          companyId: createdCompany.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'COMPANY_CREATED',
          targetType: 'Company',
          targetId: createdCompany.id,
          metadata: { name: dto.name, slug },
        },
        tx,
      );

      return createdCompany;
    });

    return this.mapToDto(company);
  }

  async listPublicCompanies(
    query: CompanyDirectoryQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<CompanySummaryItemDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CompanyWhereInput = {
      status: 'ACTIVE',
    };

    if (query.search && query.search.trim()) {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    if (query.location && query.location.trim()) {
      where.location = { contains: query.location.trim(), mode: 'insensitive' };
    }

    const now = new Date();
    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: {
          _count: {
            select: {
              jobs: {
                where: {
                  status: 'PUBLISHED',
                  applicationDeadline: { gt: now },
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.company.count({ where }),
    ]);

    const hasNextPage = skip + companies.length < total;

    const data: CompanySummaryItemDto[] = companies.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      logoUrl: c.logoUrl,
      location: c.location,
      description: c.description,
      companySize: c.companySize,
      activeJobsCount: (c as { _count?: { jobs?: number } })._count?.jobs ?? 0,
      techStack: Array.isArray(c.techStack) ? c.techStack : [],
    }));

    return {
      data,
      meta: {
        requestId: requestId ?? '',
        page: {
          nextCursor: hasNextPage ? String(page + 1) : null,
          hasNextPage,
          limit,
        },
      },
    };
  }

  async getCompanyByIdOrSlug(idOrSlug: string, user?: AuthenticatedUser): Promise<CompanyDto> {
    const company = await this.prisma.company.findFirst({
      where: {
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
      },
    });

    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    const now = new Date();
    const activeJobsCount = await this.prisma.job.count({
      where: {
        companyId: company.id,
        status: 'PUBLISHED',
        applicationDeadline: { gt: now },
        company: { status: 'ACTIVE' },
      },
    });

    let isFollowed: boolean | undefined = undefined;
    if (user && user.role === 'CANDIDATE') {
      const candidateProfile = await this.prisma.candidateProfile.findUnique({
        where: { userId: user.id },
      });
      if (candidateProfile) {
        const follow = await this.prisma.companyFollow.findUnique({
          where: {
            candidateProfileId_companyId: {
              candidateProfileId: candidateProfile.id,
              companyId: company.id,
            },
          },
        });
        isFollowed = !!follow;
      } else {
        isFollowed = false;
      }
    }

    return this.mapToDto(company, { activeJobsCount, isFollowed });
  }

  async updateCompany(
    companyId: string,
    user: AuthenticatedUser,
    dto: UpdateCompanyDto,
  ): Promise<CompanyDto> {
    const company = await this.scopeService.assertOwnerOrAdmin(companyId, user);

    if (company.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: 'Company was modified by another request. Stale expectedVersion.',
      });
    }

    if (dto.slug !== undefined && dto.slug !== company.slug) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Company slug cannot be changed once created.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.company.update({
        where: { id: companyId },
        data: {
          name: dto.name !== undefined ? dto.name : company.name,
          description: dto.description !== undefined ? dto.description : company.description,
          websiteUrl: dto.websiteUrl !== undefined ? dto.websiteUrl : company.websiteUrl,
          logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : company.logoUrl,
          location: dto.location !== undefined ? dto.location : company.location,
          companyModel: dto.companyModel !== undefined ? dto.companyModel : company.companyModel,
          companySize: dto.companySize !== undefined ? dto.companySize : company.companySize,
          country: dto.country !== undefined ? dto.country : company.country,
          workingTime: dto.workingTime !== undefined ? dto.workingTime : company.workingTime,
          overtimePolicy:
            dto.overtimePolicy !== undefined ? dto.overtimePolicy : company.overtimePolicy,
          techStack: dto.techStack !== undefined ? dto.techStack : company.techStack,
          reasonsToJoin:
            dto.reasonsToJoin !== undefined
              ? (dto.reasonsToJoin as unknown as Prisma.InputJsonValue)
              : (company.reasonsToJoin as Prisma.InputJsonValue),
          perks:
            dto.perks !== undefined
              ? (dto.perks as unknown as Prisma.InputJsonValue)
              : (company.perks as Prisma.InputJsonValue),
          version: company.version + 1,
        },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'COMPANY_UPDATED',
          targetType: 'Company',
          targetId: companyId,
          metadata: { version: result.version },
        },
        tx,
      );

      return result;
    });

    const activeJobsCount = await this.prisma.job.count({
      where: {
        companyId: updated.id,
        status: 'PUBLISHED',
        applicationDeadline: { gt: new Date() },
        company: { status: 'ACTIVE' },
      },
    });

    return this.mapToDto(updated, { activeJobsCount });
  }

  async followCompany(companyId: string, user: AuthenticatedUser): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });

    if (!candidateProfile) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Candidate profile required to follow companies.',
      });
    }

    const existing = await this.prisma.companyFollow.findUnique({
      where: {
        candidateProfileId_companyId: {
          candidateProfileId: candidateProfile.id,
          companyId,
        },
      },
    });

    if (!existing) {
      await this.prisma.companyFollow.create({
        data: {
          candidateProfileId: candidateProfile.id,
          companyId,
        },
      });
    }
  }

  async unfollowCompany(companyId: string, user: AuthenticatedUser): Promise<void> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    const candidateProfile = await this.prisma.candidateProfile.findUnique({
      where: { userId: user.id },
    });

    if (!candidateProfile) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Candidate profile required.',
      });
    }

    await this.prisma.companyFollow.deleteMany({
      where: {
        candidateProfileId: candidateProfile.id,
        companyId,
      },
    });
  }

  async getCompanyDashboardStats(
    companyId: string,
    user: AuthenticatedUser,
  ): Promise<CompanyDashboardStatsDto> {
    await this.scopeService.assertMemberOrAdmin(companyId, user);

    const now = new Date();
    const [totalApplicationsCount, activeJobsCount, teamMembersCount] = await Promise.all([
      this.prisma.application.count({
        where: {
          job: { companyId },
        },
      }),
      this.prisma.job.count({
        where: {
          companyId,
          status: 'PUBLISHED',
          applicationDeadline: { gt: now },
          company: { status: 'ACTIVE' },
        },
      }),
      this.prisma.companyMembership.count({
        where: { companyId },
      }),
    ]);

    return {
      totalApplicationsCount,
      activeJobsCount,
      teamMembersCount,
    };
  }

  private isManagedAssetUrl(url: string, companyId: string): boolean {
    return (
      url.includes(`/companies/${companyId}/`) &&
      (url.includes('itziec-assets') || url.includes(this.storageService.getAssetsBucket()))
    );
  }

  private extractAssetKey(url: string): string | null {
    const match = url.match(/companies\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-.]+/);
    return match ? match[0] : null;
  }

  async uploadCompanyLogo(
    companyId: string,
    user: AuthenticatedUser,
    file: UploadedLogoFile,
    dto?: UploadCompanyLogoDto,
  ): Promise<UploadCompanyLogoResponseDto> {
    // 1. Authorize: Only global ADMIN or HR OWNER can upload logo
    const company = await this.scopeService.assertOwnerOrAdmin(companyId, user);

    // 2. Validate file presence
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException({
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Logo file is required in multipart field "logo".',
      });
    }

    // 3. Max size: 5 MiB (5 * 1024 * 1024 bytes)
    const MAX_LOGO_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_LOGO_SIZE || file.buffer.length > MAX_LOGO_SIZE) {
      throw new PayloadTooLargeException({
        code: ERROR_CODES.FILE_TOO_LARGE,
        message: 'File size exceeds the 5 MiB limit.',
      });
    }

    // 4. Validate MIME type
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: 'Only PNG, JPEG, and WebP images are supported.',
      });
    }

    // 5. Validate magic bytes signature
    let detectedExt: string | null = null;
    const buf = file.buffer;

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    ) {
      detectedExt = 'png';
    }
    // JPEG: FF D8 FF
    else if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      detectedExt = 'jpg';
    }
    // WebP: RIFF at 0..3 and WEBP at 8..11
    else if (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      detectedExt = 'webp';
    }

    if (!detectedExt) {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: 'File content does not match any supported image signature (PNG, JPEG, WebP).',
      });
    }

    // Check MIME vs signature
    if (
      (detectedExt === 'png' && file.mimetype !== 'image/png') ||
      (detectedExt === 'jpg' && file.mimetype !== 'image/jpeg') ||
      (detectedExt === 'webp' && file.mimetype !== 'image/webp')
    ) {
      throw new UnsupportedMediaTypeException({
        code: ERROR_CODES.INVALID_FILE_TYPE,
        message: `File content signature does not match declared MIME type ${file.mimetype}.`,
      });
    }

    // 6. Optimistic concurrency check
    if (dto?.expectedVersion !== undefined && dto.expectedVersion !== company.version) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Company version mismatch: expected ${dto.expectedVersion}, but current is ${company.version}.`,
      });
    }

    // 7. Server-side key generation & upload
    const assetKey = `companies/${companyId}/${crypto.randomUUID()}.${detectedExt}`;
    const publicUrl = await this.storageService.uploadPublicAsset(
      assetKey,
      file.buffer,
      file.mimetype,
    );

    // 8. DB update with compensation
    let updatedCompany: Company;
    try {
      updatedCompany = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.company.update({
          where: {
            id: companyId,
            version: company.version,
          },
          data: {
            logoUrl: publicUrl,
            version: { increment: 1 },
          },
        });

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'COMPANY_LOGO_UPDATED',
            targetType: 'Company',
            targetId: companyId,
            metadata: {
              version: updated.version,
              previousLogoUrl: company.logoUrl,
              newLogoUrl: publicUrl,
            },
          },
          tx,
        );

        return updated;
      });
    } catch (error: unknown) {
      // Compensation: remove newly uploaded asset if DB update fails
      await this.storageService.deletePublicAsset(assetKey).catch((delErr: unknown) => {
        const msg = delErr instanceof Error ? delErr.message : String(delErr);
        this.logger.warn(`Failed to compensate uploaded logo asset ${assetKey}: ${msg}`);
      });
      throw error;
    }

    // 9. Cleanup old managed logo if replaced
    if (company.logoUrl && this.isManagedAssetUrl(company.logoUrl, companyId)) {
      const oldKey = this.extractAssetKey(company.logoUrl);
      if (oldKey) {
        await this.storageService.deletePublicAsset(oldKey).catch(() => {});
      }
    }

    return {
      logoUrl: updatedCompany.logoUrl ?? publicUrl,
      version: updatedCompany.version,
    };
  }

  async listMyCompanies(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<CallerCompanyMembershipDto>> {
    const limit = query.limit || 20;

    const findArgs = {
      where: { userId: user.id },
      include: { company: true },
      orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    };

    const memberships = await this.prisma.companyMembership.findMany(findArgs);
    const hasNextPage = memberships.length > limit;
    const items = hasNextPage ? memberships.slice(0, limit) : memberships;

    let nextCursor: string | null = null;
    if (hasNextPage && items.length > 0) {
      nextCursor = items[items.length - 1].id;
    }

    const data: CallerCompanyMembershipDto[] = items.map((m) => ({
      membership: {
        id: m.id,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      },
      company: this.mapToDto(m.company),
    }));

    return {
      data,
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

  async listMembers(companyId: string, user: AuthenticatedUser, query: PaginationQueryDto) {
    await this.scopeService.assertMemberOrAdmin(companyId, user);

    const limit = query.limit || 20;

    const rows = await this.prisma.companyMembership.findMany({
      where: { companyId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage && items.length > 0 ? items[items.length - 1].id : null;

    return {
      data: items.map((m) => this.mapMemberToDto(m)),
      meta: {
        page: {
          nextCursor,
          hasNextPage,
          limit,
        },
      },
    };
  }

  async addMember(
    companyId: string,
    user: AuthenticatedUser,
    dto: AddCompanyMemberDto,
  ): Promise<CompanyInvitationDto> {
    await this.scopeService.assertOwnerOrAdmin(companyId, user);

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    const normalizedEmail = dto.userEmail.trim().toLowerCase();
    const targetUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const targetRole: CompanyMemberRole = (dto.role as CompanyMemberRole) || 'RECRUITER';

    if (!targetUser || targetUser.role !== 'HR' || targetUser.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: ERROR_CODES.INVITATION_TARGET_INELIGIBLE,
        message: 'Only existing active HR accounts can be invited to a company.',
      });
    }

    const existingMembership = await this.prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException({
        code: ERROR_CODES.MEMBERSHIP_ALREADY_EXISTS,
        message: 'User is already a member of this company.',
      });
    }

    // Check existing pending invitation
    const existingInvitation = await this.prisma.companyInvitation.findFirst({
      where: {
        companyId,
        email: normalizedEmail,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      if (existingInvitation.expiresAt > new Date()) {
        throw new ConflictException({
          code: ERROR_CODES.INVITATION_ALREADY_PENDING,
          message: 'An active invitation already exists for this email address.',
        });
      } else {
        // Mark expired pending invitation so partial unique index doesn't conflict
        await this.prisma.companyInvitation.update({
          where: { id: existingInvitation.id },
          data: { status: 'EXPIRED' },
        });
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const encryptedSecret = this.secretAdapter.encryptToken(rawToken);

    try {
      const invitation = await this.prisma.$transaction(async (tx) => {
        const created = await tx.companyInvitation.create({
          data: {
            companyId,
            email: normalizedEmail,
            role: targetRole,
            invitedById: user.id,
            tokenHash,
            status: 'PENDING',
            expiresAt,
          },
        });

        await tx.companyInvitationDeliverySecret.create({
          data: {
            invitationId: created.id,
            encryptedToken: encryptedSecret.encryptedToken,
            iv: encryptedSecret.iv,
            authTag: encryptedSecret.authTag,
          },
        });

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'COMPANY_INVITATION_CREATED',
            targetType: 'CompanyInvitation',
            targetId: created.id,
            metadata: {
              companyId,
              maskedEmail: maskEmail(normalizedEmail),
              role: created.role,
            },
          },
          tx,
        );

        await this.outboxService.recordEvent(tx, {
          eventName: 'CompanyInvitationCreated',
          aggregateType: 'CompanyInvitation',
          aggregateId: created.id,
          actorId: user.id,
          payload: {
            companyId,
            companyName: company.name,
            email: normalizedEmail,
            role: created.role,
            invitedById: user.id,
            invitationId: created.id,
          },
        });

        return created;
      });

      return {
        id: invitation.id,
        companyId: invitation.companyId,
        email: maskEmail(invitation.email),
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      };
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.INVITATION_ALREADY_PENDING,
          message: 'An active invitation already exists for this email address.',
        });
      }
      throw err;
    }
  }

  async removeMember(companyId: string, memberId: string, user: AuthenticatedUser): Promise<void> {
    await this.scopeService.assertOwnerOrAdmin(companyId, user);

    const membership = await this.prisma.companyMembership.findUnique({
      where: { id: memberId },
    });

    if (!membership || membership.companyId !== companyId) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company membership not found.',
      });
    }

    if (membership.role === 'OWNER') {
      const ownerCount = await this.prisma.companyMembership.count({
        where: {
          companyId,
          role: 'OWNER',
        },
      });

      if (ownerCount <= 1) {
        throw new ConflictException({
          code: ERROR_CODES.LAST_COMPANY_OWNER,
          message: 'Cannot remove the last remaining active owner of the company.',
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.companyMembership.delete({
        where: { id: memberId },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'COMPANY_MEMBER_REMOVED',
          targetType: 'CompanyMembership',
          targetId: memberId,
          metadata: { removedUserId: membership.userId },
        },
        tx,
      );
    });
  }

  public mapToDto(
    company: Company & { _count?: { jobs?: number } },
    context?: { activeJobsCount?: number; isFollowed?: boolean },
  ): CompanyDto {
    const rawReasons = Array.isArray(company.reasonsToJoin)
      ? (company.reasonsToJoin as unknown as CompanyReasonToJoinDto[])
      : [];
    const rawPerks = Array.isArray(company.perks)
      ? (company.perks as unknown as CompanyPerkDto[])
      : [];

    return {
      id: company.id,
      slug: company.slug,
      name: company.name,
      description: company.description,
      websiteUrl: company.websiteUrl,
      logoUrl: company.logoUrl,
      location: company.location,
      companyModel: company.companyModel ?? null,
      companySize: company.companySize ?? null,
      country: company.country ?? null,
      workingTime: company.workingTime ?? null,
      overtimePolicy: company.overtimePolicy ?? null,
      techStack: Array.isArray(company.techStack) ? company.techStack : [],
      reasonsToJoin: rawReasons,
      perks: rawPerks,
      activeJobsCount: context?.activeJobsCount ?? company._count?.jobs ?? 0,
      ...(context?.isFollowed !== undefined ? { isFollowed: context.isFollowed } : {}),
      status: company.status,
      version: company.version,
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  }

  private mapMemberToDto(membership: CompanyMembership & { user: User }): CompanyMembershipDto {
    return {
      id: membership.id,
      companyId: membership.companyId,
      user: {
        id: membership.user.id,
        email: membership.user.email,
        role: membership.user.role,
        status: membership.user.status,
        createdAt: membership.user.createdAt.toISOString(),
      },
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  async acceptInvitation(token: string, user: AuthenticatedUser): Promise<CompanyMembershipDto> {
    if (user.role !== 'HR') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only active HR accounts can accept company invitations.',
      });
    }

    const userEntity = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userEntity || userEntity.role !== 'HR' || userEntity.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only active HR accounts can accept company invitations.',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { tokenHash },
    });

    if (!invitation) {
      throw new NotFoundException({
        code: ERROR_CODES.INVITATION_NOT_FOUND,
        message: 'Company invitation not found or invalid token.',
      });
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
        message: 'This invitation has already been accepted.',
      });
    }

    if (invitation.status === 'REVOKED') {
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_REVOKED,
        message: 'This invitation has been revoked.',
      });
    }

    const now = new Date();
    if (invitation.status === 'EXPIRED' || invitation.expiresAt <= now) {
      if (invitation.status !== 'EXPIRED') {
        await this.prisma.companyInvitation.update({
          where: { id: invitation.id },
          data: { status: 'EXPIRED' },
        });
      }
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_EXPIRED,
        message: 'This invitation has expired.',
      });
    }

    if (userEntity.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenException({
        code: ERROR_CODES.INVITATION_EMAIL_MISMATCH,
        message: 'This invitation was issued to a different email address.',
      });
    }

    const existingMembership = await this.prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId: invitation.companyId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      await this.prisma.companyInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: now },
      });
      throw new ConflictException({
        code: ERROR_CODES.MEMBERSHIP_ALREADY_EXISTS,
        message: 'User is already a member of this company.',
      });
    }

    const company = await this.prisma.company.findUnique({
      where: { id: invitation.companyId },
    });

    if (!company || company.status !== 'ACTIVE') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Company is suspended or unavailable.',
      });
    }

    try {
      const membership = await this.prisma.$transaction(async (tx) => {
        // Atomic conditional update: only update if status is still PENDING
        const updatedInv = await tx.companyInvitation.updateMany({
          where: {
            id: invitation.id,
            status: 'PENDING',
          },
          data: {
            status: 'ACCEPTED',
            acceptedAt: now,
          },
        });

        if (updatedInv.count === 0) {
          throw new ConflictException({
            code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
            message: 'This invitation has already been accepted.',
          });
        }

        const created = await tx.companyMembership.create({
          data: {
            companyId: invitation.companyId,
            userId: user.id,
            role: invitation.role,
          },
          include: { user: true },
        });

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'COMPANY_MEMBER_ADDED',
            targetType: 'CompanyMembership',
            targetId: created.id,
            metadata: {
              companyId: invitation.companyId,
              invitationId: invitation.id,
              role: created.role,
            },
          },
          tx,
        );

        await this.outboxService.recordEvent(tx, {
          eventName: 'CompanyMemberAdded',
          aggregateType: 'Company',
          aggregateId: invitation.companyId,
          actorId: user.id,
          payload: {
            companyId: invitation.companyId,
            companyName: company.name,
            userId: user.id,
            role: created.role,
            addedById: invitation.invitedById || user.id,
          },
        });

        await tx.companyInvitationDeliverySecret.deleteMany({
          where: { invitationId: invitation.id },
        });

        return created;
      });

      return this.mapMemberToDto(membership);
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({
          code: ERROR_CODES.MEMBERSHIP_ALREADY_EXISTS,
          message: 'User is already a member of this company.',
        });
      }
      throw err;
    }
  }

  async revokeInvitation(
    companyId: string,
    user: AuthenticatedUser,
    invitationId: string,
  ): Promise<void> {
    const membership = await this.prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: user.id,
        },
      },
    });

    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Only company owners can revoke company invitations.',
      });
    }

    const invitation = await this.prisma.companyInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.companyId !== companyId) {
      throw new NotFoundException({
        code: ERROR_CODES.INVITATION_NOT_FOUND,
        message: 'Invitation not found in this company.',
      });
    }

    if (invitation.status === 'ACCEPTED') {
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
        message: 'This invitation has already been accepted.',
      });
    }

    if (invitation.status === 'REVOKED') {
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_REVOKED,
        message: 'This invitation has already been revoked.',
      });
    }

    const now = new Date();
    if (invitation.status === 'EXPIRED' || invitation.expiresAt <= now) {
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_EXPIRED,
        message: 'This invitation has expired.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.companyInvitation.updateMany({
        where: {
          id: invitationId,
          companyId,
          status: 'PENDING',
        },
        data: {
          status: 'REVOKED',
          revokedAt: now,
        },
      });

      if (updateResult.count === 0) {
        const current = await tx.companyInvitation.findUnique({
          where: { id: invitationId },
        });
        if (current?.status === 'ACCEPTED') {
          throw new ConflictException({
            code: ERROR_CODES.INVITATION_ALREADY_ACCEPTED,
            message: 'This invitation has already been accepted.',
          });
        }
        throw new ConflictException({
          code: ERROR_CODES.INVITATION_REVOKED,
          message: 'This invitation has already been revoked or expired.',
        });
      }

      await tx.companyInvitationDeliverySecret.deleteMany({
        where: { invitationId },
      });

      await this.auditService.record(
        {
          actorId: user.id,
          action: 'COMPANY_INVITATION_REVOKED',
          targetType: 'CompanyInvitation',
          targetId: invitationId,
          metadata: {
            companyId,
            role: invitation.role,
          },
        },
        tx,
      );
    });
  }
}
