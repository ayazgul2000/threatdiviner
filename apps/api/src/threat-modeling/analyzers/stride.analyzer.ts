import { Injectable } from '@nestjs/common';

export type StrideCategory = 'spoofing' | 'tampering' | 'repudiation' | 'information_disclosure' | 'denial_of_service' | 'elevation_of_privilege';

export interface StrideThreats {
  spoofing: ThreatTemplate[];
  tampering: ThreatTemplate[];
  repudiation: ThreatTemplate[];
  information_disclosure: ThreatTemplate[];
  denial_of_service: ThreatTemplate[];
  elevation_of_privilege: ThreatTemplate[];
}

export interface ThreatTemplate {
  id: string;
  title: string;
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  affectedComponentTypes: string[];
  mitigations: string[];
  cweIds: string[];
  attackTechniqueIds: string[];
}

export interface AnalyzedThreat {
  strideCategory: StrideCategory;
  title: string;
  description: string;
  affectedComponent: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  riskScore: number;
  mitigations: string[];
  cweIds: string[];
  attackTechniqueIds: string[];
}

export interface StrideAnalysisResult {
  modelId: string;
  threats: AnalyzedThreat[];
  summary: {
    totalThreats: number;
    byCategory: Record<StrideCategory, number>;
    byRiskLevel: { high: number; medium: number; low: number };
  };
}

