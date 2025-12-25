import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VectorDbService, VectorDocument, SearchResult } from './vector-db.service';
import { EmbeddingService } from './embedding.service';

export interface RemediationContext {
  cweId: string;
  cweName: string;
  description: string;
  remediation: string;
  attackTechniques?: string[];
  complianceControls?: string[];
}

export interface RemediationSearchResult {
  query: string;
  results: Array<{
    cweId: string;
    cweName: string;
    remediation: string;
    score: number;
    relatedTechniques?: string[];
    complianceControls?: string[];
  }>;
}

export interface TechniqueSearchResult {
  techniqueId: string;
  techniqueName: string;
  tacticName: string;
  description: string;
  mitigations: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  score: number;
}

@Injectable()
export class RagService implements OnModuleInit {
  private readonly logger = new Logger(RagService.name);
  private isInitialized = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorDb: VectorDbService,
    private readonly embedding: EmbeddingService,
  ) {}

  async onModuleInit() {
    try {
      await this.vectorDb.initialize();
      this.isInitialized = true;
      this.logger.log('RAG service initialized');
    } catch (error) {
      this.logger.error(`Failed to initialize RAG service: ${error}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.isInitialized && await this.vectorDb.isAvailable();
  }

  // ==================
  // Indexing Methods
  // ==================

  async indexAllCweRemediations(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('Starting CWE remediation indexing...');
    let indexed = 0;
    let errors = 0;

    try {
      // Get all CWEs from database
      const cwes = await this.prisma.cwe.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          extendedDescription: true,
          potentialMitigations: true,
        },
      });

      const documents: VectorDocument[] = [];

      for (const cwe of cwes) {
        try {
          // Combine all remediation-related text - potentialMitigations is JSON
          const mitigationsText = cwe.potentialMitigations
            ? (typeof cwe.potentialMitigations === 'string'
                ? cwe.potentialMitigations
                : JSON.stringify(cwe.potentialMitigations))
            : '';
          const remediationText = [
            mitigationsText,
            cwe.extendedDescription,
          ].filter(Boolean).join('\n\n');

          if (!remediationText || remediationText.length < 50) {
            continue;
          }

          // Create embedding
          const embedding = await this.embedding.embed(
            `${cwe.name}: ${remediationText.substring(0, 2000)}`
          );

          if (embedding) {
            documents.push({
              id: `cwe-${cwe.id}`,
              collection: 'cwe_remediation',
              embedding,
              metadata: {
                cweId: cwe.id,
                cweName: cwe.name,
                description: cwe.description?.substring(0, 500) || '',
                remediation: remediationText.substring(0, 2000),
              },
            });
            indexed++;
          }
        } catch (e) {
          this.logger.error(`Failed to index CWE ${cwe.id}: ${e}`);
          errors++;
        }
      }

      // Bulk upsert to vector DB
      if (documents.length > 0) {
        await this.vectorDb.upsertMany('cwe_remediation', documents);
      }

      this.logger.log(`CWE indexing complete: ${indexed} indexed, ${errors} errors`);
    } catch (error) {
      this.logger.error(`CWE indexing failed: ${error}`);
      throw error;
    }

    return { indexed, errors };
  }

  async indexAllAttackTechniques(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('Starting ATT&CK technique indexing...');
    let indexed = 0;
    let errors = 0;

    try {
      // Get all ATT&CK techniques from database
      const techniques = await this.prisma.attackTechnique.findMany({
        include: {
          tactic: true,
        },
      });

      const documents: VectorDocument[] = [];

      for (const technique of techniques) {
        try {
          const mitigationsArray = technique.mitigations as Array<{ id: string; name: string; description: string }> || [];

          // Create combined text for embedding
          const combinedText = [
            technique.name,
            technique.description,
            technique.detection,
            mitigationsArray.map(m => `${m.name}: ${m.description}`).join('\n'),
          ].filter(Boolean).join('\n\n');

          if (combinedText.length < 50) {
            continue;
          }

          const embedding = await this.embedding.embed(combinedText.substring(0, 2000));

          if (embedding) {
            documents.push({
              id: `attack-${technique.id}`,
              collection: 'attack_techniques',
              embedding,
              metadata: {
                techniqueId: technique.id,
                techniqueName: technique.name,
                tacticName: technique.tactic?.name || 'Unknown',
                description: technique.description?.substring(0, 500) || '',
                detection: technique.detection?.substring(0, 500) || '',
                mitigations: JSON.stringify(mitigationsArray.slice(0, 5)),
              },
            });
            indexed++;
          }
        } catch (e) {
          this.logger.error(`Failed to index technique ${technique.id}: ${e}`);
          errors++;
        }
      }

      if (documents.length > 0) {
        await this.vectorDb.upsertMany('attack_techniques', documents);
      }

      this.logger.log(`ATT&CK indexing complete: ${indexed} indexed, ${errors} errors`);
    } catch (error) {
      this.logger.error(`ATT&CK indexing failed: ${error}`);
      throw error;
    }

    return { indexed, errors };
  }

  async indexAllComplianceControls(): Promise<{ indexed: number; errors: number }> {
    this.logger.log('Starting compliance control indexing...');
    let indexed = 0;
    let errors = 0;

    try {
      // Get all compliance controls from database
      const controls = await this.prisma.complianceControl.findMany({
        select: {
          id: true,
          controlId: true,
          name: true,
          description: true,
          frameworkId: true,
        },
      });

      const documents: VectorDocument[] = [];

      for (const control of controls) {
        try {
          const combinedText = `${control.name}: ${control.description || ''}`;

          if (combinedText.length < 30) {
            continue;
          }

          const embedding = await this.embedding.embed(combinedText.substring(0, 2000));

          if (embedding) {
            documents.push({
              id: `compliance-${control.id}`,
              collection: 'compliance_controls',
              embedding,
              metadata: {
                controlId: control.controlId,
                name: control.name,
                description: control.description?.substring(0, 500) || '',
                frameworkId: control.frameworkId,
              },
            });
            indexed++;
          }
        } catch (e) {
          this.logger.error(`Failed to index control ${control.controlId}: ${e}`);
          errors++;
        }
      }

      if (documents.length > 0) {
        await this.vectorDb.upsertMany('compliance_controls', documents);
      }

      this.logger.log(`Compliance indexing complete: ${indexed} indexed, ${errors} errors`);
    } catch (error) {
      this.logger.error(`Compliance indexing failed: ${error}`);
      throw error;
    }

    return { indexed, errors };
  }

  async indexAll(): Promise<{ cwe: { indexed: number; errors: number }; attack: { indexed: number; errors: number }; compliance: { indexed: number; errors: number } }> {
    const cwe = await this.indexAllCweRemediations();
    const attack = await this.indexAllAttackTechniques();
    const compliance = await this.indexAllComplianceControls();
    return { cwe, attack, compliance };
  }

  // ==================
  // Search Methods
  // ==================

  async searchRemediations(query: string, limit: number = 5): Promise<RemediationSearchResult> {
    try {
      const queryEmbedding = await this.embedding.embed(query);
      if (!queryEmbedding) {
        return { query, results: [] };
      }

      const results = await this.vectorDb.search('cwe_remediation', queryEmbedding, limit);

      return {
        query,
        results: results.map(r => ({
          cweId: r.metadata.cweId as string,
          cweName: r.metadata.cweName as string,
          remediation: r.metadata.remediation as string,
          score: r.score,
          relatedTechniques: [],
          complianceControls: [],
        })),
      };
    } catch (error) {
      this.logger.error(`Remediation search failed: ${error}`);
      return { query, results: [] };
    }
  }

  async searchAttackTechniques(query: string, limit: number = 5): Promise<TechniqueSearchResult[]> {
    try {
      const queryEmbedding = await this.embedding.embed(query);
      if (!queryEmbedding) {
        return [];
      }

      const results = await this.vectorDb.search('attack_techniques', queryEmbedding, limit);

      return results.map(r => ({
        techniqueId: r.metadata.techniqueId as string,
        techniqueName: r.metadata.techniqueName as string,
        tacticName: r.metadata.tacticName as string,
        description: r.metadata.description as string,
        mitigations: JSON.parse(r.metadata.mitigations as string || '[]'),
        score: r.score,
      }));
    } catch (error) {
      this.logger.error(`ATT&CK search failed: ${error}`);
      return [];
    }
  }

  async searchComplianceControls(query: string, limit: number = 5): Promise<SearchResult[]> {
    try {
      const queryEmbedding = await this.embedding.embed(query);
      if (!queryEmbedding) {
        return [];
      }

      return this.vectorDb.search('compliance_controls', queryEmbedding, limit);
    } catch (error) {
      this.logger.error(`Compliance search failed: ${error}`);
      return [];
    }
  }

  // ==================
  // Remediation Generation
  // ==================

  async generateRemediationForFinding(findingId: string): Promise<{
    remediation: string;
    defenseInDepth: string[];
    detectionGuidance: string;
    relatedCwes: string[];
    attackTechniques: string[];
  } | null> {
    try {
      // Get the finding with enriched data (enrichment fields are directly on Finding)
      const finding = await this.prisma.finding.findUnique({
        where: { id: findingId },
        include: {
          scan: {
            include: {
              repository: true,
            },
          },
        },
      });

      if (!finding) {
        return null;
      }

      // Extract CWE name from cached cweData JSON if available
      const cweData = finding.cweData as Record<string, any> | null;
      const cweName = cweData?.name || null;

      // Build search query from finding context
      const searchQuery = [
        finding.title,
        finding.description,
        finding.cweId,
        cweName,
      ].filter(Boolean).join(' ');

      // Search for relevant remediations
      const remediationResults = await this.searchRemediations(searchQuery, 3);
      const attackResults = await this.searchAttackTechniques(searchQuery, 2);

      // Aggregate remediations
      const remediations = remediationResults.results
        .map(r => r.remediation)
        .filter(Boolean);

      // Aggregate attack mitigations
      const attackMitigations = attackResults
        .flatMap(t => t.mitigations)
        .map(m => m.description)
        .filter(Boolean);

      // Generate combined remediation
      const primaryRemediation = remediations[0] || 'No specific remediation found. Please review the vulnerability and apply security best practices.';

      // Defense in depth recommendations
      const defenseInDepth = [
        ...new Set([
          ...attackMitigations.slice(0, 3),
          'Implement input validation and sanitization',
          'Apply the principle of least privilege',
          'Enable security logging and monitoring',
        ]),
      ].slice(0, 5);

      // Detection guidance
      const detectionGuidance = attackResults
        .map(t => t.description)
        .filter(Boolean)
        .join('\n\n') || 'Monitor logs for suspicious activity related to this vulnerability.';

      return {
        remediation: primaryRemediation,
        defenseInDepth,
        detectionGuidance,
        relatedCwes: remediationResults.results.map(r => r.cweId).filter(Boolean),
        attackTechniques: attackResults.map(t => t.techniqueId).filter(Boolean),
      };
    } catch (error) {
      this.logger.error(`Failed to generate remediation for finding ${findingId}: ${error}`);
      return null;
    }
  }

  // ==================
  // Status Methods
  // ==================

  async getIndexStatus(): Promise<{
    isAvailable: boolean;
    collections: Array<{
      name: string;
      documentCount: number;
    }>;
  }> {
    const isAvailable = await this.isAvailable();
    if (!isAvailable) {
      return { isAvailable: false, collections: [] };
    }

    const collections = await this.vectorDb.getCollectionStats();
    return { isAvailable: true, collections };
  }
}
