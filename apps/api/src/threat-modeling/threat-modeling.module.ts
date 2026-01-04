import { Module } from '@nestjs/common';
import { ThreatModelingController } from './threat-modeling.controller';
import { ThreatModelingService } from './threat-modeling.service';
import { StrideAnalyzer } from './analyzers/stride.analyzer';
import { EnterpriseStrideAnalyzer } from './analyzers/enterprise-stride.analyzer';
import { ThreatModelDiagramService } from './services/diagram.service';
import { ThreatModelExportService } from './services/export.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ThreatModelingController],
  providers: [
    ThreatModelingService,
    StrideAnalyzer,
    EnterpriseStrideAnalyzer,
    ThreatModelDiagramService,
    ThreatModelExportService,
  ],
  exports: [
    ThreatModelingService,
    StrideAnalyzer,
    EnterpriseStrideAnalyzer,
    ThreatModelDiagramService,
    ThreatModelExportService,
  ],
})
export class ThreatModelingModule {}
