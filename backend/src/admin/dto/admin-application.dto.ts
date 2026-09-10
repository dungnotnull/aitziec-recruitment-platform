import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationStatus } from '../../applications/dto/application.dto';

export class AdminApplicationQueryDto {
  @ApiPropertyOptional({ description: 'Search candidate name, job title, or company name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by company UUID' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Filter by job UUID' })
  @IsOptional()
  @IsUUID()
  jobId?: string;

  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({ description: 'Filter applications submitted on or after this ISO date' })
  @IsOptional()
  @IsISO8601()
  submittedAfter?: string;

  @ApiPropertyOptional({ description: 'Filter applications submitted on or before this ISO date' })
  @IsOptional()
  @IsISO8601()
  submittedBefore?: string;

  @ApiPropertyOptional({ description: 'Opaque pagination cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ModerateApplicationDto {
  @ApiProperty({ enum: ApplicationStatus, example: ApplicationStatus.REVIEWING })
  @IsEnum(ApplicationStatus)
  targetStatus!: ApplicationStatus;

  @ApiProperty({ example: 'Application reviewed and approved for interview stage' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class AdminCandidateSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ nullable: true })
  headline: string | null;

  @ApiPropertyOptional({ type: [String] })
  skills?: string[];
}

export class AdminJobSummaryRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;
}

export class AdminCompanySummaryRefDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  slug: string;
}

export class AdminApplicationSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jobId: string;

  @ApiProperty()
  candidateId: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: string;

  @ApiProperty()
  version: number;

  @ApiProperty()
  submittedAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiProperty({ type: AdminCandidateSummaryDto })
  candidate: AdminCandidateSummaryDto;

  @ApiProperty({ type: AdminJobSummaryRefDto })
  job: AdminJobSummaryRefDto;

  @ApiProperty({ type: AdminCompanySummaryRefDto })
  company: AdminCompanySummaryRefDto;
}

export class AdminApplicationStatusEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  fromStatus: string | null;

  @ApiProperty()
  toStatus: string;

  @ApiProperty({ nullable: true })
  reason: string | null;

  @ApiProperty()
  actorId: string;

  @ApiProperty()
  occurredAt: string;
}

export class AdminApplicationDetailDto extends AdminApplicationSummaryDto {
  @ApiProperty({ type: [AdminApplicationStatusEventDto] })
  history: AdminApplicationStatusEventDto[];
}
