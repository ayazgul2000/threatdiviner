import { Module } from '@nestjs/common';
import { FixController } from './fix.controller';
import { FixService } from './fix.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ScmModule } from '../scm/scm.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, ScmModule, AiModule],
  controllers: [FixController],
  providers: [FixService],
  exports: [FixService],
})
export class FixModule {}
