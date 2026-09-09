import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CompanySummaryDto {
  @ApiProperty({ example: 'comp-uuid' })
  id: string;

  @ApiProperty({ example: 'techcorp-vietnam' })
  slug: string;

  @ApiProperty({ example: 'TechCorp Vietnam' })
  name: string;

  @ApiProperty({ example: 'https://cdn.techcorp.vn/logo.png', nullable: true })
  logoUrl: string | null;
}

export class JobDto {
  @ApiProperty({ example: 'job-uuid' })
  id: string;

  @ApiProperty({ type: CompanySummaryDto })
  company: CompanySummaryDto;

  @ApiProperty({ example: 'Senior Backend Engineer' })
  title: string;

  @ApiProperty({ example: 'senior-backend-engineer-abc123' })
  slug: string;

  @ApiProperty({ example: 'We are seeking a Senior Backend Engineer...' })
  description: string;

  @ApiProperty({ example: '3+ years of Node.js/NestJS experience...' })
  requirements: string;

  @ApiPropertyOptional({ example: 'Design architecture, lead junior engineers...', nullable: true })
  responsibilities: string | null;

  @ApiProperty({ example: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis'] })
  technologyNames: string[];

  @ApiProperty({ example: 'Ho Chi Minh City, Vietnam' })
  location: string;

  @ApiProperty({ enum: ['ONSITE', 'HYBRID', 'REMOTE'], example: 'HYBRID' })
  workplaceType: 'ONSITE' | 'HYBRID' | 'REMOTE';

  @ApiProperty({
    enum: ['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'],
    example: 'SENIOR',
  })
  experienceLevel: 'INTERN' | 'FRESHER' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER';

  @ApiProperty({
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
    example: 'FULL_TIME',
  })
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

  @ApiPropertyOptional({ example: 25000000, nullable: true })
  salaryMin: number | null;

  @ApiPropertyOptional({ example: 45000000, nullable: true })
  salaryMax: number | null;

  @ApiProperty({ example: 'VND' })
  currency: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  applicationDeadline: string;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED'], example: 'DRAFT' })
  status: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'CLOSED';

  @ApiPropertyOptional({ example: '2026-09-09T00:00:00.000Z', nullable: true })
  publishedAt: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  closedAt: string | null;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  updatedAt: string;
}

export class CreateJobDto {
  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'We are seeking a Senior Backend Engineer...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: '3+ years of Node.js/NestJS experience...' })
  @IsString()
  @IsNotEmpty()
  requirements: string;

  @ApiPropertyOptional({ example: 'Design architecture, lead junior engineers...', nullable: true })
  @IsOptional()
  @IsString()
  responsibilities?: string | null;

  @ApiProperty({ example: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis'] })
  @IsArray()
  @IsString({ each: true })
  technologyNames: string[];

  @ApiProperty({ example: 'Ho Chi Minh City, Vietnam' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ enum: ['ONSITE', 'HYBRID', 'REMOTE'], example: 'HYBRID' })
  @IsIn(['ONSITE', 'HYBRID', 'REMOTE'])
  workplaceType: 'ONSITE' | 'HYBRID' | 'REMOTE';

  @ApiProperty({
    enum: ['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'],
    example: 'SENIOR',
  })
  @IsIn(['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'])
  experienceLevel: 'INTERN' | 'FRESHER' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER';

  @ApiProperty({
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
    example: 'FULL_TIME',
  })
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'])
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

  @ApiPropertyOptional({ example: 25000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number | null;

  @ApiPropertyOptional({ example: 45000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number | null;

  @ApiProperty({ example: 'VND' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ example: '2026-10-01T00:00:00.000Z' })
  @IsISO8601()
  applicationDeadline: string;
}

export class UpdateJobDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ example: 'Lead Backend Engineer' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description...' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @ApiPropertyOptional({ example: 'Updated requirements...' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  requirements?: string;

  @ApiPropertyOptional({ example: 'Updated responsibilities...', nullable: true })
  @IsOptional()
  @IsString()
  responsibilities?: string | null;

  @ApiPropertyOptional({ example: ['Node.js', 'NestJS', 'PostgreSQL', 'Redis'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologyNames?: string[];

  @ApiPropertyOptional({ example: 'Hanoi, Vietnam' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  location?: string;

  @ApiPropertyOptional({ enum: ['ONSITE', 'HYBRID', 'REMOTE'], example: 'REMOTE' })
  @IsOptional()
  @IsIn(['ONSITE', 'HYBRID', 'REMOTE'])
  workplaceType?: 'ONSITE' | 'HYBRID' | 'REMOTE';

  @ApiPropertyOptional({
    enum: ['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'],
    example: 'LEAD',
  })
  @IsOptional()
  @IsIn(['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'])
  experienceLevel?: 'INTERN' | 'FRESHER' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER';

  @ApiPropertyOptional({
    enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
    example: 'FULL_TIME',
  })
  @IsOptional()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'])
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP';

  @ApiPropertyOptional({ example: 30000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMin?: number | null;

  @ApiPropertyOptional({ example: 55000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  salaryMax?: number | null;

  @ApiPropertyOptional({ example: 'VND' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  currency?: string;

  @ApiPropertyOptional({ example: '2026-11-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  applicationDeadline?: string;
}

export class PublishJobDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class UnpublishJobDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class CloseJobDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ example: 'Position has been filled' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ModerateJobDto {
  @ApiProperty({ enum: ['UNPUBLISH', 'CLOSE'], example: 'UNPUBLISH' })
  @IsIn(['UNPUBLISH', 'CLOSE'])
  action: 'UNPUBLISH' | 'CLOSE';

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({ example: 'Violates content guideline policy' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
