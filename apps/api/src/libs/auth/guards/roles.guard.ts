import { Injectable, CanActivate, ExecutionContext, Inject, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Role-based access control guard
 * Use with @Roles() decorator and JwtAuthGuard
 *
 * Note: Requires Reflector to be available in the module context.
 * If used outside of AuthModule, you may need to provide Reflector.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Optional() @Inject(Reflector) private reflector?: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.reflector) {
      // If reflector is not available, allow access (no role check)
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.role === role);
  }
}
