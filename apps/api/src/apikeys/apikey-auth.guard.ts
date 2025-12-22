import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeysService } from './apikeys.service';

export const REQUIRED_SCOPE_KEY = 'requiredApiKeyScope';
export const RequireApiKeyScope = (scope: string) => SetMetadata(REQUIRED_SCOPE_KEY, scope);

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    // Support both "Bearer <key>" and "ApiKey <key>" formats
    const [scheme, key] = authHeader.split(' ');

    if (!key) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    if (scheme !== 'Bearer' && scheme !== 'ApiKey') {
      throw new UnauthorizedException('Invalid authorization scheme');
    }

    // Check if it's an API key (starts with td_)
    if (!key.startsWith('td_')) {
      // Not an API key, let other guards handle it
      return false;
    }

    const validation = await this.apiKeysService.validateApiKey(key);

    if (!validation.valid) {
      throw new UnauthorizedException('Invalid or expired API key');
    }

    // Check required scope if specified
    const requiredScope = this.reflector.get<string>(
      REQUIRED_SCOPE_KEY,
      context.getHandler(),
    );

    if (requiredScope && validation.scopes) {
      if (!this.apiKeysService.hasScope(validation.scopes, requiredScope)) {
        throw new UnauthorizedException(
          `API key does not have required scope: ${requiredScope}`,
        );
      }
    }

    // Attach tenant and user info to request
    request.tenantId = validation.tenantId;
    request.userId = validation.userId;
    request.apiKeyScopes = validation.scopes;
    request.isApiKeyAuth = true;

    return true;
  }
}

/**
 * Combined guard that accepts either JWT or API key authentication
 */
@Injectable()
export class JwtOrApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const [_scheme, token] = authHeader.split(' ');

    if (!token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    // Check if it's an API key
    if (token.startsWith('td_')) {
      const validation = await this.apiKeysService.validateApiKey(token);

      if (!validation.valid) {
        throw new UnauthorizedException('Invalid or expired API key');
      }

      // Check required scope
      const requiredScope = this.reflector.get<string>(
        REQUIRED_SCOPE_KEY,
        context.getHandler(),
      );

      if (requiredScope && validation.scopes) {
        if (!this.apiKeysService.hasScope(validation.scopes, requiredScope)) {
          throw new UnauthorizedException(
            `API key does not have required scope: ${requiredScope}`,
          );
        }
      }

      request.tenantId = validation.tenantId;
      request.userId = validation.userId;
      request.apiKeyScopes = validation.scopes;
      request.isApiKeyAuth = true;

      return true;
    }

    // Not an API key - let the JWT guard handle it
    // Return false to indicate this guard doesn't handle this request
    return false;
  }
}
