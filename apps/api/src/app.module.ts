import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ScmModule } from './scm/scm.module';
import { CustomBullModule } from './queue/custom-bull.module';
import { QueueModule } from './queue/queue.module';
import { ScannersModule } from './scanners/scanners.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportingModule } from './reporting/reporting.module';
import { PlatformModule } from './platform/platform.module';
import { TeamModule } from './team/team.module';
import { AuditModule } from './audit/audit.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { JiraModule } from './integrations/jira/jira.module';
import { CustomThrottlerGuard } from './common/throttle/throttle.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: 1000, // 1 second
            limit: configService.get('THROTTLE_SHORT_LIMIT', 10),
          },
          {
            name: 'medium',
            ttl: 60000, // 1 minute
            limit: configService.get('THROTTLE_MEDIUM_LIMIT', 100),
          },
          {
            name: 'long',
            ttl: 3600000, // 1 hour
            limit: configService.get('THROTTLE_LONG_LIMIT', 1000),
          },
        ],
      }),
    }),
    CustomBullModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    ScmModule,
    QueueModule,
    ScannersModule,
    AiModule,
    NotificationsModule,
    ReportingModule,
    PlatformModule,
    TeamModule,
    SchedulerModule,
    JiraModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule {}
