import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SbomController } from './sbom.controller';
import { SbomService } from './sbom.service';
import { SbomCveMatcherService } from './sbom-cve-matcher.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 5,
    }),
  ],
  controllers: [SbomController],
  providers: [SbomService, SbomCveMatcherService],
  exports: [SbomService, SbomCveMatcherService],
})
export class SbomModule {}
