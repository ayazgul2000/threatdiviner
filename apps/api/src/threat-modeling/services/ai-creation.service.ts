import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AiService } from '../../ai/ai.service';
import { ThreatModelingService } from '../threat-modeling.service';
import {
  buildThreatModelExtractionPrompt,
  parseThreatModelExtractionResponse,
  ThreatModelExtractionRequest,
  ExtractedComponent,
  ExtractedDataFlow,
} from '../../ai/prompts/threat-model-extraction.prompt';

export interface AiGenerationResult {
  title: string;
  description: string;
  components: ExtractedComponent[];
  dataFlows: ExtractedDataFlow[];
  boundaries: Array<{
    name: string;
    type: string;
    description: string;
    componentNames: string[];
  }>;
  suggestedThreats: string[];
}

export interface AiCreateResult {
  threatModel: { id: string; name: string };
  componentsCreated: number;
  dataFlowsCreated: number;
}

@Injectable()
export class AiCreationService {
  private readonly logger = new Logger(AiCreationService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly threatModelingService: ThreatModelingService,
  ) {}

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    return this.aiService.isAvailable();
  }

  /**
   * Generate threat model components from natural language description
   */
  async generateFromDescription(
    description: string,
    options?: {
      systemType?: string;
      industry?: string;
    },
  ): Promise<AiGenerationResult> {
    if (!description || description.trim().length < 20) {
      throw new BadRequestException(
        'Please provide a more detailed system description (at least 20 characters)',
      );
    }

    const isAvailable = await this.aiService.isAvailable();
    if (!isAvailable) {
      throw new BadRequestException(
        'AI service is not available. Please configure ANTHROPIC_API_KEY or GEMINI_API_KEY.',
      );
    }

    const request: ThreatModelExtractionRequest = {
      description: description.trim(),
      systemType: options?.systemType,
      industry: options?.industry,
    };

    const prompt = buildThreatModelExtractionPrompt(request);

    this.logger.debug('Sending threat model extraction prompt to AI');

    const response = await this.aiService.analyzeWithPrompt(prompt);

    if (!response) {
      throw new BadRequestException(
        'AI failed to generate a response. Please try again.',
      );
    }

    try {
      const result = parseThreatModelExtractionResponse(response);

      this.logger.log(
        `AI generated: ${result.components.length} components, ${result.dataFlows.length} data flows`,
      );

      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse AI response: ${message}`);
      throw new BadRequestException(
        `Failed to parse AI response: ${message}. Please try again with a clearer description.`,
      );
    }
  }

  /**
   * Refine an existing generation result with additional context
   */
  async refineGeneration(
    currentResult: AiGenerationResult,
    refinementPrompt: string,
  ): Promise<AiGenerationResult> {
    if (!refinementPrompt || refinementPrompt.trim().length < 10) {
      throw new BadRequestException(
        'Please provide a more detailed refinement request',
      );
    }

    const isAvailable = await this.aiService.isAvailable();
    if (!isAvailable) {
      throw new BadRequestException('AI service is not available');
    }

    const prompt = `You are refining a threat model based on user feedback.

## Current Threat Model
Title: ${currentResult.title}
Description: ${currentResult.description}

### Components (${currentResult.components.length})
${currentResult.components.map((c) => `- ${c.name} (${c.type}): ${c.description}`).join('\n')}

### Data Flows (${currentResult.dataFlows.length})
${currentResult.dataFlows.map((f) => `- ${f.sourceName} → ${f.targetName}: ${f.description}`).join('\n')}

### Trust Boundaries (${currentResult.boundaries.length})
${currentResult.boundaries.map((b) => `- ${b.name}: ${b.description}`).join('\n')}

## User's Refinement Request
${refinementPrompt}

## Your Task
Update the threat model based on the user's feedback. You may:
- Add new components
- Remove components
- Modify existing components
- Add/remove data flows
- Update boundaries
- Improve descriptions

Respond with ONLY a valid JSON object in the same format as before:
{
  "title": "Updated title if needed",
  "description": "Updated description",
  "components": [...],
  "dataFlows": [...],
  "boundaries": [...],
  "suggestedThreats": [...]
}

IMPORTANT: Return the COMPLETE updated model, not just the changes.`;

    const response = await this.aiService.analyzeWithPrompt(prompt);

    if (!response) {
      throw new BadRequestException('AI failed to generate a response');
    }

    try {
      return parseThreatModelExtractionResponse(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse AI refinement response: ${message}`);
      throw new BadRequestException(
        `Failed to parse AI response: ${message}`,
      );
    }
  }

  /**
   * Create a threat model from AI-generated result
   */
  async createFromGeneration(
    tenantId: string,
    userId: string,
    projectId: string,
    generationResult: AiGenerationResult,
    name: string,
    description?: string,
    methodology?: string,
  ): Promise<AiCreateResult> {
    // Create the threat model
    const threatModel = await this.threatModelingService.createThreatModel(
      tenantId,
      userId,
      {
        name,
        projectId,
        description: description || generationResult.description,
        methodology: methodology || 'stride',
      },
    );

    // Build name to ID map for linking data flows
    const nameToComponentId = new Map<string, string>();

    // Create components
    for (const comp of generationResult.components) {
      const created = await this.threatModelingService.addComponent(
        tenantId,
        threatModel.id,
        {
          name: comp.name,
          type: comp.type,
          technology: comp.technology,
          description: comp.description,
          dataClassification: comp.dataClassification,
          criticality: comp.criticality,
        },
      );
      nameToComponentId.set(comp.name, created.id);
    }

    // Create data flows
    let dataFlowsCreated = 0;
    for (const flow of generationResult.dataFlows) {
      const sourceId = nameToComponentId.get(flow.sourceName);
      const targetId = nameToComponentId.get(flow.targetName);

      if (sourceId && targetId) {
        await this.threatModelingService.addDataFlow(tenantId, threatModel.id, {
          sourceId,
          targetId,
          protocol: flow.protocol,
          dataType: flow.dataType,
          authentication: flow.authenticated ?? false,
          encryption: flow.encrypted ?? false,
        });
        dataFlowsCreated++;
      } else {
        this.logger.warn(
          `Skipping data flow: ${flow.sourceName} → ${flow.targetName} (component not found)`,
        );
      }
    }

    return {
      threatModel: {
        id: threatModel.id,
        name: threatModel.name,
      },
      componentsCreated: generationResult.components.length,
      dataFlowsCreated,
    };
  }
}
