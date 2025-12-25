import { Controller, Get, Post, Param, Query, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { RagService } from './rag.service';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  // ==================
  // Status Endpoints
  // ==================

  @Get('status')
  async getStatus() {
    return this.ragService.getIndexStatus();
  }

  // ==================
  // Indexing Endpoints
  // ==================

  @Post('index/all')
  async indexAll() {
    return this.ragService.indexAll();
  }

  @Post('index/cwe')
  async indexCweRemediations() {
    return this.ragService.indexAllCweRemediations();
  }

  @Post('index/attack')
  async indexAttackTechniques() {
    return this.ragService.indexAllAttackTechniques();
  }

  @Post('index/compliance')
  async indexComplianceControls() {
    return this.ragService.indexAllComplianceControls();
  }

  // ==================
  // Search Endpoints
  // ==================

  @Get('search/remediation')
  async searchRemediations(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
    }

    return this.ragService.searchRemediations(
      query,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  @Get('search/attack')
  async searchAttackTechniques(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
    }

    return this.ragService.searchAttackTechniques(
      query,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  @Get('search/compliance')
  async searchComplianceControls(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      throw new HttpException('Query is required', HttpStatus.BAD_REQUEST);
    }

    return this.ragService.searchComplianceControls(
      query,
      limit ? parseInt(limit, 10) : 5,
    );
  }

  // ==================
  // Remediation Generation
  // ==================

  @Get('remediation/:findingId')
  async getRemediationForFinding(@Param('findingId') findingId: string) {
    const result = await this.ragService.generateRemediationForFinding(findingId);
    if (!result) {
      throw new HttpException('Finding not found or remediation could not be generated', HttpStatus.NOT_FOUND);
    }
    return result;
  }
}
