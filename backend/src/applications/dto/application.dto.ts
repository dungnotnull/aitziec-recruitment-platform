import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export enum ApplicationStatus {
  APPLIED = 'APPLIED',
  REVIEWING = 'REVIEWING',
  INTERVIEWING = 'INTERVIEWING',
  PASSED = 'PASSED',
  REJECTED = 'REJECTED',
}

export class SubmitApplicationDto {
  @IsUUID()
  cvId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  candidateNote?: string | null;
}

export class TransitionApplicationDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsEnum(ApplicationStatus)
  targetStatus!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class ApplicationQueryDto {
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? 20 : parsed;
  })
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @IsOptional()
  @IsString()
  sort?: string;
}

export interface ApplicationStatusEventDto {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  reason: string | null;
  actorId: string;
  occurredAt: string;
}

export interface ApplicationDto {
  id: string;
  candidateId: string;
  jobId: string;
  submittedCvId: string;
  status: ApplicationStatus;
  candidateNote: string | null;
  version: number;
  submittedAt: string;
  updatedAt: string;
}

export interface ApplicationDetailDto extends ApplicationDto {
  job: any;
  candidate: {
    id: string;
    fullName: string;
    headline: string | null;
    skills: any[];
  };
  history: ApplicationStatusEventDto[];
}
