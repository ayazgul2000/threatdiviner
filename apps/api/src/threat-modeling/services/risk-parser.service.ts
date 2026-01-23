import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

interface ParsedRisk {
  id: string;
  category: string;
  title: string;
  severity: string;
  exploitationLikelihood: string;
  exploitationImpact: string;
  mostRelevantTechnicalAsset: string;
  cweId?: number;
  mitigation?: string;
  riskAssessment?: string;
  fingerprint: string;
}

interface CreateThreatResult {
  threatId: string;
  isNew: boolean;
  linkedComponents: string[];
}

@Injectable()
export class RiskParserService {
  private readonly logger = new Logger(RiskParserService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse raw Threagile output into normalized risk objects
   */
  parseThreagileOutput(rawOutput: any): ParsedRisk[] {
    const risks: ParsedRisk[] = [];

    if (rawOutput.risks_identified) {
      // Format 1: risks_identified array
      for (const risk of rawOutput.risks_identified) {
        risks.push(this.normalizeRisk(risk));
      }
    } else if (rawOutput.generated_risks) {
      // Format 2: generated_risks object
      for (const [id, risk] of Object.entries(rawOutput.generated_risks)) {
        risks.push(this.normalizeRisk({ id, ...(risk as any) }));
      }
    } else if (Array.isArray(rawOutput)) {
      // Format 3: Direct array
      for (const risk of rawOutput) {
        risks.push(this.normalizeRisk(risk));
      }
    }

    this.logger.log(`Parsed ${risks.length} risks from Threagile output`);
    return risks;
  }

  private normalizeRisk(raw: any): ParsedRisk {
    const id = raw.id || raw.synthetic_id || `risk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const category = raw.category || raw.risk_category || 'unknown';
    const title = raw.title || raw.risk_title || 'Untitled Risk';
    const asset = raw.most_relevant_technical_asset || raw.most_relevant_asset || '';
    const cweId = raw.cwe_id || raw.cwe;
    const mitigation = raw.mitigation || '';
    const riskAssessment = raw.risk_assessment || '';

    // Generate fingerprint for deduplication
    const fingerprint = this.generateFingerprint(category, title, asset, cweId);

    return {
      id,
      category,
      title,
      severity: this.normalizeSeverity(raw.severity || raw.risk_severity),
      exploitationLikelihood: raw.exploitation_likelihood || 'likely',
      exploitationImpact: raw.exploitation_impact || 'medium',
      mostRelevantTechnicalAsset: asset,
      cweId: cweId ? Number(cweId) : undefined,
      mitigation,
      riskAssessment,
      fingerprint,
    };
  }

  private generateFingerprint(category: string, title: string, asset: string, cweId?: number): string {
    const data = `${category}:${title}:${asset}:${cweId || ''}`.toLowerCase();
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  private normalizeSeverity(severity: string): string {
    const normalized = (severity || '').toLowerCase();
    if (normalized.includes('critical')) return 'critical';
    if (normalized.includes('elevated') || normalized.includes('high')) return 'high';
    if (normalized.includes('medium')) return 'medium';
    if (normalized.includes('low')) return 'low';
    return 'medium';
  }

  /**
   * Lookup canonical risk by CWE or category
   */
  async lookupCanonicalRisk(
    tenantId: string,
    risk: ParsedRisk,
  ): Promise<{ canonicalRiskId: string | null; controlMappings: string[] }> {
    // Try to find by CWE first
    if (risk.cweId) {
      const sourceMapping = await this.prisma.canonicalRiskSource.findFirst({
        where: {
          source: 'cwe',
          sourceRuleId: String(risk.cweId),
          canonicalRisk: {
            tenantId,
            status: 'live',
          },
        },
        include: {
          canonicalRisk: {
            include: {
              controlMappings: {
                select: { complianceControlId: true },
              },
            },
          },
        },
      });

      if (sourceMapping) {
        return {
          canonicalRiskId: sourceMapping.canonicalRiskId,
          controlMappings: sourceMapping.canonicalRisk.controlMappings.map(m => m.complianceControlId),
        };
      }
    }

    // Try by category
    const categoryMapping = await this.prisma.canonicalRiskSource.findFirst({
      where: {
        source: 'threagile',
        sourceRuleId: risk.category,
        canonicalRisk: {
          tenantId,
          status: 'live',
        },
      },
      include: {
        canonicalRisk: {
          include: {
            controlMappings: {
              select: { complianceControlId: true },
            },
          },
        },
      },
    });

    if (categoryMapping) {
      return {
        canonicalRiskId: categoryMapping.canonicalRiskId,
        controlMappings: categoryMapping.canonicalRisk.controlMappings.map(m => m.complianceControlId),
      };
    }

    return { canonicalRiskId: null, controlMappings: [] };
  }

  /**
   * Find component by name (for linking risks to components)
   */
  async findComponentByName(
    threatModelId: string,
    assetName: string,
  ): Promise<string | null> {
    if (!assetName) return null;

    // Try exact match first
    const exactMatch = await this.prisma.threatModelComponent.findFirst({
      where: {
        threatModelId,
        name: assetName,
      },
      select: { id: true },
    });

    if (exactMatch) return exactMatch.id;

    // Try case-insensitive match
    const component = await this.prisma.threatModelComponent.findFirst({
      where: {
        threatModelId,
        name: { equals: assetName, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (component) return component.id;

    // Try partial match (contains)
    const partialMatch = await this.prisma.threatModelComponent.findFirst({
      where: {
        threatModelId,
        name: { contains: assetName, mode: 'insensitive' },
      },
      select: { id: true },
    });

    return partialMatch?.id || null;
  }

  /**
   * Create or update threat record with deduplication
   */
  async createOrUpdateThreat(
    tenantId: string,
    threatModelId: string,
    userId: string,
    risk: ParsedRisk,
    analysisRunId: string,
  ): Promise<CreateThreatResult> {
    // Check for existing threat with same fingerprint
    const existingThreat = await this.prisma.threat.findFirst({
      where: {
        threatModelId,
        fingerprint: risk.fingerprint,
      },
      include: {
        components: true,
      },
    });

    // Lookup canonical risk
    const { canonicalRiskId } = await this.lookupCanonicalRisk(tenantId, risk);

    // Find related component
    const componentId = await this.findComponentByName(threatModelId, risk.mostRelevantTechnicalAsset);

    const linkedComponents: string[] = [];

    if (existingThreat) {
      // Update existing threat
      await this.prisma.threat.update({
        where: { id: existingThreat.id },
        data: {
          // Update fields that might have changed
          description: risk.mitigation || risk.riskAssessment || existingThreat.description,
          likelihood: this.mapLikelihood(risk.exploitationLikelihood),
          impact: this.mapImpact(risk.exploitationImpact),
          canonicalRiskId,
          analysisRunId,
          lastDetectedAt: new Date(),
        },
      });

      // Add component mapping if not exists
      if (componentId && !existingThreat.components.find(c => c.componentId === componentId)) {
        await this.prisma.threatComponentMapping.create({
          data: {
            threatId: existingThreat.id,
            componentId,
          },
        });
        linkedComponents.push(componentId);
      }

      return {
        threatId: existingThreat.id,
        isNew: false,
        linkedComponents,
      };
    }

    // Create new threat
    const newThreat = await this.prisma.threat.create({
      data: {
        threatModelId,
        title: risk.title,
        description: risk.mitigation || risk.riskAssessment || 'Risk identified by Threagile',
        category: risk.category,
        strideCategory: this.mapStrideCategory(risk.category),
        likelihood: this.mapLikelihood(risk.exploitationLikelihood),
        impact: this.mapImpact(risk.exploitationImpact),
        status: 'open',
        createdBy: userId,
        fingerprint: risk.fingerprint,
        canonicalRiskId,
        analysisRunId,
        lastDetectedAt: new Date(),
        cweId: risk.cweId ? String(risk.cweId) : null,
      },
    });

    // Link to component
    if (componentId) {
      await this.prisma.threatComponentMapping.create({
        data: {
          threatId: newThreat.id,
          componentId,
        },
      });
      linkedComponents.push(componentId);
    }

    return {
      threatId: newThreat.id,
      isNew: true,
      linkedComponents,
    };
  }

  /**
   * Process all risks from an analysis run
   */
  async processRisks(
    tenantId: string,
    threatModelId: string,
    userId: string,
    analysisRunId: string,
    risks: ParsedRisk[],
  ): Promise<{ created: number; updated: number; linked: number }> {
    let created = 0;
    let updated = 0;
    let linked = 0;

    for (const risk of risks) {
      try {
        const result = await this.createOrUpdateThreat(
          tenantId,
          threatModelId,
          userId,
          risk,
          analysisRunId,
        );

        if (result.isNew) {
          created++;
        } else {
          updated++;
        }
        linked += result.linkedComponents.length;
      } catch (error) {
        this.logger.warn(`Failed to process risk ${risk.id}: ${error}`);
      }
    }

    this.logger.log(`Processed risks: ${created} created, ${updated} updated, ${linked} component links`);
    return { created, updated, linked };
  }

  private mapStrideCategory(category: string): string {
    const mapping: Record<string, string> = {
      'unencrypted-asset': 'information_disclosure',
      'unencrypted-communication': 'information_disclosure',
      'missing-authentication': 'spoofing',
      'missing-authentication-second-factor': 'spoofing',
      'missing-authorization': 'elevation_of_privilege',
      'sql-nosql-injection': 'tampering',
      'code-backdoor': 'tampering',
      'denial-of-service': 'denial_of_service',
      'untrusted-deserialization': 'tampering',
      'xml-external-entity': 'information_disclosure',
      'cross-site-scripting': 'tampering',
      'cross-site-request-forgery': 'spoofing',
      'missing-build-infrastructure': 'repudiation',
      'missing-cloud-hardening': 'elevation_of_privilege',
      'path-traversal': 'information_disclosure',
      'server-side-request-forgery': 'tampering',
    };
    return mapping[category?.toLowerCase()] || 'tampering';
  }

  private mapLikelihood(likelihood: string): string {
    const mapping: Record<string, string> = {
      'frequent': 'high',
      'likely': 'high',
      'occasional': 'medium',
      'unlikely': 'low',
      'rare': 'low',
    };
    return mapping[likelihood?.toLowerCase()] || 'medium';
  }

  private mapImpact(impact: string): string {
    const mapping: Record<string, string> = {
      'critical': 'high',
      'high': 'high',
      'medium': 'medium',
      'low': 'low',
      'negligible': 'low',
    };
    return mapping[impact?.toLowerCase()] || 'medium';
  }
}
