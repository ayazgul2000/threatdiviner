import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController, IntegrationsController],
  providers: [SettingsService, IntegrationsService],
  exports: [SettingsService, IntegrationsService],
})
export class SettingsModule {}
