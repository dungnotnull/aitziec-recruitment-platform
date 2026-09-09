import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from './company-scope.service';
import { AuditService } from '../audit/audit.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/response.dto';
import {
  AddCompanyMemberDto,
  CompanyDto,
  CompanyMembershipDto,
  CreateCompanyDto,
  UpdateCompanyDto,
} from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: CompanyScopeService,
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

  async listMembers(companyId: string, user: AuthenticatedUser, query: PaginationQueryDto) {
    await this.scopeService.assertMemberOrAdmin(companyId, user);

    const limit = query.limit || 20;
    const findArgs: any = {
      where: { companyId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    };

    if (query.cursor) {
      findArgs.cursor = { id: query.cursor };
      findArgs.skip = 1;
    }

    const rows = await this.prisma.companyMembership.findMany(findArgs);
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
  ): Promise<CompanyMembershipDto> {
    await this.scopeService.assertOwnerOrAdmin(companyId, user);

    const normalizedEmail = dto.userEmail.trim().toLowerCase();
    const targetUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!targetUser) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: `No user found with email "${dto.userEmail}".`,
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

    const membership = await this.prisma.$transaction(async (tx) => {
      const created = await tx.companyMembership.create({
        data: {
          companyId,
          userId: targetUser.id,
          role: (dto.role as any) || 'RECRUITER',
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

      return created;
    });

    return this.mapMemberToDto(membership);
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

  public mapToDto(company: any): CompanyDto {
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

  private mapMemberToDto(membership: any): CompanyMembershipDto {
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
}
