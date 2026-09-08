import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'candidate@example.com', description: 'Unique user email address' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'SecurePassword123!',
    description: 'Password between 12 and 128 characters',
    minLength: 12,
    maxLength: 128,
  })
  @IsString()
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;

  @ApiProperty({
    enum: ['CANDIDATE', 'HR'],
    example: 'CANDIDATE',
    description: 'Target registration role',
  })
  @IsIn(['CANDIDATE', 'HR'], { message: 'role must be either CANDIDATE or HR' })
  role: 'CANDIDATE' | 'HR';
}

export class LoginDto {
  @ApiProperty({ example: 'candidate@example.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class UserSummaryDto {
  @ApiProperty({ example: 'c0a80101-0000-0000-0000-000000000001' })
  id: string;

  @ApiProperty({ example: 'candidate@example.com' })
  email: string;

  @ApiProperty({ enum: ['CANDIDATE', 'HR', 'ADMIN'], example: 'CANDIDATE' })
  role: string;

  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'DISABLED'], example: 'ACTIVE' })
  status: string;

  @ApiProperty({ example: '2026-09-08T09:30:00.000Z' })
  createdAt: string;
}

export class AuthSessionDto {
  @ApiProperty({ description: 'Short-lived JWT access token', example: 'eyJhbGci...' })
  accessToken: string;

  @ApiProperty({
    description: 'Access token expiration ISO UTC timestamp',
    example: '2026-09-08T09:45:00.000Z',
  })
  accessTokenExpiresAt: string;

  @ApiProperty({ type: UserSummaryDto })
  user: UserSummaryDto;
}
