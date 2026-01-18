import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { QueueModule } from '../queue/queue.module';
import { ApiKeysModule } from '../apikeys/apikeys.module';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';
import { CliAuthGuard } from './cli-auth.guard';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ScmModule,
    QueueModule,
    ApiKeysModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET', 'threatdiviner-dev-secret-change-in-production'),
      }),
    }),
  ],
  controllers: [CliController],
  providers: [CliService, CliAuthGuard],
  exports: [CliService],
})
export class CliModule {}
