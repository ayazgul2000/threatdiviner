import { Injectable } from '@nestjs/common';

export type LinddunCategory =
  | 'linkability'
  | 'identifiability'
  | 'non_repudiation'
  | 'detectability'
  | 'disclosure'
  | 'unawareness'
  | 'non_compliance';

export interface PrivacyThreat {
  id: string;
  category: LinddunCategory;
  title: string;
  description: string;
  affectedData: string[];
  affectedComponent: string;
  dataSubject: string;
  likelihood: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
  privacyPrinciples: string[];
  gdprArticles: string[];
  mitigations: PrivacyMitigation[];
}

export interface PrivacyMitigation {
  id: string;
  strategy: string;
  description: string;
  patternType: 'data_minimization' | 'anonymization' | 'pseudonymization' | 'encryption' | 'access_control' | 'transparency' | 'consent';
  effectiveness: 'high' | 'medium' | 'low';
}

export interface DataSubject {
  type: string;
  personalData: PersonalDataItem[];
  processingPurposes: string[];
  retentionPeriod?: string;
  legalBasis?: string;
}

export interface PersonalDataItem {
  name: string;
  category: 'basic' | 'sensitive' | 'special_category' | 'biometric' | 'genetic' | 'children';
  description: string;
}

export interface LinddunAnalysisResult {
  modelId: string;
  threats: PrivacyThreat[];
  dataSubjects: DataSubject[];
  summary: {
    totalThreats: number;
    byCategory: Record<LinddunCategory, number>;
    byImpact: { high: number; medium: number; low: number };
    affectedGdprArticles: string[];
    recommendedPatterns: string[];
  };
  complianceGaps: ComplianceGap[];
}

export interface ComplianceGap {
  gdprArticle: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  recommendation: string;
}

