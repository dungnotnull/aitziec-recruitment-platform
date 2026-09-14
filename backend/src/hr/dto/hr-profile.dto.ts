import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, MaxLength, IsUrl, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class HrProfileDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d' })
  id: string;

  @ApiProperty({ example: 'u1v2w3x4-y5z6-7a8b-9c0d-1e2f3a4b5c6d' })
  userId: string;

  @ApiPropertyOptional({ example: 'John', nullable: true })
  firstName: string | null;

  @ApiPropertyOptional({ example: 'Doe', nullable: true })
  lastName: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.itziec.com/avatars/hr-1.png', nullable: true })
  avatarUrl: string | null;

  @ApiPropertyOptional({ example: '+84987654321', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: '2026-09-14T08:00:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-14T08:00:00.000Z' })
  updatedAt: string;
}

export class UpdateHrProfileDto {
  @ApiPropertyOptional({ example: 1, description: 'Optimistic concurrency version' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedVersion?: number;

  @ApiPropertyOptional({ example: 'John', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  firstName?: string | null;

  @ApiPropertyOptional({ example: 'Doe', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  lastName?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.itziec.com/avatars/hr-1.png', nullable: true })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;

  @ApiPropertyOptional({ example: '+84987654321', nullable: true })
  @IsOptional()
  @Matches(/^(\+?[0-9]{7,15})?$/, {
    message: 'Phone must be a valid phone number with 7 to 15 digits',
  })
  @MaxLength(20)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  phone?: string | null;
}
