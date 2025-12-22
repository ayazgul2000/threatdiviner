import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '../../libs/auth';
import { JiraService } from './jira.service';
import { UpdateJiraConfigDto, CreateJiraIssueDto, LinkJiraIssueDto } from './dto';

@Controller('integrations/jira')
@UseGuards(JwtAuthGuard)
export class JiraController {
  constructor(private readonly jiraService: JiraService) {}

  @Get('config')
  async getConfig(@CurrentUser() user: { tenantId: string }) {
    return this.jiraService.getConfig(user.tenantId);
  }

  @Put('config')
  async updateConfig(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: UpdateJiraConfigDto,
  ) {
    return this.jiraService.updateConfig(user.tenantId, dto);
  }

  @Post('test')
  async testConnection(@CurrentUser() user: { tenantId: string }) {
    return this.jiraService.testConnection(user.tenantId);
  }

  @Get('projects')
  async getProjects(@CurrentUser() user: { tenantId: string }) {
    return this.jiraService.getProjects(user.tenantId);
  }

  @Get('issue-types')
  async getIssueTypes(
    @CurrentUser() user: { tenantId: string },
    @Query('projectKey') projectKey: string,
  ) {
    return this.jiraService.getIssueTypes(user.tenantId, projectKey);
  }

  @Post('issues')
  async createIssue(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: CreateJiraIssueDto,
  ) {
    return this.jiraService.createIssue(
      user.tenantId,
      dto.findingId,
      dto.projectKey,
      dto.issueType,
      dto.additionalDescription,
    );
  }

  @Post('link')
  async linkIssue(
    @CurrentUser() user: { tenantId: string },
    @Body() dto: LinkJiraIssueDto,
  ) {
    await this.jiraService.linkFindingToIssue(
      user.tenantId,
      dto.findingId,
      dto.issueKey,
    );
    return { success: true };
  }

  @Get('issues/:findingId')
  async getLinkedIssue(
    @CurrentUser() user: { tenantId: string },
    @Param('findingId') findingId: string,
  ) {
    return this.jiraService.getLinkedIssue(user.tenantId, findingId);
  }
}
