import { TriageRequest } from '../providers/ai-provider.interface';

/**
 * Build the triage prompt for AI analysis
 * This prompt is shared across all AI providers for consistency
 */
export function buildTriagePrompt(request: TriageRequest): string {
  const { finding, codeContext, fileContent, repositoryContext } = request;

  let prompt = `You are a security expert analyzing a vulnerability finding from a security scanner.

## Finding Details
- **Title**: ${finding.title}
- **Description**: ${finding.description}
- **Severity**: ${finding.severity}
- **Rule ID**: ${finding.ruleId}
- **File**: ${finding.filePath}:${finding.startLine}${finding.endLine ? `-${finding.endLine}` : ''}
${finding.cweId ? `- **CWE**: ${finding.cweId}` : ''}
`;

  if (finding.snippet) {
    prompt += `
## Code Snippet (Vulnerable Code)
\`\`\`
${finding.snippet}
\`\`\`
`;
  }

  // If full file content is provided (full-file triage mode), include it for better context
  if (fileContent) {
    // Truncate if too long (keep around the vulnerable lines)
    const maxFileLength = 8000;
    let truncatedContent = fileContent;

    if (fileContent.length > maxFileLength) {
      // Extract context around the vulnerable lines
      const lines = fileContent.split('\n');
      const startLine = Math.max(0, (finding.startLine || 1) - 30);
      const endLine = Math.min(lines.length, (finding.endLine || finding.startLine || 1) + 30);
      truncatedContent = lines.slice(startLine, endLine).join('\n');
      prompt += `
## Full File Context (lines ${startLine + 1}-${endLine} of ${lines.length})
\`\`\`
${truncatedContent}
\`\`\`
`;
    } else {
      prompt += `
## Full File Content
\`\`\`
${fileContent}
\`\`\`
`;
    }
  } else if (codeContext) {
    prompt += `
## Additional Code Context
\`\`\`
${codeContext}
\`\`\`
`;
  }

  if (repositoryContext) {
    prompt += `
## Repository Context
- **Name**: ${repositoryContext.name}
- **Primary Language**: ${repositoryContext.language}
${repositoryContext.framework ? `- **Framework**: ${repositoryContext.framework}` : ''}
`;
  }

  prompt += `
## Your Task
Analyze this finding. Keep ALL responses SHORT (1-2 lines max).

Respond in this exact JSON format:
{
  "analysis": "1-2 lines: what the vulnerability is and impact",
  "suggestedSeverity": "high",
  "isLikelyFalsePositive": false,
  "confidence": 0.85,
  "exploitability": "moderate",
  "remediation": "1-2 lines: exact fix action",
  "references": []
}

CRITICAL: Keep analysis and remediation to 1-2 lines MAX. Be direct.`;

  return prompt;
}

/**
 * Parse the triage response from AI
 * Handles variations in JSON output format
 */
export function parseTriageResponse(text: string): {
  analysis: string;
  suggestedSeverity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  isLikelyFalsePositive: boolean;
  confidence: number;
  exploitability: 'easy' | 'moderate' | 'difficult' | 'unlikely';
  remediation: string;
  references: string[];
} {
  // Extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and normalize the response
  return {
    analysis: String(parsed.analysis || 'No analysis provided'),
    suggestedSeverity: normalizeSeverity(parsed.suggestedSeverity),
    isLikelyFalsePositive: Boolean(parsed.isLikelyFalsePositive),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
    exploitability: normalizeExploitability(parsed.exploitability),
    remediation: String(parsed.remediation || 'No remediation provided'),
    references: Array.isArray(parsed.references) ? parsed.references.map(String) : [],
  };
}

function normalizeSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  const normalized = String(severity).toLowerCase();
  if (['critical', 'high', 'medium', 'low', 'info'].includes(normalized)) {
    return normalized as 'critical' | 'high' | 'medium' | 'low' | 'info';
  }
  return 'medium';
}

function normalizeExploitability(exploitability: string): 'easy' | 'moderate' | 'difficult' | 'unlikely' {
  const normalized = String(exploitability).toLowerCase();
  if (['easy', 'moderate', 'difficult', 'unlikely'].includes(normalized)) {
    return normalized as 'easy' | 'moderate' | 'difficult' | 'unlikely';
  }
  return 'moderate';
}
