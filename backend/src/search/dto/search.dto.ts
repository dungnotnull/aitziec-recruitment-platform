import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class JobSearchQueryDto {
  @ApiPropertyOptional({ example: 'backend nestjs', description: 'Full-text keyword query' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: ['Node.js', 'NestJS'], type: [String] })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  technology?: string[];

  @ApiPropertyOptional({ example: ['Ho Chi Minh City'], type: [String] })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  location?: string[];

  @ApiPropertyOptional({
    enum: ['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'],
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return value;
  })
  @IsArray()
  @IsIn(['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'], { each: true })
  experienceLevel?: ('INTERN' | 'FRESHER' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER')[];

  @ApiPropertyOptional({
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return value;
  })
  @IsArray()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'], { each: true })
  employmentType?: ('FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP')[];

  @ApiPropertyOptional({
    enum: ['ONSITE', 'HYBRID', 'REMOTE'],
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string')
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    return value;
  })
  @IsArray()
  @IsIn(['ONSITE', 'HYBRID', 'REMOTE'], { each: true })
  workplaceType?: ('ONSITE' | 'HYBRID' | 'REMOTE')[];

  @ApiPropertyOptional({ example: 'comp-uuid' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 20000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMin?: number;

  @ApiPropertyOptional({ example: 50000000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  salaryMax?: number;

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  publishedAfter?: string;

  @ApiPropertyOptional({
    enum: ['RELEVANCE', 'NEWEST', 'SALARY_ASC', 'SALARY_DESC'],
    example: 'NEWEST',
  })
  @IsOptional()
  @IsIn(['RELEVANCE', 'NEWEST', 'SALARY_ASC', 'SALARY_DESC'])
  sort?: 'RELEVANCE' | 'NEWEST' | 'SALARY_ASC' | 'SALARY_DESC';

  @ApiPropertyOptional({ description: 'Opaque base64 pagination cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ParseSearchQueryDto {
  @ApiProperty({ example: 'Senior backend remote lương trên 30 triệu ở HCM' })
  @IsString()
  @IsNotEmpty()
  query: string;
}
