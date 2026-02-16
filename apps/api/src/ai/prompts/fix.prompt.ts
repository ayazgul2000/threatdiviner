import { AutoFixRequest } from '../providers/ai-provider.interface';

/**
 * Language detection from file extension
 */
const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  java: 'java',
  go: 'go',
  rs: 'rust',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sql: 'sql',
  sh: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  json: 'json',
};

export function detectLanguage(filePath: string): string {
  const extension = filePath.split('.').pop() || '';
  return LANGUAGE_MAP[extension] || extension;
}

/**
 * Build the auto-fix prompt for AI code generation
 * This prompt is shared across all AI providers for consistency
 */
export function buildAutoFixPrompt(request: AutoFixRequest): string {
  const { finding, fileContent, language } = request;
  const detectedLanguage = language || detectLanguage(finding.filePath);

  // Check if we only have snippet context (limited context mode)
  const isSnippetOnly = fileContent === finding.snippet;

  let prompt = `You are a security expert. Generate a SECURE code fix.

## Vulnerability
- **Rule**: ${finding.ruleId}
- **Severity**: ${finding.severity}
- **File**: ${finding.filePath}:${finding.startLine}
${finding.cweId ? `- **CWE**: ${finding.cweId}` : ''}

## Description
${finding.description}
`;

  if (finding.snippet) {
    prompt += `
## VULNERABLE CODE (to be replaced):
\`\`\`${detectedLanguage}
${finding.snippet}
\`\`\`
`;
  }

  // Include file context if we have more than just the snippet
  if (!isSnippetOnly && fileContent) {
    const lines = fileContent.split('\n');
    const startLine = Math.max(0, (finding.startLine || 1) - 10);
    const endLine = Math.min(lines.length, (finding.endLine || finding.startLine || 1) + 10);
    const contextLines = lines.slice(startLine, endLine);
    const contextWithLineNums = contextLines
      .map((line, idx) => `${startLine + idx + 1}: ${line}`)
      .join('\n');

    prompt += `
## File Context
\`\`\`${detectedLanguage}
${contextWithLineNums}
\`\`\`
`;
  }

  prompt += `
## TASK
Generate the FIXED version of the vulnerable code above. Your fix must:
1. Replace the ENTIRE vulnerable code snippet shown above
2. Be syntactically correct ${detectedLanguage}
3. Fix the security vulnerability completely
4. Preserve the same indentation as the original
5. Be a DROP-IN replacement (no extra imports/functions unless essential)

## RESPONSE FORMAT (JSON only)
{
  "fixedCode": "the complete fixed code here",
  "explanation": "1-line description of the fix",
  "confidence": 0.85
}

RULES:
- fixedCode = exact replacement for the vulnerable code shown above
- NO "..." or placeholders - must be complete code
- NO comments in the code
- explanation = MAX 1-2 lines`;

  return prompt;
}

/**
 * Parse the auto-fix response from AI
 * Handles variations in JSON output format
 */
export function parseAutoFixResponse(text: string): {
  fixedCode: string;
  explanation: string;
  confidence: number;
} {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    fixedCode: String(parsed.fixedCode || ''),
    explanation: String(parsed.explanation || 'No explanation provided'),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5)),
  };
}
