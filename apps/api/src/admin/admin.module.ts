import { Module } from '@nestjs/common';
import { ShapeMappingsController } from './shape-mappings/shape-mappings.controller';
import { ShapeMappingsService } from './shape-mappings/shape-mappings.service';
import { CanonicalRisksController } from './canonical-risks/canonical-risks.controller';
import { CanonicalRisksService } from './canonical-risks/canonical-risks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShapeMappingsController, CanonicalRisksController],
  providers: [ShapeMappingsService, CanonicalRisksService],
  exports: [ShapeMappingsService, CanonicalRisksService],
})
export class AdminModule {}
