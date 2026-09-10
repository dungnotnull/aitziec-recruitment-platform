import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ description: 'Filter by actor user ID' })
  @IsOptional()
  @IsString()
  actorId?: string;

  @ApiPropertyOptional({ description: 'Filter by action name (e.g. USER_STATUS_MODERATED)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by target type (e.g. User, Company, Job)' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'Filter by target ID' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 UTC end date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

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

export class AuditLogDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6', nullable: true })
  actorId: string | null;

  @ApiProperty({ example: 'USER_STATUS_MODERATED' })
  action: string;

  @ApiProperty({ example: 'User' })
  targetType: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  targetId: string;

  @ApiPropertyOptional({ example: 'req-12345', nullable: true })
  requestId: string | null;

  @ApiProperty({ example: { reason: 'Violation of platform rules' } })
  metadata: Record<string, unknown>;

  @ApiProperty({ example: '2026-09-10T00:00:00.000Z' })
  occurredAt: string;
}
