import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ERROR_CODES } from '../constants/error-codes';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<'CANDIDATE' | 'HR' | 'ADMIN'>>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: 'Access forbidden: Role cannot be determined.',
      });
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException({
        code: ERROR_CODES.FORBIDDEN,
        message: `Forbidden: Required one of [${requiredRoles.join(', ')}], current role is ${user.role}.`,
      });
    }

    return true;
  }
}
