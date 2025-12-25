import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { PipelineService, CreateGateDto, UpdateGateDto } from './pipeline.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('pipeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pipeline')
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) {}

  @Get('gates')
  @ApiOperation({ summary: 'Get pipeline gates configuration' })
  @ApiQuery({ name: 'repositoryId', required: false })
  async getGates(
    @CurrentUser() user: AuthenticatedUser,
    @Query('repositoryId') repositoryId?: string,
  ) {
    return this.pipelineService.getGates(user.tenantId, repositoryId);
  }

  @Get('gates/:stageId')
  @ApiOperation({ summary: 'Get a specific gate configuration' })
  async getGate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stageId') stageId: string,
  ) {
    return this.pipelineService.getGate(user.tenantId, stageId);
  }

  @Post('gates')
  @ApiOperation({ summary: 'Create or update a pipeline gate' })
  async createGate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateGateDto,
  ) {
    return this.pipelineService.createGate(user.tenantId, dto);
  }

  @Put('gates/:stageId')
  @ApiOperation({ summary: 'Update a pipeline gate' })
  async updateGate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateGateDto,
  ) {
    return this.pipelineService.updateGate(user.tenantId, stageId, dto);
  }

  @Delete('gates/:stageId')
  @ApiOperation({ summary: 'Delete a pipeline gate' })
  async deleteGate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('stageId') stageId: string,
  ) {
    return this.pipelineService.deleteGate(user.tenantId, stageId);
  }
}
