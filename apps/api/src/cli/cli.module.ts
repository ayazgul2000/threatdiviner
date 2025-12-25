import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CliController } from './cli.controller';
import { CliService } from './cli.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [CliController],
  providers: [CliService],
  exports: [CliService],
})
export class CliModule {}
