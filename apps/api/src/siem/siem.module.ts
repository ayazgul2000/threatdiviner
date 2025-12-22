import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SiemController } from './siem.controller';
import { SiemService } from './siem.service';
import { OpenSearchProvider } from './opensearch.provider';
import { AlertRulesService } from './alert-rules.service';

@Module({
  imports: [ConfigModule, PrismaModule, NotificationsModule],
  controllers: [SiemController],
  providers: [SiemService, OpenSearchProvider, AlertRulesService],
  exports: [SiemService, OpenSearchProvider],
})
export class SiemModule {}
