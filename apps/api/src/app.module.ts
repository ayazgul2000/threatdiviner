import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ScmModule } from './scm/scm.module';
import { CustomBullModule } from './queue/custom-bull.module';
import { QueueModule } from './queue/queue.module';
import { ScannersModule } from './scanners/scanners.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    CustomBullModule.forRoot(),
    PrismaModule,
    AuthModule,
    ScmModule,
    QueueModule,
    ScannersModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
