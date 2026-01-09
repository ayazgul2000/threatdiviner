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
import { JwtAuthGuard } from '../libs/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../libs/auth/decorators/current-user.decorator';
import { SmartTriageService } from './services/smart-triage.service';
import { FixGeneratorService } from './services/fix-generator.service';
import { ThreatGeneratorService } from './services/threat-generator.service';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedUser {
  id: string;
  tenantId: string;
}

interface TriageFindingDto {
  codeContext?: string;
  repositoryContext?: { name: string; language: string; framework?: string };
}

interface GenerateFixDto {
  vulnerableCode: string;
  language: string;
  framework?: string;
}

interface GenerateThreatsDto {
  projectName: string;
  components: { name: string; type: string; technology?: string }[];
  dataFlows: { source: string; target: string; dataType?: string; encrypted?: boolean }[];
  trustBoundaries?: string[];
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly triageService: SmartTriageService,
    private readonly fixService: FixGeneratorService,
    private readonly threatService: ThreatGeneratorService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('triage/:findingId')
  async triageFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('findingId') findingId: string,
    @Body() dto: TriageFindingDto,
  ) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, tenantId: user.tenantId },
    });

    if (!finding) throw new NotFoundException('Finding not found');

    const result = await this.triageService.triageFinding({
      id: finding.id,
      title: finding.title,
      description: finding.description || '',
      severity: finding.severity,
      scanner: finding.scanner,
      ruleId: finding.ruleId || '',
      filePath: finding.filePath || '',
      lineNumber: finding.startLine || undefined,
      codeSnippet: dto.codeContext || finding.snippet || undefined,
      cweId: finding.cweId || undefined,
    }, dto.repositoryContext);

    // Update finding with triage result
    await this.prisma.finding.update({
      where: { id: findingId },
      data: {
        status: result.status === 'confirmed' ? 'confirmed' : result.status === 'false_positive' ? 'false_positive' : 'needs_review',
        aiAnalysis: result.reasoning,
        aiConfidence: result.confidence === 'high' ? 0.9 : result.confidence === 'medium' ? 0.7 : 0.5,
        aiSeverity: result.adjustedSeverity,
        aiFalsePositive: result.status === 'false_positive',
        aiTriagedAt: new Date(),
      },
    });

    return result;
  }

  @Post('fix/:findingId')
  async generateFix(
    @CurrentUser() user: AuthenticatedUser,
    @Param('findingId') findingId: string,
    @Body() dto: GenerateFixDto,
  ) {
    const finding = await this.prisma.finding.findFirst({
      where: { id: findingId, tenantId: user.tenantId },
    });

    if (!finding) throw new NotFoundException('Finding not found');

    return this.fixService.generateFix({
      findingId: finding.id,
      title: finding.title,
      description: finding.description || '',
      cweId: finding.cweId || undefined,
      vulnerableCode: dto.vulnerableCode,
      filePath: finding.filePath || '',
      language: dto.language,
      framework: dto.framework,
    });
  }

  @Post('threats/generate')
  async generateThreats(
    @CurrentUser() _user: AuthenticatedUser,
    @Body() dto: GenerateThreatsDto,
  ) {
    if (!dto.components?.length) {
      throw new BadRequestException('At least one component required');
    }

    return this.threatService.generateThreats({
      projectName: dto.projectName,
      components: dto.components,
      dataFlows: dto.dataFlows || [],
      trustBoundaries: dto.trustBoundaries,
    });
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: AuthenticatedUser) {
    // AI usage tracking - placeholder until AiUsage model is migrated
    return {
      daily: [],
      totals: { inputTokens: 0, outputTokens: 0, requests: 0, cost: 0 },
      message: 'AI usage tracking requires database migration',
    };
  }
}
