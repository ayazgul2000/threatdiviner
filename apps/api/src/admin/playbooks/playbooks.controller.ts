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
import { PlaybooksService } from './playbooks.service';
import {
  CreatePlaybookDto,
  UpdatePlaybookDto,
  CreateStepDto,
  UpdateStepDto,
  ReorderStepsDto,
  CreateIacSnippetDto,
  UpdateIacSnippetDto,
  PlaybookListQuery,
  BulkImportPlaybooksDto,
} from './dto/playbook.dto';
import { PlatformAdminGuard } from '../../platform/guards/platform-admin.guard';

@Controller('admin/playbooks')
@UseGuards(PlatformAdminGuard)
export class PlaybooksController {
  constructor(private readonly service: PlaybooksService) {}

  // ============================================
  // Playbook Endpoints
  // ============================================

  @Get()
  async listPlaybooks(@Query() query: PlaybookListQuery) {
    return this.service.listPlaybooks(query);
  }

  @Get('options/effort')
  async getEffortOptions() {
    const options = await this.service.getEffortOptions();
    return { options };
  }

  @Get('options/roles')
  async getRoleOptions() {
    const options = await this.service.getRoleOptions();
    return { options };
  }

  @Get('options/platforms')
  async getPlatformOptions() {
    const options = await this.service.getPlatformOptions();
    return { options };
  }

  @Get(':id')
  async getPlaybook(@Param('id') id: string) {
    const playbook = await this.service.getPlaybookById(id);
    return { playbook };
  }

  @Get(':id/stats')
  async getPlaybookStats(@Param('id') id: string) {
    const stats = await this.service.getPlaybookStats(id);
    return { stats };
  }

  @Post()
  async createPlaybook(@Body() dto: CreatePlaybookDto) {
    const playbook = await this.service.createPlaybook(dto);
    return { playbook };
  }

  @Put(':id')
  async updatePlaybook(
    @Param('id') id: string,
    @Body() dto: UpdatePlaybookDto,
  ) {
    const playbook = await this.service.updatePlaybook(id, dto);
    return { playbook };
  }

  @Delete(':id')
  async deletePlaybook(@Param('id') id: string) {
    return this.service.deletePlaybook(id);
  }

  @Post(':id/submit')
  async submitForReview(@Param('id') id: string) {
    const playbook = await this.service.submitForReview(id);
    return { playbook };
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string) {
    // In a real implementation, extract isSuperAdmin from the request user
    const isSuperAdmin = true; // TODO: Get from auth context
    const playbook = await this.service.approve(id, isSuperAdmin);
    return { playbook };
  }

  @Post('import')
  async bulkImport(@Body() dto: BulkImportPlaybooksDto) {
    return this.service.bulkImport(dto);
  }

  // ============================================
  // Step Endpoints
  // ============================================

  @Get(':playbookId/steps')
  async listSteps(@Param('playbookId') playbookId: string) {
    const steps = await this.service.listSteps(playbookId);
    return { steps };
  }

  @Post(':playbookId/steps')
  async createStep(
    @Param('playbookId') playbookId: string,
    @Body() dto: CreateStepDto,
  ) {
    const step = await this.service.createStep(playbookId, dto);
    return { step };
  }

  @Put(':playbookId/steps/:stepId')
  async updateStep(
    @Param('playbookId') playbookId: string,
    @Param('stepId') stepId: string,
    @Body() dto: UpdateStepDto,
  ) {
    const step = await this.service.updateStep(playbookId, stepId, dto);
    return { step };
  }

  @Delete(':playbookId/steps/:stepId')
  async deleteStep(
    @Param('playbookId') playbookId: string,
    @Param('stepId') stepId: string,
  ) {
    return this.service.deleteStep(playbookId, stepId);
  }

  @Post(':playbookId/steps/reorder')
  async reorderSteps(
    @Param('playbookId') playbookId: string,
    @Body() dto: ReorderStepsDto,
  ) {
    const steps = await this.service.reorderSteps(playbookId, dto);
    return { steps };
  }

  // ============================================
  // IaC Snippet Endpoints
  // ============================================

  @Get(':playbookId/iac-snippets')
  async listIacSnippets(@Param('playbookId') playbookId: string) {
    const snippets = await this.service.listIacSnippets(playbookId);
    return { snippets };
  }

  @Post(':playbookId/iac-snippets')
  async createIacSnippet(
    @Param('playbookId') playbookId: string,
    @Body() dto: CreateIacSnippetDto,
  ) {
    const snippet = await this.service.createIacSnippet(playbookId, dto);
    return { snippet };
  }

  @Put(':playbookId/iac-snippets/:snippetId')
  async updateIacSnippet(
    @Param('playbookId') playbookId: string,
    @Param('snippetId') snippetId: string,
    @Body() dto: UpdateIacSnippetDto,
  ) {
    const snippet = await this.service.updateIacSnippet(
      playbookId,
      snippetId,
      dto,
    );
    return { snippet };
  }

  @Delete(':playbookId/iac-snippets/:snippetId')
  async deleteIacSnippet(
    @Param('playbookId') playbookId: string,
    @Param('snippetId') snippetId: string,
  ) {
    return this.service.deleteIacSnippet(playbookId, snippetId);
  }
}