@Injectable()
export class LinddunAnalyzer {
  private readonly threatTemplates: Record<LinddunCategory, any[]> = {
    linkability: [
      {
        id: 'L1',
        title: 'Cross-System Data Correlation',
        description: 'Personal data can be linked across different systems or contexts to build user profiles',
        privacyPrinciples: ['Data Minimization', 'Purpose Limitation'],
        gdprArticles: ['Art. 5(1)(b)', 'Art. 5(1)(c)'],
        mitigations: [
          { strategy: 'Use different pseudonyms per context', patternType: 'pseudonymization' },
          { strategy: 'Implement data compartmentalization', patternType: 'data_minimization' },
          { strategy: 'Use anonymization where possible', patternType: 'anonymization' },
        ],
      },
      {
        id: 'L2',
        title: 'Session Linkability',
        description: 'User sessions or activities can be linked together to track behavior over time',
        privacyPrinciples: ['Storage Limitation', 'Data Minimization'],
        gdprArticles: ['Art. 5(1)(c)', 'Art. 5(1)(e)'],
        mitigations: [
          { strategy: 'Rotate session identifiers regularly', patternType: 'pseudonymization' },
          { strategy: 'Limit session data retention', patternType: 'data_minimization' },
        ],
      },
      {
        id: 'L3',
        title: 'Temporal Linkability',
        description: 'Activities can be linked through timestamps and temporal patterns',
        privacyPrinciples: ['Data Minimization'],
        gdprArticles: ['Art. 5(1)(c)'],
        mitigations: [
          { strategy: 'Add noise to timestamps', patternType: 'anonymization' },
          { strategy: 'Aggregate temporal data', patternType: 'data_minimization' },
        ],
      },
    ],
    identifiability: [
      {
        id: 'I1',
        title: 'Direct Identification',
        description: 'Personal data directly identifies individuals through names, IDs, or other unique identifiers',
        privacyPrinciples: ['Data Minimization', 'Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(c)', 'Art. 5(1)(f)', 'Art. 25'],
        mitigations: [
          { strategy: 'Use pseudonymization for identifiers', patternType: 'pseudonymization' },
          { strategy: 'Implement k-anonymity for datasets', patternType: 'anonymization' },
          { strategy: 'Encrypt personal identifiers at rest', patternType: 'encryption' },
        ],
      },
      {
        id: 'I2',
        title: 'Quasi-Identifier Combination',
        description: 'Combination of quasi-identifiers enables re-identification of individuals',
        privacyPrinciples: ['Data Minimization', 'Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(c)', 'Art. 5(1)(f)'],
        mitigations: [
          { strategy: 'Apply l-diversity to prevent attribute disclosure', patternType: 'anonymization' },
          { strategy: 'Generalize quasi-identifiers', patternType: 'anonymization' },
          { strategy: 'Minimize collected attributes', patternType: 'data_minimization' },
        ],
      },
      {
        id: 'I3',
        title: 'Location-Based Identification',
        description: 'Location data can uniquely identify individuals based on movement patterns',
        privacyPrinciples: ['Data Minimization', 'Purpose Limitation'],
        gdprArticles: ['Art. 5(1)(b)', 'Art. 5(1)(c)'],
        mitigations: [
          { strategy: 'Reduce location precision', patternType: 'anonymization' },
          { strategy: 'Aggregate location data', patternType: 'data_minimization' },
          { strategy: 'Apply differential privacy', patternType: 'anonymization' },
        ],
      },
    ],
    non_repudiation: [
      {
        id: 'NR1',
        title: 'Action Attribution',
        description: 'Users cannot deny actions they have performed due to comprehensive logging',
        privacyPrinciples: ['Data Minimization', 'Storage Limitation'],
        gdprArticles: ['Art. 5(1)(c)', 'Art. 5(1)(e)'],
        mitigations: [
          { strategy: 'Implement deniable operations where appropriate', patternType: 'anonymization' },
          { strategy: 'Use unlinkable credentials', patternType: 'pseudonymization' },
        ],
      },
      {
        id: 'NR2',
        title: 'Audit Trail Exposure',
        description: 'Detailed audit trails expose user activities beyond what is necessary',
        privacyPrinciples: ['Data Minimization', 'Purpose Limitation'],
        gdprArticles: ['Art. 5(1)(b)', 'Art. 5(1)(c)'],
        mitigations: [
          { strategy: 'Minimize audit log detail', patternType: 'data_minimization' },
          { strategy: 'Implement log retention policies', patternType: 'data_minimization' },
        ],
      },
    ],
    detectability: [
      {
        id: 'D1',
        title: 'Existence Detection',
        description: 'The existence of personal data or user accounts can be detected by attackers',
        privacyPrinciples: ['Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(f)'],
        mitigations: [
          { strategy: 'Use constant-time responses', patternType: 'access_control' },
          { strategy: 'Implement dummy data', patternType: 'anonymization' },
          { strategy: 'Return generic error messages', patternType: 'access_control' },
        ],
      },
      {
        id: 'D2',
        title: 'Traffic Analysis',
        description: 'Communication patterns reveal information about data subjects',
        privacyPrinciples: ['Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(f)', 'Art. 32'],
        mitigations: [
          { strategy: 'Use traffic padding', patternType: 'encryption' },
          { strategy: 'Implement mix networks', patternType: 'anonymization' },
          { strategy: 'Normalize traffic patterns', patternType: 'access_control' },
        ],
      },
      {
        id: 'D3',
        title: 'Metadata Leakage',
        description: 'Metadata reveals information about communications or activities',
        privacyPrinciples: ['Data Minimization', 'Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(c)', 'Art. 5(1)(f)'],
        mitigations: [
          { strategy: 'Strip unnecessary metadata', patternType: 'data_minimization' },
          { strategy: 'Encrypt metadata where possible', patternType: 'encryption' },
        ],
      },
    ],
    disclosure: [
      {
        id: 'DIS1',
        title: 'Unauthorized Data Access',
        description: 'Personal data may be accessed by unauthorized parties',
        privacyPrinciples: ['Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(f)', 'Art. 32'],
        mitigations: [
          { strategy: 'Implement strong access controls', patternType: 'access_control' },
          { strategy: 'Encrypt data at rest', patternType: 'encryption' },
          { strategy: 'Use field-level encryption for sensitive data', patternType: 'encryption' },
        ],
      },
      {
        id: 'DIS2',
        title: 'Data Breach',
        description: 'Personal data may be exposed through security breaches',
        privacyPrinciples: ['Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(f)', 'Art. 32', 'Art. 33', 'Art. 34'],
        mitigations: [
          { strategy: 'Implement encryption in transit and at rest', patternType: 'encryption' },
          { strategy: 'Apply defense in depth', patternType: 'access_control' },
          { strategy: 'Implement breach detection and response', patternType: 'transparency' },
        ],
      },
      {
        id: 'DIS3',
        title: 'Third-Party Data Sharing',
        description: 'Personal data may be shared with third parties without appropriate safeguards',
        privacyPrinciples: ['Purpose Limitation', 'Lawfulness'],
        gdprArticles: ['Art. 5(1)(a)', 'Art. 5(1)(b)', 'Art. 28'],
        mitigations: [
          { strategy: 'Implement data processing agreements', patternType: 'consent' },
          { strategy: 'Minimize data shared with third parties', patternType: 'data_minimization' },
          { strategy: 'Anonymize data before sharing', patternType: 'anonymization' },
        ],
      },
    ],
    unawareness: [
      {
        id: 'U1',
        title: 'Lack of Transparency',
        description: 'Data subjects are not informed about data collection and processing',
        privacyPrinciples: ['Transparency', 'Lawfulness'],
        gdprArticles: ['Art. 5(1)(a)', 'Art. 12', 'Art. 13', 'Art. 14'],
        mitigations: [
          { strategy: 'Provide clear privacy notices', patternType: 'transparency' },
          { strategy: 'Implement privacy dashboards', patternType: 'transparency' },
          { strategy: 'Use layered privacy policies', patternType: 'transparency' },
        ],
      },
      {
        id: 'U2',
        title: 'Hidden Data Collection',
        description: 'Data is collected without explicit user knowledge',
        privacyPrinciples: ['Transparency', 'Fairness'],
        gdprArticles: ['Art. 5(1)(a)', 'Art. 6', 'Art. 7'],
        mitigations: [
          { strategy: 'Obtain explicit consent', patternType: 'consent' },
          { strategy: 'Implement just-in-time notifications', patternType: 'transparency' },
          { strategy: 'Provide data collection indicators', patternType: 'transparency' },
        ],
      },
      {
        id: 'U3',
        title: 'Unclear Purpose',
        description: 'The purpose of data processing is not clearly communicated',
        privacyPrinciples: ['Purpose Limitation', 'Transparency'],
        gdprArticles: ['Art. 5(1)(b)', 'Art. 13(1)(c)'],
        mitigations: [
          { strategy: 'Clearly state processing purposes', patternType: 'transparency' },
          { strategy: 'Implement purpose-specific consent', patternType: 'consent' },
        ],
      },
    ],
    non_compliance: [
      {
        id: 'NC1',
        title: 'Missing Data Subject Rights',
        description: 'Data subject rights (access, erasure, portability) are not implemented',
        privacyPrinciples: ['Lawfulness'],
        gdprArticles: ['Art. 15', 'Art. 16', 'Art. 17', 'Art. 18', 'Art. 20', 'Art. 21'],
        mitigations: [
          { strategy: 'Implement subject access request handling', patternType: 'consent' },
          { strategy: 'Provide data export functionality', patternType: 'transparency' },
          { strategy: 'Implement data deletion workflows', patternType: 'data_minimization' },
        ],
      },
      {
        id: 'NC2',
        title: 'Inadequate Consent Management',
        description: 'Consent is not properly obtained, recorded, or managed',
        privacyPrinciples: ['Lawfulness', 'Transparency'],
        gdprArticles: ['Art. 6', 'Art. 7', 'Art. 8'],
        mitigations: [
          { strategy: 'Implement consent management platform', patternType: 'consent' },
          { strategy: 'Enable granular consent options', patternType: 'consent' },
          { strategy: 'Maintain consent records', patternType: 'consent' },
        ],
      },
      {
        id: 'NC3',
        title: 'Excessive Data Retention',
        description: 'Personal data is retained longer than necessary',
        privacyPrinciples: ['Storage Limitation'],
        gdprArticles: ['Art. 5(1)(e)', 'Art. 17'],
        mitigations: [
          { strategy: 'Implement automated data retention policies', patternType: 'data_minimization' },
          { strategy: 'Enable data purging workflows', patternType: 'data_minimization' },
          { strategy: 'Document retention periods', patternType: 'transparency' },
        ],
      },
      {
        id: 'NC4',
        title: 'Cross-Border Transfer Issues',
        description: 'Personal data is transferred outside EEA without adequate safeguards',
        privacyPrinciples: ['Lawfulness'],
        gdprArticles: ['Art. 44', 'Art. 45', 'Art. 46', 'Art. 49'],
        mitigations: [
          { strategy: 'Use Standard Contractual Clauses', patternType: 'consent' },
          { strategy: 'Ensure adequacy decisions apply', patternType: 'consent' },
          { strategy: 'Implement data localization where required', patternType: 'access_control' },
        ],
      },
    ],
  };

