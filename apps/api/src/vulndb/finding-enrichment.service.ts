import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VulnDbService } from './vulndb.service';

export interface EnrichmentResult {
  enrichedCount: number;
  errorCount: number;
  kevCount: number;
  highEpssCount: number;
}

@Injectable()
export class FindingEnrichmentService {
  private readonly logger = new Logger(FindingEnrichmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vulnDbService: VulnDbService,
  ) {}

  /**
   * Enrich all findings for a specific scan
   */
  async enrichScanFindings(scanId: string): Promise<EnrichmentResult> {
    const findings = await this.prisma.finding.findMany({
      where: { scanId },
      select: {
        id: true,
        cveId: true,
        cweId: true,
      },
    });

    this.logger.log(`Enriching ${findings.length} findings for scan ${scanId}`);

    let enrichedCount = 0;
    let errorCount = 0;
    let kevCount = 0;
    let highEpssCount = 0;

    for (const finding of findings) {
      try {
        const enrichment = await this.vulnDbService.enrichFinding({
          cveId: finding.cveId,
          cweId: finding.cweId,
        });

        // Build update data
        const updateData: Record<string, any> = {
          riskScore: enrichment.riskScore,
          enrichedAt: new Date(),
        };

        // Add CVE data if available
        if (enrichment.cve) {
          updateData.cveData = {
            description: enrichment.cve.description,
            cvssV3Score: enrichment.cve.cvssV3Score,
            cvssV3Severity: enrichment.cve.cvssV3Severity,
            publishedDate: enrichment.cve.publishedDate,
            epssScore: enrichment.cve.epssScore,
            isKev: enrichment.cve.isKev,
            kevDueDate: enrichment.cve.kevDueDate,
          };
          updateData.epssScore = enrichment.cve.epssScore;
          updateData.isKev = enrichment.cve.isKev;

          if (enrichment.cve.isKev) kevCount++;
          if (enrichment.cve.epssScore && enrichment.cve.epssScore >= 0.5) highEpssCount++;
        }

        // Add CWE data if available
        if (enrichment.cwe) {
          updateData.cweData = {
            name: enrichment.cwe.name,
            description: enrichment.cwe.description,
            potentialMitigations: enrichment.cwe.potentialMitigations,
            detectionMethods: enrichment.cwe.detectionMethods,
          };
        }

        // Add OWASP category if available
        if (enrichment.owaspCategory) {
          updateData.owaspCategory = enrichment.owaspCategory.id;
        }

        // Add compliance controls as JSON
        if (enrichment.complianceMappings && enrichment.complianceMappings.length > 0) {
          const controls: Record<string, string[]> = {};
          for (const mapping of enrichment.complianceMappings) {
            if (!controls[mapping.frameworkId]) {
              controls[mapping.frameworkId] = [];
            }
            controls[mapping.frameworkId].push(mapping.controlId);
          }
          updateData.complianceControls = controls;
        }

        // Add ATT&CK techniques
        if (enrichment.attackTechniques && enrichment.attackTechniques.length > 0) {
          updateData.attackTechniques = enrichment.attackTechniques.map((t) => ({
            id: t.id,
            name: t.name,
            tacticId: t.tacticId,
          }));
        }

        await this.prisma.finding.update({
          where: { id: finding.id },
          data: updateData,
        });

        enrichedCount++;
      } catch (error) {
        this.logger.warn(`Failed to enrich finding ${finding.id}:`, error);
        errorCount++;
      }
    }

    this.logger.log(
      `Enrichment complete: ${enrichedCount} enriched, ${errorCount} errors, ${kevCount} KEV, ${highEpssCount} high EPSS`,
    );

    return { enrichedCount, errorCount, kevCount, highEpssCount };
  }

