import { Module } from '@nestjs/common';
import { ShapeMappingsController } from './shape-mappings/shape-mappings.controller';
import { ShapeMappingsService } from './shape-mappings/shape-mappings.service';
import { CanonicalRisksController } from './canonical-risks/canonical-risks.controller';
import { CanonicalRisksService } from './canonical-risks/canonical-risks.service';
import { ComplianceFrameworksController } from './compliance-frameworks/compliance-frameworks.controller';
import { ComplianceFrameworksService } from './compliance-frameworks/compliance-frameworks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShapeMappingsController, CanonicalRisksController, ComplianceFrameworksController],
  providers: [ShapeMappingsService, CanonicalRisksService, ComplianceFrameworksService],
  exports: [ShapeMappingsService, CanonicalRisksService, ComplianceFrameworksService],
})
export class AdminModule {}
