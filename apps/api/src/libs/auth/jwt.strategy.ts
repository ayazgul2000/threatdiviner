import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtPayload, AltanicheAuthConfig } from './interfaces';
import { AUTH_CONFIG } from './auth.constants';

/**
 * JWT Strategy for Passport
 * Extracts token from httpOnly cookie or Authorization header
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AUTH_CONFIG) config: AltanicheAuthConfig) {
    const cookieName = config.accessTokenCookieName || 'accessToken';

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First try to extract from httpOnly cookie
        (request: Request) => {
          return request?.cookies?.[cookieName];
        },
        // Fallback to Authorization header for API clients
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload | null> {
    // Only allow access tokens (not refresh tokens) for API access
    if (payload.type === 'refresh') {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      tenantSlug: payload.tenantSlug,
      type: payload.type,
    };
  }
}
