import { Injectable } from '@nestjs/common';

export interface BusinessObjective {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  securityRequirements: string[];
}

export interface TechnicalScope {
  components: TechnicalComponent[];
  dataFlows: DataFlow[];
  trustBoundaries: TrustBoundary[];
}

export interface TechnicalComponent {
  id: string;
  name: string;
  type: 'application' | 'service' | 'database' | 'network' | 'infrastructure' | 'external';
  technology: string;
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  exposedInterfaces: string[];
}

export interface DataFlow {
  id: string;
  source: string;
  target: string;
  protocol: string;
  dataTypes: string[];
  encrypted: boolean;
  authenticated: boolean;
}

export interface TrustBoundary {
  id: string;
  name: string;
  type: 'network' | 'process' | 'machine' | 'external';
  components: string[];
}

export interface Vulnerability {
  id: string;
  cveId?: string;
  cweId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedComponent: string;
  exploitability: number;
  cvssScore?: number;
}

export interface AttackVector {
  id: string;
  name: string;
  description: string;
  attackerProfile: string;
  entryPoint: string;
  targetAsset: string;
  vulnerabilitiesExploited: string[];
  techniques: string[];
  likelihood: 'high' | 'medium' | 'low';
}

export interface PastaStage {
  stage: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  outputs: any;
}

export interface PastaAnalysisResult {
  modelId: string;
  stages: PastaStage[];
  riskMatrix: RiskMatrixEntry[];
  prioritizedThreats: PrioritizedThreat[];
  mitigationStrategy: MitigationStrategy[];
}

export interface RiskMatrixEntry {
  threatId: string;
  threatName: string;
  likelihood: number;
  impact: number;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
}

export interface PrioritizedThreat {
  id: string;
  name: string;
  description: string;
  attackVector: AttackVector;
  vulnerabilities: Vulnerability[];
  businessImpact: string;
  riskScore: number;
  affectedObjectives: string[];
}

export interface MitigationStrategy {
  threatId: string;
  strategy: 'avoid' | 'transfer' | 'mitigate' | 'accept';
  controls: SecurityControl[];
  residualRisk: number;
  implementationPriority: number;
}

export interface SecurityControl {
  id: string;
  name: string;
  type: 'preventive' | 'detective' | 'corrective' | 'compensating';
  description: string;
  effectiveness: number;
  implementationEffort: 'low' | 'medium' | 'high';
}

@Injectable()
export class PastaAnalyzer {
  async analyze(
    modelId: string,
    businessObjectives: BusinessObjective[],
    technicalScope: TechnicalScope,
    knownVulnerabilities: Vulnerability[] = []
  ): Promise<PastaAnalysisResult> {
    const stages: PastaStage[] = [];

    // Stage 1: Define Business Objectives
    const stage1 = await this.stage1DefineObjectives(businessObjectives);
    stages.push(stage1);

    // Stage 2: Define Technical Scope
    const stage2 = await this.stage2DefineTechnicalScope(technicalScope);
    stages.push(stage2);

    // Stage 3: Application Decomposition
    const stage3 = await this.stage3DecomposeApplication(technicalScope);
    stages.push(stage3);

    // Stage 4: Threat Analysis
    const stage4 = await this.stage4AnalyzeThreats(technicalScope, stage3.outputs);
    stages.push(stage4);

    // Stage 5: Vulnerability Analysis
    const stage5 = await this.stage5AnalyzeVulnerabilities(
      technicalScope,
      knownVulnerabilities,
      stage4.outputs
    );
    stages.push(stage5);

    // Stage 6: Attack Modeling
    const stage6 = await this.stage6ModelAttacks(
      stage4.outputs,
      stage5.outputs,
      technicalScope
    );
    stages.push(stage6);

    // Stage 7: Risk & Impact Analysis
    const stage7 = await this.stage7AnalyzeRiskAndImpact(
      businessObjectives,
      stage6.outputs,
      stage5.outputs
    );
    stages.push(stage7);

    return {
      modelId,
      stages,
      riskMatrix: stage7.outputs.riskMatrix,
      prioritizedThreats: stage7.outputs.prioritizedThreats,
      mitigationStrategy: stage7.outputs.mitigationStrategy,
    };
  }

