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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { CspmService, CloudProvider } from './cspm.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('cspm')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cspm')
export class CspmController {
  constructor(private readonly cspmService: CspmService) {}

  @Get('accounts')
  @ApiOperation({ summary: 'List all cloud accounts' })
  async listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.cspmService.getAccounts(user.tenantId);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get cloud account details' })
  async getAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.cspmService.getAccount(user.tenantId, id);
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create cloud account connection' })
  async createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      provider: CloudProvider;
      name: string;
      accountId: string;
      credentials: Record<string, string>;
      regions?: string[];
    },
  ) {
    return this.cspmService.createAccount(user.tenantId, body);
  }

  @Put('accounts/:id')
  @ApiOperation({ summary: 'Update cloud account' })
  async updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      credentials?: Record<string, string>;
      regions?: string[];
      enabled?: boolean;
    },
  ) {
    return this.cspmService.updateAccount(user.tenantId, id, body);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Delete cloud account' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.cspmService.deleteAccount(user.tenantId, id);
    return { message: 'Cloud account deleted successfully' };
  }

  @Post('accounts/:id/scan')
  @ApiOperation({ summary: 'Run CSPM scan on cloud account' })
  async runScan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.cspmService.runScan(user.tenantId, id);
  }

  @Get('findings')
  @ApiOperation({ summary: 'List CSPM findings' })
  async listFindings(
    @CurrentUser() user: AuthenticatedUser,
    @Query('accountId') accountId?: string,
    @Query('provider') provider?: CloudProvider,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('service') service?: string,
  ) {
    return this.cspmService.getFindings(user.tenantId, {
      accountId,
      provider,
      severity: severity ? severity.split(',') : undefined,
      status: status ? status.split(',') : undefined,
      service,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get CSPM summary statistics' })
  async getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.cspmService.getSummary(user.tenantId);
  }

  @Put('findings/:id/status')
  @ApiOperation({ summary: 'Update finding status' })
  async updateFindingStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { status: 'open' | 'resolved' | 'suppressed' },
  ) {
    return this.cspmService.updateFindingStatus(user.tenantId, id, body.status);
  }
}
