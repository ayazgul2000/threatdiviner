// apps/api/src/reporting/reporting.module.ts

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReportingController } from './reporting.controller';
import { EnhancedReportService } from './services/enhanced-report.service';
import { ThreatModelReportService } from './services/threat-model-report.service';
import { ReportDataService } from './services/report-data.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [ReportingController],
  providers: [
    EnhancedReportService,
    ThreatModelReportService,
    ReportDataService,
  ],
  exports: [EnhancedReportService, ThreatModelReportService, ReportDataService],
})
export class ReportingModule {}