  private async stage1DefineObjectives(objectives: BusinessObjective[]): Promise<PastaStage> {
    const prioritizedObjectives = objectives.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const securityRequirements = new Set<string>();
    for (const obj of objectives) {
      for (const req of obj.securityRequirements) {
        securityRequirements.add(req);
      }
    }

    return {
      stage: 1,
      name: 'Define Business Objectives',
      status: 'completed',
      outputs: {
        prioritizedObjectives,
        securityRequirements: Array.from(securityRequirements),
        objectiveCount: objectives.length,
        criticalObjectives: objectives.filter(o => o.priority === 'critical').length,
      },
    };
  }

  private async stage2DefineTechnicalScope(scope: TechnicalScope): Promise<PastaStage> {
    const componentsByType: Record<string, number> = {};
    const dataClassifications: Record<string, number> = {};

    for (const component of scope.components) {
      componentsByType[component.type] = (componentsByType[component.type] || 0) + 1;
      dataClassifications[component.dataClassification] =
        (dataClassifications[component.dataClassification] || 0) + 1;
    }

    const externalInterfaces = scope.components
      .filter(c => c.type === 'external' || c.exposedInterfaces.length > 0)
      .flatMap(c => c.exposedInterfaces);

    return {
      stage: 2,
      name: 'Define Technical Scope',
      status: 'completed',
      outputs: {
        componentCount: scope.components.length,
        componentsByType,
        dataClassifications,
        dataFlowCount: scope.dataFlows.length,
        trustBoundaryCount: scope.trustBoundaries.length,
        externalInterfaces,
        encryptedFlows: scope.dataFlows.filter(f => f.encrypted).length,
        unauthenticatedFlows: scope.dataFlows.filter(f => !f.authenticated).length,
      },
    };
  }

  private async stage3DecomposeApplication(scope: TechnicalScope): Promise<PastaStage> {
    // Identify entry points
    const entryPoints = scope.components.filter(
      c => c.type === 'external' || c.exposedInterfaces.length > 0
    );

    // Identify assets (data stores and sensitive components)
    const assets = scope.components.filter(
      c => c.type === 'database' || c.dataClassification === 'restricted' || c.dataClassification === 'confidential'
    );

    // Map data flows across trust boundaries
    const crossBoundaryFlows = scope.dataFlows.filter(flow => {
      const sourceComponent = scope.components.find(c => c.id === flow.source || c.name === flow.source);
      const targetComponent = scope.components.find(c => c.id === flow.target || c.name === flow.target);

      if (!sourceComponent || !targetComponent) return false;

      const sourceBoundary = scope.trustBoundaries.find(b => b.components.includes(sourceComponent.id));
      const targetBoundary = scope.trustBoundaries.find(b => b.components.includes(targetComponent.id));

      return sourceBoundary?.id !== targetBoundary?.id;
    });

    // Identify security controls
    const securityControls = this.identifyExistingControls(scope);

    return {
      stage: 3,
      name: 'Application Decomposition',
      status: 'completed',
      outputs: {
        entryPoints: entryPoints.map(e => ({
          id: e.id,
          name: e.name,
          interfaces: e.exposedInterfaces,
        })),
        assets: assets.map(a => ({
          id: a.id,
          name: a.name,
          classification: a.dataClassification,
          type: a.type,
        })),
        crossBoundaryFlows,
        securityControls,
        attackSurface: entryPoints.length + scope.dataFlows.filter(f => !f.authenticated).length,
      },
    };
  }

