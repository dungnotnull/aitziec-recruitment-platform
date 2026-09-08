import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { UserSummaryDto } from '../../auth/dto/auth.dto';

export class CompanyDto {
  @ApiProperty({ example: 'comp-1234' })
  id: string;

  @ApiProperty({ example: 'techcorp-vietnam' })
  slug: string;

  @ApiProperty({ example: 'TechCorp Vietnam' })
  name: string;

  @ApiProperty({ example: 'Leading software firm', nullable: true })
  description: string | null;

  @ApiProperty({ example: 'https://techcorp.vn', nullable: true })
  websiteUrl: string | null;

  @ApiProperty({ example: 'https://cdn.techcorp.vn/logo.png', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'Ho Chi Minh City, Vietnam', nullable: true })
  location: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'], example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: 1 })
  version: number;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  updatedAt: string;
}

export class CreateCompanyDto {
  @ApiProperty({ example: 'TechCorp Vietnam' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'techcorp-vietnam' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional({ example: 'Top tech employer', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://techcorp.vn', nullable: true })
  @IsOptional()
  @IsString()
  websiteUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://techcorp.vn/logo.png', nullable: true })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: 'Ho Chi Minh City', nullable: true })
  @IsOptional()
  @IsString()
  location?: string | null;
}

export class UpdateCompanyDto {
  @ApiProperty({ example: 1, description: 'Expected aggregate version' })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ example: 'TechCorp Vietnam Ltd' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Leading innovation hub', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'https://techcorp.vn', nullable: true })
  @IsOptional()
  @IsString()
  websiteUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://techcorp.vn/logo.png', nullable: true })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: 'District 1, HCMC', nullable: true })
  @IsOptional()
  @IsString()
  location?: string | null;
}

export class AddCompanyMemberDto {
  @ApiProperty({ example: 'recruiter@techcorp.vn' })
  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @ApiPropertyOptional({ enum: ['RECRUITER'], default: 'RECRUITER' })
  @IsOptional()
  @IsIn(['RECRUITER'], { message: 'Only RECRUITER can be added directly via this endpoint' })
  role?: 'RECRUITER';
}

export class CompanyMembershipDto {
  @ApiProperty({ example: 'membership-uuid-1' })
  id: string;

  @ApiProperty({ example: 'comp-1234' })
  companyId: string;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;

  @ApiProperty({ enum: ['OWNER', 'RECRUITER'], example: 'RECRUITER' })
  role: string;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  createdAt: string;
}
