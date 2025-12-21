import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, hasPermission } from './permissions.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      Permission[] | { all: Permission[] }
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions) {
      return true; // No permissions required
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('Access denied - no role assigned');
    }

    // Check if user has required permissions
    if (Array.isArray(requiredPermissions)) {
      // ANY permission is sufficient
      const hasAny = requiredPermissions.some((permission) =>
        hasPermission(user.role, permission),
      );

      if (!hasAny) {
        throw new ForbiddenException(
          `Access denied - requires one of: ${requiredPermissions.join(', ')}`,
        );
      }
    } else if (requiredPermissions.all) {
      // ALL permissions are required
      const hasAll = requiredPermissions.all.every((permission) =>
        hasPermission(user.role, permission),
      );

      if (!hasAll) {
        throw new ForbiddenException(
          `Access denied - requires all of: ${requiredPermissions.all.join(', ')}`,
        );
      }
    }

    return true;
  }
}
