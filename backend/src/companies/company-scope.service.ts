import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { Company } from '@prisma/client';

export interface CompanyScopeContext {
  company: Company;
  role: 'ADMIN' | 'OWNER' | 'RECRUITER';
}

@Injectable()
export class CompanyScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async assertOwnerOrAdmin(companyId: string, user: AuthenticatedUser): Promise<Company> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    if (company.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Company has been suspended by an administrator.',
      });
    }

    if (user.role === 'ADMIN') {
      return company;
    }

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
        message: 'Only company owner or administrator is authorized for this operation.',
      });
    }

    return company;
  }

  async assertMemberOrAdminWithRole(
    companyId: string,
    user: AuthenticatedUser,
    options?: { allowSuspended?: boolean },
  ): Promise<CompanyScopeContext> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
    });

    if (!company) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'Company not found.',
      });
    }

    if (!options?.allowSuspended && company.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Company has been suspended by an administrator.',
      });
    }

    if (user.role === 'ADMIN') {
      return { company, role: 'ADMIN' };
    }

    const membership = await this.prisma.companyMembership.findUnique({
      where: {
        companyId_userId: {
          companyId,
          userId: user.id,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'You are not a member of this company.',
      });
    }

    return { company, role: membership.role as 'OWNER' | 'RECRUITER' };
  }

  async assertMemberOrAdmin(companyId: string, user: AuthenticatedUser): Promise<Company> {
    const { company } = await this.assertMemberOrAdminWithRole(companyId, user, {
      allowSuspended: false,
    });
    return company;
  }

  async assertMemberOrAdminReadOnly(companyId: string, user: AuthenticatedUser): Promise<Company> {
    const { company } = await this.assertMemberOrAdminWithRole(companyId, user, {
      allowSuspended: true,
    });
    return company;
  }
}
