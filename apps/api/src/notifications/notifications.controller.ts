import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService, UpdateNotificationConfigDto } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('config')
  async getConfig(@CurrentUser() user: { tenantId: string }) {
    const config = await this.notificationsService.getConfig(user.tenantId);
    return config || {
      slackEnabled: false,
      slackWebhookUrl: null,
      slackChannel: null,
      notifyOnScanStart: false,
      notifyOnScanComplete: true,
      notifyOnCritical: true,
      notifyOnHigh: false,
    };
  }

  @Put('config')
  async updateConfig(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: UpdateNotificationConfigDto,
  ) {
    return this.notificationsService.updateConfig(user.tenantId, dto);
  }

  @Post('test-slack')
  async testSlack(@CurrentUser() user: { tenantId: string }) {
    return this.notificationsService.testSlack(user.tenantId);
  }
}
