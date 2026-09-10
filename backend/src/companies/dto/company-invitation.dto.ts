import { ApiProperty } from '@nestjs/swagger';

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

export class CompanyInvitationDto {
  @ApiProperty({ example: 'b6f69fcf-b6ee-4c57-a36c-945b0a3dbf88' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  companyId: string;

  @ApiProperty({ example: 'u***r@example.com', description: 'Masked email of invited user' })
  email: string;

  @ApiProperty({ example: 'RECRUITER', enum: ['OWNER', 'RECRUITER'] })
  role: string;

  @ApiProperty({ example: 'PENDING', enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] })
  status: string;

  @ApiProperty({ example: '2026-09-17T00:00:00.000Z' })
  expiresAt: string;

  @ApiProperty({ example: '2026-09-10T00:00:00.000Z' })
  createdAt: string;
}
