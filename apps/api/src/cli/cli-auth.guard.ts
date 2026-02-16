import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from '../apikeys/apikeys.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Combined auth guard for CLI endpoints
 * Supports both API keys (td_xxx) and JWT tokens
 */
@Injectable()
export class CliAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (!token || (scheme !== 'Bearer' && scheme !== 'ApiKey')) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    // Check if it's an API key (starts with td_)
    if (token.startsWith('td_')) {
      return this.validateApiKey(request, token);
    }

    // Otherwise try JWT
    return this.validateJwt(request, token);
  }

  private async validateApiKey(request: any, key: string): Promise<boolean> {
    const validation = await this.apiKeysService.validateApiKey(key);

    if (!validation.valid) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Check for scans:trigger scope for CLI operations
    if (validation.scopes && !this.apiKeysService.hasScope(validation.scopes, 'scans:trigger')) {
      throw new UnauthorizedException('API key does not have required scope: scans:trigger');
    }

    // Attach user info to request (compatible with @CurrentUser decorator)
    request.user = {
      sub: validation.userId,
      userId: validation.userId,
      tenantId: validation.tenantId,
      isApiKeyAuth: true,
      apiKeyScopes: validation.scopes,
    };

    return true;
  }

  private async validateJwt(request: any, token: string): Promise<boolean> {
    try {
      const secret = this.configService.get('JWT_SECRET', 'threatdiviner-dev-secret-change-in-production');
      const payload = this.jwtService.verify(token, { secret });

      // Don't allow refresh tokens
      if (payload.type === 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      request.user = {
        sub: payload.sub,
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
        tenantId: payload.tenantId,
        tenantSlug: payload.tenantSlug,
        type: payload.type,
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
