import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { VulnDbService } from './vulndb.service';
import { VulnDbController } from './vulndb.controller';
import { FindingEnrichmentService } from './finding-enrichment.service';
import { SlaService } from './sla.service';
import {
  NvdSyncService,
  CweSyncService,
  EpssSyncService,
  KevSyncService,
  OwaspSyncService,
  CweMappingSyncService,
  AttackSyncService,
} from './sync';
import { VulnDbSchedulerService } from './vulndb-scheduler.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    VulnDbService,
    FindingEnrichmentService,
    SlaService,
    NvdSyncService,
    CweSyncService,
    EpssSyncService,
    KevSyncService,
    OwaspSyncService,
    CweMappingSyncService,
    AttackSyncService,
    VulnDbSchedulerService,
  ],
  controllers: [VulnDbController],
  exports: [VulnDbService, FindingEnrichmentService, SlaService],
})
export class VulnDbModule {}
