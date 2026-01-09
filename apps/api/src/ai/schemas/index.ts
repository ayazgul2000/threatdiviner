// apps/api/src/ai/schemas/index.ts
// Zod schemas for structured AI outputs

import { z } from 'zod';

// Triage output schema
export const TriageOutputSchema = z.object({
  status: z.enum(['confirmed', 'false_positive', 'needs_review', 'suppressed']),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string().min(10).max(500),
  adjustedSeverity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  suggestedAction: z.string().optional(),
});
export type TriageOutput = z.infer<typeof TriageOutputSchema>;

// Remediation output schema
export const RemediationOutputSchema = z.object({
  summary: z.string().min(10).max(200),
  fixedCode: z.string().min(1),
  explanation: z.string().min(20).max(1000),
  additionalSteps: z.array(z.string()).optional(),
  references: z.array(z.object({ title: z.string(), url: z.string().url() })).optional(),
  estimatedEffort: z.enum(['minutes', 'hours', 'days']).optional(),
});
export type RemediationOutput = z.infer<typeof RemediationOutputSchema>;

// Threat model output schema
export const ThreatOutputSchema = z.object({
  id: z.string(),
  category: z.enum(['SPOOFING', 'TAMPERING', 'REPUDIATION', 'INFORMATION_DISCLOSURE', 'DENIAL_OF_SERVICE', 'ELEVATION_OF_PRIVILEGE']),
  title: z.string(),
  description: z.string(),
  targetComponent: z.string(),
  attackVector: z.string(),
  likelihood: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  mitigations: z.array(z.string()),
  cweIds: z.array(z.string()).optional(),
});

export const ThreatModelOutputSchema = z.object({
  threats: z.array(ThreatOutputSchema),
  summary: z.string().optional(),
  riskScore: z.number().min(0).max(10).optional(),
});
export type ThreatModelOutput = z.infer<typeof ThreatModelOutputSchema>;

// Logic analysis output schema
export const LogicFindingSchema = z.object({
  type: z.enum(['auth_bypass', 'idor', 'business_logic', 'race_condition', 'missing_validation']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  location: z.object({ file: z.string(), line: z.number().optional(), function: z.string().optional() }),
  description: z.string(),
  attackScenario: z.string(),
  recommendation: z.string(),
});

export const LogicAnalysisOutputSchema = z.object({
  findings: z.array(LogicFindingSchema),
  noIssues: z.boolean(),
  analysisNotes: z.string().optional(),
});
export type LogicAnalysisOutput = z.infer<typeof LogicAnalysisOutputSchema>;

// Chat response schema
export const ChatOutputSchema = z.object({
  response: z.string(),
  suggestedActions: z.array(z.object({ label: z.string(), action: z.string() })).optional(),
  references: z.array(z.object({ title: z.string(), url: z.string().optional() })).optional(),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;
