import {
  Controller,
  Post,
  Get,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { CurrentPlatformAdmin } from './decorators/current-admin.decorator';

interface LoginDto {
  email: string;
  password: string;
}

@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly authService: PlatformAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);

    res.cookie('platform_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return { admin: result.admin };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('platform_token');
    return { success: true };
  }

  @Get('profile')
  @UseGuards(PlatformAdminGuard)
  async getProfile(@CurrentPlatformAdmin() admin: any) {
    return admin;
  }
}
