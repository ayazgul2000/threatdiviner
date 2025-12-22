import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, CurrentUser } from '../libs/auth';
import { ReportingService } from './reporting.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('scan/:scanId/pdf')
  async getScanReport(
    @Param('scanId') scanId: string,
    @CurrentUser() user: { tenantId: string },
    @Res() res: Response,
  ) {
    const result = await this.reportingService.generateScanReport(user.tenantId, scanId);

    // If we have a buffer (no MinIO), serve directly
    if (result.buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="scan-${scanId}.pdf"`);
      res.send(result.buffer);
      return;
    }

    // Otherwise redirect to presigned URL
    res.redirect(result.url);
  }

  @Get('repository/:repositoryId/pdf')
  async getRepositoryReport(
    @Param('repositoryId') repositoryId: string,
    @CurrentUser() user: { tenantId: string },
    @Res() res: Response,
  ) {
    const result = await this.reportingService.generateRepositoryReport(user.tenantId, repositoryId);

    if (result.buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="repository-${repositoryId}.pdf"`);
      res.send(result.buffer);
      return;
    }

    res.redirect(result.url);
  }

  @Get('summary/pdf')
  async getTenantSummaryReport(
    @CurrentUser() user: { tenantId: string },
    @Res() res: Response,
  ) {
    const result = await this.reportingService.generateTenantSummaryReport(user.tenantId);

    if (result.buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="security-summary.pdf"`);
      res.send(result.buffer);
      return;
    }

    res.redirect(result.url);
  }
}
