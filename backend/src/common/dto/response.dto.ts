import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ErrorCode } from '../constants/error-codes';

export class ResponseMeta {
  @ApiPropertyOptional({
    description: 'Request identifier',
    example: 'be8db5af-89d7-41f2-9ad1-f98c9d64f2fd',
  })
  requestId?: string;
}

export class SuccessResponse<T> {
  @ApiProperty({ description: 'Payload data' })
  data: T;

  @ApiPropertyOptional({ type: ResponseMeta })
  meta?: ResponseMeta;
}

export class PageInfo {
  @ApiProperty({ description: 'Opaque cursor for next page', nullable: true, example: null })
  nextCursor: string | null;

  @ApiProperty({ description: 'Whether another page of results exists', example: false })
  hasNextPage: boolean;

  @ApiProperty({ description: 'Limit requested', example: 20 })
  limit: number;
}

export class CollectionMeta extends ResponseMeta {
  @ApiProperty({ type: PageInfo })
  page: PageInfo;

  @ApiPropertyOptional({
    description: 'Opt-out status for algorithmic recommendations',
    example: false,
  })
  optedOut?: boolean;

  @ApiPropertyOptional({
    description: 'Informational message',
    example: 'Candidate has disabled automated job recommendations.',
  })
  message?: string;

  @ApiPropertyOptional({
    description: 'Total unread notifications count for notification queries',
    example: 3,
  })
  unreadCount?: number;
}

export class CollectionResponse<T> {
  @ApiProperty({ description: 'Array of resources' })
  data: T[];

  @ApiProperty({ type: CollectionMeta })
  meta: CollectionMeta;
}

export class FieldError {
  @ApiProperty({ description: 'Field that failed validation', example: 'salaryMin' })
  field: string;

  @ApiProperty({ description: 'Validation code', example: 'MIN_VALUE' })
  code: string;

  @ApiProperty({
    description: 'Human-readable message',
    example: 'salaryMin must be greater than or equal to 0.',
  })
  message: string;
}

export class ErrorDetail {
  @ApiProperty({ description: 'Standardized error code' })
  code: ErrorCode;

  @ApiProperty({ description: 'Safe error message' })
  message: string;

  @ApiPropertyOptional({ description: 'Validation or operational details' })
  details?: FieldError[] | Record<string, unknown>;

  @ApiProperty({ description: 'Request identifier' })
  requestId: string;

  @ApiProperty({ description: 'ISO UTC timestamp' })
  timestamp: string;
}

export class ErrorResponse {
  @ApiProperty({ type: ErrorDetail })
  error: ErrorDetail;
}

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    description: 'Number of items to return',
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
