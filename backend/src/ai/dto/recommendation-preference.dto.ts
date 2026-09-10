import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RecommendationPreferenceDto {
  @ApiProperty({ description: 'Preference ID', example: 'uuid' })
  id: string;

  @ApiProperty({ description: 'User ID', example: 'uuid' })
  userId: string;

  @ApiProperty({ description: 'Whether automated job recommendations are enabled', example: true })
  enabled: boolean;

  @ApiProperty({ description: 'Consent policy version accepted by user', example: 'v1.0' })
  consentPolicyVersion: string;

  @ApiProperty({
    description: 'Timestamp when consent was recorded',
    example: '2026-09-10T12:00:00.000Z',
  })
  consentedAt: string;

  @ApiProperty({ description: 'Concurrency control version', example: 1 })
  version: number;

  @ApiProperty({ description: 'Creation timestamp', example: '2026-09-10T12:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ description: 'Last update timestamp', example: '2026-09-10T12:00:00.000Z' })
  updatedAt: string;
}

export class UpdateRecommendationPreferenceDto {
  @ApiProperty({ description: 'Enable or disable automated job recommendations', example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Consent policy version to record', example: 'v1.0' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  consentPolicyVersion?: string;

  @ApiProperty({
    description: 'Expected current version for optimistic concurrency control',
    example: 1,
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
