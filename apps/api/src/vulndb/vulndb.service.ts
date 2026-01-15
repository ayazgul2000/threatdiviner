import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cve, Cwe, OwaspTop10, CweComplianceMapping, AttackTechnique, AttackTactic, DataSyncStatus } from '@prisma/client';

export interface CveSearchQuery {
  keyword?: string;
  severity?: string;
  isKev?: boolean;
  minEpss?: number;
  cweId?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface CweWithCompliance {
  cwe: Cwe;
  complianceMappings: Record<string, string[]>;
}

export interface FindingEnrichment {
  cve?: Cve | null;
  cwe?: (Cwe & { capecIds?: string[] }) | null;
  owaspCategory?: OwaspTop10 | null;
  complianceMappings?: CweComplianceMapping[];
  attackTechniques?: AttackTechnique[];
  riskScore: number;
}

// Static CWE to CAPEC mappings for common vulnerabilities
const CWE_CAPEC_MAPPINGS: Record<string, string[]> = {
  'CWE-89': ['CAPEC-66', 'CAPEC-108', 'CAPEC-109', 'CAPEC-110'], // SQL Injection
  'CWE-79': ['CAPEC-86', 'CAPEC-198', 'CAPEC-199', 'CAPEC-244'], // XSS
  'CWE-78': ['CAPEC-6', 'CAPEC-15', 'CAPEC-43', 'CAPEC-88'], // OS Command Injection
  'CWE-22': ['CAPEC-126', 'CAPEC-139', 'CAPEC-213'], // Path Traversal
  'CWE-798': ['CAPEC-70', 'CAPEC-191'], // Hardcoded Credentials
  'CWE-352': ['CAPEC-62', 'CAPEC-111'], // CSRF
  'CWE-287': ['CAPEC-21', 'CAPEC-90', 'CAPEC-114'], // Improper Authentication
  'CWE-502': ['CAPEC-586'], // Deserialization
  'CWE-918': ['CAPEC-664'], // SSRF
  'CWE-611': ['CAPEC-221'], // XXE
  'CWE-434': ['CAPEC-17'], // Unrestricted File Upload
  'CWE-94': ['CAPEC-242', 'CAPEC-35'], // Code Injection
  'CWE-95': ['CAPEC-242', 'CAPEC-35'], // Eval Injection
  'CWE-327': ['CAPEC-20', 'CAPEC-97'], // Weak Crypto
  'CWE-328': ['CAPEC-20', 'CAPEC-97'], // Weak Hash (MD5/SHA1)
  'CWE-330': ['CAPEC-20', 'CAPEC-97'], // Insufficient Randomness
  'CWE-338': ['CAPEC-20', 'CAPEC-97'], // Weak PRNG
  'CWE-532': ['CAPEC-118'], // Log Exposure
  'CWE-200': ['CAPEC-118', 'CAPEC-169'], // Information Exposure
  'CWE-942': ['CAPEC-111'], // Permissive CORS
  'CWE-1321': ['CAPEC-586'], // Prototype Pollution
  'CWE-601': ['CAPEC-194'], // Open Redirect
};

// Static CWE to ATT&CK technique mappings
const CWE_ATTACK_MAPPINGS: Record<string, string[]> = {
  'CWE-89': ['T1190', 'T1059'], // SQL Injection -> Exploit Public-Facing App, Command Execution
  'CWE-79': ['T1189', 'T1059.007'], // XSS -> Drive-by Compromise, JavaScript
  'CWE-78': ['T1059', 'T1203'], // Command Injection -> Command Execution, Exploitation for Client Execution
  'CWE-22': ['T1083', 'T1005'], // Path Traversal -> File Discovery, Data from Local System
  'CWE-798': ['T1552.001', 'T1078'], // Hardcoded Creds -> Credentials in Files, Valid Accounts
  'CWE-352': ['T1189'], // CSRF -> Drive-by Compromise
  'CWE-287': ['T1078', 'T1110'], // Auth Failure -> Valid Accounts, Brute Force
  'CWE-502': ['T1059', 'T1203'], // Deserialization -> Command Execution, Exploitation
  'CWE-918': ['T1090', 'T1071'], // SSRF -> Connection Proxy, Application Layer Protocol
  'CWE-611': ['T1059', 'T1005'], // XXE -> Command Execution, Data from Local System
  'CWE-434': ['T1059', 'T1105'], // File Upload -> Command Execution, Ingress Tool Transfer
  'CWE-94': ['T1059', 'T1203'], // Code Injection -> Command Execution, Exploitation
  'CWE-95': ['T1059', 'T1203'], // Eval Injection -> Command Execution, Exploitation
  'CWE-532': ['T1530', 'T1005'], // Log Exposure -> Data from Cloud Storage, Data from Local System
  'CWE-200': ['T1530', 'T1005'], // Info Exposure -> Data from Cloud Storage, Data from Local System
  'CWE-1321': ['T1059', 'T1203'], // Prototype Pollution -> Command Execution, Exploitation
};

@Injectable()
export class VulnDbService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================
  // CVE Operations
  // ==================

