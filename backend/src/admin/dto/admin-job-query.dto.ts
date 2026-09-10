import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminJobQueryDto {
  @ApiPropertyOptional({ description: 'Search in title, slug, or company name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by specific company UUID' })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CLOSED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'UNPUBLISHED' | 'CLOSED';

  @ApiPropertyOptional({
    enum: ['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'],
  })
  @IsOptional()
  @IsIn(['INTERN', 'FRESHER', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER'])
  experienceLevel?: 'INTERN' | 'FRESHER' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER';

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
