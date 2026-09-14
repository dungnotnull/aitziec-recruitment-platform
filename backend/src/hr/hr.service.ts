import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { HrProfile, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { HrProfileDto, UpdateHrProfileDto } from './dto/hr-profile.dto';
import { HrInvitationItemDto } from './dto/hr-invitation.dto';
import { PaginationQueryDto, CollectionResponse } from '../common/dto/response.dto';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

export interface HrInvitationCursor {
  id: string;
  createdAt: string;
}

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  public mapToDto(profile: HrProfile): HrProfileDto {
    return {
      id: profile.id,
      userId: profile.userId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
      phone: profile.phone,
      version: profile.version,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  public decodeCursor(cursorStr: string): HrInvitationCursor {
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      if (
        parsed &&
        typeof parsed.id === 'string' &&
        typeof parsed.createdAt === 'string' &&
        !isNaN(new Date(parsed.createdAt).getTime())
      ) {
        return parsed as HrInvitationCursor;
      }
      throw new Error();
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Invalid pagination cursor.',
      });
    }
  }

  public encodeCursor(item: { id: string; createdAt: Date }): string {
    return Buffer.from(
      JSON.stringify({
        id: item.id,
        createdAt: item.createdAt.toISOString(),
      }),
    ).toString('base64url');
  }

  async getProfile(userId: string): Promise<HrProfileDto> {
    let profile = await this.prisma.hrProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Check if user exists and is HR to backfill safely
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user || user.role !== 'HR') {
        throw new NotFoundException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'HR profile not found.',
        });
      }

      // Safe legacy backfill on-the-fly
      profile = await this.prisma.hrProfile.create({
        data: {
          userId,
          version: 1,
        },
      });
    }

    return this.mapToDto(profile);
  }

  async updateProfile(userId: string, dto: UpdateHrProfileDto): Promise<HrProfileDto> {
    let profile = await this.prisma.hrProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      // Safe fallback for legacy accounts
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user || user.role !== 'HR') {
        throw new NotFoundException({
          code: ERROR_CODES.RESOURCE_NOT_FOUND,
          message: 'HR profile not found.',
        });
      }
      profile = await this.prisma.hrProfile.create({
        data: {
          userId,
          version: 1,
        },
      });
    }

    // Optimistic concurrency check
    if (dto.expectedVersion !== undefined && profile.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: ERROR_CODES.VERSION_CONFLICT,
        message: `Version conflict: expected version ${dto.expectedVersion}, current version is ${profile.version}.`,
      });
    }

    const changedFields: string[] = [];
    const updateData: Prisma.HrProfileUpdateInput = {
      version: { increment: 1 },
    };

    if (dto.firstName !== undefined) {
      updateData.firstName = dto.firstName;
      changedFields.push('firstName');
    }
    if (dto.lastName !== undefined) {
      updateData.lastName = dto.lastName;
      changedFields.push('lastName');
    }
    if (dto.avatarUrl !== undefined) {
      updateData.avatarUrl = dto.avatarUrl;
      changedFields.push('avatarUrl');
    }
    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
      changedFields.push('phone');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.hrProfile.update({
        where: { id: profile.id },
        data: updateData,
      });

      await this.auditService.record(
        {
          actorId: userId,
          action: 'HR_PROFILE_UPDATED',
          targetType: 'HrProfile',
          targetId: result.id,
          metadata: {
            version: result.version,
            changedFields,
          },
        },
        tx,
      );

      return result;
    });

    return this.mapToDto(updated);
  }

  async listInvitations(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<HrInvitationItemDto>> {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);

    const userEntity = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!userEntity) {
      throw new NotFoundException({
        code: ERROR_CODES.RESOURCE_NOT_FOUND,
        message: 'User not found.',
      });
    }

    const now = new Date();
    const whereClause: Prisma.CompanyInvitationWhereInput = {
      email: userEntity.email.toLowerCase(),
      status: 'PENDING',
      expiresAt: { gt: now },
    };

    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      const cursorDate = new Date(decoded.createdAt);
      whereClause.OR = [
        { createdAt: { lt: cursorDate } },
        {
          createdAt: cursorDate,
          id: { lt: decoded.id },
        },
      ];
    }

    const invitations = await this.prisma.companyInvitation.findMany({
      where: whereClause,
      include: { company: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasNextPage = invitations.length > limit;
    const items = hasNextPage ? invitations.slice(0, limit) : invitations;
    const nextCursor =
      hasNextPage && items.length > 0 ? this.encodeCursor(items[items.length - 1]) : null;

    const data: HrInvitationItemDto[] = items.map((inv) => ({
      id: inv.id,
      company: {
        id: inv.company.id,
        slug: inv.company.slug,
        name: inv.company.name,
        logoUrl: inv.company.logoUrl,
      },
      role: inv.role,
      status: inv.status,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
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
}
