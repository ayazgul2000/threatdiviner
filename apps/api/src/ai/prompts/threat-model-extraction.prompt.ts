/**
 * Prompt for extracting threat model components from natural language descriptions
 */

export interface ThreatModelExtractionRequest {
  description: string;
  systemType?: string; // e.g., 'web-app', 'api', 'mobile', 'microservices'
  industry?: string; // e.g., 'fintech', 'healthcare', 'e-commerce'
}

export interface ExtractedComponent {
  name: string;
  type: 'process' | 'data_store' | 'external_entity';
  description: string;
  technology?: string;
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  criticality?: 'critical' | 'high' | 'medium' | 'low';
}

export interface ExtractedDataFlow {
  sourceName: string;
  targetName: string;
  description: string;
  protocol?: string;
  dataType?: string;
  authenticated?: boolean;
  encrypted?: boolean;
}

export interface ExtractedBoundary {
  name: string;
  type: string;
  description: string;
  componentNames: string[];
}

export interface ThreatModelExtractionResult {
  title: string;
  description: string;
  components: ExtractedComponent[];
  dataFlows: ExtractedDataFlow[];
  boundaries: ExtractedBoundary[];
  suggestedThreats: string[];
}

export function buildThreatModelExtractionPrompt(request: ThreatModelExtractionRequest): string {
  const { description, systemType, industry } = request;

  let prompt = `You are a security architect helping to create a threat model from a system description.

## System Description
${description}
`;

  if (systemType) {
    prompt += `
## System Type
${systemType}
`;
  }

  if (industry) {
    prompt += `
## Industry Context
${industry}
`;
  }

  prompt += `
## Your Task
Analyze the system description and extract:
1. **Components** - Systems, services, databases, external entities involved
2. **Data Flows** - How data moves between components
3. **Trust Boundaries** - Security zones and perimeters
4. **Initial Threat Suggestions** - Key security concerns to investigate

## Response Format
Respond with ONLY a valid JSON object in this exact format:
{
  "title": "Short title for the threat model",
  "description": "1-2 sentence system overview",
  "components": [
    {
      "name": "Component Name",
      "type": "process|data_store|external_entity",
      "description": "Brief description",
      "technology": "e.g., Node.js, PostgreSQL, AWS S3",
      "dataClassification": "public|internal|confidential|restricted",
      "criticality": "critical|high|medium|low"
    }
  ],
  "dataFlows": [
    {
      "sourceName": "Source Component Name",
      "targetName": "Target Component Name",
      "description": "What data flows",
      "protocol": "HTTPS, gRPC, SQL, etc.",
      "dataType": "User credentials, PII, etc.",
      "authenticated": true,
      "encrypted": true
    }
  ],
  "boundaries": [
    {
      "name": "Boundary Name",
      "type": "network|trust|compliance",
      "description": "What this boundary represents",
      "componentNames": ["Component1", "Component2"]
    }
  ],
  "suggestedThreats": [
    "Brief threat description 1",
    "Brief threat description 2"
  ]
}

## Guidelines
- Extract ALL components mentioned or implied (databases, APIs, services, users, external systems)
- Infer reasonable data flows even if not explicitly stated
- Use standard component types: "process" for services/apps, "data_store" for databases/storage, "external_entity" for users/external systems
- Be specific about technologies when mentioned
- Suggest 3-5 relevant threats based on the architecture
- Keep descriptions concise (1-2 sentences max)

IMPORTANT: Return ONLY the JSON object, no markdown code blocks or additional text.`;

  return prompt;
}

export function parseThreatModelExtractionResponse(text: string): ThreatModelExtractionResult {
  // Try to extract JSON from the response
  let jsonText = text.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  }

  // Find JSON object
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate and normalize the response
  return {
    title: String(parsed.title || 'Untitled System'),
    description: String(parsed.description || 'No description provided'),
    components: normalizeComponents(parsed.components),
    dataFlows: normalizeDataFlows(parsed.dataFlows),
    boundaries: normalizeBoundaries(parsed.boundaries),
    suggestedThreats: Array.isArray(parsed.suggestedThreats)
      ? parsed.suggestedThreats.map(String)
      : [],
  };
}

function normalizeComponents(components: unknown): ExtractedComponent[] {
  if (!Array.isArray(components)) return [];

  return components.map((c: any) => ({
    name: String(c.name || 'Unknown Component'),
    type: normalizeComponentType(c.type),
    description: String(c.description || ''),
    technology: c.technology ? String(c.technology) : undefined,
    dataClassification: normalizeDataClassification(c.dataClassification),
    criticality: normalizeCriticality(c.criticality),
  }));
}

function normalizeDataFlows(flows: unknown): ExtractedDataFlow[] {
  if (!Array.isArray(flows)) return [];

  return flows.map((f: any) => ({
    sourceName: String(f.sourceName || f.source || 'Unknown'),
    targetName: String(f.targetName || f.target || 'Unknown'),
    description: String(f.description || ''),
    protocol: f.protocol ? String(f.protocol) : undefined,
    dataType: f.dataType ? String(f.dataType) : undefined,
    authenticated: Boolean(f.authenticated),
    encrypted: Boolean(f.encrypted),
  }));
}

function normalizeBoundaries(boundaries: unknown): ExtractedBoundary[] {
  if (!Array.isArray(boundaries)) return [];

  return boundaries.map((b: any) => ({
    name: String(b.name || 'Unknown Boundary'),
    type: String(b.type || 'trust'),
    description: String(b.description || ''),
    componentNames: Array.isArray(b.componentNames)
      ? b.componentNames.map(String)
      : [],
  }));
}

function normalizeComponentType(type: unknown): 'process' | 'data_store' | 'external_entity' {
  const normalized = String(type).toLowerCase().replace(/[- ]/g, '_');
  if (['process', 'service', 'app', 'application', 'server', 'api'].includes(normalized)) {
    return 'process';
  }
  if (['data_store', 'datastore', 'database', 'storage', 'cache', 'queue'].includes(normalized)) {
    return 'data_store';
  }
  if (['external_entity', 'external', 'user', 'client', 'third_party'].includes(normalized)) {
    return 'external_entity';
  }
  return 'process';
}

function normalizeDataClassification(
  classification: unknown
): 'public' | 'internal' | 'confidential' | 'restricted' | undefined {
  if (!classification) return undefined;
  const normalized = String(classification).toLowerCase();
  if (['public', 'internal', 'confidential', 'restricted'].includes(normalized)) {
    return normalized as 'public' | 'internal' | 'confidential' | 'restricted';
  }
  return 'internal';
}

function normalizeCriticality(
  criticality: unknown
): 'critical' | 'high' | 'medium' | 'low' | undefined {
  if (!criticality) return undefined;
  const normalized = String(criticality).toLowerCase();
  if (['critical', 'high', 'medium', 'low'].includes(normalized)) {
    return normalized as 'critical' | 'high' | 'medium' | 'low';
  }
  return 'medium';
}
