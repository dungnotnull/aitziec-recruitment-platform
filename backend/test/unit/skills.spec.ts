import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SkillsService } from '../../src/skills/skills.service';
import { PrismaService } from '../../src/database/prisma.service';
import { InMemoryPrismaService } from '../e2e/in-memory-prisma';
import { ERROR_CODES } from '../../src/common/constants/error-codes';

describe('SkillsService (Unit)', () => {
  let service: SkillsService;
  let inMemoryPrisma: InMemoryPrismaService;

  beforeEach(async () => {
    inMemoryPrisma = new InMemoryPrismaService();
    inMemoryPrisma.reset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SkillsService,
        {
          provide: PrismaService,
          useValue: inMemoryPrisma,
        },
      ],
    }).compile();

    service = module.get<SkillsService>(SkillsService);
  });

  it('should return an empty collection when no skills exist', async () => {
    const res = await service.listSkills({});
    expect(res.data).toEqual([]);
    expect(res.meta.page.hasNextPage).toBe(false);
    expect(res.meta.page.nextCursor).toBeNull();
    expect(res.meta.page.limit).toBe(20);
  });

  it('should find skills by canonical name and aliases (case-insensitive)', async () => {
    const reactSkill = await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-react-1',
        name: 'React',
        normalizedName: 'react',
        active: true,
      },
    });
    await inMemoryPrisma.skillAlias.create({
      data: {
        skillId: reactSkill.id,
        alias: 'React.js',
        normalizedName: 'react.js',
      },
    });
    await inMemoryPrisma.skillAlias.create({
      data: {
        skillId: reactSkill.id,
        alias: 'ReactJS',
        normalizedName: 'reactjs',
      },
    });

    const nestSkill = await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-nest-2',
        name: 'NestJS',
        normalizedName: 'nestjs',
        active: true,
      },
    });

    // Search by canonical name 'react'
    const searchCanonical = await service.listSkills({ search: 'react' });
    expect(searchCanonical.data.length).toBe(1);
    expect(searchCanonical.data[0].id).toBe(reactSkill.id);
    expect(searchCanonical.data[0].aliases).toEqual(['React.js', 'ReactJS']);

    // Search by alias 'reactjs'
    const searchAlias = await service.listSkills({ search: 'reactjs' });
    expect(searchAlias.data.length).toBe(1);
    expect(searchAlias.data[0].id).toBe(reactSkill.id);

    // Search 'nest'
    const searchNest = await service.listSkills({ search: 'nest' });
    expect(searchNest.data.length).toBe(1);
    expect(searchNest.data[0].id).toBe(nestSkill.id);
  });

  it('should respect active filter (default true, and explicit false)', async () => {
    await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-active',
        name: 'TypeScript',
        normalizedName: 'typescript',
        active: true,
      },
    });
    await inMemoryPrisma.skill.create({
      data: {
        id: 'skill-inactive',
        name: 'CoffeeScript',
        normalizedName: 'coffeescript',
        active: false,
      },
    });

    // Default active=true
    const activeOnly = await service.listSkills({});
    expect(activeOnly.data.length).toBe(1);
    expect(activeOnly.data[0].name).toBe('TypeScript');

    // Explicit active=false
    const inactiveOnly = await service.listSkills({ active: false });
    expect(inactiveOnly.data.length).toBe(1);
    expect(inactiveOnly.data[0].name).toBe('CoffeeScript');
  });

  it('should paginate deterministically with opaque cursor', async () => {
    for (let i = 1; i <= 5; i++) {
      await inMemoryPrisma.skill.create({
        data: {
          id: `skill-${i}`,
          name: `Skill ${String.fromCharCode(64 + i)}`,
          normalizedName: `skill ${String.fromCharCode(96 + i)}`,
          active: true,
        },
      });
    }

    const page1 = await service.listSkills({ limit: 2 });
    expect(page1.data.length).toBe(2);
    expect(page1.meta.page.hasNextPage).toBe(true);
    expect(page1.meta.page.nextCursor).toBeDefined();

    const page2 = await service.listSkills({ limit: 2, cursor: page1.meta.page.nextCursor! });
    expect(page2.data.length).toBe(2);
    expect(page2.data[0].id).not.toBe(page1.data[0].id);
    expect(page2.data[0].id).not.toBe(page1.data[1].id);
  });

  it('should throw BadRequestException with INVALID_CURSOR for malformed cursor', async () => {
    await expect(service.listSkills({ cursor: 'not-a-valid-cursor-string' })).rejects.toThrow(
      BadRequestException,
    );
    try {
      await service.listSkills({ cursor: 'invalid-base64!' });
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(BadRequestException);
      const res = (err as BadRequestException).getResponse() as { code: string };
      expect(res.code).toBe(ERROR_CODES.INVALID_CURSOR);
    }
  });
});