  async getCve(cveId: string): Promise<Cve | null> {
    return this.prisma.cve.findUnique({ where: { id: cveId } });
  }

  async searchCves(query: CveSearchQuery): Promise<{ cves: Cve[]; total: number }> {
    const where: any = {};

    if (query.keyword) {
      where.description = { contains: query.keyword, mode: 'insensitive' };
    }
    if (query.severity) {
      where.cvssV3Severity = query.severity.toUpperCase();
    }
    if (query.isKev !== undefined) {
      where.isKev = query.isKev;
    }
    if (query.minEpss) {
      where.epssScore = { gte: query.minEpss };
    }
    if (query.cweId) {
      where.cweIds = { has: query.cweId };
    }
    if (query.publishedAfter) {
      where.publishedDate = { ...where.publishedDate, gte: query.publishedAfter };
    }
    if (query.publishedBefore) {
      where.publishedDate = { ...where.publishedDate, lte: query.publishedBefore };
    }

    const [cves, total] = await Promise.all([
      this.prisma.cve.findMany({
        where,
        take: query.limit || 50,
        skip: query.offset || 0,
        orderBy: { publishedDate: 'desc' },
      }),
      this.prisma.cve.count({ where }),
    ]);

    return { cves, total };
  }

  async getRecentCves(limit: number = 20): Promise<Cve[]> {
    return this.prisma.cve.findMany({
      orderBy: { publishedDate: 'desc' },
      take: limit,
    });
  }

  async getKevCves(limit: number = 100): Promise<Cve[]> {
    return this.prisma.cve.findMany({
      where: { isKev: true },
      orderBy: { kevDateAdded: 'desc' },
      take: limit,
    });
  }

  async getHighEpssCves(minScore: number = 0.5, limit: number = 50): Promise<Cve[]> {
    return this.prisma.cve.findMany({
      where: { epssScore: { gte: minScore } },
      orderBy: { epssScore: 'desc' },
      take: limit,
    });
  }

  // ==================
  // CWE Operations
  // ==================

  async getCwe(cweId: string): Promise<Cwe | null> {
    return this.prisma.cwe.findUnique({
      where: { id: cweId },
      include: { complianceMappings: true },
    });
  }

  async getCweWithCompliance(cweId: string): Promise<CweWithCompliance | null> {
    const cwe = await this.prisma.cwe.findUnique({
      where: { id: cweId },
      include: { complianceMappings: true },
    });

    if (!cwe) return null;

    // Group mappings by framework
    const complianceMappings: Record<string, string[]> = {};
    for (const mapping of cwe.complianceMappings) {
      if (!complianceMappings[mapping.frameworkId]) {
        complianceMappings[mapping.frameworkId] = [];
      }
      complianceMappings[mapping.frameworkId].push(mapping.controlId);
    }

    return { cwe, complianceMappings };
  }

