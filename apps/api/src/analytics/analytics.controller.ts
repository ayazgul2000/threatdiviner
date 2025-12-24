import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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

  @Get()
  @ApiOperation({ summary: 'Get analytics data for date range' })
  async getAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('range') range: '7d' | '30d' | '90d' = '30d',
  ) {
    const now = new Date();
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 30;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return this.analyticsService.getAnalytics(user.tenantId, { start, end: now });
  }

  @Get('scanners')
  @ApiOperation({ summary: 'Get scanner-specific statistics' })
  async getScannerStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('range') range: '7d' | '30d' | '90d' = '30d',
  ) {
    const now = new Date();
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[range] || 30;
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return this.analyticsService.getScannerStats(user.tenantId, { start, end: now });
  }
}
