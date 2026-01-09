// apps/api/src/ai/services/logic-analyzer.service.ts
// AI-powered business logic vulnerability detection

import { Injectable, Logger } from '@nestjs/common';
import { StructuredAIService } from '../structured-ai.service';
import { LogicAnalysisOutputSchema, LogicAnalysisOutput } from '../schemas';

interface CodeContext {
  filePath: string;
  content: string;
  language: string;
  framework?: string;
  authBoundaries?: string[];
}

interface LogicAnalysisResult extends LogicAnalysisOutput {
  filePath: string;
  provider: string;
  tokensUsed: number;
}

@Injectable()
export class LogicAnalyzerService {
  private readonly logger = new Logger(LogicAnalyzerService.name);

  constructor(private readonly structuredAI: StructuredAIService) {}

  /**
   * Analyze code for business logic vulnerabilities
   * Focuses on: auth bypass, IDOR, race conditions, missing validation
   */
  async analyzeCode(context: CodeContext): Promise<LogicAnalysisResult> {
    const systemPrompt = `You are a security expert analyzing code for business logic vulnerabilities.

Focus on these vulnerability types:
1. **AUTH_BYPASS**: Missing or incorrect authentication checks
2. **IDOR**: Insecure Direct Object References - accessing resources without ownership validation
3. **BUSINESS_LOGIC**: Flawed business rules (negative quantities, price manipulation, etc.)
4. **RACE_CONDITION**: TOCTOU, double-spend, concurrent state issues
5. **MISSING_VALIDATION**: Input validation gaps, type coercion issues

For each finding, provide:
- Type of vulnerability
- Severity (critical/high/medium/low)
- Exact location (file, line, function)
- Clear description of the issue
- Realistic attack scenario
- Specific recommendation to fix

If no issues found, set noIssues: true.`;

    const userPrompt = `Analyze this ${context.language} code for business logic vulnerabilities:

**File:** ${context.filePath}
${context.framework ? `**Framework:** ${context.framework}` : ''}
${context.authBoundaries?.length ? `**Auth Boundaries:** ${context.authBoundaries.join(', ')}` : ''}

\`\`\`${context.language}
${context.content}
\`\`\`

Identify any business logic vulnerabilities. Be specific about locations and attack scenarios.`;

    try {
      const response = await this.structuredAI.execute({
        schema: LogicAnalysisOutputSchema,
        systemPrompt,
        userPrompt,
        maxTokens: 2000,
        temperature: 0.1,
      });

      return {
        ...response.data,
        filePath: context.filePath,
        provider: response.provider,
        tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      };
    } catch (error) {
      this.logger.error(`Logic analysis failed for ${context.filePath}`, error);
      return {
        findings: [],
        noIssues: true,
        analysisNotes: 'Analysis failed - manual review recommended',
        filePath: context.filePath,
        provider: 'fallback',
        tokensUsed: 0,
      };
    }
  }

  /**
   * Analyze multiple files for cross-cutting logic issues
   */
  async analyzeProject(files: CodeContext[]): Promise<LogicAnalysisResult[]> {
    const results: LogicAnalysisResult[] = [];

    // Prioritize auth-related files
    const prioritized = files.sort((a, b) => {
      const authKeywords = ['auth', 'login', 'session', 'permission', 'access', 'guard'];
      const aIsAuth = authKeywords.some(k => a.filePath.toLowerCase().includes(k));
      const bIsAuth = authKeywords.some(k => b.filePath.toLowerCase().includes(k));
      if (aIsAuth && !bIsAuth) return -1;
      if (!aIsAuth && bIsAuth) return 1;
      return 0;
    });

    for (const file of prioritized.slice(0, 20)) { // Limit to 20 files
      const result = await this.analyzeCode(file);
      results.push(result);
      await new Promise(r => setTimeout(r, 200)); // Rate limit
    }

    return results;
  }

  /**
   * Quick check for common auth patterns
   */
  detectAuthPatterns(content: string, language: string): string[] {
    const patterns: string[] = [];
    const lc = content.toLowerCase();

    // Missing auth checks
    if (lc.includes('router') && !lc.includes('auth') && !lc.includes('guard')) {
      patterns.push('Router without visible auth middleware');
    }

    // Direct DB access without user context
    if ((lc.includes('findone') || lc.includes('findunique')) && !lc.includes('userid') && !lc.includes('user.id')) {
      patterns.push('DB query without user context filtering');
    }

    // Hardcoded credentials
    if (/password\s*[:=]\s*['"][^'"]+['"]/i.test(content)) {
      patterns.push('Possible hardcoded credentials');
    }

    // Admin checks that might be bypassable
    if (lc.includes('isadmin') && lc.includes('||')) {
      patterns.push('Admin check with OR condition - review for bypass');
    }

    return patterns;
  }
}