  analyze(
    modelId: string,
    components: any[],
    dataFlows: any[],
    dataSubjects: DataSubject[] = []
  ): LinddunAnalysisResult {
    const threats: PrivacyThreat[] = [];

    // Identify data subjects if not provided
    const identifiedDataSubjects = dataSubjects.length > 0
      ? dataSubjects
      : this.identifyDataSubjects(components, dataFlows);

    // Analyze each component for privacy threats
    for (const component of components) {
      const componentThreats = this.analyzeComponent(component, identifiedDataSubjects);
      threats.push(...componentThreats);
    }

    // Analyze data flows for privacy threats
    for (const flow of dataFlows) {
      const flowThreats = this.analyzeDataFlow(flow, identifiedDataSubjects);
      threats.push(...flowThreats);
    }

    // Identify compliance gaps
    const complianceGaps = this.identifyComplianceGaps(threats, components);

    // Calculate summary
    const summary = this.calculateSummary(threats);

    return {
      modelId,
      threats,
      dataSubjects: identifiedDataSubjects,
      summary,
      complianceGaps,
    };
  }

  private identifyDataSubjects(components: any[], _dataFlows: any[]): DataSubject[] {
    const subjects: DataSubject[] = [];
    const detectedTypes = new Set<string>();

    // Analyze components for potential data subjects
    for (const component of components) {
      const name = component.name?.toLowerCase() || '';
      const desc = component.description?.toLowerCase() || '';

      if (name.includes('user') || desc.includes('user') || name.includes('customer')) {
        detectedTypes.add('user');
      }
      if (name.includes('employee') || desc.includes('employee') || desc.includes('staff')) {
        detectedTypes.add('employee');
      }
      if (name.includes('patient') || desc.includes('patient') || desc.includes('health')) {
        detectedTypes.add('patient');
      }
    }

    // Create data subject entries
    for (const type of detectedTypes) {
      subjects.push({
        type,
        personalData: this.inferPersonalDataItems(type),
        processingPurposes: this.inferProcessingPurposes(type),
      });
    }

    // Default data subject if none detected
    if (subjects.length === 0) {
      subjects.push({
        type: 'user',
        personalData: [
          { name: 'email', category: 'basic', description: 'User email address' },
          { name: 'name', category: 'basic', description: 'User full name' },
        ],
        processingPurposes: ['Service provision', 'Account management'],
      });
    }

    return subjects;
  }

