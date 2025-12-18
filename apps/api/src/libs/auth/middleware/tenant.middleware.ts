import { Injectable, NestMiddleware, Inject } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload, AltanicheAuthConfig } from '../interfaces';
import { AUTH_CONFIG } from '../auth.constants';

/**
 * Tenant middleware for multi-tenant applications
 * Extracts tenant from JWT and sets database context for RLS
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    @Inject(AUTH_CONFIG) private config: AltanicheAuthConfig,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    if (!this.config.multiTenant || !this.config.setTenantContext) {
      return next();
    }

    const cookieName = this.config.accessTokenCookieName || 'accessToken';
    const token = req.cookies?.[cookieName] || this.extractBearerToken(req);

    if (token) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(token, {
          secret: this.config.jwtSecret,
        });

        if (payload.type === 'access' && payload.tenantId) {
          await this.config.setTenantContext(payload.tenantId);
        }
      } catch {
        // Token invalid or expired - RLS will use empty tenant context
      }
    }

    next();
  }

  private extractBearerToken(req: Request): string | null {
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      return auth.slice(7);
    }
    return null;
  }
}
