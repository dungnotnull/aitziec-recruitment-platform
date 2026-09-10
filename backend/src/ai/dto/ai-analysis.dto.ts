import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScoreComponentDto {
  @ApiProperty({ enum: ['SKILLS', 'EXPERIENCE', 'REQUIREMENTS', 'KEYWORDS'] })
  name: 'SKILLS' | 'EXPERIENCE' | 'REQUIREMENTS' | 'KEYWORDS';

  @ApiProperty({ example: 85, description: 'Score integer from 0 to 100' })
  score: number;

  @ApiProperty({ example: 0.4, description: 'Weight coefficient from 0.0 to 1.0' })
  weight: number;

  @ApiProperty({ example: ['Found 5 years of NestJS and PostgreSQL in recent projects'] })
  evidence: string[];
}

export class AiAnalysisDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ enum: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS', 'CV_JOB_ANALYSIS'] })
  type: 'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS' | 'CV_JOB_ANALYSIS';

  @ApiProperty()
  candidateId: string;

  @ApiProperty()
  cvId: string;

  @ApiPropertyOptional({ nullable: true })
  jobId: string | null;

  @ApiProperty({ enum: ['SUCCEEDED', 'FAILED'] })
  status: 'SUCCEEDED' | 'FAILED';

  @ApiPropertyOptional({ example: 85, nullable: true })
  overallScore: number | null;

  @ApiProperty({ type: [ScoreComponentDto] })
  components: ScoreComponentDto[];

  @ApiProperty({ example: ['TypeScript', 'NestJS', 'PostgreSQL'] })
  matchedSkills: string[];

  @ApiProperty({ example: ['Kubernetes', 'GraphQL'] })
  missingSkills: string[];

  @ApiProperty({ example: ['Requires 5+ years backend leadership'] })
  unmetRequirements: string[];

  @ApiProperty({ example: ['Highlight microservices architecture experience on page 1'] })
  suggestions: string[];

  @ApiProperty({ example: ['Analysis advisory only; candidate portfolio link was not reachable'] })
  limitations: string[];

  @ApiProperty({ example: 'gemini-1.5-flash' })
  model: string;

  @ApiProperty({ example: 'cv_job_match_v1.0' })
  promptVersion: string;

  @ApiProperty({ example: 'v1.0' })
  schemaVersion: string;

  @ApiProperty()
  createdAt: string;
}
