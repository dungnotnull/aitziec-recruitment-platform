import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsUUID } from 'class-validator';

export class CreateCvJobAnalysisDto {
  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'CV UUID to analyze',
  })
  @IsUUID('4')
  cvId: string;

  @ApiProperty({
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    description: 'Target Job UUID to evaluate against',
  })
  @IsUUID('4')
  jobId: string;

  @ApiProperty({
    example: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
    description: 'List of analysis kinds to perform',
    enum: ['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'],
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['CV_JOB_MATCH', 'CV_GAP_ANALYSIS'], { each: true })
  analyses: Array<'CV_JOB_MATCH' | 'CV_GAP_ANALYSIS'>;
}
