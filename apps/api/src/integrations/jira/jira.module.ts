import { Module } from '@nestjs/common';
import { JiraController } from './jira.controller';
import { JiraService } from './jira.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScmModule } from '../../scm/scm.module';
import { AuthModule } from '../../libs/auth';

@Module({
  imports: [PrismaModule, ScmModule, AuthModule],
  controllers: [JiraController],
  providers: [JiraService],
  exports: [JiraService],
})
export class JiraModule {}