@Injectable()
export class StrideAnalyzer {
  private readonly threatTemplates: StrideThreats = {
    spoofing: [
      {
        id: 'S1',
        title: 'Identity Spoofing',
        description: 'An attacker could impersonate a legitimate user or system component to gain unauthorized access.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['external_entity', 'process'],
        mitigations: [
          'Implement strong authentication mechanisms (MFA)',
          'Use certificate-based authentication for service-to-service communication',
          'Validate all identity claims at trust boundaries',
        ],
        cweIds: ['CWE-287', 'CWE-290'],
        attackTechniqueIds: ['T1078', 'T1134'],
      },
      {
        id: 'S2',
        title: 'Session Hijacking',
        description: 'An attacker could steal or forge session tokens to impersonate authenticated users.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['process', 'external_entity'],
        mitigations: [
          'Use secure, HttpOnly, SameSite cookies',
          'Implement session timeout and regeneration',
          'Bind sessions to client fingerprint',
        ],
        cweIds: ['CWE-384', 'CWE-613'],
        attackTechniqueIds: ['T1539', 'T1550'],
      },
      {
        id: 'S3',
        title: 'API Key/Token Theft',
        description: 'API keys or tokens could be intercepted or extracted from client applications.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['external_entity', 'process'],
        mitigations: [
          'Rotate API keys regularly',
          'Use short-lived tokens with refresh mechanism',
          'Never expose secrets in client-side code',
        ],
        cweIds: ['CWE-522', 'CWE-798'],
        attackTechniqueIds: ['T1528', 'T1552'],
      },
    ],
    tampering: [
      {
        id: 'T1',
        title: 'Data Tampering in Transit',
        description: 'Data could be modified as it passes between system components.',
        likelihood: 'low',
        impact: 'high',
        affectedComponentTypes: ['process', 'datastore'],
        mitigations: [
          'Use TLS 1.3 for all data in transit',
          'Implement message signing/HMAC verification',
          'Enable certificate pinning for critical connections',
        ],
        cweIds: ['CWE-345', 'CWE-353'],
        attackTechniqueIds: ['T1557', 'T1565'],
      },
      {
        id: 'T2',
        title: 'Data Tampering at Rest',
        description: 'Stored data could be modified by unauthorized parties.',
        likelihood: 'low',
        impact: 'high',
        affectedComponentTypes: ['datastore'],
        mitigations: [
          'Implement database integrity constraints',
          'Use cryptographic checksums for critical data',
          'Enable audit logging for data modifications',
        ],
        cweIds: ['CWE-494', 'CWE-354'],
        attackTechniqueIds: ['T1565.001'],
      },
      {
        id: 'T3',
        title: 'Input Manipulation',
        description: 'Malicious input could alter application behavior or corrupt data.',
        likelihood: 'high',
        impact: 'high',
        affectedComponentTypes: ['process', 'external_entity'],
        mitigations: [
          'Implement comprehensive input validation',
          'Use parameterized queries/prepared statements',
          'Apply output encoding appropriate to context',
        ],
        cweIds: ['CWE-20', 'CWE-89', 'CWE-79'],
        attackTechniqueIds: ['T1190', 'T1059'],
      },
    ],
    repudiation: [
      {
        id: 'R1',
        title: 'Lack of Audit Trail',
        description: 'Users could deny performing actions if there is no logging.',
        likelihood: 'medium',
        impact: 'medium',
        affectedComponentTypes: ['process', 'datastore'],
        mitigations: [
          'Implement comprehensive audit logging',
          'Use immutable append-only logs',
          'Include timestamps and user identity in all logs',
        ],
        cweIds: ['CWE-778', 'CWE-223'],
        attackTechniqueIds: ['T1070'],
      },
      {
        id: 'R2',
        title: 'Log Tampering',
        description: 'Attackers could modify or delete logs to cover their tracks.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['process', 'datastore'],
        mitigations: [
          'Use write-once storage for logs',
          'Send logs to external SIEM in real-time',
          'Implement log signing with trusted timestamps',
        ],
        cweIds: ['CWE-117', 'CWE-779'],
        attackTechniqueIds: ['T1070.001', 'T1070.002'],
      },
    ],
    information_disclosure: [
      {
        id: 'I1',
        title: 'Sensitive Data Exposure',
        description: 'Sensitive data could be exposed through improper access controls or encryption.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['datastore', 'process'],
        mitigations: [
          'Encrypt sensitive data at rest using AES-256',
          'Implement field-level encryption for PII',
          'Use data masking for non-production environments',
        ],
        cweIds: ['CWE-200', 'CWE-312', 'CWE-359'],
        attackTechniqueIds: ['T1005', 'T1039', 'T1552'],
      },
      {
        id: 'I2',
        title: 'Error Message Information Leakage',
        description: 'Detailed error messages could reveal sensitive system information.',
        likelihood: 'high',
        impact: 'medium',
        affectedComponentTypes: ['process', 'external_entity'],
        mitigations: [
          'Use generic error messages for users',
          'Log detailed errors server-side only',
          'Implement custom error pages',
        ],
        cweIds: ['CWE-209', 'CWE-532'],
        attackTechniqueIds: ['T1592'],
      },
      {
        id: 'I3',
        title: 'API Information Disclosure',
        description: 'APIs could expose more data than necessary in responses.',
        likelihood: 'high',
        impact: 'medium',
        affectedComponentTypes: ['process', 'external_entity'],
        mitigations: [
          'Implement response filtering/field selection',
          'Use DTOs to control exposed fields',
          'Apply principle of least privilege to API responses',
        ],
        cweIds: ['CWE-213', 'CWE-200'],
        attackTechniqueIds: ['T1530'],
      },
    ],
    denial_of_service: [
      {
        id: 'D1',
        title: 'Resource Exhaustion',
        description: 'Attackers could exhaust system resources through excessive requests or large payloads.',
        likelihood: 'high',
        impact: 'high',
        affectedComponentTypes: ['process', 'datastore'],
        mitigations: [
          'Implement rate limiting per client/IP',
          'Set maximum payload sizes',
          'Use connection pooling and timeouts',
        ],
        cweIds: ['CWE-400', 'CWE-770'],
        attackTechniqueIds: ['T1498', 'T1499'],
      },
      {
        id: 'D2',
        title: 'Application-Layer DoS',
        description: 'Expensive operations could be exploited to slow or crash the system.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['process'],
        mitigations: [
          'Implement query complexity limits',
          'Use pagination for large data sets',
          'Add circuit breakers for downstream services',
        ],
        cweIds: ['CWE-400', 'CWE-834'],
        attackTechniqueIds: ['T1499.003', 'T1499.004'],
      },
      {
        id: 'D3',
        title: 'Dependency Failure',
        description: 'System availability could be impacted by failures in dependent services.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['process', 'external_entity'],
        mitigations: [
          'Implement circuit breaker pattern',
          'Use retry with exponential backoff',
          'Design for graceful degradation',
        ],
        cweIds: ['CWE-754', 'CWE-636'],
        attackTechniqueIds: ['T1499'],
      },
    ],
    elevation_of_privilege: [
      {
        id: 'E1',
        title: 'Privilege Escalation',
        description: 'Users could gain elevated privileges beyond their authorized level.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['process'],
        mitigations: [
          'Implement RBAC with least privilege',
          'Validate authorization on every request',
          'Separate admin functions from user functions',
        ],
        cweIds: ['CWE-269', 'CWE-266'],
        attackTechniqueIds: ['T1068', 'T1548'],
      },
      {
        id: 'E2',
        title: 'Insecure Direct Object Reference',
        description: 'Users could access resources belonging to others by manipulating identifiers.',
        likelihood: 'high',
        impact: 'high',
        affectedComponentTypes: ['process', 'datastore'],
        mitigations: [
          'Use indirect object references',
          'Validate ownership on every access',
          'Implement row-level security',
        ],
        cweIds: ['CWE-639', 'CWE-284'],
        attackTechniqueIds: ['T1078'],
      },
      {
        id: 'E3',
        title: 'Injection Leading to Code Execution',
        description: 'Injection vulnerabilities could allow attackers to execute arbitrary code.',
        likelihood: 'medium',
        impact: 'high',
        affectedComponentTypes: ['process'],
        mitigations: [
          'Use parameterized queries exclusively',
          'Implement input validation and sanitization',
          'Run processes with minimal privileges',
        ],
        cweIds: ['CWE-94', 'CWE-78'],
        attackTechniqueIds: ['T1059', 'T1190'],
      },
    ],
  };

