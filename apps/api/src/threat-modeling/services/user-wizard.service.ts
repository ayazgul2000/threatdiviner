import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ThreatModelingService } from '../threat-modeling.service';

interface WizardAnswer {
  questionId: string;
  selectedValue: string | string[]; // string[] for multi-select
}

interface WizardNode {
  name: string;
  ref: string;
  type?: string;
  technology?: string;
  description?: string;
  machineType?: string;
  internetFacing?: boolean;
  encryption?: string;
  authentication?: string;
  dataClassification?: string;
  criticality?: string;
}

interface WizardBoundary {
  name: string;
  ref: string;
  type: string;
  description?: string;
}

interface WizardLink {
  sourceRef: string;
  targetRef: string;
  protocol?: string;
  dataType?: string;
  encrypted?: boolean;
  authenticated?: boolean;
}

interface WizardTriggers {
  addNodes?: WizardNode[];
  addBoundaries?: WizardBoundary[];
  addLinks?: WizardLink[];
  setProperties?: Record<string, string>;
}

export interface WizardFlowResult {
  globalProperties: Record<string, string>;
  nodes: WizardNode[];
  boundaries: WizardBoundary[];
  links: WizardLink[];
  path: Array<{ questionId: string; selectedValue: string | string[]; questionText: string }>;
}

export interface WizardQuestion {
  id: string;
  questionId: string;
  text: string;
  helpText: string | null;
  type: string;
  isEntryPoint: boolean;
  isTerminal: boolean;
  options: Array<{
    id: string;
    value: string;
    label: string;
    description: string | null;
    iconUrl: string | null;
    nextQuestionId: string | null;
  }>;
}

