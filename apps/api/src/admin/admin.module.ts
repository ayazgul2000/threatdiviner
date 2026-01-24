import { Module } from '@nestjs/common';
import { ShapeMappingsController } from './shape-mappings/shape-mappings.controller';
import { ShapeMappingsService } from './shape-mappings/shape-mappings.service';
import { CanonicalRisksController } from './canonical-risks/canonical-risks.controller';
import { CanonicalRisksService } from './canonical-risks/canonical-risks.service';
import { ComplianceFrameworksController } from './compliance-frameworks/compliance-frameworks.controller';
import { ComplianceFrameworksService } from './compliance-frameworks/compliance-frameworks.service';
import { PlaybooksController } from './playbooks/playbooks.controller';
import { PlaybooksService } from './playbooks/playbooks.service';
import { WizardController } from './wizard/wizard.controller';
import { WizardService } from './wizard/wizard.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    ShapeMappingsController,
    CanonicalRisksController,
    ComplianceFrameworksController,
    PlaybooksController,
    WizardController,
  ],
  providers: [
    ShapeMappingsService,
    CanonicalRisksService,
    ComplianceFrameworksService,
    PlaybooksService,
    WizardService,
  ],
  exports: [
    ShapeMappingsService,
    CanonicalRisksService,
    ComplianceFrameworksService,
    PlaybooksService,
    WizardService,
  ],
})
export class AdminModule {}