  private inferPersonalDataItems(subjectType: string): PersonalDataItem[] {
    const commonItems: PersonalDataItem[] = [
      { name: 'email', category: 'basic', description: 'Email address' },
      { name: 'name', category: 'basic', description: 'Full name' },
      { name: 'phone', category: 'basic', description: 'Phone number' },
      { name: 'ip_address', category: 'basic', description: 'IP address' },
    ];

    if (subjectType === 'user' || subjectType === 'customer') {
      return [
        ...commonItems,
        { name: 'address', category: 'basic', description: 'Physical address' },
        { name: 'payment_info', category: 'sensitive', description: 'Payment information' },
      ];
    }

    if (subjectType === 'employee') {
      return [
        ...commonItems,
        { name: 'ssn', category: 'sensitive', description: 'Social security number' },
        { name: 'salary', category: 'sensitive', description: 'Salary information' },
        { name: 'performance_data', category: 'sensitive', description: 'Performance reviews' },
      ];
    }

    if (subjectType === 'patient') {
      return [
        ...commonItems,
        { name: 'health_data', category: 'special_category', description: 'Health information' },
        { name: 'medical_history', category: 'special_category', description: 'Medical history' },
        { name: 'prescriptions', category: 'special_category', description: 'Prescription data' },
      ];
    }

    return commonItems;
  }

  private inferProcessingPurposes(subjectType: string): string[] {
    if (subjectType === 'user' || subjectType === 'customer') {
      return ['Service provision', 'Account management', 'Marketing', 'Analytics'];
    }
    if (subjectType === 'employee') {
      return ['Employment administration', 'Payroll', 'HR management', 'Compliance'];
    }
    if (subjectType === 'patient') {
      return ['Healthcare provision', 'Medical records', 'Treatment', 'Insurance'];
    }
    return ['Service provision'];
  }

