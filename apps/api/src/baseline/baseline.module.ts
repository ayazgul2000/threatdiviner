import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../libs/auth';
import { BaselineController } from './baseline.controller';
import { BaselineService } from './baseline.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BaselineController],
  providers: [BaselineService],
  exports: [BaselineService],
})
export class BaselineModule {}
