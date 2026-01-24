import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThreatModelingController } from './threat-modeling.controller';
import { ThreatModelingService } from './threat-modeling.service';
import { StrideAnalyzer } from './analyzers/stride.analyzer';
import { EnterpriseStrideAnalyzer } from './analyzers/enterprise-stride.analyzer';
import { ThreatModelDiagramService } from './services/diagram.service';
import { ThreatModelExportService } from './services/export.service';
import { ThreagileService } from './services/threagile.service';
import { YamlGeneratorService } from './services/yaml-generator.service';
import { RiskParserService } from './services/risk-parser.service';
import { GapDetectionService } from './services/gap-detection.service';
import { AnalysisProcessor } from '../queue/processors';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, ConfigModule, QueueModule],
  controllers: [ThreatModelingController],
  providers: [
    ThreatModelingService,
    StrideAnalyzer,
    EnterpriseStrideAnalyzer,
    ThreatModelDiagramService,
    ThreatModelExportService,
    ThreagileService,
    YamlGeneratorService,
    RiskParserService,
    GapDetectionService,
    AnalysisProcessor,
  ],
  exports: [
    ThreatModelingService,
    StrideAnalyzer,
    EnterpriseStrideAnalyzer,
    ThreatModelDiagramService,
    ThreatModelExportService,
    ThreagileService,
    YamlGeneratorService,
    RiskParserService,
    GapDetectionService,
  ],
})
export class ThreatModelingModule {}
