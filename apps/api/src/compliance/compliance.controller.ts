import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { ComplianceService } from './compliance.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Get('frameworks')
  @ApiOperation({ summary: 'List available compliance frameworks' })
  getFrameworks() {
    return this.complianceService.getFrameworks();
  }

  @Get('score')
  @ApiOperation({ summary: 'Get tenant-wide compliance score' })
  @ApiQuery({ name: 'framework', required: false, description: 'Filter by framework ID' })
  async getTenantScore(
    @CurrentUser() user: AuthenticatedUser,
    @Query('framework') frameworkId?: string,
  ) {
    return this.complianceService.getTenantComplianceScore(user.tenantId, frameworkId);
  }

  @Get('score/:repositoryId')
  @ApiOperation({ summary: 'Get compliance score for a repository' })
  @ApiQuery({ name: 'framework', required: false, description: 'Filter by framework ID' })
  async getRepositoryScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('repositoryId') repositoryId: string,
    @Query('framework') frameworkId?: string,
  ) {
    return this.complianceService.getRepositoryComplianceScore(
      user.tenantId,
      repositoryId,
      frameworkId,
    );
  }

  @Get('violations/:frameworkId')
  @ApiOperation({ summary: 'Get control violations for a framework' })
  @ApiQuery({ name: 'control', required: false, description: 'Filter by control ID' })
  @ApiQuery({ name: 'repository', required: false, description: 'Filter by repository ID' })
  async getViolations(
    @CurrentUser() user: AuthenticatedUser,
    @Param('frameworkId') frameworkId: string,
    @Query('control') controlId?: string,
    @Query('repository') repositoryId?: string,
  ) {
    return this.complianceService.getControlViolations(
      user.tenantId,
      frameworkId,
      controlId,
      repositoryId,
    );
  }

  @Get('trend/:frameworkId')
  @ApiOperation({ summary: 'Get compliance trend over time' })
  @ApiQuery({ name: 'days', required: false, description: 'Number of days (default: 30)' })
  @ApiQuery({ name: 'repository', required: false, description: 'Filter by repository ID' })
  async getComplianceTrend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('frameworkId') frameworkId: string,
    @Query('days') days?: string,
    @Query('repository') repositoryId?: string,
  ) {
    return this.complianceService.getComplianceTrend(
      user.tenantId,
      frameworkId,
      days ? parseInt(days, 10) : 30,
      repositoryId,
    );
  }

  @Get('report/:frameworkId')
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiQuery({ name: 'repository', required: false, description: 'Filter by repository ID' })
  async generateReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('frameworkId') frameworkId: string,
    @Query('repository') repositoryId?: string,
  ) {
    return this.complianceService.generateComplianceReport(
      user.tenantId,
      frameworkId,
      repositoryId,
    );
  }
}
