import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PasswordService } from './password.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { ERROR_CODES } from '../common/constants/error-codes';
import { AuthSessionDto, LoginDto, RegisterDto, UserSummaryDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private setRefreshCookie(res: Response, token: string) {
    const cookieName = this.configService.get<string>('REFRESH_COOKIE_NAME', 'itziec_refresh');
    const isSecure = this.configService.get<boolean>('REFRESH_COOKIE_SECURE', false);
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>(
      'REFRESH_COOKIE_SAME_SITE',
      'lax',
    );

    res.cookie(cookieName, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
  }

  private clearRefreshCookie(res: Response) {
    const cookieName = this.configService.get<string>('REFRESH_COOKIE_NAME', 'itziec_refresh');
    res.clearCookie(cookieName, {
      path: '/api/v1/auth',
    });
  }

  async register(dto: RegisterDto, res: Response): Promise<AuthSessionDto> {
    const normalizedEmail = this.usersService.normalizeEmail(dto.email);

    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException({
        code: ERROR_CODES.EMAIL_ALREADY_EXISTS,
        message: 'An account with this email address already exists.',
      });
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: dto.role,
          status: 'ACTIVE',
        },
      });

      if (dto.role === 'CANDIDATE') {
        await tx.candidateProfile.create({
          data: {
            userId: createdUser.id,
            fullName: normalizedEmail.split('@')[0],
            isSearchable: true,
            profileCompleteness: 15, // fullName provides base 15%
            version: 1,
          },
        });
      }

      await this.auditService.record(
        {
          actorId: createdUser.id,
          action: 'USER_REGISTERED',
          targetType: 'User',
          targetId: createdUser.id,
          metadata: { role: dto.role },
        },
        tx,
      );

      return createdUser;
    });

    return this.createSession(user, res);
  }

  async login(dto: LoginDto, res: Response): Promise<AuthSessionDto> {
    const normalizedEmail = this.usersService.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    const passwordValid = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password.',
      });
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account has been suspended by an administrator.',
      });
    }

    if (user.status === 'DISABLED') {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Your account has been disabled.',
      });
    }

    await this.auditService.record({
      actorId: user.id,
      action: 'USER_LOGGED_IN',
      targetType: 'User',
      targetId: user.id,
    });

    return this.createSession(user, res);
  }

  async refresh(rawToken: string | undefined, res: Response): Promise<AuthSessionDto> {
    if (!rawToken) {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Refresh token cookie is missing.',
      });
    }

    const tokenHash = this.hashToken(rawToken);
    const session = await this.prisma.refreshSession.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      this.clearRefreshCookie(res);
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh session.',
      });
    }

    // Reuse detection
    if (session.isRevoked) {
      this.logger.warn(
        `[SECURITY] Token family reuse attack detected on familyId: ${session.familyId}, userId: ${session.userId}`,
      );

      // Invalidate the ENTIRE token family
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId },
        data: { isRevoked: true },
      });

      this.clearRefreshCookie(res);

      await this.auditService.record({
        actorId: session.userId,
        action: 'SECURITY_ALERT_REFRESH_TOKEN_REUSED',
        targetType: 'RefreshSession',
        targetId: session.id,
        metadata: { familyId: session.familyId },
      });

      throw new UnauthorizedException({
        code: ERROR_CODES.REFRESH_TOKEN_REUSED,
        message:
          'Refresh token reuse detected. All sessions in this token family have been revoked.',
      });
    }

    if (new Date() > session.expiresAt) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      });
      this.clearRefreshCookie(res);
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Refresh session has expired.',
      });
    }

    const user = session.user;
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenException({
        code: ERROR_CODES.ACCOUNT_SUSPENDED,
        message: 'Your account has been suspended.',
      });
    }

    // Rotate within same token family
    const nextRawToken = crypto.randomBytes(32).toString('hex');
    const nextTokenHash = this.hashToken(nextRawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [, newSession] = await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { isRevoked: true },
      }),
      this.prisma.refreshSession.create({
        data: {
          userId: user.id,
          familyId: session.familyId,
          tokenHash: nextTokenHash,
          isRevoked: false,
          expiresAt,
        },
      }),
    ]);

    this.setRefreshCookie(res, nextRawToken);

    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        status: user.status,
        sessionId: newSession.id,
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );

    return {
      accessToken,
      accessTokenExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  async logout(rawToken: string | undefined, res: Response): Promise<void> {
    if (rawToken) {
      const tokenHash = this.hashToken(rawToken);
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    }
    this.clearRefreshCookie(res);
  }

  async logoutAll(userId: string, res: Response): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
    this.clearRefreshCookie(res);
  }

  async me(userId: string): Promise<UserSummaryDto> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTHENTICATION_REQUIRED,
        message: 'User no longer exists.',
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async createSession(user: User, res: Response): Promise<AuthSessionDto> {
    const familyId = uuidv4();
    const rawRefreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash,
        isRevoked: false,
        expiresAt,
      },
    });

    this.setRefreshCookie(res, rawRefreshToken);

    const accessTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        status: user.status,
        sessionId: session.id,
      },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: '15m',
      },
    );

    return {
      accessToken,
      accessTokenExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }
}
