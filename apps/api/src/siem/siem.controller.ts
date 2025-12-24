import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { SiemService } from './siem.service';
import { AlertRulesService, AlertRule } from './alert-rules.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('siem')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('siem')
export class SiemController {
  constructor(
    private readonly siemService: SiemService,
    private readonly alertRulesService: AlertRulesService,
  ) {}

  // =====================
  // Events
  // =====================

  @Get('events')
  @ApiOperation({ summary: 'Search security events' })
  async searchEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('eventTypes') eventTypes?: string,
    @Query('sources') sources?: string,
    @Query('severities') severities?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('searchText') searchText?: string,
    @Query('size') size?: string,
    @Query('from') from?: string,
  ) {
    return this.siemService.searchEvents({
      tenantId: user.tenantId,
      eventTypes: eventTypes ? eventTypes.split(',') : undefined,
      sources: sources ? sources.split(',') : undefined,
      severities: severities ? severities.split(',') : undefined,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      searchText,
      size: size ? parseInt(size, 10) : 100,
      from: from ? parseInt(from, 10) : 0,
    });
  }

  @Get('events/dashboard')
  @ApiOperation({ summary: 'Get event dashboard data' })
  async getEventDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ) {
    const end = endTime ? new Date(endTime) : new Date();
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // Default 7 days

    return this.siemService.getEventDashboard(user.tenantId, { start, end });
  }

  @Get('events/export')
  @ApiOperation({ summary: 'Export security events' })
  async exportEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startTime') startTime: string,
    @Query('endTime') endTime: string,
    @Query('format') format: 'json' | 'csv' = 'json',
    @Res() res: Response,
  ) {
    const content = await this.siemService.exportEvents(
      user.tenantId,
      { start: new Date(startTime), end: new Date(endTime) },
      format,
    );

    const contentType =
      format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `security-events-${new Date().toISOString().split('T')[0]}.${format}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get('threats/summary')
  @ApiOperation({ summary: 'Get threat intelligence summary' })
  async getThreatSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.siemService.getThreatSummary(user.tenantId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get SIEM statistics' })
  async getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('timeRange') timeRange?: string,
  ) {
    const end = new Date();
    let start: Date;

    switch (timeRange) {
      case '1h':
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '24h':
      default:
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }

    const data = await this.siemService.getEventDashboard(user.tenantId, { start, end });
    const alertHistory = await this.alertRulesService.getAlertHistory(user.tenantId, 100);
    // Count recent alerts (last 24 hours) as active
    const activeAlerts = alertHistory.filter(a => {
      const triggeredAt = new Date(a.triggeredAt);
      return triggeredAt >= start;
    }).length;

    // Map to expected dashboard format
    return {
      totalEvents: data.totalEvents,
      criticalEvents: data.bySeverity?.critical || 0,
      activeAlerts,
      eventsBySource: data.bySource || {},
      eventsBySeverity: data.bySeverity || {},
      eventsTimeline: data.timeline || [],
    };
  }

  // =====================
  // Alert Rules
  // =====================

  @Get('alerts/rules')
  @ApiOperation({ summary: 'List alert rules' })
  async listAlertRules(@CurrentUser() user: AuthenticatedUser) {
    return this.alertRulesService.getRules(user.tenantId);
  }

  @Get('alerts/rules/:id')
  @ApiOperation({ summary: 'Get alert rule' })
  async getAlertRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.alertRulesService.getRule(user.tenantId, id);
  }

  @Post('alerts/rules')
  @ApiOperation({ summary: 'Create alert rule' })
  async createAlertRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: Omit<AlertRule, 'id' | 'tenantId' | 'triggerCount' | 'createdAt' | 'updatedAt'>,
  ) {
    return this.alertRulesService.createRule(user.tenantId, body);
  }

  @Put('alerts/rules/:id')
  @ApiOperation({ summary: 'Update alert rule' })
  async updateAlertRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Partial<AlertRule>,
  ) {
    return this.alertRulesService.updateRule(user.tenantId, id, body);
  }

  @Delete('alerts/rules/:id')
  @ApiOperation({ summary: 'Delete alert rule' })
  async deleteAlertRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.alertRulesService.deleteRule(user.tenantId, id);
    return { message: 'Alert rule deleted successfully' };
  }

  @Get('alerts/history')
  @ApiOperation({ summary: 'Get alert history' })
  async getAlertHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.alertRulesService.getAlertHistory(
      user.tenantId,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
