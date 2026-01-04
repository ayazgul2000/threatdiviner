import { Injectable } from '@nestjs/common';

export interface DreadFactors {
  damage: number;         // 0-10: How bad would an attack be?
  reproducibility: number; // 0-10: How easy is it to reproduce the attack?
  exploitability: number;  // 0-10: How much work is it to launch the attack?
  affectedUsers: number;   // 0-10: How many people will be impacted?
  discoverability: number; // 0-10: How easy is it to discover the threat?
}

export interface DreadAssessment {
  threatId: string;
  threatName: string;
  factors: DreadFactors;
  score: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  justification: DreadJustification;
  recommendation: string;
}

export interface DreadJustification {
  damage: string;
  reproducibility: string;
  exploitability: string;
  affectedUsers: string;
  discoverability: string;
}

export interface DreadBatchResult {
  assessments: DreadAssessment[];
  summary: {
    averageScore: number;
    maxScore: number;
    minScore: number;
    riskDistribution: Record<string, number>;
    topThreats: DreadAssessment[];
  };
}

@Injectable()
export class DreadCalculator {
  // Factor scoring guidelines
  private readonly damageGuidelines = {
    10: 'Complete system compromise, full data breach, regulatory fines',
    8: 'Significant data breach, major financial loss, reputation damage',
    6: 'Moderate data exposure, business disruption',
    4: 'Limited data exposure, minor disruption',
    2: 'Minimal impact, no sensitive data exposed',
    0: 'No significant damage',
  };

  private readonly reproducibilityGuidelines = {
    10: 'Attack can be reproduced every time, automated',
    8: 'Attack can be reproduced most of the time',
    6: 'Attack requires specific conditions but is reliable',
    4: 'Attack is difficult to reproduce, requires timing',
    2: 'Attack is very difficult to reproduce',
    0: 'Attack cannot be reproduced reliably',
  };

  private readonly exploitabilityGuidelines = {
    10: 'No skill needed, automated tools available',
    8: 'Novice attacker with basic tools',
    6: 'Intermediate attacker with custom tools',
    4: 'Skilled attacker with specialized knowledge',
    2: 'Expert attacker with advanced resources',
    0: 'Theoretically possible but practically impossible',
  };

  private readonly affectedUsersGuidelines = {
    10: 'All users affected',
    8: 'Most users (>75%) affected',
    6: 'Many users (50-75%) affected',
    4: 'Some users (25-50%) affected',
    2: 'Few users (<25%) affected',
    0: 'Only administrative users affected',
  };

  private readonly discoverabilityGuidelines = {
    10: 'Public knowledge, documented vulnerability',
    8: 'Easily discoverable through scanning',
    6: 'Discoverable through manual testing',
    4: 'Requires detailed analysis to discover',
    2: 'Very difficult to discover',
    0: 'Requires insider knowledge or source code access',
  };

  calculateScore(factors: DreadFactors): number {
    const { damage, reproducibility, exploitability, affectedUsers, discoverability } = factors;

    // Validate all factors are in range 0-10
    const validatedFactors = [damage, reproducibility, exploitability, affectedUsers, discoverability];
    for (const factor of validatedFactors) {
      if (factor < 0 || factor > 10) {
        throw new Error('All DREAD factors must be between 0 and 10');
      }
    }

    // Calculate average
    const score = (damage + reproducibility + exploitability + affectedUsers + discoverability) / 5;
    return Math.round(score * 10) / 10;
  }

  getRiskLevel(score: number): 'critical' | 'high' | 'medium' | 'low' | 'informational' {
    if (score >= 9) return 'critical';
    if (score >= 7) return 'high';
    if (score >= 5) return 'medium';
    if (score >= 3) return 'low';
    return 'informational';
  }

  assess(threatId: string, threatName: string, factors: DreadFactors): DreadAssessment {
    const score = this.calculateScore(factors);
    const riskLevel = this.getRiskLevel(score);
    const justification = this.generateJustification(factors);
    const recommendation = this.generateRecommendation(factors, riskLevel);

    return {
      threatId,
      threatName,
      factors,
      score,
      riskLevel,
      justification,
      recommendation,
    };
  }

  assessFromThreat(threat: any): DreadAssessment {
    // Auto-assess DREAD factors from threat characteristics
    const factors = this.inferFactors(threat);
    return this.assess(threat.id, threat.title || threat.name, factors);
  }

