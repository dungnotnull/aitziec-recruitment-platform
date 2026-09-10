import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { JobDto } from '../../jobs/dto/job.dto';

export class RecommendationQueryDto {
  @ApiPropertyOptional({ description: 'Opaque pagination cursor' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class RecommendedJobDto {
  @ApiProperty({ description: 'Job detail' })
  job: JobDto;

  @ApiProperty({ description: 'Recommendation match score between 0 and 100', example: 85 })
  score: number;

  @ApiProperty({
    description: 'Server-owned explainable reason codes',
    example: ['SKILL_MATCH', 'EXPERIENCE_LEVEL_MATCH'],
    type: [String],
  })
  reasonCodes: string[];

  @ApiProperty({
    description: 'Explainable evidence supporting recommendation',
    example: ['Candidate has 3 matching skills: TypeScript, Node.js, PostgreSQL'],
    type: [String],
  })
  evidence: string[];

  @ApiProperty({
    description: 'AI disclosures and limitations',
    example: [
      'AI generated recommendations do not guarantee interview invitation',
      'Recommendation is calculated based on current published job requirements',
    ],
    type: [String],
  })
  limitations: string[];
}
