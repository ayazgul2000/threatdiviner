import {
  Controller,
  Get,
  Query,
  Param,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RequirePermission, CurrentTenant } from '../libs/auth';
import { Permission } from '../libs/auth/permissions/permissions.enum';
import { ExportService, ExportFormat } from './export.service';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('findings')
  @RequirePermission(Permission.FINDINGS_READ)
  @ApiOperation({ summary: 'Export findings data' })
  @ApiQuery({ name: 'format', enum: ['csv', 'json'], required: false })
  @ApiQuery({ name: 'repositoryId', required: false })
  @ApiQuery({ name: 'scanId', required: false })
  @ApiQuery({ name: 'severity', isArray: true, required: false })
  @ApiQuery({ name: 'status', isArray: true, required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportFindings(
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'csv',
    @Query('repositoryId') repositoryId?: string,
    @Query('scanId') scanId?: string,
    @Query('severity') severity?: string | string[],
    @Query('status') status?: string | string[],
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    this.validateFormat(format);

    const result = await this.exportService.exportFindings(tenantId, {
      format,
      filters: {
        repositoryId,
        scanId,
        severity: this.toArray(severity),
        status: this.toArray(status),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get('scans')
  @RequirePermission(Permission.SCANS_READ)
  @ApiOperation({ summary: 'Export scans data' })
  @ApiQuery({ name: 'format', enum: ['csv', 'json'], required: false })
  @ApiQuery({ name: 'repositoryId', required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportScans(
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'csv',
    @Query('repositoryId') repositoryId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    this.validateFormat(format);

    const result = await this.exportService.exportScans(tenantId, {
      format,
      filters: {
        repositoryId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get('repositories')
  @RequirePermission(Permission.REPOS_READ)
  @ApiOperation({ summary: 'Export repositories data' })
  @ApiQuery({ name: 'format', enum: ['csv', 'json'], required: false })
  async exportRepositories(
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'csv',
  ): Promise<void> {
    this.validateFormat(format);

    const result = await this.exportService.exportRepositories(tenantId, { format });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get('audit-logs')
  @RequirePermission(Permission.AUDIT_LOGS_READ)
  @ApiOperation({ summary: 'Export audit logs' })
  @ApiQuery({ name: 'format', enum: ['csv', 'json'], required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async exportAuditLogs(
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
    @Query('format') format: ExportFormat = 'csv',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<void> {
    this.validateFormat(format);

    const result = await this.exportService.exportAuditLogs(tenantId, {
      format,
      filters: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  @Get('scans/:scanId/sarif')
  @RequirePermission(Permission.SCANS_READ)
  @ApiOperation({ summary: 'Export scan results in SARIF format' })
  async exportScanSarif(
    @CurrentTenant() tenantId: string,
    @Param('scanId') scanId: string,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.exportService.exportScanSarif(tenantId, scanId);

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.data);
  }

  private validateFormat(format: string): void {
    if (!['csv', 'json'].includes(format)) {
      throw new BadRequestException('Format must be csv or json');
    }
  }

  private toArray(value: string | string[] | undefined): string[] | undefined {
    if (!value) return undefined;
    return Array.isArray(value) ? value : [value];
  }
}
