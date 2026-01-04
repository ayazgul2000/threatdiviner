import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../libs/auth';
import { SettingsService } from './settings.service';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

class UpdateTenantSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  aiTriageEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  auditRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  findingRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  scanRetentionDays?: number;

  @IsOptional()
  @IsBoolean()
  allowProjectConnections?: boolean;
}

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('tenant')
  @UseGuards(JwtAuthGuard)
  async getTenantSettings(@CurrentUser() user: { tenantId: string }) {
    return this.settingsService.getTenantSettings(user.tenantId);
  }

  @Put('tenant')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  async updateTenantSettings(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    return this.settingsService.updateTenantSettings(user.tenantId, dto);
  }
}
