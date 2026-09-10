import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { ERROR_CODES } from '../constants/error-codes';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      const request = context.switchToHttp().getRequest<Request>();
      const token = this.extractTokenFromHeader(request);
      if (token) {
        try {
          const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
          const payload = await this.jwtService.verifyAsync(token, { secret });
          const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
          });
          if (user && user.status === 'ACTIVE') {
            request.user = {
              id: user.id,
              email: user.email,
              role: user.role,
              status: user.status,
              sessionId: payload.sessionId,
            };
          }
        } catch {
          // On public route, gracefully ignore token errors
        }
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTHENTICATION_REQUIRED,
        message: 'Authentication required. Bearer token missing.',
      });
    }

    try {
      const secret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // Verify user in DB to ensure account is not suspended/disabled
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException({
          code: ERROR_CODES.AUTHENTICATION_REQUIRED,
          message: 'User no longer exists.',
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

      request.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        sessionId: payload.sessionId,
      };

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException || err instanceof UnauthorizedException) {
        throw err;
      }
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          code: ERROR_CODES.ACCESS_TOKEN_EXPIRED,
          message: 'Access token has expired. Please refresh your session.',
        });
      }
      throw new UnauthorizedException({
        code: ERROR_CODES.AUTHENTICATION_REQUIRED,
        message: 'Invalid access token.',
      });
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
