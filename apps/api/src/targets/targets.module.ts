import { Module } from '@nestjs/common';
import { TargetsController } from './targets.controller';
import { PenTestModule } from '../pentest/pentest.module';

@Module({
  imports: [PenTestModule],
  controllers: [TargetsController],
})
export class TargetsModule {}
