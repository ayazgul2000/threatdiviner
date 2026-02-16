import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type StrideCategory = 'SPOOFING' | 'TAMPERING' | 'REPUDIATION' | 'INFORMATION_DISCLOSURE' | 'DENIAL_OF_SERVICE' | 'ELEVATION_OF_PRIVILEGE';
export type ComponentType = 'API_GATEWAY' | 'DATA_STORE' | 'PROCESS' | 'EXTERNAL_ENTITY' | 'TRUST_BOUNDARY';

interface EnterpriseThreatTemplate {
  category: StrideCategory;
  titleTemplate: string;
  descriptionTemplate: string;
  vulnerabilityTemplate: string;
  attackVectorTemplate: string;
  threatActors: string[];
  skillsRequired: string;
  complexity: string;
  likelihoodPre: string;
  impactCIA: string;
  existingControlsTemplate: string;
  riskAfterExisting: string;
  recommendationTemplate: string;
  finalRisk: string;
  cweId?: string;
  attackTechnique?: string;
}

interface EnterpriseAnalysisResult {
  success: boolean;
  threatModelId: string;
  methodology: string;
  threatsCreated: number;
  threats: any[];
}

@Injectable()
export class EnterpriseStrideAnalyzer {
  private readonly threatTemplates: Record<string, Record<string, EnterpriseThreatTemplate>> = {
    // API Gateway / Web Entry Point
    API_GATEWAY: {
      SPOOFING: {
        category: 'SPOOFING',
        titleTemplate: 'Impersonation of legitimate users via {component}',
        descriptionTemplate: 'An attacker could impersonate legitimate users to gain unauthorized access through {component}',
        vulnerabilityTemplate: 'Weak or compromised user credentials (e.g., phishing, weak passwords)',
        attackVectorTemplate: 'Phishing, Credential stuffing, Social engineering',
        threatActors: ['Cybercriminal', 'Script Kiddie'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (C,I,A)',
        existingControlsTemplate: 'Authentication via tokens, but MFA not mandatory',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement MFA enforcement; Add CAPTCHA for login; User security awareness training',
        finalRisk: 'Low',
        cweId: 'CWE-287',
        attackTechnique: 'T1078',
      },
      DENIAL_OF_SERVICE: {
        category: 'DENIAL_OF_SERVICE',
        titleTemplate: 'API unavailability from excessive requests to {component}',
        descriptionTemplate: 'An attacker could flood {component} with requests causing service disruption',
        vulnerabilityTemplate: 'Lack of rate limiting or insufficient DDoS protection',
        attackVectorTemplate: 'Request flooding, Resource Exhaustion',
        threatActors: ['Malicious Actor', 'Script Kiddie'],
        skillsRequired: 'Low',
        complexity: 'Low',
        likelihoodPre: 'High',
        impactCIA: 'High (A)',
        existingControlsTemplate: 'Basic rate limiting may be in place',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Configure detailed rate limits per endpoint and user; Implement burst limits; Use auto-scaling',
        finalRisk: 'Low',
        cweId: 'CWE-400',
        attackTechnique: 'T1499',
      },
      ELEVATION_OF_PRIVILEGE: {
        category: 'ELEVATION_OF_PRIVILEGE',
        titleTemplate: 'Unauthorized API access via {component}',
        descriptionTemplate: 'An attacker could exploit misconfigurations to gain elevated access through {component}',
        vulnerabilityTemplate: 'Insecure IAM roles or API Keys',
        attackVectorTemplate: 'Misconfigured IAM policies, Compromised API Keys',
        threatActors: ['Malicious Insider', 'Cybercriminal'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (C,I,A)',
        existingControlsTemplate: 'API Gateway secured with IAM roles',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement least privilege for IAM roles; Regular IAM policy audits; Strong key management',
        finalRisk: 'Low',
        cweId: 'CWE-269',
        attackTechnique: 'T1078.004',
      },
      INFORMATION_DISCLOSURE: {
        category: 'INFORMATION_DISCLOSURE',
        titleTemplate: 'Sensitive data exposure through {component} endpoints',
        descriptionTemplate: 'Sensitive data could be exposed through verbose error messages or misconfigured responses',
        vulnerabilityTemplate: 'Misconfigured API Gateway responses',
        attackVectorTemplate: 'Verbose error messages, Data leakage through logs',
        threatActors: ['Developer', 'Insider Threat'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Low',
        impactCIA: 'Medium (C)',
        existingControlsTemplate: 'API Gateway provides logging',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Remove verbose error messages; Implement log redaction; Regular configuration audits',
        finalRisk: 'Low',
        cweId: 'CWE-209',
        attackTechnique: 'T1530',
      },
    },

    // Data Store (Database)
    DATA_STORE: {
      INFORMATION_DISCLOSURE: {
        category: 'INFORMATION_DISCLOSURE',
        titleTemplate: 'Unauthorized access to sensitive data in {component}',
        descriptionTemplate: 'Sensitive data in {component} could be accessed without proper authorization',
        vulnerabilityTemplate: 'Weak access controls or lack of encryption at rest',
        attackVectorTemplate: 'Unauthorized access to storage, Compromised credentials',
        threatActors: ['Cybercriminal', 'Nation-State Actor'],
        skillsRequired: 'High',
        complexity: 'High',
        likelihoodPre: 'Medium',
        impactCIA: 'High (C)',
        existingControlsTemplate: 'Access controlled via IAM roles',
        riskAfterExisting: 'High',
        recommendationTemplate: 'Enable encryption at rest using KMS; Implement strong access controls for keys',
        finalRisk: 'Low',
        cweId: 'CWE-311',
        attackTechnique: 'T1530',
      },
      TAMPERING: {
        category: 'TAMPERING',
        titleTemplate: 'Unauthorized data modification in {component}',
        descriptionTemplate: 'An attacker could modify or delete data in {component}',
        vulnerabilityTemplate: 'Misconfigured IAM policies or over-privileged roles',
        attackVectorTemplate: 'Privilege escalation via IAM, SQL injection',
        threatActors: ['Insider Threat', 'Cybercriminal'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (I,A)',
        existingControlsTemplate: 'Access to data store controlled via IAM',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Audit IAM policies regularly; Implement fine-grained access control; Enable backup and point-in-time recovery',
        finalRisk: 'Low',
        cweId: 'CWE-284',
        attackTechnique: 'T1565',
      },
      REPUDIATION: {
        category: 'REPUDIATION',
        titleTemplate: 'Log tampering in {component}',
        descriptionTemplate: 'Audit logs for {component} could be modified or deleted',
        vulnerabilityTemplate: 'Lack of immutable logging or centralized log management',
        attackVectorTemplate: 'Log tampering, Undetected unauthorized activity',
        threatActors: ['Malicious Insider', 'Cybercriminal'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (I,A)',
        existingControlsTemplate: 'Basic logging enabled',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Centralize logs to immutable storage; Implement alerts for suspicious activity; Regular log review',
        finalRisk: 'Low',
        cweId: 'CWE-778',
        attackTechnique: 'T1070',
      },
    },

    // Process / Service
    PROCESS: {
      SPOOFING: {
        category: 'SPOOFING',
        titleTemplate: 'Service impersonation of {component}',
        descriptionTemplate: 'An attacker could impersonate {component} to intercept or modify requests',
        vulnerabilityTemplate: 'Weak service authentication or missing mutual TLS',
        attackVectorTemplate: 'Service impersonation, Man-in-the-middle',
        threatActors: ['Cybercriminal', 'Insider Threat'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (C,I,A)',
        existingControlsTemplate: 'Service communicates over internal network',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement mutual TLS (mTLS) for service-to-service auth; Use service mesh with identity',
        finalRisk: 'Low',
        cweId: 'CWE-290',
        attackTechnique: 'T1557',
      },
      TAMPERING: {
        category: 'TAMPERING',
        titleTemplate: 'Data manipulation in {component}',
        descriptionTemplate: 'An attacker could modify data processed by {component}',
        vulnerabilityTemplate: 'Vulnerable code or lack of input validation',
        attackVectorTemplate: 'Code injection, Input manipulation',
        threatActors: ['Cybercriminal'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (I,A)',
        existingControlsTemplate: 'Application logic handles data processing',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Perform SAST/DAST security testing; Implement robust input validation; Use dependency scanning',
        finalRisk: 'Low',
        cweId: 'CWE-20',
        attackTechnique: 'T1059',
      },
      ELEVATION_OF_PRIVILEGE: {
        category: 'ELEVATION_OF_PRIVILEGE',
        titleTemplate: 'Privilege escalation via {component}',
        descriptionTemplate: 'An attacker could exploit {component} to gain elevated permissions',
        vulnerabilityTemplate: 'Over-privileged execution roles',
        attackVectorTemplate: 'Compromised function, Misconfiguration',
        threatActors: ['Malicious Insider', 'Cybercriminal'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'High',
        impactCIA: 'High (C,I,A)',
        existingControlsTemplate: 'Function runs with IAM role',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement least privilege for execution roles; Regular permission audits',
        finalRisk: 'Low',
        cweId: 'CWE-269',
        attackTechnique: 'T1068',
      },
      INFORMATION_DISCLOSURE: {
        category: 'INFORMATION_DISCLOSURE',
        titleTemplate: 'Sensitive data leakage from {component}',
        descriptionTemplate: '{component} could expose sensitive data through logging or responses',
        vulnerabilityTemplate: 'Excessive logging of sensitive data',
        attackVectorTemplate: 'Log analysis, Debug endpoint access',
        threatActors: ['Insider Threat', 'Cybercriminal'],
        skillsRequired: 'Low to Medium',
        complexity: 'Low',
        likelihoodPre: 'Medium',
        impactCIA: 'High (C)',
        existingControlsTemplate: 'Logging configured but may include sensitive data',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement log sanitization; Remove debug endpoints in production; Mask PII in logs',
        finalRisk: 'Low',
        cweId: 'CWE-532',
        attackTechnique: 'T1005',
      },
      DENIAL_OF_SERVICE: {
        category: 'DENIAL_OF_SERVICE',
        titleTemplate: 'Resource exhaustion in {component}',
        descriptionTemplate: '{component} could be overwhelmed by excessive requests or expensive operations',
        vulnerabilityTemplate: 'Lack of resource limits or circuit breakers',
        attackVectorTemplate: 'Request flooding, Algorithm complexity attacks',
        threatActors: ['Cybercriminal', 'Competitor'],
        skillsRequired: 'Low to Medium',
        complexity: 'Low',
        likelihoodPre: 'Medium',
        impactCIA: 'High (A)',
        existingControlsTemplate: 'Basic timeout configured',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement circuit breakers; Set memory and CPU limits; Add request timeouts',
        finalRisk: 'Low',
        cweId: 'CWE-400',
        attackTechnique: 'T1499',
      },
    },

    // External Entity
    EXTERNAL_ENTITY: {
      SPOOFING: {
        category: 'SPOOFING',
        titleTemplate: 'Impersonation of {component}',
        descriptionTemplate: 'An attacker could impersonate the external entity {component}',
        vulnerabilityTemplate: 'Weak authentication for external integrations',
        attackVectorTemplate: 'API Key theft, Credential stuffing',
        threatActors: ['Cybercriminal', 'Malicious Insider'],
        skillsRequired: 'Medium to High',
        complexity: 'Medium',
        likelihoodPre: 'Medium',
        impactCIA: 'High (C,I,A)',
        existingControlsTemplate: 'External entity authenticates via API key',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Implement API key rotation; Enforce strong access controls; Consider mTLS',
        finalRisk: 'Low',
        cweId: 'CWE-287',
        attackTechnique: 'T1078',
      },
      INFORMATION_DISCLOSURE: {
        category: 'INFORMATION_DISCLOSURE',
        titleTemplate: 'Data leakage to unauthorized {component} instances',
        descriptionTemplate: 'Sensitive data could be exposed to unauthorized instances of {component}',
        vulnerabilityTemplate: 'Misconfigured API access policies',
        attackVectorTemplate: 'Unauthorized API access, Configuration error',
        threatActors: ['Insider Threat'],
        skillsRequired: 'Low to Medium',
        complexity: 'High',
        likelihoodPre: 'Low',
        impactCIA: 'High (C)',
        existingControlsTemplate: 'API validates credentials',
        riskAfterExisting: 'Medium',
        recommendationTemplate: 'Ensure fine-grained authorization (least privilege); Implement data masking; Encrypt in transit',
        finalRisk: 'Low',
        cweId: 'CWE-200',
        attackTechnique: 'T1530',
      },
    },
  };

  constructor(private prisma: PrismaService) {}

  async analyze(threatModelId: string, tenantId: string): Promise<EnterpriseAnalysisResult> {
    const threatModel = await this.prisma.threatModel.findFirst({
      where: { id: threatModelId, tenantId },
      include: {
        components: true,
        dataFlows: true,
      },
    });

    if (!threatModel) {
      throw new Error('Threat model not found');
    }

    const threats: any[] = [];
    let diagramCounter = 1;

    // Generate threats for each component
    for (const component of threatModel.components) {
      const componentType = this.mapComponentType(component.type);
      const templates = this.threatTemplates[componentType] || this.threatTemplates.PROCESS;

      for (const [, template] of Object.entries(templates)) {
        const diagramId = `D-${component.name.replace(/\s+/g, '').substring(0, 4).toUpperCase()}${String(diagramCounter).padStart(2, '0')}`;

        const threat = await this.prisma.threat.create({
          data: {
            threatModelId,
            diagramId,
            title: template.titleTemplate.replace('{component}', component.name),
            description: template.descriptionTemplate.replace('{component}', component.name),
            category: template.category,
            strideCategory: template.category.toLowerCase().replace(/_/g, '_'),
            vulnerability: template.vulnerabilityTemplate,
            attackVector: template.attackVectorTemplate,
            threatActor: template.threatActors.join(', '),
            skillsRequired: template.skillsRequired,
            complexity: template.complexity,
            likelihoodPre: template.likelihoodPre,
            likelihood: template.likelihoodPre.toLowerCase(),
            impactCIA: template.impactCIA,
            impact: template.impactCIA.includes('High') ? 'high' : 'medium',
            existingControls: template.existingControlsTemplate,
            riskAfterExisting: template.riskAfterExisting,
            gapRecommendation: template.recommendationTemplate,
            finalRisk: template.finalRisk,
            cweIds: template.cweId ? [template.cweId] : [],
            attackTechniqueIds: template.attackTechnique ? [template.attackTechnique] : [],
            status: 'identified',
          },
        });

        // Link threat to component
        await this.prisma.threatComponentMapping.create({
          data: {
            threatId: threat.id,
            componentId: component.id,
          },
        });

        threats.push(threat);
        diagramCounter++;
      }
    }

    // Generate threats for data flows
    for (const flow of threatModel.dataFlows) {
      // Unencrypted data flow threat
      if (!flow.encryption) {
        const threat = await this.prisma.threat.create({
          data: {
            threatModelId,
            diagramId: `D-FLOW${String(diagramCounter).padStart(2, '0')}`,
            title: `Data exposure in transit: ${flow.label || 'Data Flow'}`,
            description: `Data transmitted via ${flow.label || 'this flow'} could be intercepted if not encrypted`,
            category: 'INFORMATION_DISCLOSURE',
            strideCategory: 'information_disclosure',
            vulnerability: 'Lack of encryption in transit',
            attackVector: 'Eavesdropping, Man-in-the-middle attack',
            threatActor: 'Cybercriminal',
            skillsRequired: 'Medium to High',
            complexity: 'Medium',
            likelihoodPre: 'Medium',
            likelihood: 'medium',
            impactCIA: 'High (C)',
            impact: 'high',
            existingControls: `Data flow uses ${flow.protocol || 'unspecified protocol'}`,
            riskAfterExisting: 'High',
            gapRecommendation: 'Enforce TLS 1.2+ for all communication; Implement certificate pinning',
            finalRisk: 'Low',
            cweIds: ['CWE-319'],
            attackTechniqueIds: ['T1557'],
            status: 'identified',
          },
        });

        // Link threat to data flow
        await this.prisma.threatDataFlowMapping.create({
          data: {
            threatId: threat.id,
            dataFlowId: flow.id,
          },
        });

        threats.push(threat);
        diagramCounter++;
      }

      // Unauthenticated data flow threat
      if (!flow.authentication) {
        const threat = await this.prisma.threat.create({
          data: {
            threatModelId,
            diagramId: `D-FLOW${String(diagramCounter).padStart(2, '0')}`,
            title: `Unauthenticated data flow: ${flow.label || 'Data Flow'}`,
            description: `Data flow ${flow.label || 'this flow'} may not require authentication`,
            category: 'SPOOFING',
            strideCategory: 'spoofing',
            vulnerability: 'Missing authentication on data flow',
            attackVector: 'Unauthorized access, Service impersonation',
            threatActor: 'Cybercriminal, Malicious Insider',
            skillsRequired: 'Medium',
            complexity: 'Low',
            likelihoodPre: 'Medium',
            likelihood: 'medium',
            impactCIA: 'High (C,I)',
            impact: 'high',
            existingControls: 'Network-level controls may exist',
            riskAfterExisting: 'Medium',
            gapRecommendation: 'Implement mutual authentication; Use API keys or tokens',
            finalRisk: 'Low',
            cweIds: ['CWE-306'],
            attackTechniqueIds: ['T1078'],
            status: 'identified',
          },
        });

        // Link threat to data flow
        await this.prisma.threatDataFlowMapping.create({
          data: {
            threatId: threat.id,
            dataFlowId: flow.id,
          },
        });

        threats.push(threat);
        diagramCounter++;
      }
    }

    // Update threat model status
    await this.prisma.threatModel.update({
      where: { id: threatModelId },
      data: {
        status: 'in_progress',
        methodology: 'stride',
      },
    });

    return {
      success: true,
      threatModelId,
      methodology: 'STRIDE',
      threatsCreated: threats.length,
      threats,
    };
  }

  private mapComponentType(type: string | null): string {
    if (!type) return 'PROCESS';

    const typeMap: Record<string, string> = {
      process: 'PROCESS',
      datastore: 'DATA_STORE',
      database: 'DATA_STORE',
      external_entity: 'EXTERNAL_ENTITY',
      external: 'EXTERNAL_ENTITY',
      trust_boundary: 'TRUST_BOUNDARY',
      api: 'API_GATEWAY',
      gateway: 'API_GATEWAY',
    };

    return typeMap[type.toLowerCase()] || 'PROCESS';
  }
}
