import {
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { InterviewStatus } from '@prisma/client';

export class CreateInterviewDto {
  @IsISO8601()
  startsAt!: string;

  @IsISO8601()
  endsAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  locationOrMeetingUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  candidateInstructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recruiterPrivateNotes?: string | null;
}

export class UpdateInterviewDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsISO8601()
  startsAt?: string;

  @IsOptional()
  @IsISO8601()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationOrMeetingUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  candidateInstructions?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recruiterPrivateNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recruiterFeedback?: string | null;
}

export class CompleteInterviewDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  recruiterFeedback?: string | null;
}

export class CancelInterviewDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class InterviewQueryDto {
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
}

export interface InterviewDto {
  id: string;
  applicationId: string;
  status: InterviewStatus;
  startsAt: string;
  endsAt: string;
  locationOrMeetingUrl: string;
  candidateInstructions: string | null;
  recruiterPrivateNotes?: string | null;
  recruiterFeedback?: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
