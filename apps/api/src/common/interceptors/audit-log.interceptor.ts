import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap, catchError } from 'rxjs';
import { AUDIT_LOG_KEY, AuditLogOptions } from '../decorators/audit-log.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditOptions = this.reflector.get<AuditLogOptions>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!auditOptions) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: async (response) => {
          try {
            await this.logAudit({
              tenantId: user?.tenantId,
              userId: user?.id,
              action: auditOptions.action,
              resource: auditOptions.resource,
              resourceId: request.params?.id || response?.id,
              success: true,
              details: {
                method: request.method,
                path: request.path,
                body: this.sanitizeBody(request.body),
                duration: Date.now() - startTime,
              },
              ipAddress: this.getIpAddress(request),
              userAgent: request.headers['user-agent'],
            });
          } catch (error) {
            this.logger.error('Failed to log audit', error);
          }
        },
      }),
      catchError(async (error) => {
        try {
          await this.logAudit({
            tenantId: user?.tenantId,
            userId: user?.id,
            action: `${auditOptions.action}_FAILED`,
            resource: auditOptions.resource,
            resourceId: request.params?.id,
            success: false,
            details: {
              method: request.method,
              path: request.path,
              error: error.message,
              duration: Date.now() - startTime,
            },
            ipAddress: this.getIpAddress(request),
            userAgent: request.headers['user-agent'],
          });
        } catch (logError) {
          this.logger.error('Failed to log audit error', logError);
        }
        throw error;
      }),
    );
  }

  private async logAudit(data: {
    tenantId?: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    success: boolean;
    details: any;
    ipAddress: string;
    userAgent?: string;
  }) {
    if (!data.tenantId) {
      this.logger.warn('Skipping audit log - no tenant ID');
      return;
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: data.tenantId,
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: data.details,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
    }
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sensitiveFields = [
      'password',
      'token',
      'accessToken',
      'refreshToken',
      'apiKey',
      'secret',
      'privateKey',
      'credentials',
    ];

    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Also check nested objects
    for (const key of Object.keys(sanitized)) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeBody(sanitized[key]);
      }
    }

    return sanitized;
  }

  private getIpAddress(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}
