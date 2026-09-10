import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { CollectionResponse } from '../common/dto/response.dto';
import { SkillCatalogItemDto, SkillCatalogQueryDto } from './dto/skill-catalog.dto';

interface SkillCursor {
  id: string;
  normalizedName: string;
}

@Injectable()
export class SkillsService {
  constructor(private readonly prisma: PrismaService) {}

  public encodeCursor(cursor: SkillCursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }

  public decodeCursor(cursorStr: string): SkillCursor {
    try {
      const json = Buffer.from(cursorStr, 'base64url').toString('utf8');
      const parsed = JSON.parse(json);
      if (parsed && typeof parsed.id === 'string' && typeof parsed.normalizedName === 'string') {
        return parsed as SkillCursor;
      }
      throw new Error();
    } catch {
      throw new BadRequestException({
        code: ERROR_CODES.INVALID_CURSOR,
        message: 'Invalid pagination cursor',
      });
    }
  }

  async listSkills(
    query: SkillCatalogQueryDto,
    requestId?: string,
  ): Promise<CollectionResponse<SkillCatalogItemDto>> {
    const limit = query.limit ?? 20;
    const active = query.active !== undefined ? query.active : true;
    const where: Prisma.SkillWhereInput = { active };

    if (query.search && query.search.trim()) {
      const term = query.search.trim().toLowerCase();
      where.OR = [
        { normalizedName: { contains: term, mode: 'insensitive' } },
        { aliases: { some: { normalizedName: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const findArgs: Prisma.SkillFindManyArgs = {
      where,
      orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: {
        aliases: {
          orderBy: { alias: 'asc' },
        },
      },
    };

    if (query.cursor) {
      const decoded = this.decodeCursor(query.cursor);
      findArgs.cursor = { id: decoded.id };
      findArgs.skip = 1;
    }

    const items = await this.prisma.skill.findMany(findArgs);
    const hasNextPage = items.length > limit;
    const dataItems = hasNextPage ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasNextPage && dataItems.length > 0) {
      const last = dataItems[dataItems.length - 1];
      nextCursor = this.encodeCursor({ id: last.id, normalizedName: last.normalizedName });
    }

    type SkillRecord = {
      id: string;
      name: string;
      normalizedName: string;
      active: boolean;
      createdAt: Date;
      updatedAt: Date;
      aliases?: Array<{ alias: string }>;
    };

    const data: SkillCatalogItemDto[] = (dataItems as unknown as SkillRecord[]).map((s) => ({
      id: s.id,
      name: s.name,
      aliases: (s.aliases || []).map((a) => a.alias).sort(),
      active: s.active,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
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