@Injectable()
export class UserWizardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly threatModelingService: ThreatModelingService,
  ) {}

  /**
   * Get the entry point question (status='live' only)
   */
  async getEntryQuestion(): Promise<WizardQuestion | null> {
    const question = await this.prisma.wizardQuestion.findFirst({
      where: {
        status: 'live',
        isEntryPoint: true,
      },
      include: {
        options: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            value: true,
            label: true,
            description: true,
            iconUrl: true,
            nextQuestionId: true,
          },
        },
      },
    });

    if (!question) {
      return null;
    }

    return {
      id: question.id,
      questionId: question.questionId,
      text: question.text,
      helpText: question.helpText,
      type: question.type,
      isEntryPoint: question.isEntryPoint,
      isTerminal: question.isTerminal,
      options: question.options,
    };
  }

  /**
   * Get a specific question by ID (status='live' only)
   */
  async getQuestion(questionId: string): Promise<WizardQuestion> {
    const question = await this.prisma.wizardQuestion.findFirst({
      where: {
        questionId,
        status: 'live',
      },
      include: {
        options: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            value: true,
            label: true,
            description: true,
            iconUrl: true,
            nextQuestionId: true,
          },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found or not available`);
    }

    return {
      id: question.id,
      questionId: question.questionId,
      text: question.text,
      helpText: question.helpText,
      type: question.type,
      isEntryPoint: question.isEntryPoint,
      isTerminal: question.isTerminal,
      options: question.options,
    };
  }

  /**
   * Get the next question based on current answer
   */
  async getNextQuestion(
    currentQuestionId: string,
    selectedValue: string,
  ): Promise<WizardQuestion | null> {
    const question = await this.prisma.wizardQuestion.findFirst({
      where: {
        questionId: currentQuestionId,
        status: 'live',
      },
      include: {
        options: true,
      },
    });

    if (!question) {
      throw new NotFoundException(`Question ${currentQuestionId} not found`);
    }

    const selectedOption = question.options.find((o) => o.value === selectedValue);
    if (!selectedOption) {
      throw new BadRequestException(`Option ${selectedValue} not found for question ${currentQuestionId}`);
    }

    if (!selectedOption.nextQuestionId) {
      return null; // Terminal - no next question
    }

    return this.getQuestion(selectedOption.nextQuestionId);
  }

  /**
   * Execute wizard flow and return accumulated result (preview)
   */
  async previewWizardResult(answers: WizardAnswer[]): Promise<WizardFlowResult> {
    const result: WizardFlowResult = {
      globalProperties: {},
      nodes: [],
      boundaries: [],
      links: [],
      path: [],
    };

    for (const answer of answers) {
      const question = await this.prisma.wizardQuestion.findFirst({
        where: {
          questionId: answer.questionId,
          status: 'live',
        },
        include: { options: true },
      });

      if (!question) {
        throw new BadRequestException(`Question ${answer.questionId} not found or not available`);
      }

      // Handle multi-select (array of values) or single-select (string)
      const selectedValues = Array.isArray(answer.selectedValue)
        ? answer.selectedValue
        : [answer.selectedValue];

      for (const value of selectedValues) {
        const selectedOption = question.options.find((o) => o.value === value);
        if (!selectedOption) {
          throw new BadRequestException(
            `Option ${value} not found for question ${answer.questionId}`,
          );
        }

        // Apply triggers
        const triggers = selectedOption.triggers as WizardTriggers | null;
        if (triggers) {
          if (triggers.addNodes) {
            // Deduplicate nodes by ref
            for (const node of triggers.addNodes) {
              if (!result.nodes.some((n) => n.ref === node.ref)) {
                result.nodes.push(node);
              }
            }
          }
          if (triggers.addBoundaries) {
            for (const boundary of triggers.addBoundaries) {
              if (!result.boundaries.some((b) => b.ref === boundary.ref)) {
                result.boundaries.push(boundary);
              }
            }
          }
          if (triggers.addLinks) {
            for (const link of triggers.addLinks) {
              if (!result.links.some((l) => l.sourceRef === link.sourceRef && l.targetRef === link.targetRef)) {
                result.links.push(link);
              }
            }
          }
          if (triggers.setProperties) {
            Object.assign(result.globalProperties, triggers.setProperties);
          }
        }
      }

      // Record path
      result.path.push({
        questionId: answer.questionId,
        selectedValue: answer.selectedValue,
        questionText: question.text,
      });
    }

    return result;
  }

  /**
   * Execute wizard and create a ThreatModel with components and data flows
   */
  async createFromWizard(
    tenantId: string,
    userId: string,
    projectId: string,
    answers: WizardAnswer[],
    name: string,
    description?: string,
    methodology?: string,
  ): Promise<{ threatModel: { id: string; name: string }; componentsCreated: number; dataFlowsCreated: number }> {
    // First get the accumulated result
    const wizardResult = await this.previewWizardResult(answers);

    // Create the threat model
    const threatModel = await this.threatModelingService.createThreatModel(tenantId, userId, {
      name,
      projectId,
      description: description || `Generated via Guided Wizard`,
      methodology: methodology || 'stride',
    });

    // Map node refs to component IDs for data flow creation
    const refToComponentId: Record<string, string> = {};

    // Create components from nodes
    for (const node of wizardResult.nodes) {
      const componentType = this.mapNodeTypeToComponentType(node.type);

      const component = await this.threatModelingService.addComponent(tenantId, threatModel.id, {
        name: node.name,
        type: componentType,
        technology: node.technology,
        description: node.description,
        dataClassification: node.dataClassification,
        criticality: node.criticality,
      });

      refToComponentId[node.ref] = component.id;
    }

    // Create data flows from links
    let dataFlowsCreated = 0;
    for (const link of wizardResult.links) {
      const sourceId = refToComponentId[link.sourceRef];
      const targetId = refToComponentId[link.targetRef];

      if (sourceId && targetId) {
        await this.threatModelingService.addDataFlow(tenantId, threatModel.id, {
          sourceId,
          targetId,
          protocol: link.protocol,
          dataType: link.dataType,
          authentication: link.authenticated ?? false,
          encryption: link.encrypted ?? false,
        });
        dataFlowsCreated++;
      }
    }

    return {
      threatModel: {
        id: threatModel.id,
        name: threatModel.name,
      },
      componentsCreated: wizardResult.nodes.length,
      dataFlowsCreated,
    };
  }

  /**
   * Check if wizard is available (has at least one live entry point)
   */
  async isWizardAvailable(): Promise<boolean> {
    const entryPoint = await this.prisma.wizardQuestion.findFirst({
      where: {
        status: 'live',
        isEntryPoint: true,
      },
    });
    return !!entryPoint;
  }

  /**
   * Get wizard stats for user display
   */
  async getWizardInfo(): Promise<{
    available: boolean;
    totalQuestions: number;
  }> {
    const [available, totalQuestions] = await Promise.all([
      this.isWizardAvailable(),
      this.prisma.wizardQuestion.count({ where: { status: 'live' } }),
    ]);

    return { available, totalQuestions };
  }

  /**
   * Map wizard node type to ThreatModelComponent type
   */
  private mapNodeTypeToComponentType(nodeType?: string): string {
    const mapping: Record<string, string> = {
      'process': 'process',
      'datastore': 'data_store',
      'data_store': 'data_store',
      'database': 'data_store',
      'external': 'external_entity',
      'external_entity': 'external_entity',
      'external-entity': 'external_entity',
      'boundary': 'trust_boundary',
      'trust_boundary': 'trust_boundary',
      'trust-boundary': 'trust_boundary',
      'service': 'service',
      'api': 'api',
      'api_gateway': 'api',
      'api-gateway': 'api',
      'web-app': 'process',
      'mobile-app': 'process',
      'server': 'process',
      'cache': 'data_store',
      'queue': 'data_store',
      'storage': 'data_store',
      'cdn': 'external_entity',
      'load-balancer': 'process',
      'firewall': 'process',
    };

    return mapping[nodeType?.toLowerCase() || ''] || 'process';
  }
}
