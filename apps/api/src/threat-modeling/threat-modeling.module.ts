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
import { DiagramSyncService } from './services/diagram-sync.service';
import { ThreatModelComplianceService } from './services/threat-model-compliance.service';
import { UserWizardService } from './services/user-wizard.service';
import { ImportService } from './services/import.service';
import { AiCreationService } from './services/ai-creation.service';
import { TemplateService } from './services/template.service';
import { OpenApiParser } from './parsers/openapi.parser';
import { TerraformParser } from './parsers/terraform.parser';
import { PackageJsonParser } from './parsers/package-json.parser';
import { AnalysisProcessor } from '../queue/processors';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ReportingModule } from '../reporting/reporting.module';
import { AiModule } from '../ai/ai.module';
import { ScmModule } from '../scm/scm.module';

@Module({
  imports: [PrismaModule, ConfigModule, QueueModule, ReportingModule, AiModule, ScmModule],
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
    DiagramSyncService,
    ThreatModelComplianceService,
    UserWizardService,
    ImportService,
    AiCreationService,
    TemplateService,
    OpenApiParser,
    TerraformParser,
    PackageJsonParser,
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
    DiagramSyncService,
    ThreatModelComplianceService,
  ],
})
export class ThreatModelingModule {}
