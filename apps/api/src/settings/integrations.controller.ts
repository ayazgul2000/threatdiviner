import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, CurrentUser, Roles, RolesGuard } from '../libs/auth';
import { IntegrationsService } from './integrations.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

export type IntegrationType =
  | 'github'
  | 'gitlab'
  | 'bitbucket'
  | 'azure-devops'
  | 'slack'
  | 'pagerduty'
  | 'webhook'
  | 'jira';

export type IntegrationStatus = 'connected' | 'error' | 'pending' | 'disabled';

interface CreateIntegrationDto {
  type: IntegrationType;
  name: string;
  config: Record<string, string>;
}

interface UpdateIntegrationDto {
  name?: string;
  config?: Record<string, string>;
  status?: IntegrationStatus;
}

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  private readonly logger = new Logger(IntegrationsController.name);

  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all integrations for tenant' })
  async listIntegrations(@CurrentUser() user: AuthenticatedUser) {
    const integrations = await this.integrationsService.listIntegrations(user.tenantId);
    return { integrations };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get integration details' })
  async getIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.integrationsService.getIntegration(user.tenantId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create new integration' })
  async createIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIntegrationDto,
  ) {
    this.logger.log(`Creating ${dto.type} integration for tenant ${user.tenantId}`);
    return this.integrationsService.createIntegration(user.tenantId, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update integration' })
  async updateIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.integrationsService.updateIntegration(user.tenantId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete integration' })
  async deleteIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.integrationsService.deleteIntegration(user.tenantId, id);
    return { message: 'Integration deleted successfully' };
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test integration connection' })
  async testIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.integrationsService.testIntegration(user.tenantId, id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger integration sync' })
  async syncIntegration(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.integrationsService.syncIntegration(user.tenantId, id);
  }
}
