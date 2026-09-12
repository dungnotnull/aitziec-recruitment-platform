import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CandidateSkillDto {
  @ApiProperty({ example: 'skill-id-1' })
  skillId: string;

  @ApiProperty({ example: 'TypeScript' })
  name: string;

  @ApiProperty({ example: 3, nullable: true })
  yearsOfExperience: number | null;
}

export class WorkExperienceDto {
  @ApiProperty({ example: 'exp-id-1' })
  id: string;

  @ApiProperty({ example: 'Tech Corp' })
  companyName: string;

  @ApiProperty({ example: 'Software Engineer' })
  title: string;

  @ApiProperty({ example: '2022-01-01T00:00:00.000Z' })
  startDate: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', nullable: true })
  endDate: string | null;

  @ApiProperty({ example: 'Built distributed backend services', nullable: true })
  description: string | null;
}

export class CandidateProfileDto {
  @ApiProperty({ example: 'profile-id-1' })
  id: string;

  @ApiProperty({ example: 'user-id-1' })
  userId: string;

  @ApiProperty({ example: 'Nguyen Van A' })
  fullName: string;

  @ApiProperty({ example: 'Senior Fullstack Engineer', nullable: true })
  headline: string | null;

  @ApiProperty({ example: '+84987654321', nullable: true })
  phone: string | null;

  @ApiProperty({ example: 'Ho Chi Minh City, Vietnam', nullable: true })
  location: string | null;

  @ApiProperty({ example: 'Passionate software engineer...', nullable: true })
  bio: string | null;

  @ApiProperty({ example: true })
  isSearchable: boolean;

  @ApiProperty({ example: 80 })
  profileCompleteness: number;

  @ApiProperty({ type: [CandidateSkillDto] })
  skills: CandidateSkillDto[];

  @ApiProperty({ type: [WorkExperienceDto] })
  experiences: WorkExperienceDto[];

  @ApiProperty({ example: null, nullable: true })
  defaultCvId: string | null;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  updatedAt: string;
}

export class UpdateSkillInput {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID()
  skillId: string;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsOfExperience: number | null;
}

export class UpdateExperienceInput {
  @ApiPropertyOptional({ example: 'exp-id-1' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Tech Corp' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ example: 'Senior Backend Engineer' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '2022-01-01T00:00:00.000Z' })
  @IsISO8601()
  startDate: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @IsISO8601()
  endDate?: string | null;

  @ApiPropertyOptional({ example: 'Responsible for APIs', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class UpdateCandidateProfileDto {
  @ApiProperty({ example: 1, description: 'Expected version for optimistic concurrency' })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ example: 'Nguyen Van A' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Senior Backend Engineer', nullable: true })
  @IsOptional()
  headline?: string | null;

  @ApiPropertyOptional({ example: '+84987654321', nullable: true })
  @IsOptional()
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City', nullable: true })
  @IsOptional()
  location?: string | null;

  @ApiPropertyOptional({ example: 'Passionate developer', nullable: true })
  @IsOptional()
  bio?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isSearchable?: boolean;

  @ApiPropertyOptional({ type: [UpdateSkillInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSkillInput)
  skills?: UpdateSkillInput[];

  @ApiPropertyOptional({ type: [UpdateExperienceInput] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateExperienceInput)
  experiences?: UpdateExperienceInput[];
}
