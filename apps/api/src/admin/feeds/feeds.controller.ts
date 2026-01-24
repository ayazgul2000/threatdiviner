import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../libs/auth/guards/jwt-auth.guard';
import { FeedsService } from './feeds.service';
import {
  CreateFeedConfigDto,
  UpdateFeedConfigDto,
  FeedConfigListQuery,
  FeedSyncRunListQuery,
  SetScheduleDto,
  TestConnectionDto,
} from './dto/feed.dto';

@Controller('admin/feeds')
@UseGuards(JwtAuthGuard)
export class FeedsController {
  constructor(private readonly feedsService: FeedsService) {}

  // ============================================
  // Feed Config Endpoints
  // ============================================

  @Get()
  async listFeedConfigs(@Query() query: FeedConfigListQuery) {
    return this.feedsService.listFeedConfigs(query);
  }

  @Get('stats')
  async getStats() {
    const stats = await this.feedsService.getStats();
    return { stats };
  }

  @Get('schedule-presets')
  async getSchedulePresets() {
    const presets = await this.feedsService.getSchedulePresets();
    return { presets };
  }

  @Get(':id')
  async getFeedConfig(@Param('id') id: string) {
    const feed = await this.feedsService.getFeedConfigById(id);
    return { feed };
  }

  @Get('by-feed-id/:feedId')
  async getFeedConfigByFeedId(@Param('feedId') feedId: string) {
    const feed = await this.feedsService.getFeedConfigByFeedId(feedId);
    return { feed };
  }

  @Post()
  async createFeedConfig(@Body() dto: CreateFeedConfigDto) {
    const feed = await this.feedsService.createFeedConfig(dto);
    return { feed };
  }

  @Put(':id')
  async updateFeedConfig(
    @Param('id') id: string,
    @Body() dto: UpdateFeedConfigDto,
  ) {
    const feed = await this.feedsService.updateFeedConfig(id, dto);
    return { feed };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFeedConfig(@Param('id') id: string) {
    await this.feedsService.deleteFeedConfig(id);
  }

  @Post(':id/schedule')
  async setSchedule(
    @Param('id') id: string,
    @Body() dto: SetScheduleDto,
  ) {
    const feed = await this.feedsService.setSchedule(id, dto);
    return { feed };
  }

  @Post('test-connection')
  async testConnection(@Body() dto: TestConnectionDto) {
    const result = await this.feedsService.testConnection(dto.url);
    return result;
  }

  // ============================================
  // Sync Endpoints
  // ============================================

  @Post(':id/sync')
  async triggerSync(@Param('id') id: string) {
    return this.feedsService.triggerSync(id);
  }

  @Post('sync-all')
  async triggerSyncAll() {
    return this.feedsService.triggerSyncAll();
  }

  // ============================================
  // Sync Run Endpoints
  // ============================================

  @Get(':feedConfigId/sync-runs')
  async listSyncRuns(
    @Param('feedConfigId') feedConfigId: string,
    @Query() query: FeedSyncRunListQuery,
  ) {
    return this.feedsService.listSyncRuns(feedConfigId, query);
  }

  @Get('sync-runs/:syncRunId')
  async getSyncRun(@Param('syncRunId') syncRunId: string) {
    const syncRun = await this.feedsService.getSyncRunById(syncRunId);
    return { syncRun };
  }
}
