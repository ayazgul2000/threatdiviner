import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { JwtAuthGuard, RequirePermission, CurrentTenant } from '../libs/auth';
import { Permission } from '../libs/auth/permissions/permissions.enum';
import { RetentionService } from './retention.service';

class UpdateRetentionConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(7)
  scanRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  findingRetentionDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  auditRetentionDays?: number;
}

@ApiTags('Retention')
@ApiBearerAuth()
@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get('config')
  @RequirePermission(Permission.SETTINGS_READ)
  @ApiOperation({ summary: 'Get retention configuration' })
  async getRetentionConfig(@CurrentTenant() tenantId: string) {
    return this.retentionService.getTenantRetentionConfig(tenantId);
  }

  @Put('config')
  @RequirePermission(Permission.SETTINGS_WRITE)
  @ApiOperation({ summary: 'Update retention configuration' })
  async updateRetentionConfig(
    @CurrentTenant() tenantId: string,
    @Body() dto: UpdateRetentionConfigDto,
  ) {
    return this.retentionService.updateTenantRetentionConfig(tenantId, dto);
  }

  @Get('stats')
  @RequirePermission(Permission.SETTINGS_READ)
  @ApiOperation({ summary: 'Get storage usage statistics' })
  async getStorageStats(@CurrentTenant() tenantId: string) {
    return this.retentionService.getTenantStorageStats(tenantId);
  }
}
