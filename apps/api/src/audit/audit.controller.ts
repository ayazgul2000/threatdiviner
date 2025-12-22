import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AuditService, AuditResource } from './audit.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getAuditLogs(
    @CurrentUser('tenantId') tenantId: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset?: number,
  ) {
    const result = await this.auditService.query({
      tenantId,
      action,
      resource,
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset,
    });

    return result;
  }

  @Get('recent')
  async getRecentActivity(
    @CurrentUser('tenantId') tenantId: string,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.auditService.getRecentActivity(tenantId, limit);
  }

  @Get('resource/:resource/:resourceId')
  async getResourceHistory(
    @CurrentUser('tenantId') tenantId: string,
    @Query('resource') resource: AuditResource,
    @Query('resourceId') resourceId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    const logs = await this.auditService.getResourceHistory(resource, resourceId, limit);
    // Filter to only include logs from this tenant
    return logs.filter(log => log.tenantId === tenantId);
  }

  @Get('stats')
  async getStats(@CurrentUser('tenantId') tenantId: string) {
    return this.auditService.getStats(tenantId);
  }
}
