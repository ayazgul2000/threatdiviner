import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorator to require specific roles for a route
 *
 * @example
 * @Roles('admin')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('admin-only')
 * adminRoute() {}
 *
 * @example
 * @Roles('admin', 'manager')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Get('elevated')
 * elevatedRoute() {}
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
