import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { CvProcessingStatus } from '@prisma/client';

export class SetDefaultCvDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export interface UploadedCvFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class CvQueryDto {
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

export interface CvDto {
  id: string;
  candidateId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  processingStatus: CvProcessingStatus;
  failureCode: string | null;
  isDefault: boolean;
  version: number;
  latestOperationId?: string | null;
  extractionAttempts?: number;
  createdAt: string;
  updatedAt: string;
}

export interface OperationDto {
  id: string;
  type: string;
  status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  progressPercent: number | null;
  resultResource: { type: string; id: string } | null;
  failure: { code: string; message: string } | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface SignedDownloadDto {
  url: string;
  expiresAt: string;
}
