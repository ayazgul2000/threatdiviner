import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService, TriageRequest, TriageResult } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

interface TriageFindingDto {
  codeContext?: string;
  repositoryContext?: {
    name: string;
    language: string;
    framework?: string;
  };
}

interface BatchTriageDto {
  findingIds: string[];
}

interface TriageResponse {
  id: string;
  aiAnalysis: string | null;
  aiConfidence: number | null;
  aiSeverity: string | null;
  aiFalsePositive: boolean | null;
  aiExploitability: string | null;
  aiRemediation: string | null;
  aiTriagedAt: Date | null;
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async getStatus(): Promise<{ available: boolean; model: string }> {
    const available = await this.aiService.isAvailable();
    return {
      available,
      model: available ? 'claude-sonnet-4-20250514' : 'none',
    };
  }

  @Post('triage/:findingId')
  async triageFinding(
    @Param('findingId') findingId: string,
    @Body() dto: TriageFindingDto,
    @CurrentUser() user: { tenantId: string },
  ): Promise<TriageResponse> {
    // Find the finding
    const finding = await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        tenantId: user.tenantId,
      },
      include: {
        scan: {
          include: {
            repository: true,
          },
        },
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    // Build triage request
    const request: TriageRequest = {
      finding: {
        id: finding.id,
        title: finding.title,
        description: finding.description || '',
        severity: finding.severity,
        ruleId: finding.ruleId,
        filePath: finding.filePath,
        startLine: finding.startLine || 0,
        snippet: finding.snippet || undefined,
        cweId: finding.cweId || undefined,
      },
      codeContext: dto.codeContext,
      repositoryContext: dto.repositoryContext || {
        name: finding.scan.repository.name,
        language: finding.scan.repository.language || 'unknown',
      },
    };

    // Run AI triage
    const result = await this.aiService.triageFinding(request);

    if (!result) {
      throw new BadRequestException('AI triage failed - check API key configuration');
    }

    // Update finding with AI triage results
    const updated = await this.prisma.finding.update({
      where: { id: finding.id },
      data: {
        aiAnalysis: result.analysis,
        aiConfidence: result.confidence,
        aiSeverity: result.suggestedSeverity,
        aiFalsePositive: result.isLikelyFalsePositive,
        aiExploitability: result.exploitability,
        aiRemediation: result.remediation,
        aiTriagedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      aiAnalysis: updated.aiAnalysis,
      aiConfidence: updated.aiConfidence,
      aiSeverity: updated.aiSeverity,
      aiFalsePositive: updated.aiFalsePositive,
      aiExploitability: updated.aiExploitability,
      aiRemediation: updated.aiRemediation,
      aiTriagedAt: updated.aiTriagedAt,
    };
  }

  @Post('triage/batch')
  async batchTriage(
    @Body() dto: BatchTriageDto,
    @CurrentUser() user: { tenantId: string },
  ): Promise<{ processed: number; results: TriageResponse[] }> {
    if (!dto.findingIds || dto.findingIds.length === 0) {
      throw new BadRequestException('findingIds array is required');
    }

    if (dto.findingIds.length > 50) {
      throw new BadRequestException('Maximum 50 findings per batch');
    }

    // Find all findings
    const findings = await this.prisma.finding.findMany({
      where: {
        id: { in: dto.findingIds },
        tenantId: user.tenantId,
      },
      include: {
        scan: {
          include: {
            repository: true,
          },
        },
      },
    });

    if (findings.length === 0) {
      throw new NotFoundException('No findings found');
    }

    // Build triage requests
    const requests: TriageRequest[] = findings.map((f) => ({
      finding: {
        id: f.id,
        title: f.title,
        description: f.description || '',
        severity: f.severity,
        ruleId: f.ruleId,
        filePath: f.filePath,
        startLine: f.startLine || 0,
        snippet: f.snippet || undefined,
        cweId: f.cweId || undefined,
      },
      repositoryContext: {
        name: f.scan.repository.name,
        language: f.scan.repository.language || 'unknown',
      },
    }));

    // Run batch triage
    const triageResults = await this.aiService.batchTriageFindings(requests);

    // Update findings with results
    const results: TriageResponse[] = [];
    for (const finding of findings) {
      const result = triageResults.get(finding.id);
      if (result) {
        const updated = await this.prisma.finding.update({
          where: { id: finding.id },
          data: {
            aiAnalysis: result.analysis,
            aiConfidence: result.confidence,
            aiSeverity: result.suggestedSeverity,
            aiFalsePositive: result.isLikelyFalsePositive,
            aiExploitability: result.exploitability,
            aiRemediation: result.remediation,
            aiTriagedAt: new Date(),
          },
        });

        results.push({
          id: updated.id,
          aiAnalysis: updated.aiAnalysis,
          aiConfidence: updated.aiConfidence,
          aiSeverity: updated.aiSeverity,
          aiFalsePositive: updated.aiFalsePositive,
          aiExploitability: updated.aiExploitability,
          aiRemediation: updated.aiRemediation,
          aiTriagedAt: updated.aiTriagedAt,
        });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  @Get('triage/:findingId')
  async getTriageResult(
    @Param('findingId') findingId: string,
    @CurrentUser() user: { tenantId: string },
  ): Promise<TriageResponse> {
    const finding = await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        aiAnalysis: true,
        aiConfidence: true,
        aiSeverity: true,
        aiFalsePositive: true,
        aiExploitability: true,
        aiRemediation: true,
        aiTriagedAt: true,
      },
    });

    if (!finding) {
      throw new NotFoundException('Finding not found');
    }

    return finding;
  }
}