  private async stage4AnalyzeThreats(
    scope: TechnicalScope,
    decomposition: any
  ): Promise<PastaStage> {
    const threats: any[] = [];

    // Analyze threats based on entry points
    for (const entryPoint of decomposition.entryPoints) {
      const component = scope.components.find(c => c.id === entryPoint.id);
      if (!component) continue;

      // Add threats based on component type and exposure
      threats.push(...this.generateThreatsForComponent(component, entryPoint));
    }

    // Analyze threats based on data flows
    for (const flow of decomposition.crossBoundaryFlows) {
      threats.push(...this.generateThreatsForDataFlow(flow));
    }

    // Add threats for sensitive assets
    for (const asset of decomposition.assets) {
      threats.push(...this.generateThreatsForAsset(asset));
    }

    // Deduplicate and categorize threats
    const uniqueThreats = this.deduplicateThreats(threats);
    const categorizedThreats = this.categorizeThreats(uniqueThreats);

    return {
      stage: 4,
      name: 'Threat Analysis',
      status: 'completed',
      outputs: {
        threats: uniqueThreats,
        categorizedThreats,
        threatCount: uniqueThreats.length,
        threatsByCategory: Object.fromEntries(
          Object.entries(categorizedThreats).map(([k, v]) => [k, (v as any[]).length])
        ),
      },
    };
  }

  private async stage5AnalyzeVulnerabilities(
    scope: TechnicalScope,
    knownVulnerabilities: Vulnerability[],
    threatAnalysis: any
  ): Promise<PastaStage> {
    const vulnerabilities: Vulnerability[] = [...knownVulnerabilities];

    // Infer vulnerabilities from architecture
    for (const component of scope.components) {
      const inferredVulns = this.inferVulnerabilities(component);
      vulnerabilities.push(...inferredVulns);
    }

    // Check for vulnerabilities in data flows
    for (const flow of scope.dataFlows) {
      if (!flow.encrypted) {
        vulnerabilities.push({
          id: `VULN-FLOW-${flow.id}`,
          cweId: 'CWE-319',
          title: 'Cleartext Transmission',
          description: `Data flow from ${flow.source} to ${flow.target} transmits data in cleartext`,
          severity: 'high',
          affectedComponent: `${flow.source} -> ${flow.target}`,
          exploitability: 8,
        });
      }
      if (!flow.authenticated) {
        vulnerabilities.push({
          id: `VULN-AUTH-${flow.id}`,
          cweId: 'CWE-306',
          title: 'Missing Authentication',
          description: `Data flow from ${flow.source} to ${flow.target} lacks authentication`,
          severity: 'high',
          affectedComponent: `${flow.source} -> ${flow.target}`,
          exploitability: 9,
        });
      }
    }

    // Map vulnerabilities to threats
    const vulnThreatMapping = this.mapVulnerabilitiesToThreats(
      vulnerabilities,
      threatAnalysis.threats
    );

    return {
      stage: 5,
      name: 'Vulnerability Analysis',
      status: 'completed',
      outputs: {
        vulnerabilities,
        vulnerabilityCount: vulnerabilities.length,
        bySeverity: {
          critical: vulnerabilities.filter(v => v.severity === 'critical').length,
          high: vulnerabilities.filter(v => v.severity === 'high').length,
          medium: vulnerabilities.filter(v => v.severity === 'medium').length,
          low: vulnerabilities.filter(v => v.severity === 'low').length,
        },
        vulnThreatMapping,
      },
    };
  }

  private async stage6ModelAttacks(
    threatAnalysis: any,
    vulnAnalysis: any,
    scope: TechnicalScope
  ): Promise<PastaStage> {
    const attackVectors: AttackVector[] = [];

    // Generate attack vectors by combining threats and vulnerabilities
    for (const threat of threatAnalysis.threats) {
      const relatedVulns = vulnAnalysis.vulnerabilities.filter(
        (v: Vulnerability) => vulnAnalysis.vulnThreatMapping[threat.id]?.includes(v.id)
      );

      if (relatedVulns.length === 0) continue;

      const attackVector = this.generateAttackVector(threat, relatedVulns, scope);
      if (attackVector) {
        attackVectors.push(attackVector);
      }
    }

    // Generate attack trees for high-risk vectors
    const attackTrees = attackVectors
      .filter(av => av.likelihood === 'high')
      .map(av => this.generateSimpleAttackTree(av));

    return {
      stage: 6,
      name: 'Attack Modeling',
      status: 'completed',
      outputs: {
        attackVectors,
        attackVectorCount: attackVectors.length,
        byLikelihood: {
          high: attackVectors.filter(a => a.likelihood === 'high').length,
          medium: attackVectors.filter(a => a.likelihood === 'medium').length,
          low: attackVectors.filter(a => a.likelihood === 'low').length,
        },
        attackTrees,
      },
    };
  }

