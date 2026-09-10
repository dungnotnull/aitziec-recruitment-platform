import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OperationResultResourceDto {
  @ApiProperty({ example: 'AI_ANALYSIS' })
  type: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;
}

export class OperationFailureDto {
  @ApiProperty({ example: 'AI_UPSTREAM_ERROR' })
  code: string;

  @ApiProperty({ example: 'Model timeout while processing CV' })
  message: string;
}

export class OperationDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: 'CV_JOB_ANALYSIS' })
  type: string;

  @ApiProperty({ enum: ['QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED'] })
  status: 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

  @ApiPropertyOptional({ example: 100, nullable: true })
  progressPercent: number | null;

  @ApiPropertyOptional({ type: OperationResultResourceDto, nullable: true })
  resultResource: OperationResultResourceDto | null;

  @ApiPropertyOptional({ type: OperationFailureDto, nullable: true })
  failure: OperationFailureDto | null;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;

  @ApiPropertyOptional({ nullable: true })
  completedAt: string | null;
}
