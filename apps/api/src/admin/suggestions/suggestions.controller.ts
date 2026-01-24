import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../libs/auth/guards/jwt-auth.guard';
import { SuggestionsService } from './suggestions.service';
import {
  SuggestionListQuery,
  ApproveSuggestionDto,
  RejectSuggestionDto,
  EditSuggestionDto,
  BulkActionDto,
  PromotionListQuery,
  SubmitForReviewDto,
  ReviewDecisionDto,
  PromoteDto,
  RollbackDto,
  TestShapeMappingDto,
  TestDeduplicationDto,
  TestPlaybookDto,
  AuditLogQuery,
} from './dto/suggestion.dto';

interface RequestWithUser extends Request {
  user: { id: string; name?: string };
}

@Controller('admin/suggestions')
@UseGuards(JwtAuthGuard)
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  // ============================================
  // AI Suggestion Queue Endpoints
  // ============================================

  @Get('queue')
  async listSuggestions(@Query() query: SuggestionListQuery) {
    return this.suggestionsService.listSuggestions(query);
  }

  @Get('queue/stats')
  async getSuggestionStats() {
    const stats = await this.suggestionsService.getSuggestionStats();
    return { stats };
  }

  @Get('queue/:id')
  async getSuggestion(@Param('id') id: string) {
    const suggestion = await this.suggestionsService.getSuggestionById(id);
    return { suggestion };
  }

  @Post('queue/:id/approve')
  async approveSuggestion(
    @Param('id') id: string,
    @Body() dto: ApproveSuggestionDto,
    @Request() req: RequestWithUser,
  ) {
    const suggestion = await this.suggestionsService.approveSuggestion(id, dto, req.user.id);
    return { suggestion };
  }

  @Post('queue/:id/reject')
  async rejectSuggestion(
    @Param('id') id: string,
    @Body() dto: RejectSuggestionDto,
    @Request() req: RequestWithUser,
  ) {
    const suggestion = await this.suggestionsService.rejectSuggestion(id, dto, req.user.id);
    return { suggestion };
  }

  @Put('queue/:id/edit')
  async editSuggestion(
    @Param('id') id: string,
    @Body() dto: EditSuggestionDto,
    @Request() req: RequestWithUser,
  ) {
    const suggestion = await this.suggestionsService.editSuggestion(id, dto, req.user.id);
    return { suggestion };
  }

  @Post('queue/bulk')
  async bulkAction(
    @Body() dto: BulkActionDto,
    @Request() req: RequestWithUser,
  ) {
    return this.suggestionsService.bulkAction(dto, req.user.id);
  }

  // ============================================
  // Promotion Workflow Endpoints
  // ============================================

  @Get('promotions')
  async listPromotionItems(@Query() query: PromotionListQuery) {
    return this.suggestionsService.listPromotionItems(query);
  }

  @Get('promotions/stats')
  async getPromotionStats() {
    const stats = await this.suggestionsService.getPromotionStats();
    return { stats };
  }

  @Get('promotions/:id')
  async getPromotionItem(@Param('id') id: string) {
    const item = await this.suggestionsService.getPromotionItemById(id);
    return { item };
  }

  @Post('promotions/submit')
  async submitForReview(
    @Body() dto: SubmitForReviewDto,
    @Request() req: RequestWithUser,
  ) {
    const item = await this.suggestionsService.submitForReview(dto, req.user.id);
    return { item };
  }

  @Post('promotions/:id/review')
  async reviewDecision(
    @Param('id') id: string,
    @Body() dto: ReviewDecisionDto,
    @Request() req: RequestWithUser,
  ) {
    const item = await this.suggestionsService.reviewDecision(id, dto, req.user.id);
    return { item };
  }

  @Post('promotions/promote')
  async promote(
    @Body() dto: PromoteDto,
    @Request() req: RequestWithUser,
  ) {
    return this.suggestionsService.promote(dto, req.user.id);
  }

  @Post('promotions/rollback')
  async rollback(
    @Body() dto: RollbackDto,
    @Request() req: RequestWithUser,
  ) {
    const item = await this.suggestionsService.rollback(dto, req.user.id);
    return { item };
  }

  // ============================================
  // Sandbox Testing Endpoints
  // ============================================

  @Post('sandbox/test-shapes')
  async testShapeMappings(@Body() dto: TestShapeMappingDto) {
    return this.suggestionsService.testShapeMappings(dto);
  }

  @Post('sandbox/test-deduplication')
  async testDeduplication(@Body() dto: TestDeduplicationDto) {
    return this.suggestionsService.testDeduplication(dto);
  }

  @Post('sandbox/test-playbook')
  async testPlaybook(@Body() dto: TestPlaybookDto) {
    return this.suggestionsService.testPlaybook(dto);
  }

  // ============================================
  // Audit Log Endpoints
  // ============================================

  @Get('audit-logs')
  async listAuditLogs(@Query() query: AuditLogQuery) {
    return this.suggestionsService.listAuditLogs(query);
  }
}
