import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';
import { JwtAuthGuard, CurrentTenant, CurrentUser } from '../libs/auth';
import { ApiKeysService, API_KEY_SCOPES } from './apikeys.service';

// Note: API keys are user-owned, no special permission required beyond being authenticated

class CreateApiKeyDto {
  @IsString()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  scopes!: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get('scopes')
  @ApiOperation({ summary: 'List available API key scopes' })
  listScopes() {
    return { scopes: API_KEY_SCOPES };
  }

  @Get()
  @ApiOperation({ summary: 'List user API keys' })
  async listApiKeys(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.apiKeysService.listApiKeys(tenantId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create new API key' })
  async createApiKey(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateApiKeyDto,
  ) {
    const result = await this.apiKeysService.createApiKey(tenantId, user.id, {
      name: dto.name,
      scopes: dto.scopes,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    return {
      ...result.apiKey,
      key: result.rawKey, // Only shown once
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: 'Rotate an API key' })
  async rotateApiKey(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') keyId: string,
  ) {
    const result = await this.apiKeysService.rotateApiKey(tenantId, user.id, keyId);

    return {
      ...result.apiKey,
      key: result.rawKey,
      warning: 'Store this key securely. It will not be shown again.',
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an API key' })
  async deleteApiKey(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Param('id') keyId: string,
  ) {
    await this.apiKeysService.deleteApiKey(tenantId, user.id, keyId);
    return { success: true };
  }
}
