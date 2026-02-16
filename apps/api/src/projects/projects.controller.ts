import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects for tenant' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project by ID' })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.findOne(user.tenantId, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get project statistics' })
  getStats(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.getStats(user.tenantId, id);
  }

  @Get(':id/hierarchy')
  @ApiOperation({ summary: 'Get project with full hierarchy (repos, threat models, environments, gates)' })
  getHierarchy(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.getProjectHierarchy(user.tenantId, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() data: { name: string; description?: string }) {
    return this.projectsService.create(user.tenantId, data);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update project' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() data: { name?: string; description?: string },
  ) {
    return this.projectsService.update(user.tenantId, id, data);
  }

  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive project' })
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.archive(user.tenantId, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project' })
  delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.projectsService.delete(user.tenantId, id);
  }

  @Post(':id/repositories/:repositoryId')
  @ApiOperation({ summary: 'Link repository to project' })
  linkRepository(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.projectsService.linkRepository(user.tenantId, projectId, repositoryId);
  }

  @Delete(':id/repositories/:repositoryId')
  @ApiOperation({ summary: 'Unlink repository from project' })
  unlinkRepository(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('repositoryId') repositoryId: string,
  ) {
    return this.projectsService.unlinkRepository(user.tenantId, projectId, repositoryId);
  }

  // ========== SCM Access Management ==========

  @Get(':id/scm-access')
  @ApiOperation({ summary: 'Get SCM connections available to project' })
  getScmAccess(@CurrentUser() user: AuthenticatedUser, @Param('id') projectId: string) {
    return this.projectsService.getScmAccess(user.tenantId, projectId);
  }

  @Post(':id/scm-access')
  @ApiOperation({ summary: 'Grant project access to an SCM connection' })
  grantScmAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Body() data: { connectionId: string },
  ) {
    return this.projectsService.grantScmAccess(user.tenantId, projectId, data.connectionId);
  }

  @Delete(':id/scm-access/:connectionId')
  @ApiOperation({ summary: 'Revoke project access to an SCM connection' })
  revokeScmAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.projectsService.revokeScmAccess(user.tenantId, projectId, connectionId);
  }

  @Get(':id/scm-access/:connectionId/repos')
  @ApiOperation({ summary: 'Get allowed repositories for project from connection' })
  getRepoAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('connectionId') connectionId: string,
  ) {
    return this.projectsService.getRepoAccess(user.tenantId, projectId, connectionId);
  }

  @Post(':id/scm-access/:connectionId/repos')
  @ApiOperation({ summary: 'Grant project access to specific repositories' })
  grantRepoAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('connectionId') connectionId: string,
    @Body() data: { repos: { externalRepoId: string; fullName: string }[] },
  ) {
    return this.projectsService.grantRepoAccess(user.tenantId, projectId, connectionId, data.repos);
  }

  @Delete(':id/scm-access/:connectionId/repos')
  @ApiOperation({ summary: 'Revoke project access to specific repositories' })
  revokeRepoAccess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') projectId: string,
    @Param('connectionId') connectionId: string,
    @Body() data: { externalRepoIds: string[] },
  ) {
    return this.projectsService.revokeRepoAccess(user.tenantId, projectId, connectionId, data.externalRepoIds);
  }
}