  /**
   * Enrich a single finding by ID
   */
  async enrichFinding(findingId: string): Promise<void> {
    const finding = await this.prisma.finding.findUnique({
      where: { id: findingId },
      select: { cveId: true, cweId: true },
    });

    if (!finding) {
      throw new Error(`Finding ${findingId} not found`);
    }

    const enrichment = await this.vulnDbService.enrichFinding({
      cveId: finding.cveId,
      cweId: finding.cweId,
    });

    const updateData: Record<string, any> = {
      riskScore: enrichment.riskScore,
      enrichedAt: new Date(),
    };

    if (enrichment.cve) {
      updateData.cveData = {
        description: enrichment.cve.description,
        cvssV3Score: enrichment.cve.cvssV3Score,
        cvssV3Severity: enrichment.cve.cvssV3Severity,
        publishedDate: enrichment.cve.publishedDate,
        epssScore: enrichment.cve.epssScore,
        isKev: enrichment.cve.isKev,
        kevDueDate: enrichment.cve.kevDueDate,
      };
      updateData.epssScore = enrichment.cve.epssScore;
      updateData.isKev = enrichment.cve.isKev;
    }

    if (enrichment.cwe) {
      updateData.cweData = {
        name: enrichment.cwe.name,
        description: enrichment.cwe.description,
        potentialMitigations: enrichment.cwe.potentialMitigations,
        detectionMethods: enrichment.cwe.detectionMethods,
      };
    }

    if (enrichment.owaspCategory) {
      updateData.owaspCategory = enrichment.owaspCategory.id;
    }

    if (enrichment.complianceMappings && enrichment.complianceMappings.length > 0) {
      const controls: Record<string, string[]> = {};
      for (const mapping of enrichment.complianceMappings) {
        if (!controls[mapping.frameworkId]) {
          controls[mapping.frameworkId] = [];
        }
        controls[mapping.frameworkId].push(mapping.controlId);
      }
      updateData.complianceControls = controls;
    }

    if (enrichment.attackTechniques && enrichment.attackTechniques.length > 0) {
      updateData.attackTechniques = enrichment.attackTechniques.map((t) => ({
        id: t.id,
        name: t.name,
        tacticId: t.tacticId,
      }));
    }

    await this.prisma.finding.update({
      where: { id: findingId },
      data: updateData,
    });
  }

  /**
   * Batch enrich findings that haven't been enriched yet
   */
  async enrichUnenrichedFindings(
    tenantId: string,
    limit: number = 100,
  ): Promise<EnrichmentResult> {
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        enrichedAt: null,
        OR: [{ cveId: { not: null } }, { cweId: { not: null } }],
      },
      select: { id: true, cveId: true, cweId: true },
      take: limit,
    });

    let enrichedCount = 0;
    let errorCount = 0;
    let kevCount = 0;
    let highEpssCount = 0;

    for (const finding of findings) {
      try {
        const enrichment = await this.vulnDbService.enrichFinding({
          cveId: finding.cveId,
          cweId: finding.cweId,
        });

        const updateData: Record<string, any> = {
          riskScore: enrichment.riskScore,
          enrichedAt: new Date(),
        };

        if (enrichment.cve) {
          updateData.cveData = {
            description: enrichment.cve.description,
            cvssV3Score: enrichment.cve.cvssV3Score,
            cvssV3Severity: enrichment.cve.cvssV3Severity,
            publishedDate: enrichment.cve.publishedDate,
            epssScore: enrichment.cve.epssScore,
            isKev: enrichment.cve.isKev,
          };
          updateData.epssScore = enrichment.cve.epssScore;
          updateData.isKev = enrichment.cve.isKev;

          if (enrichment.cve.isKev) kevCount++;
          if (enrichment.cve.epssScore && enrichment.cve.epssScore >= 0.5) highEpssCount++;
        }

        if (enrichment.cwe) {
          updateData.cweData = {
            name: enrichment.cwe.name,
            description: enrichment.cwe.description,
          };
        }

        if (enrichment.owaspCategory) {
          updateData.owaspCategory = enrichment.owaspCategory.id;
        }

        await this.prisma.finding.update({
          where: { id: finding.id },
          data: updateData,
        });

        enrichedCount++;
      } catch (error) {
        errorCount++;
      }
    }

    return { enrichedCount, errorCount, kevCount, highEpssCount };
  }

  /**
   * Get KEV findings that need attention
   */
  async getKevFindings(tenantId: string): Promise<any[]> {
    return this.prisma.finding.findMany({
      where: {
        tenantId,
        isKev: true,
        status: { in: ['open', 'triaged'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get high-risk findings based on EPSS score
   */
  async getHighRiskFindings(
    tenantId: string,
    minEpss: number = 0.5,
    limit: number = 50,
  ): Promise<any[]> {
    return this.prisma.finding.findMany({
      where: {
        tenantId,
        epssScore: { gte: minEpss },
        status: { in: ['open', 'triaged'] },
      },
      orderBy: { epssScore: 'desc' },
      take: limit,
    });
  }

  /**
   * Get findings by compliance framework
   */
  async getFindingsByFramework(
    tenantId: string,
    frameworkId: string,
  ): Promise<any[]> {
    // Get findings with compliance controls and filter in-memory
    const findings = await this.prisma.finding.findMany({
      where: {
        tenantId,
        status: { in: ['open', 'triaged'] },
        NOT: { complianceControls: { equals: Prisma.JsonNull } },
      },
    });

    // Filter by framework
    return findings.filter((f) => {
      const controls = f.complianceControls as Record<string, string[]> | null;
      return controls && controls[frameworkId];
    });
  }
}