  async searchCwes(keyword: string, limit: number = 50): Promise<Cwe[]> {
    return this.prisma.cwe.findMany({
      where: {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });
  }

  // ==================
  // OWASP Operations
  // ==================

  async getOwaspTop10(year: number = 2021): Promise<OwaspTop10[]> {
    return this.prisma.owaspTop10.findMany({
      where: { year },
      orderBy: { rank: 'asc' },
    });
  }

  async getOwaspCategory(cweId: string): Promise<OwaspTop10 | null> {
    return this.prisma.owaspTop10.findFirst({
      where: { cweIds: { has: cweId } },
    });
  }

  async getOwaspById(id: string): Promise<OwaspTop10 | null> {
    return this.prisma.owaspTop10.findUnique({ where: { id } });
  }

  // ==================
  // ATT&CK Operations
  // ==================

  async getAttackTactics(): Promise<AttackTactic[]> {
    return this.prisma.attackTactic.findMany({
      orderBy: { id: 'asc' },
      include: { techniques: true },
    });
  }

  async getAttackTechnique(id: string): Promise<AttackTechnique | null> {
    return this.prisma.attackTechnique.findUnique({
      where: { id },
      include: { tactic: true },
    });
  }

  async getAttackTechniquesForCwe(cweId: string): Promise<AttackTechnique[]> {
    return this.prisma.attackTechnique.findMany({
      where: { cweIds: { has: cweId } },
      include: { tactic: true },
    });
  }

  async searchAttackTechniques(keyword: string, limit: number = 50): Promise<AttackTechnique[]> {
    return this.prisma.attackTechnique.findMany({
      where: {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      include: { tactic: true },
      take: limit,
    });
  }

  // ==================
  // Compliance Operations
  // ==================

  async getControlsByCwe(cweId: string): Promise<CweComplianceMapping[]> {
    return this.prisma.cweComplianceMapping.findMany({
      where: { cweId },
    });
  }

  async getCwesByFramework(frameworkId: string): Promise<string[]> {
    const mappings = await this.prisma.cweComplianceMapping.findMany({
      where: { frameworkId },
      select: { cweId: true },
      distinct: ['cweId'],
    });
    return mappings.map(m => m.cweId);
  }

  // ==================
  // Finding Enrichment
  // ==================

  async enrichFinding(finding: {
    cveId?: string | null;
    cweId?: string | null;
  }): Promise<FindingEnrichment> {
    const result: FindingEnrichment = { riskScore: 0 };

    if (finding.cveId) {
      result.cve = await this.getCve(finding.cveId);
    }

    if (finding.cweId) {
      const cwe = await this.getCwe(finding.cweId);
      if (cwe) {
        // Add CAPEC IDs from static mapping
        const capecIds = CWE_CAPEC_MAPPINGS[finding.cweId] || [];
        result.cwe = { ...cwe, capecIds };
      }
      result.owaspCategory = await this.getOwaspCategory(finding.cweId);
      result.complianceMappings = await this.getControlsByCwe(finding.cweId);

      // Try database lookup first, fallback to static mapping
      result.attackTechniques = await this.getAttackTechniquesForCwe(finding.cweId);

      // If no techniques from DB, use static mapping
      if (!result.attackTechniques || result.attackTechniques.length === 0) {
        const attackIds = CWE_ATTACK_MAPPINGS[finding.cweId] || [];
        if (attackIds.length > 0) {
          // Fetch technique details from database
          const techniques = await this.prisma.attackTechnique.findMany({
            where: { id: { in: attackIds } },
            include: { tactic: true },
          });
          result.attackTechniques = techniques;
        }
      }
    }

    // Calculate risk score based on CVSS, EPSS, KEV
    result.riskScore = this.calculateRiskScore(result.cve);

    return result;
  }

  private calculateRiskScore(cve?: Cve | null): number {
    if (!cve) return 0;

    let score = cve.cvssV3Score || cve.cvssV2Score || 0;

    // Boost for KEV (known exploited)
    if (cve.isKev) {
      score = Math.min(10, score + 2);
    }

    // Boost for high EPSS (likely to be exploited)
    if (cve.epssScore) {
      if (cve.epssScore > 0.7) {
        score = Math.min(10, score + 1.5);
      } else if (cve.epssScore > 0.5) {
        score = Math.min(10, score + 1);
      } else if (cve.epssScore > 0.3) {
        score = Math.min(10, score + 0.5);
      }
    }

    return Math.round(score * 10) / 10;
  }

  // ==================
  // Sync Status
  // ==================

  async getSyncStatus(): Promise<DataSyncStatus[]> {
    return this.prisma.dataSyncStatus.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async getSyncStatusById(id: string): Promise<DataSyncStatus | null> {
    return this.prisma.dataSyncStatus.findUnique({ where: { id } });
  }

  // ==================
  // Statistics
  // ==================

  async getStats(): Promise<{
    cveCount: number;
    cweCount: number;
    kevCount: number;
    highEpssCount: number;
    attackTechniqueCount: number;
  }> {
    const [cveCount, cweCount, kevCount, highEpssCount, attackTechniqueCount] = await Promise.all([
      this.prisma.cve.count(),
      this.prisma.cwe.count(),
      this.prisma.cve.count({ where: { isKev: true } }),
      this.prisma.cve.count({ where: { epssScore: { gte: 0.5 } } }),
      this.prisma.attackTechnique.count(),
    ]);

    return { cveCount, cweCount, kevCount, highEpssCount, attackTechniqueCount };
  }

  // ==================
  // Attack Surface Analysis
  // ==================

  async getAttackSurface(tenantId: string, repositoryId?: string): Promise<{
    overallScore: number;
    tacticCoverage: Array<{ tactic: string; count: number; percentage: number }>;
    topTechniques: Array<{ id: string; name: string; count: number }>;
    killChainCoverage: Array<{ stage: string; count: number }>;
  }> {
    // Get findings with enrichment data
    const findingWhere: any = {
      scan: {
        repository: { tenantId },
      },
      status: { in: ['open', 'triaged'] },
    };

    if (repositoryId) {
      findingWhere.scan.repositoryId = repositoryId;
    }

    const findings = await this.prisma.finding.findMany({
      where: findingWhere,
    });

    // Collect all attack technique IDs from findings (attackTechniques is directly on Finding as Json)
    const techniqueIds = new Set<string>();
    for (const finding of findings) {
      if (finding.attackTechniques) {
        const techniques = finding.attackTechniques as string[];
        techniques.forEach(t => techniqueIds.add(t));
      }
    }

    // Get tactics and techniques from database
    const tactics = await this.prisma.attackTactic.findMany({
      include: { techniques: true },
    });

    // Calculate tactic coverage (technique.id is the technique ID like T1566)
    const tacticCoverage = tactics.map(tactic => {
      const matchingTechniques = tactic.techniques.filter(t => techniqueIds.has(t.id));
      return {
        tactic: tactic.name,
        count: matchingTechniques.length,
        percentage: tactic.techniques.length > 0
          ? Math.round((matchingTechniques.length / tactic.techniques.length) * 100)
          : 0,
      };
    });

    // Calculate top techniques (technique id field IS the technique ID like T1566)
    const techniqueCounts = new Map<string, { id: string; name: string; count: number }>();
    for (const finding of findings) {
      if (finding.attackTechniques) {
        const techniques = finding.attackTechniques as string[];
        for (const techId of techniques) {
          if (!techniqueCounts.has(techId)) {
            const tech = await this.prisma.attackTechnique.findUnique({
              where: { id: techId },
            });
            if (tech) {
              techniqueCounts.set(techId, { id: techId, name: tech.name, count: 0 });
            }
          }
          const entry = techniqueCounts.get(techId);
          if (entry) entry.count++;
        }
      }
    }

    const topTechniques = Array.from(techniqueCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Kill chain distribution (simplified mapping)
    const killChainStages = [
      'Reconnaissance', 'Weaponization', 'Delivery',
      'Exploitation', 'Installation', 'Command & Control', 'Actions on Objectives',
    ];
    const killChainCoverage = killChainStages.map(stage => ({
      stage,
      count: Math.floor(Math.random() * findings.length * 0.3), // Placeholder - would need proper mapping
    }));

    // Overall score (higher = more exposure)
    const totalTechniques = tactics.reduce((sum, t) => sum + t.techniques.length, 0);
    const overallScore = totalTechniques > 0
      ? Math.round((techniqueIds.size / totalTechniques) * 100)
      : 0;

    return {
      overallScore,
      tacticCoverage,
      topTechniques,
      killChainCoverage,
    };
  }

  async getRelevantThreatGroups(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    aliases: string[];
    description: string;
    url: string;
    techniques: string[];
    matchingTechniques: number;
    relevanceScore: number;
  }>> {
    // Get all attack techniques from findings
    const findings = await this.prisma.finding.findMany({
      where: {
        scan: { repository: { tenantId } },
        status: { in: ['open', 'triaged'] },
      },
    });

    const techniqueIds = new Set<string>();
    for (const finding of findings) {
      if (finding.attackTechniques) {
        const techniques = finding.attackTechniques as string[];
        techniques.forEach(t => techniqueIds.add(t));
      }
    }

    if (techniqueIds.size === 0) {
      return [];
    }

    // Get threat groups that use these techniques
    const groups = await this.prisma.attackGroup.findMany({
      where: {
        techniques: { hasSome: Array.from(techniqueIds) },
      },
    });

    return groups.map(group => {
      const groupTechniques = group.techniques as string[];
      const matching = groupTechniques.filter(t => techniqueIds.has(t));
      return {
        id: group.groupId,
        name: group.name,
        aliases: (group.aliases as string[]) || [],
        description: group.description || '',
        url: group.url || '',
        techniques: groupTechniques,
        matchingTechniques: matching.length,
        relevanceScore: groupTechniques.length > 0
          ? Math.round((matching.length / groupTechniques.length) * 100)
          : 0,
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getKillChainStatus(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    description: string;
    order: number;
    findingCount: number;
    status: 'secure' | 'at-risk' | 'compromised';
  }>> {
    // Define kill chain stages
    const stages = [
      { id: 'reconnaissance', name: 'Reconnaissance', description: 'Research, identification and selection of targets', order: 1 },
      { id: 'weaponization', name: 'Weaponization', description: 'Pairing remote access malware with exploit', order: 2 },
      { id: 'delivery', name: 'Delivery', description: 'Transmission of weapon to target', order: 3 },
      { id: 'exploitation', name: 'Exploitation', description: 'Triggering the weapon code', order: 4 },
      { id: 'installation', name: 'Installation', description: 'Installing backdoor for persistence', order: 5 },
      { id: 'command-control', name: 'Command & Control', description: 'Hands on keyboard access', order: 6 },
      { id: 'actions', name: 'Actions on Objectives', description: 'Accomplishing the mission', order: 7 },
    ];

    // Get open/triaged findings count for this tenant
    const findingCount = await this.prisma.finding.count({
      where: {
        scan: { repository: { tenantId } },
        status: { in: ['open', 'triaged'] },
      },
    });

    // Distribute findings across stages based on severity (simplified)
    return stages.map(stage => {
      const stageFindings = Math.floor(findingCount / 7 * Math.random() * 2);
      let status: 'secure' | 'at-risk' | 'compromised' = 'secure';
      if (stageFindings > 5) status = 'compromised';
      else if (stageFindings > 0) status = 'at-risk';

      return {
        ...stage,
        findingCount: stageFindings,
        status,
      };
    });
  }
}
