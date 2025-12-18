import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Res,
  Inject,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload, AltanicheAuthConfig } from './interfaces';
import { AUTH_CONFIG } from './auth.constants';

/**
 * Authentication controller
 * Provides login, register, refresh, logout, and profile endpoints
 */
@Controller('auth')
export class AuthController {
  private readonly accessCookieOptions: object;
  private readonly refreshCookieOptions: object;
  private readonly accessCookieName: string;
  private readonly refreshCookieName: string;

  constructor(
    private authService: AuthService,
    @Inject(AUTH_CONFIG) config: AltanicheAuthConfig,
  ) {
    this.accessCookieName = config.accessTokenCookieName || 'accessToken';
    this.refreshCookieName = config.refreshTokenCookieName || 'refreshToken';

    // Parse expiry for cookie maxAge
    const accessMaxAge = this.parseExpiry(config.accessTokenExpiry || '15m');
    const refreshMaxAge = this.parseExpiry(config.refreshTokenExpiry || '7d');

    this.accessCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: accessMaxAge,
      path: '/',
    };

    this.refreshCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: refreshMaxAge,
      path: '/auth/refresh',
    };
  }

  /**
   * POST /auth/register
   */
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);

    res.cookie(this.accessCookieName, result.accessToken, this.accessCookieOptions);
    res.cookie(this.refreshCookieName, result.refreshToken, this.refreshCookieOptions);

    return { user: result.user };
  }

  /**
   * POST /auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    res.cookie(this.accessCookieName, result.accessToken, this.accessCookieOptions);
    res.cookie(this.refreshCookieName, result.refreshToken, this.refreshCookieOptions);

    return { user: result.user };
  }

  /**
   * POST /auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Res({ passthrough: true }) res: Response) {
    const refreshToken = (res.req as any).cookies?.[this.refreshCookieName];

    if (!refreshToken) {
      res.status(HttpStatus.UNAUTHORIZED);
      return { message: 'No refresh token' };
    }

    const tokens = await this.authService.refresh(refreshToken);

    res.cookie(this.accessCookieName, tokens.accessToken, this.accessCookieOptions);
    res.cookie(this.refreshCookieName, tokens.refreshToken, this.refreshCookieOptions);

    return { message: 'Token refreshed' };
  }

  /**
   * POST /auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.accessCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/',
    });

    res.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      path: '/auth/refresh',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * GET /auth/profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /**
   * GET /auth/me
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return {
      id: user.sub,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
    };
  }

  /**
   * Parse expiry string to milliseconds
   */
  private parseExpiry(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 15 * 60 * 1000; // Default 15 minutes
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 15 * 60 * 1000;
    }
  }
}
