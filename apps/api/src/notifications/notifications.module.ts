import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { SlackService } from './slack/slack.service';
import { EmailService } from './email/email.service';
import { TeamsService } from './teams/teams.service';
import { DiscordService } from './discord/discord.service';
import { PagerDutyService } from './pagerduty/pagerduty.service';
import { OpsGenieService } from './opsgenie/opsgenie.service';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    SlackService,
    EmailService,
    TeamsService,
    DiscordService,
    PagerDutyService,
    OpsGenieService,
  ],
  exports: [
    NotificationsService,
    EmailService,
    TeamsService,
    DiscordService,
    PagerDutyService,
    OpsGenieService,
  ],
})
export class NotificationsModule {}
