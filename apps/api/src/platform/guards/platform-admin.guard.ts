import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PlatformAuthService } from '../platform-auth.service';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly authService: PlatformAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.cookies?.platform_token;

    if (!token) {
      throw new UnauthorizedException('No platform token provided');
    }

    const admin = await this.authService.validateToken(token);
    if (!admin) {
      throw new UnauthorizedException('Invalid platform token');
    }

    request.platformAdmin = admin;
    return true;
  }
}
