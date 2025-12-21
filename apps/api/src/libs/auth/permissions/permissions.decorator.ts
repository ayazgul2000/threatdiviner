import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.enum';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to require specific permissions for a route
 * @param permissions - Array of permissions required (any one of them)
 */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Decorator to require ALL specified permissions
 * @param permissions - Array of permissions ALL required
 */
export const RequireAllPermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, { all: permissions });
