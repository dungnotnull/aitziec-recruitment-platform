import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompanyMemberRole, CompanyInvitationStatus } from '@prisma/client';

export class HrInvitationCompanySummaryDto {
  @ApiProperty({ example: 'c1d2e3f4-g5h6-7i8j-9k0l-1m2n3o4p5q6r' })
  id: string;

  @ApiProperty({ example: 'techcorp-solutions' })
  slug: string;

  @ApiProperty({ example: 'TechCorp Solutions' })
  name: string;

  @ApiPropertyOptional({
    example: 'https://cdn.itziec.com/assets/companies/techcorp.png',
    nullable: true,
  })
  logoUrl: string | null;
}

export class HrInvitationItemDto {
  @ApiProperty({ example: 'inv-uuid-1234' })
  id: string;

  @ApiProperty({ type: HrInvitationCompanySummaryDto })
  company: HrInvitationCompanySummaryDto;

  @ApiProperty({ enum: ['OWNER', 'RECRUITER'], example: 'RECRUITER' })
  role: CompanyMemberRole;

  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'], example: 'PENDING' })
  status: CompanyInvitationStatus;

  @ApiProperty({ example: '2026-09-21T08:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2026-09-14T08:00:00.000Z' })
  createdAt: string;
}