  private async stage7AnalyzeRiskAndImpact(
    objectives: BusinessObjective[],
    attackModeling: any,
    vulnAnalysis: any
  ): Promise<PastaStage> {
    const riskMatrix: RiskMatrixEntry[] = [];
    const prioritizedThreats: PrioritizedThreat[] = [];

    for (const attackVector of attackModeling.attackVectors) {
      // Calculate likelihood score (1-5)
      const likelihoodScore = this.calculateLikelihoodScore(attackVector, vulnAnalysis);

      // Calculate impact score based on business objectives
      const impactScore = this.calculateImpactScore(attackVector, objectives);

      // Calculate risk score
      const riskScore = likelihoodScore * impactScore;
      const riskLevel = this.getRiskLevel(riskScore);

      riskMatrix.push({
        threatId: attackVector.id,
        threatName: attackVector.name,
        likelihood: likelihoodScore,
        impact: impactScore,
        riskScore,
        riskLevel,
      });

      // Identify affected objectives
      const affectedObjectives = objectives
        .filter(obj => this.isObjectiveAffected(obj, attackVector))
        .map(obj => obj.id);

      prioritizedThreats.push({
        id: attackVector.id,
        name: attackVector.name,
        description: attackVector.description,
        attackVector,
        vulnerabilities: attackVector.vulnerabilitiesExploited.map(
          (vId: string) => vulnAnalysis.vulnerabilities.find((v: Vulnerability) => v.id === vId)
        ).filter(Boolean),
        businessImpact: this.describeBusinessImpact(attackVector, objectives),
        riskScore,
        affectedObjectives,
      });
    }

    // Sort by risk score
    prioritizedThreats.sort((a, b) => b.riskScore - a.riskScore);

    // Generate mitigation strategies
    const mitigationStrategy = prioritizedThreats.map(threat =>
      this.generateMitigationStrategy(threat)
    );

    return {
      stage: 7,
      name: 'Risk & Impact Analysis',
      status: 'completed',
      outputs: {
        riskMatrix,
        prioritizedThreats,
        mitigationStrategy,
        summary: {
          criticalRisks: riskMatrix.filter(r => r.riskLevel === 'critical').length,
          highRisks: riskMatrix.filter(r => r.riskLevel === 'high').length,
          mediumRisks: riskMatrix.filter(r => r.riskLevel === 'medium').length,
          lowRisks: riskMatrix.filter(r => r.riskLevel === 'low').length,
          totalRiskScore: riskMatrix.reduce((sum, r) => sum + r.riskScore, 0),
        },
      },
    };
  }

  // Helper methods

  private identifyExistingControls(scope: TechnicalScope): SecurityControl[] {
    const controls: SecurityControl[] = [];

    // Check for encryption
    const encryptedFlows = scope.dataFlows.filter(f => f.encrypted);
    if (encryptedFlows.length > 0) {
      controls.push({
        id: 'CTRL-ENC-001',
        name: 'Data Encryption in Transit',
        type: 'preventive',
        description: `${encryptedFlows.length} data flows use encryption`,
        effectiveness: encryptedFlows.length / scope.dataFlows.length,
        implementationEffort: 'medium',
      });
    }

    // Check for authentication
    const authenticatedFlows = scope.dataFlows.filter(f => f.authenticated);
    if (authenticatedFlows.length > 0) {
      controls.push({
        id: 'CTRL-AUTH-001',
        name: 'Authentication Controls',
        type: 'preventive',
        description: `${authenticatedFlows.length} data flows require authentication`,
        effectiveness: authenticatedFlows.length / scope.dataFlows.length,
        implementationEffort: 'medium',
      });
    }

    return controls;
  }

