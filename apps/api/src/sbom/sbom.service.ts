import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface CreateSbomDto {
  name: string;
  version?: string;
  format: string;
  formatVersion: string;
  source: string;
  repositoryId?: string;
  rawContent?: string;
  scanId?: string;
}

interface CreateComponentDto {
  purl?: string;
  name: string;
  version?: string;
  type: string;
  supplier?: string;
  author?: string;
  license?: string;
  licenseSpdxId?: string;
  description?: string;
  checksum?: string;
  checksumAlgo?: string;
  homepage?: string;
  downloadUrl?: string;
  isDirect?: boolean;
  parentId?: string;
  depth?: number;
  scope?: string;
}

interface CreateVulnerabilityDto {
  cveId?: string;
  ghsaId?: string;
  osvId?: string;
  severity: string;
  cvssScore?: number;
  cvssVector?: string;
  title: string;
  description?: string;
  recommendation?: string;
  fixedVersion?: string;
  componentIds?: string[];
}

@Injectable()
export class SbomService {
  constructor(private prisma: PrismaService) {}

  // ===== SBOM CRUD =====

  async listSboms(
    tenantId: string,
    options?: {
      projectId?: string;
      repositoryId?: string;
      format?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    const where: Prisma.SbomWhereInput = { tenantId };

    if (options?.projectId) {
      where.projectId = options.projectId;
    }
    if (options?.repositoryId) {
      where.repositoryId = options.repositoryId;
    }
    if (options?.format) {
      where.format = options.format;
    }

    const [sboms, total] = await Promise.all([
      this.prisma.sbom.findMany({
        where,
        include: {
          _count: {
            select: {
              components: true,
              vulnerabilities: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.sbom.count({ where }),
    ]);

    return { sboms, total };
  }

  async getSbom(tenantId: string, id: string) {
    const sbom = await this.prisma.sbom.findFirst({
      where: { id, tenantId },
      include: {
        components: {
          include: {
            vulnerabilities: {
              include: {
                vulnerability: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
        vulnerabilities: {
          include: {
            components: {
              include: {
                component: true,
              },
            },
          },
          orderBy: [{ severity: 'asc' }, { cvssScore: 'desc' }],
        },
      },
    });

    if (!sbom) {
      throw new NotFoundException('SBOM not found');
    }

    return sbom;
  }

  async createSbom(tenantId: string, userId: string, dto: CreateSbomDto) {
    return this.prisma.sbom.create({
      data: {
        tenantId,
        name: dto.name,
        version: dto.version || '1.0.0',
        format: dto.format,
        formatVersion: dto.formatVersion,
        source: dto.source,
        repositoryId: dto.repositoryId,
        rawContent: dto.rawContent,
        scanId: dto.scanId,
        createdBy: userId,
      },
    });
  }

  async deleteSbom(tenantId: string, id: string) {
    const sbom = await this.prisma.sbom.findFirst({
      where: { id, tenantId },
    });

    if (!sbom) {
      throw new NotFoundException('SBOM not found');
    }

    await this.prisma.sbom.delete({ where: { id } });
    return { success: true };
  }

  // ===== COMPONENTS =====

  async addComponent(tenantId: string, sbomId: string, dto: CreateComponentDto) {
    const sbom = await this.prisma.sbom.findFirst({
      where: { id: sbomId, tenantId },
    });

    if (!sbom) {
      throw new NotFoundException('SBOM not found');
    }

    const component = await this.prisma.sbomComponent.create({
      data: {
        sbomId,
        purl: dto.purl,
        name: dto.name,
        version: dto.version,
        type: dto.type,
        supplier: dto.supplier,
        author: dto.author,
        license: dto.license,
        licenseSpdxId: dto.licenseSpdxId,
        description: dto.description,
        checksum: dto.checksum,
        checksumAlgo: dto.checksumAlgo,
        homepage: dto.homepage,
        downloadUrl: dto.downloadUrl,
        isDirect: dto.isDirect ?? true,
        parentId: dto.parentId,
        depth: dto.depth || 0,
        scope: dto.scope,
      },
    });

    // Update component count
    await this.updateSbomStats(sbomId);

    return component;
  }

  async deleteComponent(tenantId: string, componentId: string) {
    const component = await this.prisma.sbomComponent.findFirst({
      where: { id: componentId },
      include: { sbom: true },
    });

    if (!component || component.sbom.tenantId !== tenantId) {
      throw new NotFoundException('Component not found');
    }

    await this.prisma.sbomComponent.delete({ where: { id: componentId } });
    await this.updateSbomStats(component.sbomId);

    return { success: true };
  }

  // ===== VULNERABILITIES =====

  async addVulnerability(tenantId: string, sbomId: string, dto: CreateVulnerabilityDto) {
    const sbom = await this.prisma.sbom.findFirst({
      where: { id: sbomId, tenantId },
    });

    if (!sbom) {
      throw new NotFoundException('SBOM not found');
    }

    const vuln = await this.prisma.sbomVulnerability.create({
      data: {
        sbomId,
        cveId: dto.cveId,
        ghsaId: dto.ghsaId,
        osvId: dto.osvId,
        severity: dto.severity,
        cvssScore: dto.cvssScore,
        cvssVector: dto.cvssVector,
        title: dto.title,
        description: dto.description,
        recommendation: dto.recommendation,
        fixedVersion: dto.fixedVersion,
      },
    });

    // Link to components
    if (dto.componentIds?.length) {
      await this.prisma.sbomComponentVuln.createMany({
        data: dto.componentIds.map((componentId) => ({
          componentId,
          vulnId: vuln.id,
        })),
        skipDuplicates: true,
      });
    }

    await this.updateSbomStats(sbomId);

    return vuln;
  }

  async updateVulnerabilityStatus(
    tenantId: string,
    vulnId: string,
    status: string,
    userId: string,
    reason?: string,
  ) {
    const vuln = await this.prisma.sbomVulnerability.findFirst({
      where: { id: vulnId },
      include: { sbom: true },
    });

    if (!vuln || vuln.sbom.tenantId !== tenantId) {
      throw new NotFoundException('Vulnerability not found');
    }

    return this.prisma.sbomVulnerability.update({
      where: { id: vulnId },
      data: {
        status,
        ignoredReason: status === 'ignored' ? reason : null,
        ignoredBy: status === 'ignored' ? userId : null,
        ignoredAt: status === 'ignored' ? new Date() : null,
      },
    });
  }

  // ===== SBOM PARSING =====

  async parseSpdx(tenantId: string, userId: string, content: string, name: string) {
    const parsed = JSON.parse(content);

    if (!parsed.spdxVersion) {
      throw new BadRequestException('Invalid SPDX document');
    }

    const sbom = await this.createSbom(tenantId, userId, {
      name: name || parsed.name || 'Imported SBOM',
      format: 'spdx',
      formatVersion: parsed.spdxVersion,
      source: 'upload',
      rawContent: content,
    });

    // Parse packages
    const packages = parsed.packages || [];
    for (const pkg of packages) {
      if (pkg.SPDXID === 'SPDXRef-DOCUMENT') continue;

      await this.prisma.sbomComponent.create({
        data: {
          sbomId: sbom.id,
          name: pkg.name,
          version: pkg.versionInfo,
          type: 'library',
          supplier: pkg.supplier,
          license: pkg.licenseDeclared || pkg.licenseConcluded,
          homepage: pkg.homepage,
          downloadUrl: pkg.downloadLocation,
          checksum: pkg.checksums?.[0]?.checksumValue,
          checksumAlgo: pkg.checksums?.[0]?.algorithm,
          purl: pkg.externalRefs?.find((r: { referenceType: string }) => r.referenceType === 'purl')?.referenceLocator,
        },
      });
    }

    await this.updateSbomStats(sbom.id);
    return this.getSbom(tenantId, sbom.id);
  }

  async parseCycloneDx(tenantId: string, userId: string, content: string, name: string) {
    const parsed = JSON.parse(content);

    if (!parsed.bomFormat || parsed.bomFormat !== 'CycloneDX') {
      throw new BadRequestException('Invalid CycloneDX document');
    }

    const sbom = await this.createSbom(tenantId, userId, {
      name: name || parsed.metadata?.component?.name || 'Imported SBOM',
      format: 'cyclonedx',
      formatVersion: parsed.specVersion || '1.5',
      source: 'upload',
      rawContent: content,
    });

    // Parse components
    const components = parsed.components || [];
    for (const comp of components) {
      await this.prisma.sbomComponent.create({
        data: {
          sbomId: sbom.id,
          name: comp.name,
          version: comp.version,
          type: comp.type || 'library',
          supplier: comp.supplier?.name,
          author: comp.author,
          license: comp.licenses?.[0]?.license?.id || comp.licenses?.[0]?.license?.name,
          licenseSpdxId: comp.licenses?.[0]?.license?.id,
          description: comp.description,
          purl: comp.purl,
          checksum: comp.hashes?.[0]?.content,
          checksumAlgo: comp.hashes?.[0]?.alg,
        },
      });
    }

    // Parse vulnerabilities if present
    const vulnerabilities = parsed.vulnerabilities || [];
    for (const vuln of vulnerabilities) {
      const severity = vuln.ratings?.[0]?.severity?.toLowerCase() || 'unknown';
      const cvssScore = vuln.ratings?.[0]?.score;

      const createdVuln = await this.prisma.sbomVulnerability.create({
        data: {
          sbomId: sbom.id,
          cveId: vuln.id?.startsWith('CVE-') ? vuln.id : null,
          ghsaId: vuln.id?.startsWith('GHSA-') ? vuln.id : null,
          severity: severity === 'unknown' ? 'medium' : severity,
          cvssScore,
          cvssVector: vuln.ratings?.[0]?.vector,
          title: vuln.id || 'Unknown vulnerability',
          description: vuln.description,
          recommendation: vuln.recommendation,
        },
      });

      // Link to affected components
      const affectedPurls = vuln.affects?.map((a: { ref: string }) => a.ref) || [];
      if (affectedPurls.length) {
        const affectedComponents = await this.prisma.sbomComponent.findMany({
          where: { sbomId: sbom.id, purl: { in: affectedPurls } },
        });

        await this.prisma.sbomComponentVuln.createMany({
          data: affectedComponents.map((c) => ({
            componentId: c.id,
            vulnId: createdVuln.id,
          })),
          skipDuplicates: true,
        });
      }
    }

    await this.updateSbomStats(sbom.id);
    return this.getSbom(tenantId, sbom.id);
  }

  // ===== STATS =====

  async getSbomStats(tenantId: string, sbomId: string) {
    const sbom = await this.prisma.sbom.findFirst({
      where: { id: sbomId, tenantId },
      include: {
        components: true,
        vulnerabilities: true,
      },
    });

    if (!sbom) {
      throw new NotFoundException('SBOM not found');
    }

    const directDeps = sbom.components.filter((c) => c.isDirect).length;
    const transitiveDeps = sbom.components.filter((c) => !c.isDirect).length;

    const licenseDistribution = sbom.components.reduce(
      (acc, c) => {
        const license = c.license || 'Unknown';
        acc[license] = (acc[license] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const typeDistribution = sbom.components.reduce(
      (acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      componentCount: sbom.componentCount,
      directDeps,
      transitiveDeps,
      vulnCount: sbom.vulnCount,
      criticalCount: sbom.criticalCount,
      highCount: sbom.highCount,
      mediumCount: sbom.mediumCount,
      lowCount: sbom.lowCount,
      licenseDistribution,
      typeDistribution,
    };
  }

  private async updateSbomStats(sbomId: string) {
    const components = await this.prisma.sbomComponent.count({ where: { sbomId } });
    const vulns = await this.prisma.sbomVulnerability.findMany({
      where: { sbomId },
      select: { severity: true },
    });

    const counts = vulns.reduce(
      (acc, v) => {
        acc.total++;
        if (v.severity === 'critical') acc.critical++;
        else if (v.severity === 'high') acc.high++;
        else if (v.severity === 'medium') acc.medium++;
        else if (v.severity === 'low') acc.low++;
        return acc;
      },
      { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
    );

    await this.prisma.sbom.update({
      where: { id: sbomId },
      data: {
        componentCount: components,
        vulnCount: counts.total,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
      },
    });
  }

  // ===== DEPENDENCY GRAPH =====

  async getDependencyTree(tenantId: string, sbomId: string) {
    const sbom = await this.prisma.sbom.findFirst({
      where: { id: sbomId, tenantId },
      include: {
        components: {
          include: {
            vulnerabilities: {
              include: { vulnerability: true },
            },
          },
        },
      },
    });

    if (!sbom) {
      throw new NotFoundException('SBOM not found');
    }

    // Build tree structure
    const rootComponents = sbom.components.filter((c) => c.isDirect);

    const buildNode = (comp: (typeof sbom.components)[0]): object => ({
      id: comp.id,
      name: comp.name,
      version: comp.version,
      type: comp.type,
      license: comp.license,
      vulnerabilities: comp.vulnerabilities.map((v) => ({
        id: v.vulnerability.id,
        cveId: v.vulnerability.cveId,
        severity: v.vulnerability.severity,
        title: v.vulnerability.title,
      })),
      children: sbom.components
        .filter((c) => c.parentId === comp.id)
        .map((c) => buildNode(c)),
    });

    return {
      name: sbom.name,
      version: sbom.version,
      children: rootComponents.map(buildNode),
    };
  }
}