  analyze(
    modelId: string,
    components: any[],
    dataFlows: any[]
  ): StrideAnalysisResult {
    const threats: AnalyzedThreat[] = [];

    // Analyze each component
    for (const component of components) {
      const componentThreats = this.analyzeComponent(component);
      threats.push(...componentThreats);
    }

    // Analyze data flows for additional threats
    for (const flow of dataFlows) {
      const flowThreats = this.analyzeDataFlow(flow, components);
      threats.push(...flowThreats);
    }

    // Calculate summary
    const summary = this.calculateSummary(threats);

    return {
      modelId,
      threats,
      summary,
    };
  }

  private analyzeComponent(component: any): AnalyzedThreat[] {
    const threats: AnalyzedThreat[] = [];
    const componentType = component.type || 'process';

    // Check each STRIDE category
    for (const [category, templates] of Object.entries(this.threatTemplates)) {
      for (const template of templates) {
        if (template.affectedComponentTypes.includes(componentType)) {
          const contextualizedThreat = this.contextualizeThreat(
            template,
            component,
            category as StrideCategory
          );
          threats.push(contextualizedThreat);
        }
      }
    }

    return threats;
  }

  private analyzeDataFlow(flow: any, _components: any[]): AnalyzedThreat[] {
    const threats: AnalyzedThreat[] = [];

    // Check for unencrypted data flow
    if (!flow.encrypted) {
      threats.push({
        strideCategory: 'information_disclosure',
        title: `Unencrypted Data Flow: ${flow.source} -> ${flow.target}`,
        description: `Data flowing from ${flow.source} to ${flow.target} is not encrypted, potentially exposing sensitive information.`,
        affectedComponent: `${flow.source} -> ${flow.target}`,
        likelihood: 'high',
        impact: 'high',
        riskScore: 16,
        mitigations: [
          'Enable TLS 1.3 for all data in transit',
          'Implement end-to-end encryption for sensitive data',
        ],
        cweIds: ['CWE-319', 'CWE-311'],
        attackTechniqueIds: ['T1557'],
      });
    }

    // Check for unauthenticated data flow
    if (!flow.authenticated) {
      threats.push({
        strideCategory: 'spoofing',
        title: `Unauthenticated Data Flow: ${flow.source} -> ${flow.target}`,
        description: `Data flow from ${flow.source} to ${flow.target} is not authenticated, allowing potential spoofing attacks.`,
        affectedComponent: `${flow.source} -> ${flow.target}`,
        likelihood: 'medium',
        impact: 'high',
        riskScore: 12,
        mitigations: [
          'Implement mutual TLS authentication',
          'Use signed tokens or API keys',
        ],
        cweIds: ['CWE-287', 'CWE-306'],
        attackTechniqueIds: ['T1078'],
      });
    }

    return threats;
  }

  private contextualizeThreat(
    template: ThreatTemplate,
    component: any,
    category: StrideCategory
  ): AnalyzedThreat {
    const likelihoodScore = { low: 1, medium: 2, high: 3 };
    const impactScore = { low: 1, medium: 2, high: 3 };

    // Adjust likelihood based on component criticality
    let adjustedLikelihood = template.likelihood;
    if (component.criticality === 'critical' && adjustedLikelihood === 'low') {
      adjustedLikelihood = 'medium';
    }

    const riskScore =
      likelihoodScore[adjustedLikelihood] * impactScore[template.impact] *
      (component.criticality === 'critical' ? 1.5 : 1);

    return {
      strideCategory: category,
      title: `${template.title} - ${component.name}`,
      description: template.description.replace('system component', component.name),
      affectedComponent: component.name,
      likelihood: adjustedLikelihood,
      impact: template.impact,
      riskScore: Math.round(riskScore * 10) / 10,
      mitigations: template.mitigations,
      cweIds: template.cweIds,
      attackTechniqueIds: template.attackTechniqueIds,
    };
  }

  private calculateSummary(threats: AnalyzedThreat[]) {
    const byCategory: Record<StrideCategory, number> = {
      spoofing: 0,
      tampering: 0,
      repudiation: 0,
      information_disclosure: 0,
      denial_of_service: 0,
      elevation_of_privilege: 0,
    };

    const byRiskLevel = { high: 0, medium: 0, low: 0 };

    for (const threat of threats) {
      byCategory[threat.strideCategory]++;

      if (threat.riskScore >= 6) {
        byRiskLevel.high++;
      } else if (threat.riskScore >= 3) {
        byRiskLevel.medium++;
      } else {
        byRiskLevel.low++;
      }
    }

    return {
      totalThreats: threats.length,
      byCategory,
      byRiskLevel,
    };
  }

  // Get mitigations for a specific STRIDE category
  getMitigationsForCategory(category: StrideCategory): string[] {
    const templates = this.threatTemplates[category];
    const mitigations = new Set<string>();

    for (const template of templates) {
      for (const mitigation of template.mitigations) {
        mitigations.add(mitigation);
      }
    }

    return Array.from(mitigations);
  }
}
