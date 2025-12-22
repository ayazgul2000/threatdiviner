import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString } from 'class-validator';
import { JwtAuthGuard, RequirePermission, CurrentTenant, CurrentUser } from '../libs/auth';
import { Permission } from '../libs/auth/permissions/permissions.enum';
import { BaselineService } from './baseline.service';

class CreateBaselineDto {
  @IsOptional()
  @IsString()
  findingId?: string;

  @IsOptional()
  @IsString()
  fingerprint?: string;

  @IsString()
  repositoryId!: string;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

class ImportBaselineDto {
  @IsString()
  scanId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Baseline')
@ApiBearerAuth()
@Controller('baselines')
@UseGuards(JwtAuthGuard)
export class BaselineController {
  constructor(private readonly baselineService: BaselineService) {}

  @Get()
  @RequirePermission(Permission.BASELINES_READ)
  @ApiOperation({ summary: 'List baselines' })
  @ApiQuery({ name: 'repositoryId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listBaselines(
    @CurrentTenant() tenantId: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.baselineService.listBaselines(
      tenantId,
      repositoryId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post()
  @RequirePermission(Permission.BASELINES_WRITE)
  @ApiOperation({ summary: 'Add finding to baseline' })
  async addToBaseline(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateBaselineDto,
  ) {
    return this.baselineService.addToBaseline(tenantId, user.id, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Post('import')
  @RequirePermission(Permission.BASELINES_WRITE)
  @ApiOperation({ summary: 'Import baseline from scan' })
  async importFromScan(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
    @Body() dto: ImportBaselineDto,
  ) {
    return this.baselineService.importBaselineFromScan(
      tenantId,
      user.id,
      dto.scanId,
      dto.reason,
    );
  }

  @Get('compare/:scanId')
  @RequirePermission(Permission.BASELINES_READ)
  @ApiOperation({ summary: 'Compare scan findings against baseline' })
  async compareScan(
    @CurrentTenant() tenantId: string,
    @Param('scanId') scanId: string,
  ) {
    return this.baselineService.compareScanToBaseline(tenantId, scanId);
  }

  @Delete(':id')
  @RequirePermission(Permission.BASELINES_WRITE)
  @ApiOperation({ summary: 'Remove finding from baseline' })
  async removeFromBaseline(
    @CurrentTenant() tenantId: string,
    @Param('id') baselineId: string,
  ) {
    await this.baselineService.removeFromBaseline(tenantId, baselineId);
    return { success: true };
  }
}