  private generateThreatsForComponent(component: TechnicalComponent, _entryPoint: any): any[] {
    const threats: any[] = [];

    if (component.type === 'application' || component.type === 'service') {
      threats.push({
        id: `THREAT-${component.id}-INJ`,
        name: `Injection Attack on ${component.name}`,
        category: 'tampering',
        description: `Attacker could inject malicious payloads through ${component.name}`,
        targetComponent: component.id,
      });

      threats.push({
        id: `THREAT-${component.id}-AUTH`,
        name: `Authentication Bypass on ${component.name}`,
        category: 'spoofing',
        description: `Attacker could bypass authentication on ${component.name}`,
        targetComponent: component.id,
      });
    }

    if (component.type === 'database') {
      threats.push({
        id: `THREAT-${component.id}-SQLI`,
        name: `SQL Injection on ${component.name}`,
        category: 'tampering',
        description: `Attacker could execute unauthorized SQL queries on ${component.name}`,
        targetComponent: component.id,
      });

      threats.push({
        id: `THREAT-${component.id}-LEAK`,
        name: `Data Leakage from ${component.name}`,
        category: 'information_disclosure',
        description: `Sensitive data could be exposed from ${component.name}`,
        targetComponent: component.id,
      });
    }

    return threats;
  }

  private generateThreatsForDataFlow(flow: DataFlow): any[] {
    const threats: any[] = [];

    if (!flow.encrypted) {
      threats.push({
        id: `THREAT-${flow.id}-MITM`,
        name: `Man-in-the-Middle on ${flow.source} -> ${flow.target}`,
        category: 'tampering',
        description: `Unencrypted data flow allows interception and modification`,
        targetComponent: flow.id,
      });
    }

    if (!flow.authenticated) {
      threats.push({
        id: `THREAT-${flow.id}-SPOOF`,
        name: `Request Spoofing on ${flow.source} -> ${flow.target}`,
        category: 'spoofing',
        description: `Unauthenticated flow allows request spoofing`,
        targetComponent: flow.id,
      });
    }

    return threats;
  }

  private generateThreatsForAsset(asset: any): any[] {
    const threats: any[] = [];

    if (asset.classification === 'restricted' || asset.classification === 'confidential') {
      threats.push({
        id: `THREAT-${asset.id}-ACCESS`,
        name: `Unauthorized Access to ${asset.name}`,
        category: 'information_disclosure',
        description: `Sensitive data in ${asset.name} could be accessed without authorization`,
        targetComponent: asset.id,
      });

      threats.push({
        id: `THREAT-${asset.id}-EXFIL`,
        name: `Data Exfiltration from ${asset.name}`,
        category: 'information_disclosure',
        description: `Data from ${asset.name} could be exfiltrated by attackers`,
        targetComponent: asset.id,
      });
    }

    return threats;
  }

