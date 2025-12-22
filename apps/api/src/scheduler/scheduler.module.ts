import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { ScheduleController } from './schedule.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { ScmModule } from '../scm/scm.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthModule } from '../libs/auth';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    forwardRef(() => ScmModule),
    NotificationsModule,
    AuthModule,
  ],
  controllers: [ScheduleController],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
