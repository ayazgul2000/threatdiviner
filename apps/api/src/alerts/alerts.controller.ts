import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { JwtAuthGuard, RequirePermission, CurrentTenant, CurrentUser } from '../libs/auth';
import { Permission } from '../libs/auth/permissions/permissions.enum';
import { AlertsService } from './alerts.service';

class CreateAlertRuleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  severities?: string[];

  @IsOptional()
  @IsString()
  titlePattern?: string;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsNumber()
  timeWindowMinutes?: number;

  @IsOptional()
  @IsBoolean()
  notifySlack?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  createJiraIssue?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

class UpdateAlertRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eventTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sources?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  severities?: string[];

  @IsOptional()
  @IsString()
  titlePattern?: string;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsNumber()
  timeWindowMinutes?: number;

  @IsOptional()
  @IsBoolean()
  notifySlack?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  createJiraIssue?: boolean;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

@ApiTags('Alerts')
@ApiBearerAuth()
@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('rules')
  @RequirePermission(Permission.ALERTS_READ)
  @ApiOperation({ summary: 'List alert rules' })
  async listRules(@CurrentTenant() tenantId: string) {
    return this.alertsService.listRules(tenantId);
  }

  @Get('rules/:id')
  @RequirePermission(Permission.ALERTS_READ)
  @ApiOperation({ summary: 'Get alert rule by ID' })
  async getRule(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.alertsService.getRule(tenantId, id);
  }

  @Post('rules')
  @RequirePermission(Permission.ALERTS_WRITE)
  @ApiOperation({ summary: 'Create alert rule' })
  async createRule(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: { id: string },
    @Body() dto: CreateAlertRuleDto,
  ) {
    return this.alertsService.createRule(tenantId, user.id, dto);
  }

  @Put('rules/:id')
  @RequirePermission(Permission.ALERTS_WRITE)
  @ApiOperation({ summary: 'Update alert rule' })
  async updateRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAlertRuleDto,
  ) {
    return this.alertsService.updateRule(tenantId, id, dto);
  }

  @Patch('rules/:id')
  @RequirePermission(Permission.ALERTS_WRITE)
  @ApiOperation({ summary: 'Toggle alert rule enabled state' })
  async toggleRule(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.alertsService.toggleRule(tenantId, id, body.enabled);
  }

  @Delete('rules/:id')
  @RequirePermission(Permission.ALERTS_WRITE)
  @ApiOperation({ summary: 'Delete alert rule' })
  async deleteRule(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.alertsService.deleteRule(tenantId, id);
  }

  @Post('rules/:id/test')
  @RequirePermission(Permission.ALERTS_WRITE)
  @ApiOperation({ summary: 'Test alert rule' })
  async testRule(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.alertsService.testRule(tenantId, id);
  }

  @Get('history')
  @RequirePermission(Permission.ALERTS_READ)
  @ApiOperation({ summary: 'Get alert history' })
  @ApiQuery({ name: 'ruleId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async getAlertHistory(
    @CurrentTenant() tenantId: string,
    @Query('ruleId') ruleId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.alertsService.getAlertHistory(tenantId, {
      ruleId,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}
