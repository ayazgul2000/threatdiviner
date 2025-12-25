import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { EnvironmentsService } from './environments.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';

interface AuthRequest {
  user: {
    tenantId: string;
    userId: string;
  };
}

@Controller('environments')
@UseGuards(JwtAuthGuard)
export class EnvironmentsController {
  constructor(private readonly service: EnvironmentsService) {}

  // ===== ENVIRONMENTS =====

  @Get()
  async listEnvironments(@Req() req: AuthRequest) {
    return this.service.listEnvironments(req.user.tenantId);
  }

  @Get('summary')
  async getEnvironmentsSummary(@Req() req: AuthRequest) {
    return this.service.getEnvironmentsSummary(req.user.tenantId);
  }

  @Get(':id')
  async getEnvironment(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getEnvironment(req.user.tenantId, id);
  }

  @Post()
  async createEnvironment(
    @Req() req: AuthRequest,
    @Body() body: {
      name: string;
      type: string;
      description?: string;
      kubeConfig?: string;
      kubeContext?: string;
      namespace?: string;
      cloudProvider?: string;
      cloudRegion?: string;
      cloudProject?: string;
    },
  ) {
    return this.service.createEnvironment(req.user.tenantId, body);
  }

  @Put(':id')
  async updateEnvironment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      type?: string;
      description?: string;
      kubeConfig?: string;
      kubeContext?: string;
      namespace?: string;
      cloudProvider?: string;
      cloudRegion?: string;
      cloudProject?: string;
      isActive?: boolean;
    },
  ) {
    return this.service.updateEnvironment(req.user.tenantId, id, body);
  }

  @Delete(':id')
  async deleteEnvironment(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteEnvironment(req.user.tenantId, id);
  }

  // ===== DEPLOYMENTS =====

  @Get('deployments/all')
  async listAllDeployments(
    @Req() req: AuthRequest,
    @Query('environmentId') environmentId?: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listDeployments(req.user.tenantId, {
      environmentId,
      repositoryId,
      status,
    });
  }

  @Get(':environmentId/deployments')
  async listDeployments(
    @Req() req: AuthRequest,
    @Param('environmentId') environmentId: string,
  ) {
    return this.service.listDeployments(req.user.tenantId, { environmentId });
  }

  @Get('deployments/:id')
  async getDeployment(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.getDeployment(req.user.tenantId, id);
  }

  @Post(':environmentId/deployments')
  async createDeployment(
    @Req() req: AuthRequest,
    @Param('environmentId') environmentId: string,
    @Body() body: {
      name: string;
      repositoryId?: string;
      version?: string;
      image?: string;
      imageDigest?: string;
      replicas?: number;
      status?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
      exposedPorts?: number[];
      hasIngress?: boolean;
      ingressHosts?: string[];
    },
  ) {
    return this.service.createDeployment(req.user.tenantId, environmentId, body);
  }

  @Put('deployments/:id')
  async updateDeployment(
    @Req() req: AuthRequest,
    @Param('id') id: string,
    @Body() body: {
      version?: string;
      image?: string;
      imageDigest?: string;
      replicas?: number;
      status?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
      exposedPorts?: number[];
      hasIngress?: boolean;
      ingressHosts?: string[];
    },
  ) {
    return this.service.updateDeployment(req.user.tenantId, id, body);
  }

  @Delete('deployments/:id')
  async deleteDeployment(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.deleteDeployment(req.user.tenantId, id);
  }
}
