import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { QueueModule } from '../queue/queue.module';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';

@Module({
  imports: [ConfigModule, PrismaModule, ScmModule, QueueModule],
  controllers: [CliController],
  providers: [CliService],
  exports: [CliService],
})
export class CliModule {}