  private analyzeComponent(component: any, dataSubjects: DataSubject[]): PrivacyThreat[] {
    const threats: PrivacyThreat[] = [];
    const componentType = component.type || 'process';
    const classification = component.dataClassification || 'internal';

    // Analyze based on component characteristics
    for (const [category, templates] of Object.entries(this.threatTemplates)) {
      for (const template of templates) {
        // Check if threat is relevant to this component
        if (this.isThreatRelevant(template, componentType, classification, dataSubjects)) {
          threats.push(this.createThreat(
            template,
            category as LinddunCategory,
            component,
            dataSubjects
          ));
        }
      }
    }

    return threats;
  }

  private analyzeDataFlow(flow: any, dataSubjects: DataSubject[]): PrivacyThreat[] {
    const threats: PrivacyThreat[] = [];

    // Unencrypted flows are disclosure risks
    if (!flow.encrypted) {
      threats.push({
        id: `PRIV-FLOW-${flow.source}-${flow.target}`,
        category: 'disclosure',
        title: `Unencrypted Data Flow: ${flow.source} -> ${flow.target}`,
        description: `Personal data transmitted without encryption between ${flow.source} and ${flow.target}`,
        affectedData: ['All transmitted data'],
        affectedComponent: `${flow.source} -> ${flow.target}`,
        dataSubject: 'All',
        likelihood: 'high',
        impact: 'high',
        privacyPrinciples: ['Integrity and Confidentiality'],
        gdprArticles: ['Art. 5(1)(f)', 'Art. 32'],
        mitigations: [
          {
            id: 'MIT-TLS',
            strategy: 'Implement TLS 1.3',
            description: 'Enable TLS 1.3 for all data in transit',
            patternType: 'encryption',
            effectiveness: 'high',
          },
        ],
      });
    }

    // Check for cross-boundary flows
    if (flow.crossesTrustBoundary) {
      const disclosureTemplates = this.threatTemplates.disclosure;
      for (const template of disclosureTemplates) {
        if (template.id === 'DIS3') {
          threats.push(this.createThreat(
            template,
            'disclosure',
            { name: `${flow.source} -> ${flow.target}`, type: 'data_flow' },
            dataSubjects
          ));
        }
      }
    }

    return threats;
  }

  private isThreatRelevant(
    template: any,
    componentType: string,
    classification: string,
    dataSubjects: DataSubject[]
  ): boolean {
    // Check for special category data
    const hasSpecialCategoryData = dataSubjects.some(ds =>
      ds.personalData.some(pd => pd.category === 'special_category')
    );

    // Disclosure and identifiability always relevant for confidential/restricted data
    if (['confidential', 'restricted'].includes(classification)) {
      if (template.id.startsWith('DIS') || template.id.startsWith('I')) {
        return true;
      }
    }

    // Non-compliance always relevant
    if (template.id.startsWith('NC')) {
      return true;
    }

    // Unawareness relevant for external entities
    if (template.id.startsWith('U') && componentType === 'external_entity') {
      return true;
    }

    // Special category data increases all risks
    if (hasSpecialCategoryData) {
      return true;
    }

    // Database components have linkability and disclosure risks
    if (componentType === 'datastore') {
      if (template.id.startsWith('L') || template.id.startsWith('DIS')) {
        return true;
      }
    }

    return false;
  }

  private createThreat(
    template: any,
    category: LinddunCategory,
    component: any,
    dataSubjects: DataSubject[]
  ): PrivacyThreat {
    const affectedData = dataSubjects
      .flatMap(ds => ds.personalData.map(pd => pd.name))
      .slice(0, 3);

    const dataSubjectTypes = dataSubjects.map(ds => ds.type).join(', ');

    return {
      id: `${template.id}-${component.name?.replace(/\s+/g, '_') || 'component'}`,
      category,
      title: `${template.title} - ${component.name}`,
      description: template.description,
      affectedData,
      affectedComponent: component.name,
      dataSubject: dataSubjectTypes,
      likelihood: this.assessLikelihood(template, component),
      impact: this.assessImpact(template, dataSubjects),
      privacyPrinciples: template.privacyPrinciples,
      gdprArticles: template.gdprArticles,
      mitigations: template.mitigations.map((m: any, idx: number) => ({
        id: `${template.id}-MIT-${idx}`,
        strategy: m.strategy,
        description: m.strategy,
        patternType: m.patternType,
        effectiveness: 'medium',
      })),
    };
  }

