import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  private getDateRange(range: string) {
    const now = new Date();
    const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
    const days = daysMap[range] || 30;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { start, end: now, days };
  }

  @Get()
  @ApiOperation({ summary: 'Get analytics data for date range' })
  async getAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('range') range: '7d' | '30d' | '90d' = '30d',
  ) {
    const { start, end } = this.getDateRange(range);
    return this.analyticsService.getAnalytics(user.tenantId, { start, end });
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get high-level analytics overview' })
  async getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getOverview(user.tenantId);
  }

  @Get('scans-trend')
  @ApiOperation({ summary: 'Get scans over time trend' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getScansTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days: number = 30,
  ) {
    return this.analyticsService.getScansTrend(user.tenantId, days);
  }

  @Get('findings-trend')
  @ApiOperation({ summary: 'Get findings trend over time' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getFindingsTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days: number = 30,
  ) {
    return this.analyticsService.getFindingsTrend(user.tenantId, days);
  }

  @Get('severity-breakdown')
  @ApiOperation({ summary: 'Get findings breakdown by severity' })
  async getSeverityBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getSeverityBreakdown(user.tenantId);
  }

  @Get('scanner-breakdown')
  @ApiOperation({ summary: 'Get findings breakdown by scanner' })
  async getScannerBreakdown(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getScannerBreakdown(user.tenantId);
  }

  @Get('top-repos')
  @ApiOperation({ summary: 'Get top vulnerable repositories' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopRepos(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit: number = 10,
  ) {
    return this.analyticsService.getTopRepos(user.tenantId, limit);
  }

  @Get('top-rules')
  @ApiOperation({ summary: 'Get top recurring rules' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopRules(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit: number = 10,
  ) {
    return this.analyticsService.getTopRules(user.tenantId, limit);
  }

  @Get('compliance-scores')
  @ApiOperation({ summary: 'Get compliance framework scores' })
  async getComplianceScores(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.getComplianceScores(user.tenantId);
  }

  @Get('mttr-trend')
  @ApiOperation({ summary: 'Get mean time to remediate trend' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getMttrTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days: number = 30,
  ) {
    return this.analyticsService.getMttrTrend(user.tenantId, days);
  }

  @Get('scanners')
  @ApiOperation({ summary: 'Get scanner-specific statistics' })
  async getScannerStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('range') range: '7d' | '30d' | '90d' = '30d',
  ) {
    const { start, end } = this.getDateRange(range);
    return this.analyticsService.getScannerStats(user.tenantId, { start, end });
  }
}
