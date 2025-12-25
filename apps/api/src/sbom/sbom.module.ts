import { Module } from '@nestjs/common';
import { SbomController } from './sbom.controller';
import { SbomService } from './sbom.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SbomController],
  providers: [SbomService],
  exports: [SbomService],
})
export class SbomModule {}