  private assessLikelihood(_template: any, component: any): 'high' | 'medium' | 'low' {
    const classification = component.dataClassification || 'internal';
    const componentType = component.type || 'process';

    // External entities and public classifications increase likelihood
    if (componentType === 'external_entity') return 'high';
    if (classification === 'public') return 'high';

    // Datastores with sensitive data
    if (componentType === 'datastore' && ['confidential', 'restricted'].includes(classification)) {
      return 'high';
    }

    return 'medium';
  }

  private assessImpact(template: any, dataSubjects: DataSubject[]): 'high' | 'medium' | 'low' {
    // Check for special category data
    const hasSpecialCategoryData = dataSubjects.some(ds =>
      ds.personalData.some(pd =>
        ['special_category', 'biometric', 'genetic', 'children'].includes(pd.category)
      )
    );

    if (hasSpecialCategoryData) return 'high';

    // Check for sensitive data
    const hasSensitiveData = dataSubjects.some(ds =>
      ds.personalData.some(pd => pd.category === 'sensitive')
    );

    if (hasSensitiveData) return 'high';

    // Non-compliance issues are always high impact
    if (template.id.startsWith('NC')) return 'high';

    return 'medium';
  }

  private identifyComplianceGaps(threats: PrivacyThreat[], _components: any[]): ComplianceGap[] {
    const gaps: ComplianceGap[] = [];
    const coveredArticles = new Set<string>();

    // Track which GDPR articles are addressed by mitigations
    for (const threat of threats) {
      for (const article of threat.gdprArticles) {
        if (threat.mitigations.length > 0) {
          coveredArticles.add(article);
        }
      }
    }

    // Check for common compliance gaps
    const requiredArticles = [
      { article: 'Art. 6', desc: 'Lawful basis for processing', severity: 'critical' as const },
      { article: 'Art. 7', desc: 'Conditions for consent', severity: 'high' as const },
      { article: 'Art. 13', desc: 'Information to be provided', severity: 'high' as const },
      { article: 'Art. 15', desc: 'Right of access', severity: 'high' as const },
      { article: 'Art. 17', desc: 'Right to erasure', severity: 'high' as const },
      { article: 'Art. 25', desc: 'Data protection by design', severity: 'high' as const },
      { article: 'Art. 30', desc: 'Records of processing activities', severity: 'medium' as const },
      { article: 'Art. 32', desc: 'Security of processing', severity: 'critical' as const },
      { article: 'Art. 33', desc: 'Notification of breach', severity: 'high' as const },
      { article: 'Art. 35', desc: 'Data protection impact assessment', severity: 'medium' as const },
    ];

    for (const req of requiredArticles) {
      if (!coveredArticles.has(req.article)) {
        gaps.push({
          gdprArticle: req.article,
          description: `${req.desc} - no controls identified`,
          severity: req.severity,
          recommendation: `Implement controls to address ${req.article} (${req.desc})`,
        });
      }
    }

    return gaps;
  }

  private calculateSummary(threats: PrivacyThreat[]) {
    const byCategory: Record<LinddunCategory, number> = {
      linkability: 0,
      identifiability: 0,
      non_repudiation: 0,
      detectability: 0,
      disclosure: 0,
      unawareness: 0,
      non_compliance: 0,
    };

    const byImpact = { high: 0, medium: 0, low: 0 };
    const gdprArticles = new Set<string>();
    const patterns = new Set<string>();

    for (const threat of threats) {
      byCategory[threat.category]++;
      byImpact[threat.impact]++;

      for (const article of threat.gdprArticles) {
        gdprArticles.add(article);
      }

      for (const mitigation of threat.mitigations) {
        patterns.add(mitigation.patternType);
      }
    }

    return {
      totalThreats: threats.length,
      byCategory,
      byImpact,
      affectedGdprArticles: Array.from(gdprArticles),
      recommendedPatterns: Array.from(patterns),
    };
  }

  // Get mitigations for a specific LINDDUN category
  getMitigationsForCategory(category: LinddunCategory): PrivacyMitigation[] {
    const templates = this.threatTemplates[category];
    const mitigations: PrivacyMitigation[] = [];

    for (const template of templates) {
      for (const m of template.mitigations) {
        mitigations.push({
          id: `${template.id}-${m.patternType}`,
          strategy: m.strategy,
          description: m.strategy,
          patternType: m.patternType,
          effectiveness: 'medium',
        });
      }
    }

    return mitigations;
  }
}