  assessBatch(threats: any[]): DreadBatchResult {
    const assessments = threats.map(threat => this.assessFromThreat(threat));

    // Calculate summary statistics
    const scores = assessments.map(a => a.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    // Risk distribution
    const riskDistribution: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
    };
    for (const assessment of assessments) {
      riskDistribution[assessment.riskLevel]++;
    }

    // Top threats (highest scores)
    const topThreats = [...assessments]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      assessments,
      summary: {
        averageScore: Math.round(averageScore * 10) / 10,
        maxScore,
        minScore,
        riskDistribution,
        topThreats,
      },
    };
  }

  private inferFactors(threat: any): DreadFactors {
    let damage = 5;
    let reproducibility = 5;
    let exploitability = 5;
    let affectedUsers = 5;
    let discoverability = 5;

    // Infer damage based on impact
    const impact = threat.impact?.toLowerCase() || '';
    const title = threat.title?.toLowerCase() || threat.name?.toLowerCase() || '';
    const category = threat.strideCategory?.toLowerCase() || threat.category?.toLowerCase() || '';

    // Damage assessment
    if (impact === 'high' || impact === 'critical') {
      damage = 8;
    } else if (impact === 'medium') {
      damage = 6;
    } else if (impact === 'low') {
      damage = 3;
    }

    // Adjust for specific threat types
    if (title.includes('injection') || title.includes('code execution')) {
      damage = Math.max(damage, 9);
      exploitability = 7;
    }
    if (title.includes('data breach') || title.includes('data exposure')) {
      damage = Math.max(damage, 8);
      affectedUsers = 8;
    }
    if (title.includes('denial of service') || title.includes('dos')) {
      affectedUsers = 9;
      damage = 6;
    }
    if (title.includes('privilege') || title.includes('escalation')) {
      damage = Math.max(damage, 8);
      exploitability = 6;
    }

    // Reproducibility based on category
    if (category === 'spoofing' || category === 'tampering') {
      reproducibility = 7;
    }
    if (category === 'information_disclosure' || category === 'disclosure') {
      reproducibility = 6;
      discoverability = 6;
    }

    // Exploitability based on threat characteristics
    const likelihood = threat.likelihood?.toLowerCase() || '';
    if (likelihood === 'high') {
      exploitability = 8;
      reproducibility = Math.max(reproducibility, 7);
    } else if (likelihood === 'medium') {
      exploitability = 6;
    } else if (likelihood === 'low') {
      exploitability = 4;
    }

    // Discoverability based on affected component
    const component = threat.affectedComponent?.toLowerCase() || '';
    if (component.includes('api') || component.includes('external') || component.includes('public')) {
      discoverability = 8;
    }
    if (component.includes('internal') || component.includes('database')) {
      discoverability = 4;
    }

    // Check for CWE IDs that indicate common vulnerabilities
    const cweIds = threat.cweIds || [];
    for (const cwe of cweIds) {
      if (['CWE-89', 'CWE-79', 'CWE-78'].includes(cwe)) {
        exploitability = Math.max(exploitability, 8);
        discoverability = Math.max(discoverability, 7);
      }
      if (['CWE-287', 'CWE-306', 'CWE-862'].includes(cwe)) {
        damage = Math.max(damage, 7);
        reproducibility = Math.max(reproducibility, 8);
      }
    }

    return {
      damage: Math.min(10, Math.max(0, damage)),
      reproducibility: Math.min(10, Math.max(0, reproducibility)),
      exploitability: Math.min(10, Math.max(0, exploitability)),
      affectedUsers: Math.min(10, Math.max(0, affectedUsers)),
      discoverability: Math.min(10, Math.max(0, discoverability)),
    };
  }

  private generateJustification(factors: DreadFactors): DreadJustification {
    const findClosestGuideline = (value: number, guidelines: Record<number, string>): string => {
      const thresholds = Object.keys(guidelines).map(Number).sort((a, b) => b - a);
      for (const threshold of thresholds) {
        if (value >= threshold) {
          return guidelines[threshold];
        }
      }
      return guidelines[0];
    };

    return {
      damage: findClosestGuideline(factors.damage, this.damageGuidelines),
      reproducibility: findClosestGuideline(factors.reproducibility, this.reproducibilityGuidelines),
      exploitability: findClosestGuideline(factors.exploitability, this.exploitabilityGuidelines),
      affectedUsers: findClosestGuideline(factors.affectedUsers, this.affectedUsersGuidelines),
      discoverability: findClosestGuideline(factors.discoverability, this.discoverabilityGuidelines),
    };
  }

  private generateRecommendation(factors: DreadFactors, riskLevel: string): string {
    const recommendations: string[] = [];

    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Immediate remediation required.');
    } else if (riskLevel === 'medium') {
      recommendations.push('Schedule remediation in next sprint.');
    } else {
      recommendations.push('Monitor and address in regular maintenance.');
    }

    // Factor-specific recommendations
    if (factors.damage >= 8) {
      recommendations.push('Implement defense in depth to reduce potential damage.');
    }
    if (factors.exploitability >= 8) {
      recommendations.push('Apply patches and implement input validation to reduce exploitability.');
    }
    if (factors.reproducibility >= 8) {
      recommendations.push('Add rate limiting and anomaly detection.');
    }
    if (factors.affectedUsers >= 8) {
      recommendations.push('Implement segmentation to limit blast radius.');
    }
    if (factors.discoverability >= 8) {
      recommendations.push('Reduce attack surface and implement security through obscurity where appropriate.');
    }

    return recommendations.join(' ');
  }

  // Create assessment with manual factor inputs and guidance
  createAssessmentWorksheet(threatId: string, threatName: string): any {
    return {
      threatId,
      threatName,
      factors: {
        damage: {
          value: null,
          guidelines: this.damageGuidelines,
          question: 'How bad would an attack be?',
        },
        reproducibility: {
          value: null,
          guidelines: this.reproducibilityGuidelines,
          question: 'How easy is it to reproduce the attack?',
        },
        exploitability: {
          value: null,
          guidelines: this.exploitabilityGuidelines,
          question: 'How much work is it to launch the attack?',
        },
        affectedUsers: {
          value: null,
          guidelines: this.affectedUsersGuidelines,
          question: 'How many people will be impacted?',
        },
        discoverability: {
          value: null,
          guidelines: this.discoverabilityGuidelines,
          question: 'How easy is it to discover the threat?',
        },
      },
      instructions: [
        'Rate each factor from 0-10 based on the guidelines provided',
        'Use the questions to help determine appropriate values',
        'Consider the specific context of your application',
        'Document your reasoning for each factor',
      ],
    };
  }

  // Compare multiple assessments
  compareAssessments(assessments: DreadAssessment[]): any {
    if (assessments.length < 2) {
      throw new Error('Need at least 2 assessments to compare');
    }

    const comparison = {
      assessments: assessments.map(a => ({
        id: a.threatId,
        name: a.threatName,
        score: a.score,
        riskLevel: a.riskLevel,
      })),
      factorComparison: {
        damage: {
          highest: { id: '', value: 0 },
          lowest: { id: '', value: 10 },
          average: 0,
        },
        reproducibility: {
          highest: { id: '', value: 0 },
          lowest: { id: '', value: 10 },
          average: 0,
        },
        exploitability: {
          highest: { id: '', value: 0 },
          lowest: { id: '', value: 10 },
          average: 0,
        },
        affectedUsers: {
          highest: { id: '', value: 0 },
          lowest: { id: '', value: 10 },
          average: 0,
        },
        discoverability: {
          highest: { id: '', value: 0 },
          lowest: { id: '', value: 10 },
          average: 0,
        },
      },
      ranking: [] as Array<{ id: string; name: string; score: number; rank: number }>,
    };

    // Calculate factor comparisons
    const factors = ['damage', 'reproducibility', 'exploitability', 'affectedUsers', 'discoverability'] as const;

    for (const factor of factors) {
      let sum = 0;
      for (const assessment of assessments) {
        const value = assessment.factors[factor];
        sum += value;

        if (value > comparison.factorComparison[factor].highest.value) {
          comparison.factorComparison[factor].highest = { id: assessment.threatId, value };
        }
        if (value < comparison.factorComparison[factor].lowest.value) {
          comparison.factorComparison[factor].lowest = { id: assessment.threatId, value };
        }
      }
      comparison.factorComparison[factor].average = Math.round((sum / assessments.length) * 10) / 10;
    }

    // Create ranking
    const sorted = [...assessments].sort((a, b) => b.score - a.score);
    comparison.ranking = sorted.map((a, idx) => ({
      id: a.threatId,
      name: a.threatName,
      score: a.score,
      rank: idx + 1,
    }));

    return comparison;
  }

  // Calibration: helps ensure consistent scoring across assessors
  getCalibrationExamples(): any[] {
    return [
      {
        name: 'SQL Injection in Public API',
        expectedFactors: {
          damage: 9,
          reproducibility: 9,
          exploitability: 8,
          affectedUsers: 8,
          discoverability: 9,
        },
        expectedScore: 8.6,
        reasoning: 'SQL injection in a public API is well-documented, easily exploited with automated tools, can lead to full database compromise affecting most users.',
      },
      {
        name: 'Information Disclosure via Error Messages',
        expectedFactors: {
          damage: 4,
          reproducibility: 10,
          exploitability: 10,
          affectedUsers: 3,
          discoverability: 8,
        },
        expectedScore: 7.0,
        reasoning: 'Error messages exposing stack traces are easy to trigger and discover, but typically only reveal internal information rather than direct data breach.',
      },
      {
        name: 'Race Condition in Authentication',
        expectedFactors: {
          damage: 8,
          reproducibility: 4,
          exploitability: 4,
          affectedUsers: 6,
          discoverability: 3,
        },
        expectedScore: 5.0,
        reasoning: 'Race conditions are hard to discover and exploit reliably, but when successful can lead to authentication bypass with significant impact.',
      },
      {
        name: 'Cross-Site Scripting (Reflected)',
        expectedFactors: {
          damage: 6,
          reproducibility: 9,
          exploitability: 7,
          affectedUsers: 5,
          discoverability: 8,
        },
        expectedScore: 7.0,
        reasoning: 'Reflected XSS requires victim interaction but is easily discoverable and exploitable, can lead to session hijacking.',
      },
    ];
  }
}
