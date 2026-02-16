import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { PdfGenerator } from './generators/pdf.generator';
import { CompliancePdfGenerator } from './generators/compliance-pdf.generator';
import { ComplianceReportGenerator } from './generators/compliance-report.generator';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ReportingController],
  providers: [ReportingService, PdfGenerator, CompliancePdfGenerator, ComplianceReportGenerator],
  exports: [ReportingService, ComplianceReportGenerator],
})
export class ReportingModule {}
