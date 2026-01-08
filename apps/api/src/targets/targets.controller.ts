import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators';
import { PenTestService } from '../pentest/pentest.service';
import {
  CreateTargetDto,
  UpdateTargetDto,
  TargetQueryDto,
  StartTargetScanDto,
} from '../pentest/dto';

interface AuthUser {
  tenantId: string;
  userId: string;
  email: string;
}

@Controller('targets')
@UseGuards(JwtAuthGuard)
export class TargetsController {
  constructor(private readonly penTestService: PenTestService) {}

  /**
   * GET /targets - List all targets for the tenant
   */
  @Get()
  async getTargets(
    @CurrentUser() user: AuthUser,
    @Query() query: TargetQueryDto,
  ) {
    return this.penTestService.getTargets(user.tenantId, query);
  }

  /**
   * POST /targets - Create a new target
   */
  @Post()
  async createTarget(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateTargetDto,
  ) {
    return this.penTestService.createTarget(user.tenantId, dto);
  }

  /**
   * GET /targets/:id - Get target details
   */
  @Get(':id')
  async getTarget(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.penTestService.getTarget(user.tenantId, id);
  }

  /**
   * PATCH /targets/:id - Update target
   */
  @Patch(':id')
  async updateTarget(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateTargetDto,
  ) {
    return this.penTestService.updateTarget(user.tenantId, id, dto);
  }

  /**
   * DELETE /targets/:id - Delete target
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteTarget(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.penTestService.deleteTarget(user.tenantId, id);
  }

  /**
   * POST /targets/:id/scan - Start a scan for the target
   */
  @Post(':id/scan')
  async startScan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: StartTargetScanDto,
  ) {
    return this.penTestService.startTargetScan(user.tenantId, id, dto);
  }

  /**
   * GET /targets/:id/scans - List scan history for target
   */
  @Get(':id/scans')
  async getTargetScans(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
  ) {
    return this.penTestService.getTargetScans(user.tenantId, id);
  }

  /**
   * GET /targets/:id/scans/:scanId - Get specific scan details
   */
  @Get(':id/scans/:scanId')
  async getTargetScan(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('scanId') scanId: string,
  ) {
    return this.penTestService.getTargetScan(user.tenantId, id, scanId);
  }
}
