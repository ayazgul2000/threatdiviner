import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../libs/auth';
import { SchedulerService } from './scheduler.service';
import { UpdateScheduleDto } from './dto/schedule-config.dto';

@Controller('scm/repositories')
export class ScheduleController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get(':repositoryId/schedule')
  @UseGuards(JwtAuthGuard)
  async getScheduleConfig(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.schedulerService.getScheduleConfig(user.tenantId, repositoryId);
  }

  @Put(':repositoryId/schedule')
  @UseGuards(JwtAuthGuard)
  async updateScheduleConfig(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.schedulerService.updateScheduleConfig(user.tenantId, repositoryId, dto);
  }

  @Post(':repositoryId/schedule/run-now')
  @UseGuards(JwtAuthGuard)
  async runScheduledScanNow(
    @CurrentUser() user: { tenantId: string },
    @Param('repositoryId') repositoryId: string,
  ) {
    const scanId = await this.schedulerService.triggerImmediateScan(user.tenantId, repositoryId);
    return { scanId };
  }
}
