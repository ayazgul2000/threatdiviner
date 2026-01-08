import { Module } from '@nestjs/common';
import { ScanGateway } from './scan.gateway';
import { DurationEstimateService } from './duration-estimate.service';
import { ScansController } from './scans.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScansController],
  providers: [ScanGateway, DurationEstimateService],
  exports: [ScanGateway, DurationEstimateService],
})
export class ScansModule {}
