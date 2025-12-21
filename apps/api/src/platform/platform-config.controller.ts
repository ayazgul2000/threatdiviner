import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

interface UpdateConfigDto {
  aiProvider?: string;
  aiModel?: string;
  defaultPlan?: string;
  defaultMaxUsers?: number;
  defaultMaxRepositories?: number;
  maintenanceMode?: boolean;
}

interface UpdateAiKeyDto {
  apiKey: string;
}

@Controller('platform/config')
@UseGuards(PlatformAdminGuard)
export class PlatformConfigController {
  constructor(private readonly configService: PlatformConfigService) {}

  @Get()
  async get() {
    return this.configService.get();
  }

  @Put()
  async update(@Body() dto: UpdateConfigDto) {
    return this.configService.update(dto);
  }

  @Put('ai-key')
  async updateAiKey(@Body() dto: UpdateAiKeyDto) {
    return this.configService.updateAiKey(dto.apiKey);
  }
}
