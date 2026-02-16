import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'auditLog';

export interface AuditLogOptions {
  action: string;
  resource: string;
  description?: string;
}

/**
 * Decorator to mark endpoints for audit logging
 * @param options - Audit log options including action, resource, and optional description
 * @example
 * @AuditLog({ action: 'CREATE', resource: 'PROJECT' })
 * @Post()
 * async createProject(@Body() dto: CreateProjectDto) { ... }
 */
export const AuditLog = (options: AuditLogOptions) =>
  SetMetadata(AUDIT_LOG_KEY, options);
