import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { CompanyStatus } from '@prisma/client';

export class UpdateCompanyStatusDto {
  @ApiProperty({ enum: CompanyStatus, example: CompanyStatus.SUSPENDED })
  @IsEnum(CompanyStatus)
  status: CompanyStatus;

  @ApiProperty({
    example: 'Spam recruitment behavior reported by candidates',
    description: 'Mandatory reason for moderating company status',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ example: 1, description: 'Current expected company version' })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}
