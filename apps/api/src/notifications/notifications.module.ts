import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SlackService } from './slack/slack.service';
import { EmailService } from './email/email.service';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SlackService, EmailService],
  exports: [NotificationsService, EmailService],
})
export class NotificationsModule {}
