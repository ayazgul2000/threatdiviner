import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract the tenant ID from the request
 * Uses the authenticated user's tenantId or falls back to request.tenantId
 *
 * @example
 * @Get()
 * async findAll(@TenantId() tenantId: string) {
 *   return this.service.findAll(tenantId);
 * }
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId || request.tenantId;
  },
);

/**
 * Extract the full tenant object from the request
 * Requires TenantContextMiddleware to be applied
 *
 * @example
 * @Get()
 * async getSettings(@CurrentTenant() tenant: Tenant) {
 *   return tenant.settings;
 * }
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
