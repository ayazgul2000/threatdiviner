import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { PdfGenerator } from './generators/pdf.generator';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [ReportingController],
  providers: [ReportingService, PdfGenerator],
  exports: [ReportingService],
})
export class ReportingModule {}
