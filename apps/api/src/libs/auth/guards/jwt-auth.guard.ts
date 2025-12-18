import { Injectable, ExecutionContext, UnauthorizedException, Inject, Optional } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT authentication guard
 * Validates JWT token from cookie or Authorization header
 * Use with @Public() decorator to skip authentication
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Optional() @Inject(Reflector) private reflector?: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check for @Public() decorator if reflector is available
    if (this.reflector) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (isPublic) {
        return true;
      }
    }

    return super.canActivate(context);
  }

  handleRequest<TUser>(
    err: Error | null,
    user: TUser,
    _info: Error | null,
    _context: ExecutionContext,
  ): TUser {
    if (user) {
      return user;
    }

    if (err) {
      throw err;
    }

    throw new UnauthorizedException('Authentication required');
  }
}
