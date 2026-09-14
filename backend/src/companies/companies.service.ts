import * as crypto from 'crypto';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Company, CompanyMemberRole, CompanyMembership, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from './company-scope.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../outbox/outbox.service';
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
} from './dto/company.dto';
import { CompanyInvitationDto, maskEmail } from './dto/company-invitation.dto';
import { InvitationSecretAdapter } from './adapters/invitation-secret.adapter';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly outboxService: OutboxService,
    private readonly secretAdapter: InvitationSecretAdapter,
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

  async getCompanyByIdOrSlug(idOrSlug: string): Promise<CompanyDto> {
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

    return this.mapToDto(company);
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

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.company.update({
        where: { id: companyId },
        data: {
          name: dto.name !== undefined ? dto.name : company.name,
          description: dto.description !== undefined ? dto.description : company.description,
          websiteUrl: dto.websiteUrl !== undefined ? dto.websiteUrl : company.websiteUrl,
          logoUrl: dto.logoUrl !== undefined ? dto.logoUrl : company.logoUrl,
          location: dto.location !== undefined ? dto.location : company.location,
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

    return this.mapToDto(updated);
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
  ): Promise<CompanyMembershipDto | CompanyInvitationDto> {
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

    if (targetUser) {
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

      const membership = await this.prisma.$transaction(async (tx) => {
        const created = await tx.companyMembership.create({
          data: {
            companyId,
            userId: targetUser.id,
            role: targetRole,
          },
          include: { user: true },
        });

        await this.auditService.record(
          {
            actorId: user.id,
            action: 'COMPANY_MEMBER_ADDED',
            targetType: 'CompanyMembership',
            targetId: created.id,
            metadata: { targetUserId: targetUser.id, role: created.role },
          },
          tx,
        );

        await this.outboxService.recordEvent(tx, {
          eventName: 'CompanyMemberAdded',
          aggregateType: 'Company',
          aggregateId: companyId,
          actorId: user.id,
          payload: {
            companyId,
            companyName: company.name,
            userId: targetUser.id,
            role: created.role,
            addedById: user.id,
          },
        });

        return created;
      });

      return this.mapMemberToDto(membership);
    }

    // User not registered: create pending CompanyInvitation
    const existingInvitation = await this.prisma.companyInvitation.findFirst({
      where: {
        companyId,
        email: normalizedEmail,
        status: 'PENDING',
      },
    });

    if (existingInvitation && existingInvitation.expiresAt > new Date()) {
      throw new ConflictException({
        code: ERROR_CODES.INVITATION_ALREADY_PENDING,
        message: 'An active invitation already exists for this email address.',
      });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const encryptedSecret = this.secretAdapter.encryptToken(rawToken);

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

  public mapToDto(company: Company): CompanyDto {
    return {
      id: company.id,
      slug: company.slug,
      name: company.name,
      description: company.description,
      websiteUrl: company.websiteUrl,
      logoUrl: company.logoUrl,
      location: company.location,
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

    const userEntity = await this.prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!userEntity || userEntity.email.toLowerCase() !== invitation.email.toLowerCase()) {
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

    const membership = await this.prisma.$transaction(async (tx) => {
      const created = await tx.companyMembership.create({
        data: {
          companyId: invitation.companyId,
          userId: user.id,
          role: invitation.role,
        },
        include: { user: true },
      });

      await tx.companyInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: now,
        },
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
          companyName: company?.name || 'Company',
          userId: user.id,
          role: created.role,
          addedById: invitation.invitedById || user.id,
        },
      });

      return created;
    });

    return this.mapMemberToDto(membership);
  }
}
