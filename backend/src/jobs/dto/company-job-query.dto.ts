import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const JOB_STATUSES = ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED'] as const;
export const EXPERIENCE_LEVELS = [
  'INTERN',
  'FRESHER',
  'JUNIOR',
  'MID',
  'SENIOR',
  'LEAD',
  'MANAGER',
] as const;
export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'] as const;
export const WORKPLACE_TYPES = ['ONSITE', 'HYBRID', 'REMOTE'] as const;

function transformArray(value: unknown): string[] | unknown {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
}

export class CompanyJobQueryDto {
  @ApiPropertyOptional({ description: 'Text search matching title, description or requirements' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: JOB_STATUSES,
    isArray: true,
    description: 'Filter by job lifecycle status (single value or comma-separated)',
  })
  @IsOptional()
  @Transform(({ value }) => transformArray(value))
  @IsArray()
  @IsIn(JOB_STATUSES, { each: true })
  status?: Array<(typeof JOB_STATUSES)[number]>;

  @ApiPropertyOptional({
    enum: EXPERIENCE_LEVELS,
    isArray: true,
    description: 'Filter by experience level',
  })
  @IsOptional()
  @Transform(({ value }) => transformArray(value))
  @IsArray()
  @IsIn(EXPERIENCE_LEVELS, { each: true })
  experienceLevel?: Array<(typeof EXPERIENCE_LEVELS)[number]>;

  @ApiPropertyOptional({
    enum: EMPLOYMENT_TYPES,
    isArray: true,
    description: 'Filter by employment type',
  })
  @IsOptional()
  @Transform(({ value }) => transformArray(value))
  @IsArray()
  @IsIn(EMPLOYMENT_TYPES, { each: true })
  employmentType?: Array<(typeof EMPLOYMENT_TYPES)[number]>;

  @ApiPropertyOptional({
    enum: WORKPLACE_TYPES,
    isArray: true,
    description: 'Filter by workplace type',
  })
  @IsOptional()
  @Transform(({ value }) => transformArray(value))
  @IsArray()
  @IsIn(WORKPLACE_TYPES, { each: true })
  workplaceType?: Array<(typeof WORKPLACE_TYPES)[number]>;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: 'Sort field and direction (e.g., createdAt:desc, createdAt:asc, title:asc)',
  })
  @IsOptional()
  @IsString()
  sort?: string;

  @ApiPropertyOptional({ description: 'Opaque pagination cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
