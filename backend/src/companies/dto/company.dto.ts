import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserSummaryDto } from '../../auth/dto/auth.dto';

export interface UploadedLogoFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export class UploadCompanyLogoDto {
  @ApiPropertyOptional({ example: 1, description: 'Expected aggregate version' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}

export class UploadCompanyLogoResponseDto {
  @ApiProperty({
    example: 'http://localhost:9000/itziec-assets/companies/comp-1234/logo-uuid.png',
    description: 'Public URL to the uploaded company logo',
  })
  logoUrl: string;

  @ApiProperty({ example: 2, description: 'New company version after logo update' })
  version: number;
}

export class CompanyReasonToJoinDto {
  @ApiProperty({ example: 'Môi trường công nghệ mở, phát triển chuyên sâu' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Làm việc trực tiếp với các kiến trúc hệ thống hiện đại...' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class CompanyPerkDto {
  @ApiProperty({ example: 'Lương & Thưởng' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Lương tháng 13 đảm bảo, thưởng nóng hiệu suất dự án theo quý.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ example: 'gift', nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;
}

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

  @ApiPropertyOptional({ example: 'Product & IT Solutions', nullable: true })
  companyModel: string | null;

  @ApiPropertyOptional({ example: '100 - 499 nhân viên', nullable: true })
  companySize: string | null;

  @ApiPropertyOptional({ example: 'Việt Nam / Global', nullable: true })
  country: string | null;

  @ApiPropertyOptional({ example: 'Thứ 2 - Thứ 6 (8:30 - 17:30)', nullable: true })
  workingTime: string | null;

  @ApiPropertyOptional({ example: 'Không áp lực OT', nullable: true })
  overtimePolicy: string | null;

  @ApiProperty({ example: ['Java', 'Spring Boot', 'ReactJS', 'TypeScript'] })
  techStack: string[];

  @ApiProperty({ type: [CompanyReasonToJoinDto] })
  reasonsToJoin: CompanyReasonToJoinDto[];

  @ApiProperty({ type: [CompanyPerkDto] })
  perks: CompanyPerkDto[];

  @ApiProperty({ example: 5, description: 'Number of active published jobs' })
  activeJobsCount: number;

  @ApiPropertyOptional({ example: false, description: 'Whether candidate follows company' })
  isFollowed?: boolean;

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

  @ApiPropertyOptional({ example: 'Product & IT Solutions', nullable: true })
  @IsOptional()
  @IsString()
  companyModel?: string | null;

  @ApiPropertyOptional({ example: '100 - 499 nhân viên', nullable: true })
  @IsOptional()
  @IsString()
  companySize?: string | null;

  @ApiPropertyOptional({ example: 'Việt Nam / Global', nullable: true })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ example: 'Thứ 2 - Thứ 6 (8:30 - 17:30)', nullable: true })
  @IsOptional()
  @IsString()
  workingTime?: string | null;

  @ApiPropertyOptional({ example: 'Không áp lực OT', nullable: true })
  @IsOptional()
  @IsString()
  overtimePolicy?: string | null;

  @ApiPropertyOptional({ example: ['Java', 'ReactJS'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @ApiPropertyOptional({ type: [CompanyReasonToJoinDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyReasonToJoinDto)
  reasonsToJoin?: CompanyReasonToJoinDto[];

  @ApiPropertyOptional({ type: [CompanyPerkDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyPerkDto)
  perks?: CompanyPerkDto[];
}

export class UpdateCompanyDto {
  @ApiProperty({ example: 1, description: 'Expected aggregate version' })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({
    example: 'techcorp-vietnam',
    description: 'Company slug (read-only; if provided, must match existing slug)',
  })
  @IsOptional()
  @IsString()
  slug?: string;

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

  @ApiPropertyOptional({ example: 'Product & IT Solutions', nullable: true })
  @IsOptional()
  @IsString()
  companyModel?: string | null;

  @ApiPropertyOptional({ example: '100 - 499 nhân viên', nullable: true })
  @IsOptional()
  @IsString()
  companySize?: string | null;

  @ApiPropertyOptional({ example: 'Việt Nam / Global', nullable: true })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ example: 'Thứ 2 - Thứ 6 (8:30 - 17:30)', nullable: true })
  @IsOptional()
  @IsString()
  workingTime?: string | null;

  @ApiPropertyOptional({ example: 'Không áp lực OT', nullable: true })
  @IsOptional()
  @IsString()
  overtimePolicy?: string | null;

  @ApiPropertyOptional({ example: ['Java', 'ReactJS', 'TypeScript'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @ApiPropertyOptional({ type: [CompanyReasonToJoinDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyReasonToJoinDto)
  reasonsToJoin?: CompanyReasonToJoinDto[];

  @ApiPropertyOptional({ type: [CompanyPerkDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompanyPerkDto)
  perks?: CompanyPerkDto[];
}

export class CompanyDirectoryQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, description: 'Page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100, description: 'Limit per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Search term for company name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Location filter' })
  @IsOptional()
  @IsString()
  location?: string;
}

export class CompanySummaryItemDto {
  @ApiProperty({ example: 'comp-uuid' })
  id: string;

  @ApiProperty({ example: 'techcorp-vietnam' })
  slug: string;

  @ApiProperty({ example: 'TechCorp Vietnam' })
  name: string;

  @ApiProperty({ example: 'https://cdn.techcorp.vn/logo.png', nullable: true })
  logoUrl: string | null;

  @ApiProperty({ example: 'Ho Chi Minh City, Vietnam', nullable: true })
  location: string | null;

  @ApiProperty({ example: 'Leading software firm', nullable: true })
  description: string | null;

  @ApiProperty({ example: '100 - 499 nhân viên', nullable: true })
  companySize: string | null;

  @ApiProperty({ example: 5, description: 'Number of active open published jobs' })
  activeJobsCount: number;

  @ApiProperty({ example: ['Java', 'ReactJS', 'TypeScript'] })
  techStack: string[];
}

export class CompanyDashboardStatsDto {
  @ApiProperty({ example: 42, description: 'Total applications across all jobs in this company' })
  totalApplicationsCount: number;

  @ApiProperty({ example: 5, description: 'Active published non-expired jobs count' })
  activeJobsCount: number;

  @ApiProperty({ example: 3, description: 'Total team members in company' })
  teamMembersCount: number;
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

export class CallerMembershipSummaryDto {
  @ApiProperty({ example: 'membership-uuid-1' })
  id: string;

  @ApiProperty({ enum: ['OWNER', 'RECRUITER'], example: 'OWNER' })
  role: string;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  createdAt: string;
}

export class CallerCompanyMembershipDto {
  @ApiProperty({ type: CallerMembershipSummaryDto })
  membership: CallerMembershipSummaryDto;

  @ApiProperty({ type: CompanyDto })
  company: CompanyDto;
}
