import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateQuestionDto,
  UpdateQuestionDto,
  CreateOptionDto,
  UpdateOptionDto,
  BulkImportDto,
  ReorderQuestionsDto,
  TestFlowDto,
} from './dto/wizard.dto';

interface QuestionFilters {
  search?: string;
  type?: string;
  status?: string;
  isEntryPoint?: boolean;
}

interface TestFlowResult {
  globalProperties: Record<string, string>;
  nodes: Array<{ name: string; ref: string; technology?: string }>;
  boundaries: Array<{ name: string; ref: string; type: string }>;
  links: Array<{ sourceRef: string; targetRef: string; protocol?: string }>;
  path: Array<{ questionId: string; selectedValue: string; questionText: string }>;
}

@Injectable()
export class WizardService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Question CRUD
  // ============================================

  async listQuestions(filters: QuestionFilters = {}): Promise<{
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
    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.OR = [
        { questionId: { contains: filters.search, mode: 'insensitive' } },
        { text: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isEntryPoint !== undefined) {
      where.isEntryPoint = filters.isEntryPoint;
    }

    const [questions, total] = await Promise.all([
      this.prisma.wizardQuestion.findMany({
        where,
        orderBy: { orderIndex: 'asc' },
        include: {
          _count: {
            select: { options: true },
          },
        },
      }),
      this.prisma.wizardQuestion.count({ where }),
    ]);

    return { questions, total };
  }

  async getQuestionById(id: string): Promise<{
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
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    return question;
  }

  async getQuestionByQuestionId(questionId: string): Promise<{
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
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { questionId },
      include: {
        options: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question with questionId ${questionId} not found`);
    }

    return question;
  }

  async createQuestion(dto: CreateQuestionDto): Promise<{
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
    // Check for duplicate questionId
    const existing = await this.prisma.wizardQuestion.findUnique({
      where: { questionId: dto.questionId },
    });

    if (existing) {
      throw new ConflictException(`Question with questionId ${dto.questionId} already exists`);
    }

    // Validate: only one entry point allowed
    if (dto.isEntryPoint) {
      const existingEntry = await this.prisma.wizardQuestion.findFirst({
        where: { isEntryPoint: true },
      });
      if (existingEntry) {
        throw new ConflictException(
          `An entry point question already exists: ${existingEntry.questionId}. Unset it first.`
        );
      }
    }

    return this.prisma.wizardQuestion.create({
      data: {
        questionId: dto.questionId,
        text: dto.text,
        helpText: dto.helpText,
        type: dto.type,
        orderIndex: dto.orderIndex,
        isEntryPoint: dto.isEntryPoint ?? false,
        isTerminal: dto.isTerminal ?? false,
        conditions: (dto.conditions ?? []) as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
    });
  }

  async updateQuestion(
    id: string,
    dto: UpdateQuestionDto
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
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    // Check for duplicate questionId if changing
    if (dto.questionId && dto.questionId !== question.questionId) {
      const existing = await this.prisma.wizardQuestion.findUnique({
        where: { questionId: dto.questionId },
      });
      if (existing) {
        throw new ConflictException(`Question with questionId ${dto.questionId} already exists`);
      }
    }

    // Validate: only one entry point allowed
    if (dto.isEntryPoint && !question.isEntryPoint) {
      const existingEntry = await this.prisma.wizardQuestion.findFirst({
        where: { isEntryPoint: true, id: { not: id } },
      });
      if (existingEntry) {
        throw new ConflictException(
          `An entry point question already exists: ${existingEntry.questionId}. Unset it first.`
        );
      }
    }

    return this.prisma.wizardQuestion.update({
      where: { id },
      data: {
        ...(dto.questionId && { questionId: dto.questionId }),
        ...(dto.text && { text: dto.text }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText }),
        ...(dto.type && { type: dto.type }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
        ...(dto.isEntryPoint !== undefined && { isEntryPoint: dto.isEntryPoint }),
        ...(dto.isTerminal !== undefined && { isTerminal: dto.isTerminal }),
        ...(dto.conditions !== undefined && { conditions: dto.conditions as unknown as Prisma.InputJsonValue }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  async deleteQuestion(id: string): Promise<void> {
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    // Check if any options reference this question as nextQuestionId
    const referencingOptions = await this.prisma.wizardOption.findMany({
      where: { nextQuestionId: question.questionId },
      include: { question: true },
    });

    if (referencingOptions.length > 0) {
      const references = referencingOptions
        .map((o) => `${o.question.questionId}/${o.value}`)
        .join(', ');
      throw new ConflictException(
        `Cannot delete: Question is referenced by options: ${references}. Remove references first.`
      );
    }

    await this.prisma.wizardQuestion.delete({
      where: { id },
    });
  }

  async reorderQuestions(dto: ReorderQuestionsDto): Promise<void> {
    await this.prisma.$transaction(
      dto.questionIds.map((id, index) =>
        this.prisma.wizardQuestion.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );
  }

  // ============================================
  // Option CRUD
  // ============================================

  async listOptions(questionId: string): Promise<
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
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    return this.prisma.wizardOption.findMany({
      where: { questionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getOptionById(optionId: string): Promise<{
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
    const option = await this.prisma.wizardOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      throw new NotFoundException(`Option with ID ${optionId} not found`);
    }

    return option;
  }

  async createOption(
    questionId: string,
    dto: CreateOptionDto
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
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${questionId} not found`);
    }

    // Check for duplicate value within question
    const existing = await this.prisma.wizardOption.findUnique({
      where: {
        questionId_value: {
          questionId,
          value: dto.value,
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Option with value ${dto.value} already exists for this question`);
    }

    // Validate nextQuestionId if provided
    if (dto.nextQuestionId) {
      const nextQuestion = await this.prisma.wizardQuestion.findUnique({
        where: { questionId: dto.nextQuestionId },
      });
      if (!nextQuestion) {
        throw new BadRequestException(`Next question ${dto.nextQuestionId} not found`);
      }
      // Check for circular reference
      if (dto.nextQuestionId === question.questionId) {
        throw new BadRequestException('Circular reference: option cannot point to its own question');
      }
    }

    return this.prisma.wizardOption.create({
      data: {
        questionId,
        value: dto.value,
        label: dto.label,
        description: dto.description,
        iconUrl: dto.iconUrl,
        nextQuestionId: dto.nextQuestionId,
        triggers: (dto.triggers ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async updateOption(
    optionId: string,
    dto: UpdateOptionDto
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
    const option = await this.prisma.wizardOption.findUnique({
      where: { id: optionId },
      include: { question: true },
    });

    if (!option) {
      throw new NotFoundException(`Option with ID ${optionId} not found`);
    }

    // Check for duplicate value if changing
    if (dto.value && dto.value !== option.value) {
      const existing = await this.prisma.wizardOption.findUnique({
        where: {
          questionId_value: {
            questionId: option.questionId,
            value: dto.value,
          },
        },
      });
      if (existing) {
        throw new ConflictException(`Option with value ${dto.value} already exists for this question`);
      }
    }

    // Validate nextQuestionId if provided
    if (dto.nextQuestionId !== undefined && dto.nextQuestionId !== null) {
      const nextQuestion = await this.prisma.wizardQuestion.findUnique({
        where: { questionId: dto.nextQuestionId },
      });
      if (!nextQuestion) {
        throw new BadRequestException(`Next question ${dto.nextQuestionId} not found`);
      }
      // Check for circular reference
      if (dto.nextQuestionId === option.question.questionId) {
        throw new BadRequestException('Circular reference: option cannot point to its own question');
      }
    }

    return this.prisma.wizardOption.update({
      where: { id: optionId },
      data: {
        ...(dto.value && { value: dto.value }),
        ...(dto.label && { label: dto.label }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl }),
        ...(dto.nextQuestionId !== undefined && { nextQuestionId: dto.nextQuestionId }),
        ...(dto.triggers !== undefined && { triggers: dto.triggers as Prisma.InputJsonValue }),
      },
    });
  }

  async deleteOption(optionId: string): Promise<void> {
    const option = await this.prisma.wizardOption.findUnique({
      where: { id: optionId },
    });

    if (!option) {
      throw new NotFoundException(`Option with ID ${optionId} not found`);
    }

    await this.prisma.wizardOption.delete({
      where: { id: optionId },
    });
  }

  // ============================================
  // Status Workflow
  // ============================================

  async submitForReview(id: string): Promise<{
    id: string;
    questionId: string;
    status: string;
  }> {
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    if (question.status !== 'pending') {
      throw new ConflictException(`Question must be in pending status to submit for review`);
    }

    return this.prisma.wizardQuestion.update({
      where: { id },
      data: { status: 'review' },
      select: { id: true, questionId: true, status: true },
    });
  }

  async approve(id: string): Promise<{
    id: string;
    questionId: string;
    status: string;
  }> {
    const question = await this.prisma.wizardQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    if (question.status !== 'review') {
      throw new ConflictException(`Question must be in review status to approve`);
    }

    return this.prisma.wizardQuestion.update({
      where: { id },
      data: { status: 'live' },
      select: { id: true, questionId: true, status: true },
    });
  }

  // ============================================
  // Decision Tree & Test Flow
  // ============================================

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
    const questions = await this.prisma.wizardQuestion.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        options: {
          select: {
            id: true,
            value: true,
            label: true,
            nextQuestionId: true,
          },
        },
      },
    });

    // Build edges for visualization
    const edges: Array<{ from: string; to: string; label: string }> = [];
    for (const q of questions) {
      for (const opt of q.options) {
        if (opt.nextQuestionId) {
          edges.push({
            from: q.questionId,
            to: opt.nextQuestionId,
            label: opt.label,
          });
        }
      }
    }

    return { questions, edges };
  }

  async testFlow(dto: TestFlowDto): Promise<TestFlowResult> {
    const result: TestFlowResult = {
      globalProperties: {},
      nodes: [],
      boundaries: [],
      links: [],
      path: [],
    };

    for (const answer of dto.answers) {
      const question = await this.prisma.wizardQuestion.findUnique({
        where: { questionId: answer.questionId },
        include: { options: true },
      });

      if (!question) {
        throw new BadRequestException(`Question ${answer.questionId} not found`);
      }

      const selectedOption = question.options.find((o) => o.value === answer.selectedValue);
      if (!selectedOption) {
        throw new BadRequestException(
          `Option ${answer.selectedValue} not found for question ${answer.questionId}`
        );
      }

      // Record path
      result.path.push({
        questionId: answer.questionId,
        selectedValue: answer.selectedValue,
        questionText: question.text,
      });

      // Apply triggers
      const triggers = selectedOption.triggers as {
        addNodes?: Array<{ name: string; ref: string; technology?: string }>;
        addBoundaries?: Array<{ name: string; ref: string; type: string }>;
        addLinks?: Array<{ sourceRef: string; targetRef: string; protocol?: string }>;
        setProperties?: Record<string, string>;
      };

      if (triggers) {
        if (triggers.addNodes) {
          result.nodes.push(...triggers.addNodes);
        }
        if (triggers.addBoundaries) {
          result.boundaries.push(...triggers.addBoundaries);
        }
        if (triggers.addLinks) {
          result.links.push(...triggers.addLinks);
        }
        if (triggers.setProperties) {
          Object.assign(result.globalProperties, triggers.setProperties);
        }
      }
    }

    return result;
  }

  // ============================================
  // Bulk Import
  // ============================================

  async bulkImport(dto: BulkImportDto): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const q of dto.questions) {
      try {
        // Check if question already exists
        const existing = await this.prisma.wizardQuestion.findUnique({
          where: { questionId: q.questionId },
        });

        if (existing) {
          skipped++;
          errors.push(`Question ${q.questionId} already exists, skipped`);
          continue;
        }

        // Create question with options in transaction
        await this.prisma.$transaction(async (tx) => {
          const question = await tx.wizardQuestion.create({
            data: {
              questionId: q.questionId,
              text: q.text,
              helpText: q.helpText,
              type: q.type,
              orderIndex: q.orderIndex,
              isEntryPoint: q.isEntryPoint ?? false,
              isTerminal: q.isTerminal ?? false,
              conditions: (q.conditions ?? []) as unknown as Prisma.InputJsonValue,
              status: 'pending',
            },
          });

          if (q.options && q.options.length > 0) {
            await tx.wizardOption.createMany({
              data: q.options.map((o) => ({
                questionId: question.id,
                value: o.value,
                label: o.label,
                description: o.description,
                iconUrl: o.iconUrl,
                nextQuestionId: o.nextQuestionId,
                triggers: (o.triggers ?? {}) as Prisma.InputJsonValue,
              })),
            });
          }
        });

        imported++;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to import ${q.questionId}: ${message}`);
      }
    }

    return { imported, skipped, errors };
  }

  // ============================================
  // Statistics
  // ============================================

  async getStats(): Promise<{
    totalQuestions: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    entryPoints: number;
    terminalQuestions: number;
    orphanedQuestions: number;
  }> {
    const [
      totalQuestions,
      pendingCount,
      reviewCount,
      liveCount,
      singleSelectCount,
      multiSelectCount,
      textCount,
      toggleCount,
      entryPoints,
      terminalQuestions,
    ] = await Promise.all([
      this.prisma.wizardQuestion.count(),
      this.prisma.wizardQuestion.count({ where: { status: 'pending' } }),
      this.prisma.wizardQuestion.count({ where: { status: 'review' } }),
      this.prisma.wizardQuestion.count({ where: { status: 'live' } }),
      this.prisma.wizardQuestion.count({ where: { type: 'single-select' } }),
      this.prisma.wizardQuestion.count({ where: { type: 'multi-select' } }),
      this.prisma.wizardQuestion.count({ where: { type: 'text' } }),
      this.prisma.wizardQuestion.count({ where: { type: 'toggle' } }),
      this.prisma.wizardQuestion.count({ where: { isEntryPoint: true } }),
      this.prisma.wizardQuestion.count({ where: { isTerminal: true } }),
    ]);

    // Find orphaned questions (not entry point and not referenced by any option)
    const allQuestions = await this.prisma.wizardQuestion.findMany({
      where: { isEntryPoint: false },
      select: { questionId: true },
    });

    const referencedQuestionIds = await this.prisma.wizardOption.findMany({
      where: { nextQuestionId: { not: null } },
      select: { nextQuestionId: true },
    });

    const referencedSet = new Set(referencedQuestionIds.map((o) => o.nextQuestionId));
    const orphanedQuestions = allQuestions.filter((q) => !referencedSet.has(q.questionId)).length;

    return {
      totalQuestions,
      byStatus: {
        pending: pendingCount,
        review: reviewCount,
        live: liveCount,
      },
      byType: {
        'single-select': singleSelectCount,
        'multi-select': multiSelectCount,
        text: textCount,
        toggle: toggleCount,
      },
      entryPoints,
      terminalQuestions,
      orphanedQuestions,
    };
  }

  // ============================================
  // Options Metadata
  // ============================================

  async getQuestionTypes(): Promise<string[]> {
    return ['single-select', 'multi-select', 'text', 'toggle'];
  }

  async getConditionOperators(): Promise<string[]> {
    return ['equals', 'not_equals', 'in', 'not_in', 'contains'];
  }
}
