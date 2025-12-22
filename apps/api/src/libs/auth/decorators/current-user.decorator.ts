import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces';

/**
 * Extract current user from request
 *
 * @example
 * // Get full user payload
 * @CurrentUser() user: JwtPayload
 *
 * @example
 * // Get specific property
 * @CurrentUser('email') email: string
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as JwtPayload;

    return data ? user?.[data] : user;
  },
);

/**
 * Extract current tenant ID from request
 *
 * @example
 * @CurrentTenant() tenantId: string
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // Check for tenantId set by API key auth first, then JWT
    return request.tenantId || request.user?.tenantId;
  },
);
