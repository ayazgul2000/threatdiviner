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
import { FeedsController } from './feeds/feeds.controller';
import { FeedsService } from './feeds/feeds.service';
import { SuggestionsController } from './suggestions/suggestions.controller';
import { SuggestionsService } from './suggestions/suggestions.service';
import { TemplatesController } from './templates/templates.controller';
import { TemplatesService } from './templates/templates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [PrismaModule, PlatformModule],
  controllers: [
    ShapeMappingsController,
    CanonicalRisksController,
    ComplianceFrameworksController,
    PlaybooksController,
    WizardController,
    FeedsController,
    SuggestionsController,
    TemplatesController,
  ],
  providers: [
    ShapeMappingsService,
    CanonicalRisksService,
    ComplianceFrameworksService,
    PlaybooksService,
    WizardService,
    FeedsService,
    SuggestionsService,
    TemplatesService,
  ],
  exports: [
    ShapeMappingsService,
    CanonicalRisksService,
    ComplianceFrameworksService,
    PlaybooksService,
    WizardService,
    FeedsService,
    SuggestionsService,
    TemplatesService,
  ],
})
export class AdminModule {}
