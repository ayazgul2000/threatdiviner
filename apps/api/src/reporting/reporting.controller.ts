// apps/api/src/reporting/reporting.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { EnhancedReportService } from './services/enhanced-report.service';
import { ThreatModelReportService } from './services/threat-model-report.service';
import { CreateReportDto, ReportType, ReportFormat } from './dto/report.dto';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(
    private readonly enhancedReportService: EnhancedReportService,
    private readonly threatModelReportService: ThreatModelReportService,
  ) {}

  @Post()
  async generateReport(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReportDto,
    @Res() res: Response,
  ) {
    const report = await this.enhancedReportService.generateReport(user.tenantId, user.id, dto);

    if (report.buffer) {
      const contentTypes: Record<string, string> = {
        pdf: 'application/pdf',
        json: 'application/json',
        csv: 'text/csv',
        html: 'text/html',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };

      res.setHeader('Content-Type', contentTypes[report.format] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${dto.name || 'report'}.${report.format}"`);
      res.setHeader('Content-Length', report.size);
      return res.status(HttpStatus.OK).send(report.buffer);
    }

    return res.status(HttpStatus.OK).json({
      id: report.id,
      url: report.url,
      size: report.size,
      format: report.format,
    });
  }

  @Get('scan/:scanId')
  async getScanReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('scanId') scanId: string,
    @Res() res: Response,
    @Query('format') format: ReportFormat = ReportFormat.PDF,
    @Query('includeTrends') includeTrends = 'false',
    @Query('includeAi') includeAi = 'false',
  ) {
    const dto: CreateReportDto = {
      name: `scan-report-${scanId}`,
      type: ReportType.SCAN,
      format,
      scanId,
      includeTrends: includeTrends === 'true',
      includeAiAnalysis: includeAi === 'true',
    };

    return this.generateReport(user, dto, res);
  }

  @Get('threat-model/:id/excel')
  async getThreatModelExcel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') threatModelId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.threatModelReportService.generateExcelReport(user.tenantId, threatModelId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="threat-model-${threatModelId}.xlsx"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(HttpStatus.OK).send(buffer);
  }

  @Get('threat-model/:id/csv')
  async getThreatModelCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') threatModelId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.threatModelReportService.generateCsvReport(user.tenantId, threatModelId);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="threat-model-${threatModelId}.csv"`);
    res.setHeader('Content-Length', buffer.length);
    return res.status(HttpStatus.OK).send(buffer);
  }

  @Get('threat-model/:id/data')
  async getThreatModelData(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') threatModelId: string,
  ) {
    return this.threatModelReportService.getThreatModelReportData(user.tenantId, threatModelId);
  }

  @Get('threat-model/:id/diagram')
  async getThreatModelDiagram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') threatModelId: string,
    @Query('format') format: 'mermaid' | 'svg' | 'plantuml' = 'mermaid',
    @Res() res: Response,
  ) {
    const diagram = await this.threatModelReportService.generateDiagram(user.tenantId, threatModelId, format);

    const contentTypes: Record<string, string> = {
      mermaid: 'text/plain',
      svg: 'image/svg+xml',
      plantuml: 'text/plain',
    };

    res.setHeader('Content-Type', contentTypes[format] || 'text/plain');
    return res.status(HttpStatus.OK).send(diagram);
  }
}
