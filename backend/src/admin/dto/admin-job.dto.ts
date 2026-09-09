import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class ModerateJobDto {
  @ApiProperty({
    enum: ['UNPUBLISH', 'CLOSE'],
    example: 'UNPUBLISH',
    description: 'Moderation action to apply',
  })
  @IsIn(['UNPUBLISH', 'CLOSE'])
  action: 'UNPUBLISH' | 'CLOSE';

  @ApiProperty({
    example: 'Job description contains prohibited non-IT marketing content',
    description: 'Mandatory reason for job moderation',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ example: 1, description: 'Current expected job version' })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
