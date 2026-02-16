import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

// ============================================
// Interfaces
// ============================================

export interface ControlGap {
  controlId: string;
  controlName: string;
  frameworkId: string;
  frameworkName: string;
  gapStatus: 'gap' | 'partial' | 'satisfied';
  relatedRisks: {
    threatId: string;
    threatTitle: string;
    canonicalRiskId: string;
    canonicalRiskTitle: string;
    severity: string;
    mitigationStatus: string | null;
  }[];
  relevance: string;
}

export interface FrameworkComplianceScore {
  frameworkId: string;
  frameworkName: string;
  version: string;
  totalControls: number;
  satisfiedControls: number;
  partialControls: number;
  gapControls: number;
  compliancePercentage: number;
  controlDetails: ControlGap[];
}

export interface ThreatModelComplianceResult {
  threatModelId: string;
  threatModelName: string;
  generatedAt: Date;
  totalThreats: number;
  threatsWithCanonicalRisk: number;
  frameworks: FrameworkComplianceScore[];
}

export interface ComplianceGapSummary {
  totalGaps: number;
  criticalGaps: number;
  highGaps: number;
  mediumGaps: number;
  lowGaps: number;
  topGaps: ControlGap[];
}

// ============================================
// Service
// ============================================

@Injectable()
export class ThreatModelComplianceService {
  private readonly logger = new Logger(ThreatModelComplianceService.name);
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'tm-compliance:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate compliance gaps for a threat model
   * Task 4.1.1, 4.1.3, 4.1.4: Gap calculation, score calculation, gap identification
   */
  async calculateComplianceGaps(
    threatModelId: string,
    frameworkIds?: string[],
  ): Promise<ThreatModelComplianceResult> {
    const cacheKey = `${this.CACHE_PREFIX}${threatModelId}:${(frameworkIds || []).sort().join(',')}`;

    // Task 4.1.5: Check cache first
    const cached = await this.cacheService.get<ThreatModelComplianceResult>(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for threat model compliance: ${threatModelId}`);
      return cached;
    }

    // Get threat model with threats
    const threatModel = await this.prisma.threatModel.findUnique({
      where: { id: threatModelId },
      include: {
        threats: {
          include: {
            canonicalRisk: true,
            mitigations: {
              include: {
                mitigation: true,
              },
            },
          },
        },
      },
    });

    if (!threatModel) {
      throw new NotFoundException(`Threat model not found: ${threatModelId}`);
    }

    // Get frameworks (all active or specified)
    const frameworks = await this.prisma.complianceFramework.findMany({
      where: {
        isActive: true,
        ...(frameworkIds?.length ? { id: { in: frameworkIds } } : {}),
      },
      include: {
        controls: {
          include: {
            riskMappings: {
              include: {
                canonicalRisk: true,
              },
            },
          },
        },
      },
    });

    // Task 4.1.2: Risk→Control matching using RiskControlMapping
    const frameworkScores: FrameworkComplianceScore[] = [];

    for (const framework of frameworks) {
      const score = this.calculateFrameworkScore(
        framework,
        threatModel.threats,
      );
      frameworkScores.push(score);
    }

    const result: ThreatModelComplianceResult = {
      threatModelId,
      threatModelName: threatModel.name,
      generatedAt: new Date(),
      totalThreats: threatModel.threats.length,
      threatsWithCanonicalRisk: threatModel.threats.filter(t => t.canonicalRiskId).length,
      frameworks: frameworkScores,
    };

    // Task 4.1.5: Cache the result
    await this.cacheService.set(cacheKey, result, { ttl: this.CACHE_TTL });

    return result;
  }

  /**
   * Get compliance gap summary for a threat model
   * Task 4.1.4: Gap identification with severity breakdown
   */
  async getComplianceGapSummary(
    threatModelId: string,
    frameworkId?: string,
  ): Promise<ComplianceGapSummary> {
    const compliance = await this.calculateComplianceGaps(
      threatModelId,
      frameworkId ? [frameworkId] : undefined,
    );

    // Collect all gaps across frameworks
    const allGaps: ControlGap[] = [];
    for (const framework of compliance.frameworks) {
      const gaps = framework.controlDetails.filter(c => c.gapStatus === 'gap');
      allGaps.push(...gaps);
    }

    // Count gaps by severity of related risks
    let criticalGaps = 0;
    let highGaps = 0;
    let mediumGaps = 0;
    let lowGaps = 0;

    for (const gap of allGaps) {
      const maxSeverity = this.getMaxSeverity(gap.relatedRisks);
      switch (maxSeverity) {
        case 'critical':
          criticalGaps++;
          break;
        case 'high':
          highGaps++;
          break;
        case 'medium':
          mediumGaps++;
          break;
        default:
          lowGaps++;
      }
    }

    // Sort gaps by severity and take top 10
    const sortedGaps = [...allGaps].sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const aSeverity = this.getMaxSeverity(a.relatedRisks);
      const bSeverity = this.getMaxSeverity(b.relatedRisks);
      return (severityOrder[aSeverity] || 4) - (severityOrder[bSeverity] || 4);
    });

    return {
      totalGaps: allGaps.length,
      criticalGaps,
      highGaps,
      mediumGaps,
      lowGaps,
      topGaps: sortedGaps.slice(0, 10),
    };
  }

  /**
   * Get compliance score for specific framework
   */
  async getFrameworkComplianceScore(
    threatModelId: string,
    frameworkId: string,
  ): Promise<FrameworkComplianceScore | null> {
    const compliance = await this.calculateComplianceGaps(threatModelId, [frameworkId]);
    return compliance.frameworks[0] || null;
  }

  /**
   * Get controls that address a specific canonical risk
   * Task 4.1.2: Risk→Control matching
   */
  async getControlsForRisk(canonicalRiskId: string): Promise<{
    control: {
      id: string;
      controlId: string;
      name: string;
      frameworkId: string;
    };
    relevance: string;
    aiConfidence: number | null;
  }[]> {
    const mappings = await this.prisma.riskControlMapping.findMany({
      where: { canonicalRiskId },
      include: {
        control: {
          select: {
            id: true,
            controlId: true,
            name: true,
            frameworkId: true,
          },
        },
      },
    });

    return mappings.map(m => ({
      control: m.control,
      relevance: m.relevance,
      aiConfidence: m.aiConfidence,
    }));
  }

  /**
   * Get risks that map to a specific control
   * Task 4.1.2: Reverse lookup - Control→Risk
   */
  async getRisksForControl(controlId: string): Promise<{
    canonicalRisk: {
      id: string;
      canonicalId: string;
      title: string;
      defaultSeverity: string;
    };
    relevance: string;
    aiConfidence: number | null;
  }[]> {
    const mappings = await this.prisma.riskControlMapping.findMany({
      where: { complianceControlId: controlId },
      include: {
        canonicalRisk: {
          select: {
            id: true,
            canonicalId: true,
            title: true,
            defaultSeverity: true,
          },
        },
      },
    });

    return mappings.map(m => ({
      canonicalRisk: m.canonicalRisk,
      relevance: m.relevance,
      aiConfidence: m.aiConfidence,
    }));
  }

  /**
   * Invalidate compliance cache for a threat model
   */
  async invalidateCache(threatModelId: string): Promise<void> {
    await this.cacheService.delPattern(`${this.CACHE_PREFIX}${threatModelId}:*`);
    this.logger.debug(`Invalidated compliance cache for threat model: ${threatModelId}`);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * Calculate compliance score for a single framework
   * Task 4.1.3: Score calculation (% compliant per framework)
   */
  private calculateFrameworkScore(
    framework: {
      id: string;
      name: string;
      version: string;
      controls: {
        id: string;
        controlId: string;
        name: string;
        riskMappings: {
          canonicalRiskId: string;
          relevance: string;
          canonicalRisk: {
            id: string;
            canonicalId: string;
            title: string;
            defaultSeverity: string;
          };
        }[];
      }[];
    },
    threats: {
      id: string;
      title: string;
      canonicalRiskId: string | null;
      canonicalRisk: {
        id: string;
        canonicalId: string;
        title: string;
        defaultSeverity: string;
      } | null;
      mitigations: {
        mitigation: {
          id: string;
          implementationStatus: string;
        };
      }[];
      likelihood?: string;
      impact?: string;
    }[],
  ): FrameworkComplianceScore {
    const controlDetails: ControlGap[] = [];
    let satisfiedControls = 0;
    let partialControls = 0;
    let gapControls = 0;

    // Build a map of canonicalRiskId -> threats
    const threatsByCanonicalRisk = new Map<string, typeof threats>();
    for (const threat of threats) {
      if (threat.canonicalRiskId) {
        const existing = threatsByCanonicalRisk.get(threat.canonicalRiskId) || [];
        existing.push(threat);
        threatsByCanonicalRisk.set(threat.canonicalRiskId, existing);
      }
    }

    // Evaluate each control
    for (const control of framework.controls) {
      const relatedRisks: ControlGap['relatedRisks'] = [];
      let hasUnmitigatedRisk = false;
      let hasPartiallyMitigatedRisk = false;

      for (const mapping of control.riskMappings) {
        const threatsForRisk = threatsByCanonicalRisk.get(mapping.canonicalRiskId) || [];

        for (const threat of threatsForRisk) {
          const mitigationStatus = this.getMitigationStatus(threat.mitigations);

          relatedRisks.push({
            threatId: threat.id,
            threatTitle: threat.title,
            canonicalRiskId: mapping.canonicalRiskId,
            canonicalRiskTitle: mapping.canonicalRisk.title,
            severity: this.calculateSeverity(threat.likelihood || 'medium', threat.impact || 'medium'),
            mitigationStatus,
          });

          if (mitigationStatus === null || mitigationStatus === 'identified' || mitigationStatus === 'open') {
            hasUnmitigatedRisk = true;
          } else if (mitigationStatus === 'in_progress' || mitigationStatus === 'partial') {
            hasPartiallyMitigatedRisk = true;
          }
        }
      }

      // Determine gap status
      let gapStatus: 'gap' | 'partial' | 'satisfied';
      if (relatedRisks.length === 0) {
        // No risks related to this control - considered satisfied
        gapStatus = 'satisfied';
        satisfiedControls++;
      } else if (hasUnmitigatedRisk) {
        gapStatus = 'gap';
        gapControls++;
      } else if (hasPartiallyMitigatedRisk) {
        gapStatus = 'partial';
        partialControls++;
      } else {
        gapStatus = 'satisfied';
        satisfiedControls++;
      }

      controlDetails.push({
        controlId: control.controlId,
        controlName: control.name,
        frameworkId: framework.id,
        frameworkName: framework.name,
        gapStatus,
        relatedRisks,
        relevance: control.riskMappings[0]?.relevance || 'primary',
      });
    }

    const totalControls = framework.controls.length;
    const compliancePercentage = totalControls > 0
      ? Math.round(((satisfiedControls + partialControls * 0.5) / totalControls) * 100)
      : 100;

    return {
      frameworkId: framework.id,
      frameworkName: framework.name,
      version: framework.version,
      totalControls,
      satisfiedControls,
      partialControls,
      gapControls,
      compliancePercentage,
      controlDetails,
    };
  }

  /**
   * Get the overall mitigation status from a threat's mitigations
   */
  private getMitigationStatus(
    mitigations: { mitigation: { implementationStatus: string } }[],
  ): string | null {
    if (!mitigations || mitigations.length === 0) {
      return null;
    }

    // Priority: completed > in_progress > identified > open
    const statuses = mitigations.map(m => m.mitigation.implementationStatus);

    if (statuses.every(s => s === 'completed' || s === 'verified')) {
      return 'completed';
    }
    if (statuses.some(s => s === 'in_progress')) {
      return 'in_progress';
    }
    if (statuses.some(s => s === 'identified')) {
      return 'identified';
    }
    return statuses[0] || null;
  }

  /**
   * Calculate severity from likelihood and impact
   */
  private calculateSeverity(likelihood: string, impact: string): string {
    const likelihoodScore = { low: 1, medium: 2, high: 3, critical: 4 }[likelihood] || 2;
    const impactScore = { low: 1, medium: 2, high: 3, critical: 4 }[impact] || 2;
    const riskScore = likelihoodScore * impactScore;

    if (riskScore >= 12) return 'critical';
    if (riskScore >= 6) return 'high';
    if (riskScore >= 3) return 'medium';
    return 'low';
  }

  /**
   * Get max severity from a list of related risks
   */
  private getMaxSeverity(
    risks: { severity: string }[],
  ): 'critical' | 'high' | 'medium' | 'low' {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    let maxSeverity: 'critical' | 'high' | 'medium' | 'low' = 'low';

    for (const risk of risks) {
      const severity = risk.severity as 'critical' | 'high' | 'medium' | 'low';
      if (severityOrder[severity] < severityOrder[maxSeverity]) {
        maxSeverity = severity;
      }
    }

    return maxSeverity;
  }
}
