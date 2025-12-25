import { Module } from '@nestjs/common';
import { ThreatModelingController } from './threat-modeling.controller';
import { ThreatModelingService } from './threat-modeling.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ThreatModelingController],
  providers: [ThreatModelingService],
  exports: [ThreatModelingService],
})
export class ThreatModelingModule {}