  private deduplicateThreats(threats: any[]): any[] {
    const seen = new Set<string>();
    return threats.filter(threat => {
      const key = `${threat.category}-${threat.targetComponent}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private categorizeThreats(threats: any[]): Record<string, any[]> {
    const categories: Record<string, any[]> = {
      spoofing: [],
      tampering: [],
      repudiation: [],
      information_disclosure: [],
      denial_of_service: [],
      elevation_of_privilege: [],
    };

    for (const threat of threats) {
      if (categories[threat.category]) {
        categories[threat.category].push(threat);
      }
    }

    return categories;
  }

  private inferVulnerabilities(component: TechnicalComponent): Vulnerability[] {
    const vulns: Vulnerability[] = [];

    // Technology-specific vulnerabilities
    const techLower = component.technology.toLowerCase();

    if (techLower.includes('java') || techLower.includes('spring')) {
      vulns.push({
        id: `VULN-${component.id}-DESER`,
        cweId: 'CWE-502',
        title: 'Deserialization Vulnerability',
        description: `Java/Spring application ${component.name} may be vulnerable to deserialization attacks`,
        severity: 'high',
        affectedComponent: component.name,
        exploitability: 7,
      });
    }

    if (techLower.includes('node') || techLower.includes('javascript')) {
      vulns.push({
        id: `VULN-${component.id}-PROTO`,
        cweId: 'CWE-1321',
        title: 'Prototype Pollution',
        description: `Node.js application ${component.name} may be vulnerable to prototype pollution`,
        severity: 'medium',
        affectedComponent: component.name,
        exploitability: 6,
      });
    }

    if (component.type === 'database') {
      vulns.push({
        id: `VULN-${component.id}-SQLI`,
        cweId: 'CWE-89',
        title: 'SQL Injection Risk',
        description: `Database ${component.name} may be exposed to SQL injection via connected applications`,
        severity: 'high',
        affectedComponent: component.name,
        exploitability: 8,
      });
    }

    return vulns;
  }

  private mapVulnerabilitiesToThreats(
    vulnerabilities: Vulnerability[],
    threats: any[]
  ): Record<string, string[]> {
    const mapping: Record<string, string[]> = {};

    for (const threat of threats) {
      mapping[threat.id] = vulnerabilities
        .filter(v => {
          // Map by affected component
          if (v.affectedComponent === threat.targetComponent) return true;
          // Map by category/CWE relationship
          if (threat.category === 'tampering' && v.cweId.match(/CWE-(89|79|94)/)) return true;
          if (threat.category === 'spoofing' && v.cweId.match(/CWE-(287|306)/)) return true;
          if (threat.category === 'information_disclosure' && v.cweId.match(/CWE-(200|312|319)/)) return true;
          return false;
        })
        .map(v => v.id);
    }

    return mapping;
  }

  private generateAttackVector(
    threat: any,
    vulnerabilities: Vulnerability[],
    _scope: TechnicalScope
  ): AttackVector | null {
    if (vulnerabilities.length === 0) return null;

    const maxExploitability = Math.max(...vulnerabilities.map(v => v.exploitability));
    const likelihood = maxExploitability >= 8 ? 'high' : maxExploitability >= 5 ? 'medium' : 'low';

    return {
      id: `AV-${threat.id}`,
      name: threat.name,
      description: threat.description,
      attackerProfile: 'External Attacker',
      entryPoint: threat.targetComponent,
      targetAsset: threat.targetComponent,
      vulnerabilitiesExploited: vulnerabilities.map(v => v.id),
      techniques: this.getRelevantTechniques(threat, vulnerabilities),
      likelihood,
    };
  }

  private getRelevantTechniques(_threat: any, vulnerabilities: Vulnerability[]): string[] {
    const techniques: string[] = [];

    for (const vuln of vulnerabilities) {
      if (vuln.cweId === 'CWE-89') techniques.push('T1190'); // Exploit Public-Facing Application
      if (vuln.cweId === 'CWE-79') techniques.push('T1059'); // Command and Scripting Interpreter
      if (vuln.cweId === 'CWE-287') techniques.push('T1078'); // Valid Accounts
      if (vuln.cweId === 'CWE-319') techniques.push('T1557'); // Man-in-the-Middle
      if (vuln.cweId === 'CWE-502') techniques.push('T1059.007'); // JavaScript
    }

    return [...new Set(techniques)];
  }

  private generateSimpleAttackTree(attackVector: AttackVector): any {
    return {
      goal: attackVector.name,
      root: {
        type: 'AND',
        children: [
          {
            type: 'LEAF',
            label: `Identify vulnerable ${attackVector.entryPoint}`,
            probability: 0.8,
          },
          {
            type: 'OR',
            children: attackVector.vulnerabilitiesExploited.map(vId => ({
              type: 'LEAF',
              label: `Exploit ${vId}`,
              probability: 0.6,
            })),
          },
          {
            type: 'LEAF',
            label: `Access target asset: ${attackVector.targetAsset}`,
            probability: 0.7,
          },
        ],
      },
    };
  }

  private calculateLikelihoodScore(attackVector: AttackVector, vulnAnalysis: any): number {
    const baseScore = attackVector.likelihood === 'high' ? 4 : attackVector.likelihood === 'medium' ? 3 : 2;

    // Adjust based on vulnerability severity
    const vulns = attackVector.vulnerabilitiesExploited.map(
      (vId: string) => vulnAnalysis.vulnerabilities.find((v: Vulnerability) => v.id === vId)
    ).filter(Boolean);

    const hasCritical = vulns.some((v: Vulnerability) => v.severity === 'critical');
    const hasHigh = vulns.some((v: Vulnerability) => v.severity === 'high');

    if (hasCritical) return Math.min(5, baseScore + 1);
    if (hasHigh) return baseScore;
    return Math.max(1, baseScore - 1);
  }

  private calculateImpactScore(attackVector: AttackVector, objectives: BusinessObjective[]): number {
    let maxImpact = 1;

    for (const obj of objectives) {
      if (this.isObjectiveAffected(obj, attackVector)) {
        const impact = obj.priority === 'critical' ? 5 : obj.priority === 'high' ? 4 : obj.priority === 'medium' ? 3 : 2;
        maxImpact = Math.max(maxImpact, impact);
      }
    }

    return maxImpact;
  }

  private isObjectiveAffected(objective: BusinessObjective, attackVector: AttackVector): boolean {
    // Simple heuristic: check if attack vector description relates to security requirements
    const secReqs = objective.securityRequirements.join(' ').toLowerCase();
    const attackDesc = attackVector.description.toLowerCase();

    return secReqs.includes('confidentiality') && attackDesc.includes('disclosure') ||
           secReqs.includes('integrity') && attackDesc.includes('tampering') ||
           secReqs.includes('availability') && attackDesc.includes('denial') ||
           secReqs.includes('authentication') && attackDesc.includes('spoof');
  }

  private getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' {
    if (score >= 20) return 'critical';
    if (score >= 12) return 'high';
    if (score >= 6) return 'medium';
    return 'low';
  }

  private describeBusinessImpact(attackVector: AttackVector, objectives: BusinessObjective[]): string {
    const affected = objectives.filter(obj => this.isObjectiveAffected(obj, attackVector));

    if (affected.length === 0) {
      return 'Minimal direct impact on business objectives';
    }

    const criticalAffected = affected.filter(o => o.priority === 'critical');
    if (criticalAffected.length > 0) {
      return `Critical business impact: affects ${criticalAffected.map(o => o.name).join(', ')}`;
    }

    return `Moderate business impact: affects ${affected.map(o => o.name).join(', ')}`;
  }

  private generateMitigationStrategy(threat: PrioritizedThreat): MitigationStrategy {
    const controls: SecurityControl[] = [];

    // Generate controls based on vulnerabilities
    for (const vuln of threat.vulnerabilities) {
      if (vuln.cweId === 'CWE-89') {
        controls.push({
          id: `CTRL-${vuln.id}-PARAM`,
          name: 'Parameterized Queries',
          type: 'preventive',
          description: 'Use parameterized queries or prepared statements',
          effectiveness: 0.95,
          implementationEffort: 'medium',
        });
      }
      if (vuln.cweId === 'CWE-319') {
        controls.push({
          id: `CTRL-${vuln.id}-TLS`,
          name: 'TLS Encryption',
          type: 'preventive',
          description: 'Enable TLS 1.3 for all data in transit',
          effectiveness: 0.98,
          implementationEffort: 'low',
        });
      }
      if (vuln.cweId === 'CWE-306') {
        controls.push({
          id: `CTRL-${vuln.id}-AUTH`,
          name: 'Strong Authentication',
          type: 'preventive',
          description: 'Implement strong authentication mechanisms',
          effectiveness: 0.9,
          implementationEffort: 'medium',
        });
      }
    }

    // Determine strategy based on risk
    let strategy: 'avoid' | 'transfer' | 'mitigate' | 'accept';
    if (threat.riskScore >= 20) {
      strategy = 'avoid';
    } else if (threat.riskScore >= 12) {
      strategy = 'mitigate';
    } else if (threat.riskScore >= 6) {
      strategy = 'mitigate';
    } else {
      strategy = 'accept';
    }

    // Calculate residual risk after controls
    const avgEffectiveness = controls.length > 0
      ? controls.reduce((sum, c) => sum + c.effectiveness, 0) / controls.length
      : 0;
    const residualRisk = threat.riskScore * (1 - avgEffectiveness);

    return {
      threatId: threat.id,
      strategy,
      controls,
      residualRisk: Math.round(residualRisk * 10) / 10,
      implementationPriority: threat.riskScore >= 12 ? 1 : threat.riskScore >= 6 ? 2 : 3,
    };
  }
}
