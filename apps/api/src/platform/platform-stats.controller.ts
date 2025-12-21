import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
import { PlatformStatsService } from './platform-stats.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

@Controller('platform')
@UseGuards(PlatformAdminGuard)
export class PlatformStatsController {
  constructor(private readonly statsService: PlatformStatsService) {}

  @Get('stats')
  async getStats() {
    return this.statsService.getStats();
  }

  @Get('health')
  async getHealth() {
    return this.statsService.getHealth();
  }
}
