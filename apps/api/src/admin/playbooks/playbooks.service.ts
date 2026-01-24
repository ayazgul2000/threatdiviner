import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class PlaybooksService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Playbook CRUD
  // ============================================

  async listPlaybooks(query: PlaybookListQuery) {
    const {
      search,
      effort,
      hasIac,
      status,
      canonicalRiskId,
      page = 1,
      limit = 25,
    } = query;

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        {
          canonicalRisk: {
            OR: [
              { canonicalId: { contains: search, mode: 'insensitive' } },
              { title: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (effort) {
      where.totalEffort = effort;
    }

    if (status) {
      where.status = status;
    }

    if (canonicalRiskId) {
      where.canonicalRiskId = canonicalRiskId;
    }

    // Get base results
    let playbooks = await this.prisma.remediationPlaybook.findMany({
      where,
      include: {
        canonicalRisk: {
          select: {
            id: true,
            canonicalId: true,
            title: true,
          },
        },
        _count: {
          select: {
            steps: true,
            iacSnippets: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Filter by hasIac if specified
    if (hasIac !== undefined) {
      const hasIacBool = hasIac === 'true';
      playbooks = playbooks.filter((p) =>
        hasIacBool ? p._count.iacSnippets > 0 : p._count.iacSnippets === 0,
      );
    }

    const total = playbooks.length;

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedPlaybooks = playbooks.slice(skip, skip + limit);

    return {
      playbooks: paginatedPlaybooks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getPlaybookById(id: string) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id },
      include: {
        canonicalRisk: {
          select: {
            id: true,
            canonicalId: true,
            title: true,
            cweId: true,
            cweName: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        iacSnippets: {
          orderBy: { platform: 'asc' },
        },
      },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${id}`);
    }

    return playbook;
  }

  async createPlaybook(dto: CreatePlaybookDto) {
    // Verify canonical risk exists
    const risk = await this.prisma.canonicalRisk.findUnique({
      where: { id: dto.canonicalRiskId },
    });

    if (!risk) {
      throw new NotFoundException(
        `Canonical risk not found: ${dto.canonicalRiskId}`,
      );
    }

    return this.prisma.remediationPlaybook.create({
      data: {
        canonicalRiskId: dto.canonicalRiskId,
        title: dto.title,
        description: dto.description,
        totalEffort: dto.totalEffort,
        status: 'pending',
      },
      include: {
        canonicalRisk: {
          select: {
            id: true,
            canonicalId: true,
            title: true,
          },
        },
        _count: {
          select: {
            steps: true,
            iacSnippets: true,
          },
        },
      },
    });
  }

  async updatePlaybook(id: string, dto: UpdatePlaybookDto) {
    const existing = await this.prisma.remediationPlaybook.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Playbook not found: ${id}`);
    }

    // If changing canonical risk, verify it exists
    if (dto.canonicalRiskId && dto.canonicalRiskId !== existing.canonicalRiskId) {
      const risk = await this.prisma.canonicalRisk.findUnique({
        where: { id: dto.canonicalRiskId },
      });
      if (!risk) {
        throw new NotFoundException(
          `Canonical risk not found: ${dto.canonicalRiskId}`,
        );
      }
    }

    return this.prisma.remediationPlaybook.update({
      where: { id },
      data: {
        ...dto,
        status: 'pending', // Reset status on edit
      },
      include: {
        canonicalRisk: {
          select: {
            id: true,
            canonicalId: true,
            title: true,
          },
        },
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        iacSnippets: true,
      },
    });
  }

  async deletePlaybook(id: string) {
    const existing = await this.prisma.remediationPlaybook.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Playbook not found: ${id}`);
    }

    await this.prisma.remediationPlaybook.delete({
      where: { id },
    });

    return { success: true, message: 'Playbook deleted' };
  }

  async submitForReview(id: string) {
    const existing = await this.prisma.remediationPlaybook.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Playbook not found: ${id}`);
    }

    if (existing.status !== 'pending') {
      throw new ConflictException(
        `Playbook must be in pending status to submit for review`,
      );
    }

    return this.prisma.remediationPlaybook.update({
      where: { id },
      data: { status: 'review' },
    });
  }

  async approve(id: string, isSuperAdmin: boolean) {
    if (!isSuperAdmin) {
      throw new ForbiddenException('Only SuperAdmin can approve playbooks');
    }

    const existing = await this.prisma.remediationPlaybook.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Playbook not found: ${id}`);
    }

    if (existing.status !== 'review') {
      throw new ConflictException(
        `Playbook must be in review status to approve`,
      );
    }

    return this.prisma.remediationPlaybook.update({
      where: { id },
      data: { status: 'live' },
    });
  }

  // ============================================
  // Step CRUD
  // ============================================

  async listSteps(playbookId: string) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${playbookId}`);
    }

    return this.prisma.playbookStep.findMany({
      where: { playbookId },
      orderBy: { stepNumber: 'asc' },
    });
  }

  async createStep(playbookId: string, dto: CreateStepDto) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: playbookId },
      include: { _count: { select: { steps: true } } },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${playbookId}`);
    }

    // Get next step number
    const nextStepNumber = playbook._count.steps + 1;

    const step = await this.prisma.playbookStep.create({
      data: {
        playbookId,
        stepNumber: nextStepNumber,
        title: dto.title,
        description: dto.description,
        effort: dto.effort,
        role: dto.role,
        estimatedMinutes: dto.estimatedMinutes,
        automatable: dto.automatable ?? false,
      },
    });

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return step;
  }

  async updateStep(playbookId: string, stepId: string, dto: UpdateStepDto) {
    const step = await this.prisma.playbookStep.findFirst({
      where: { id: stepId, playbookId },
    });

    if (!step) {
      throw new NotFoundException(`Step not found: ${stepId}`);
    }

    const updated = await this.prisma.playbookStep.update({
      where: { id: stepId },
      data: dto,
    });

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return updated;
  }

  async deleteStep(playbookId: string, stepId: string) {
    const step = await this.prisma.playbookStep.findFirst({
      where: { id: stepId, playbookId },
    });

    if (!step) {
      throw new NotFoundException(`Step not found: ${stepId}`);
    }

    await this.prisma.playbookStep.delete({
      where: { id: stepId },
    });

    // Renumber remaining steps
    const remainingSteps = await this.prisma.playbookStep.findMany({
      where: { playbookId },
      orderBy: { stepNumber: 'asc' },
    });

    for (let i = 0; i < remainingSteps.length; i++) {
      if (remainingSteps[i].stepNumber !== i + 1) {
        await this.prisma.playbookStep.update({
          where: { id: remainingSteps[i].id },
          data: { stepNumber: i + 1 },
        });
      }
    }

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return { success: true, message: 'Step deleted' };
  }

  async reorderSteps(playbookId: string, dto: ReorderStepsDto) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${playbookId}`);
    }

    // Verify all step IDs belong to this playbook
    const steps = await this.prisma.playbookStep.findMany({
      where: { playbookId },
    });

    const stepIdSet = new Set(steps.map((s) => s.id));
    for (const stepId of dto.stepIds) {
      if (!stepIdSet.has(stepId)) {
        throw new NotFoundException(`Step not found in playbook: ${stepId}`);
      }
    }

    // Update step numbers in a transaction
    await this.prisma.$transaction(
      dto.stepIds.map((stepId, index) =>
        this.prisma.playbookStep.update({
          where: { id: stepId },
          data: { stepNumber: index + 1 },
        }),
      ),
    );

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return this.prisma.playbookStep.findMany({
      where: { playbookId },
      orderBy: { stepNumber: 'asc' },
    });
  }

  // ============================================
  // IaC Snippet CRUD
  // ============================================

  async listIacSnippets(playbookId: string) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${playbookId}`);
    }

    return this.prisma.playbookIacSnippet.findMany({
      where: { playbookId },
      orderBy: { platform: 'asc' },
    });
  }

  async createIacSnippet(playbookId: string, dto: CreateIacSnippetDto) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: playbookId },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${playbookId}`);
    }

    // Check for duplicate platform
    const existing = await this.prisma.playbookIacSnippet.findFirst({
      where: { playbookId, platform: dto.platform },
    });

    if (existing) {
      throw new ConflictException(
        `IaC snippet for platform ${dto.platform} already exists`,
      );
    }

    const snippet = await this.prisma.playbookIacSnippet.create({
      data: {
        playbookId,
        platform: dto.platform,
        code: dto.code,
        description: dto.description,
      },
    });

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return snippet;
  }

  async updateIacSnippet(
    playbookId: string,
    snippetId: string,
    dto: UpdateIacSnippetDto,
  ) {
    const snippet = await this.prisma.playbookIacSnippet.findFirst({
      where: { id: snippetId, playbookId },
    });

    if (!snippet) {
      throw new NotFoundException(`IaC snippet not found: ${snippetId}`);
    }

    const updated = await this.prisma.playbookIacSnippet.update({
      where: { id: snippetId },
      data: dto,
    });

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return updated;
  }

  async deleteIacSnippet(playbookId: string, snippetId: string) {
    const snippet = await this.prisma.playbookIacSnippet.findFirst({
      where: { id: snippetId, playbookId },
    });

    if (!snippet) {
      throw new NotFoundException(`IaC snippet not found: ${snippetId}`);
    }

    await this.prisma.playbookIacSnippet.delete({
      where: { id: snippetId },
    });

    // Reset playbook status to pending
    await this.prisma.remediationPlaybook.update({
      where: { id: playbookId },
      data: { status: 'pending' },
    });

    return { success: true, message: 'IaC snippet deleted' };
  }

  // ============================================
  // Bulk Import
  // ============================================

  async bulkImport(dto: BulkImportPlaybooksDto) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const playbook of dto.playbooks) {
      try {
        // Verify canonical risk exists
        const risk = await this.prisma.canonicalRisk.findUnique({
          where: { id: playbook.canonicalRiskId },
        });

        if (!risk) {
          results.skipped++;
          results.errors.push(
            `Canonical risk not found: ${playbook.canonicalRiskId}`,
          );
          continue;
        }

        // Create playbook with steps and snippets
        await this.prisma.remediationPlaybook.create({
          data: {
            canonicalRiskId: playbook.canonicalRiskId,
            title: playbook.title,
            description: playbook.description,
            totalEffort: playbook.totalEffort,
            status: 'pending',
            steps: {
              create:
                playbook.steps?.map((step) => ({
                  stepNumber: step.stepNumber,
                  title: step.title,
                  description: step.description,
                  effort: step.effort,
                  role: step.role,
                  estimatedMinutes: step.estimatedMinutes,
                  automatable: step.automatable ?? false,
                })) ?? [],
            },
            iacSnippets: {
              create:
                playbook.iacSnippets?.map((snippet) => ({
                  platform: snippet.platform,
                  code: snippet.code,
                  description: snippet.description,
                })) ?? [],
            },
          },
        });

        results.imported++;
      } catch (error) {
        results.skipped++;
        results.errors.push(
          `Failed to import playbook "${playbook.title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return results;
  }

  // ============================================
  // Utility Methods
  // ============================================

  async getEffortOptions() {
    return ['low', 'medium', 'high'];
  }

  async getRoleOptions() {
    return ['developer', 'devops', 'security', 'architect'];
  }

  async getPlatformOptions() {
    return ['terraform', 'cloudformation', 'kubernetes', 'pulumi'];
  }

  async getPlaybookStats(playbookId: string) {
    const playbook = await this.prisma.remediationPlaybook.findUnique({
      where: { id: playbookId },
      include: {
        steps: true,
        iacSnippets: true,
      },
    });

    if (!playbook) {
      throw new NotFoundException(`Playbook not found: ${playbookId}`);
    }

    const totalMinutes = playbook.steps.reduce(
      (sum, step) => sum + (step.estimatedMinutes || 0),
      0,
    );
    const automatableSteps = playbook.steps.filter((s) => s.automatable).length;
    const roles = [...new Set(playbook.steps.map((s) => s.role).filter(Boolean))];

    return {
      totalSteps: playbook.steps.length,
      automatableSteps,
      totalMinutes,
      roles,
      platforms: playbook.iacSnippets.map((s) => s.platform),
    };
  }
}
