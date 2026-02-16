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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PlatformAdminGuard } from '../../platform/guards/platform-admin.guard';
import { WizardService } from './wizard.service';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  CreateOptionDto,
  UpdateOptionDto,
  BulkImportDto,
  ReorderQuestionsDto,
  TestFlowDto,
} from './dto/wizard.dto';

@Controller('admin/wizard')
@UseGuards(PlatformAdminGuard)
export class WizardController {
  constructor(private readonly wizardService: WizardService) {}

  // ============================================
  // Question Endpoints
  // ============================================

  @Get('questions')
  async listQuestions(
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('isEntryPoint') isEntryPoint?: string
  ): Promise<{
    questions: Array<{
      id: string;
      questionId: string;
      text: string;
      helpText: string | null;
      type: string;
      orderIndex: number;
      isEntryPoint: boolean;
      isTerminal: boolean;
      conditions: unknown;
      status: string;
      createdAt: Date;
      updatedAt: Date;
      _count: { options: number };
    }>;
    total: number;
  }> {
    return this.wizardService.listQuestions({
      search,
      type,
      status,
      isEntryPoint: isEntryPoint === 'true' ? true : isEntryPoint === 'false' ? false : undefined,
    });
  }

  @Get('questions/:id')
  async getQuestion(@Param('id') id: string): Promise<{
    id: string;
    questionId: string;
    text: string;
    helpText: string | null;
    type: string;
    orderIndex: number;
    isEntryPoint: boolean;
    isTerminal: boolean;
    conditions: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    options: Array<{
      id: string;
      questionId: string;
      value: string;
      label: string;
      description: string | null;
      iconUrl: string | null;
      nextQuestionId: string | null;
      triggers: unknown;
      createdAt: Date;
    }>;
  }> {
    return this.wizardService.getQuestionById(id);
  }

  @Post('questions')
  async createQuestion(@Body() dto: CreateQuestionDto): Promise<{
    id: string;
    questionId: string;
    text: string;
    helpText: string | null;
    type: string;
    orderIndex: number;
    isEntryPoint: boolean;
    isTerminal: boolean;
    conditions: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return this.wizardService.createQuestion(dto);
  }

  @Put('questions/:id')
  async updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto
  ): Promise<{
    id: string;
    questionId: string;
    text: string;
    helpText: string | null;
    type: string;
    orderIndex: number;
    isEntryPoint: boolean;
    isTerminal: boolean;
    conditions: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return this.wizardService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteQuestion(@Param('id') id: string): Promise<void> {
    return this.wizardService.deleteQuestion(id);
  }

  @Post('questions/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderQuestions(@Body() dto: ReorderQuestionsDto): Promise<void> {
    return this.wizardService.reorderQuestions(dto);
  }

  @Post('questions/:id/submit-for-review')
  async submitForReview(@Param('id') id: string): Promise<{
    id: string;
    questionId: string;
    status: string;
  }> {
    return this.wizardService.submitForReview(id);
  }

  @Post('questions/:id/approve')
  async approve(@Param('id') id: string): Promise<{
    id: string;
    questionId: string;
    status: string;
  }> {
    return this.wizardService.approve(id);
  }

  // ============================================
  // Option Endpoints
  // ============================================

  @Get('questions/:questionId/options')
  async listOptions(@Param('questionId') questionId: string): Promise<
    Array<{
      id: string;
      questionId: string;
      value: string;
      label: string;
      description: string | null;
      iconUrl: string | null;
      nextQuestionId: string | null;
      triggers: unknown;
      createdAt: Date;
    }>
  > {
    return this.wizardService.listOptions(questionId);
  }

  @Get('options/:optionId')
  async getOption(@Param('optionId') optionId: string): Promise<{
    id: string;
    questionId: string;
    value: string;
    label: string;
    description: string | null;
    iconUrl: string | null;
    nextQuestionId: string | null;
    triggers: unknown;
    createdAt: Date;
  }> {
    return this.wizardService.getOptionById(optionId);
  }

  @Post('questions/:questionId/options')
  async createOption(
    @Param('questionId') questionId: string,
    @Body() dto: CreateOptionDto
  ): Promise<{
    id: string;
    questionId: string;
    value: string;
    label: string;
    description: string | null;
    iconUrl: string | null;
    nextQuestionId: string | null;
    triggers: unknown;
    createdAt: Date;
  }> {
    return this.wizardService.createOption(questionId, dto);
  }

  @Put('options/:optionId')
  async updateOption(
    @Param('optionId') optionId: string,
    @Body() dto: UpdateOptionDto
  ): Promise<{
    id: string;
    questionId: string;
    value: string;
    label: string;
    description: string | null;
    iconUrl: string | null;
    nextQuestionId: string | null;
    triggers: unknown;
    createdAt: Date;
  }> {
    return this.wizardService.updateOption(optionId, dto);
  }

  @Delete('options/:optionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOption(@Param('optionId') optionId: string): Promise<void> {
    return this.wizardService.deleteOption(optionId);
  }

  // ============================================
  // Decision Tree & Test Flow
  // ============================================

  @Get('decision-tree')
  async getDecisionTree(): Promise<{
    questions: Array<{
      id: string;
      questionId: string;
      text: string;
      type: string;
      orderIndex: number;
      isEntryPoint: boolean;
      isTerminal: boolean;
      status: string;
      options: Array<{
        id: string;
        value: string;
        label: string;
        nextQuestionId: string | null;
      }>;
    }>;
    edges: Array<{
      from: string;
      to: string;
      label: string;
    }>;
  }> {
    return this.wizardService.getDecisionTree();
  }

  @Post('test-flow')
  async testFlow(@Body() dto: TestFlowDto): Promise<{
    globalProperties: Record<string, string>;
    nodes: Array<{ name: string; ref: string; technology?: string }>;
    boundaries: Array<{ name: string; ref: string; type: string }>;
    links: Array<{ sourceRef: string; targetRef: string; protocol?: string }>;
    path: Array<{ questionId: string; selectedValue: string; questionText: string }>;
  }> {
    return this.wizardService.testFlow(dto);
  }

  // ============================================
  // Bulk Import & Stats
  // ============================================

  @Post('bulk-import')
  async bulkImport(@Body() dto: BulkImportDto): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    return this.wizardService.bulkImport(dto);
  }

  @Get('stats')
  async getStats(): Promise<{
    totalQuestions: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    entryPoints: number;
    terminalQuestions: number;
    orphanedQuestions: number;
  }> {
    return this.wizardService.getStats();
  }

  // ============================================
  // Metadata Endpoints
  // ============================================

  @Get('question-types')
  async getQuestionTypes(): Promise<string[]> {
    return this.wizardService.getQuestionTypes();
  }

  @Get('condition-operators')
  async getConditionOperators(): Promise<string[]> {
    return this.wizardService.getConditionOperators();
  }
}
