# 08 — Rules for Claude Code

## Purpose

This document defines mandatory constraints, patterns, and protocols that Claude Code must follow when implementing ThreatDiviner. Violations of these rules should block merges and require remediation.

---

## 1. Code Style

### 1.1 TypeScript Strictness

```typescript
// tsconfig.json requirements
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Rules:**
- ❌ NEVER use `any` type — use `unknown` and type guards instead
- ❌ NEVER use `@ts-ignore` or `@ts-expect-error` without justification comment
- ✅ ALWAYS define explicit return types for functions
- ✅ ALWAYS use strict equality (`===`, `!==`)
- ✅ ALWAYS handle `null` and `undefined` explicitly

```typescript
// ❌ BAD
function processRisk(risk: any) {
  return risk.severity;
}

// ✅ GOOD
function processRisk(risk: Risk): RiskSeverity {
  if (!risk || !risk.severity) {
    throw new InvalidRiskError('Risk must have severity');
  }
  return risk.severity;
}
```

### 1.2 React Components

**Rules:**
- ✅ ALWAYS use functional components with hooks
- ✅ ALWAYS use TypeScript interfaces for props
- ❌ NEVER use class components
- ❌ NEVER use default exports for components (use named exports)
- ✅ ALWAYS co-locate component, types, and tests

```typescript
// ❌ BAD
export default function RiskCard(props) {
  return <div>{props.risk.title}</div>;
}

// ✅ GOOD
interface RiskCardProps {
  risk: Risk;
  onTriage: (action: TriageAction) => void;
  isSelected?: boolean;
}

export function RiskCard({ risk, onTriage, isSelected = false }: RiskCardProps) {
  return (
    <div className={cn('risk-card', { selected: isSelected })}>
      {risk.title}
    </div>
  );
}
```

### 1.3 Styling

**Rules:**
- ✅ ALWAYS use Tailwind CSS utility classes
- ❌ NEVER create separate CSS/SCSS files
- ❌ NEVER use inline `style` props (except for dynamic values like width)
- ✅ Use `cn()` utility (clsx + tailwind-merge) for conditional classes
- ✅ Extract repeated patterns to component variants

```typescript
// ❌ BAD
<div style={{ backgroundColor: 'red', padding: '16px' }}>

// ❌ BAD
import './RiskCard.css';
<div className="risk-card-container">

// ✅ GOOD
<div className="bg-red-500 p-4">

// ✅ GOOD (dynamic value)
<div style={{ width: `${progress}%` }} className="bg-blue-500 h-2">
```

### 1.4 Linting & Formatting

**Enforced via CI:**
- ESLint with `@typescript-eslint/recommended`
- Prettier with project config
- `lint-staged` on pre-commit
- CI blocks merge if linting fails

```json
// .eslintrc.json key rules
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "no-console": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  }
}
```

---

## 2. File Structure

### 2.1 Feature-Based Modules

```
src/
├── modules/
│   ├── threat-model/
│   │   ├── components/
│   │   │   ├── DiagramCanvas.tsx
│   │   │   ├── DiagramCanvas.test.tsx
│   │   │   ├── PropertyPanel.tsx
│   │   │   └── PropertyPanel.test.tsx
│   │   ├── services/
│   │   │   ├── threat-model.service.ts
│   │   │   └── threat-model.service.test.ts
│   │   ├── hooks/
│   │   │   ├── useThreatModel.ts
│   │   │   └── useThreatModel.test.ts
│   │   ├── types/
│   │   │   └── threat-model.types.ts
│   │   ├── utils/
│   │   │   └── diagram-parser.ts
│   │   └── index.ts  // barrel export
│   │
│   ├── risk/
│   ├── compliance/
│   └── analysis/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── types/
│
└── infrastructure/
    ├── api/
    ├── auth/
    └── config/
```

### 2.2 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `RiskCard.tsx` |
| Hooks | camelCase, `use` prefix | `useThreatModel.ts` |
| Services | kebab-case, `.service.ts` | `threat-model.service.ts` |
| Types | kebab-case, `.types.ts` | `threat-model.types.ts` |
| Utils | kebab-case | `diagram-parser.ts` |
| Tests | Same name + `.test.ts` | `RiskCard.test.tsx` |
| DTOs | PascalCase, `Dto` suffix | `CreateThreatModelDto` |
| Resolvers | kebab-case, `.resolver.ts` | `threat-model.resolver.ts` |

### 2.3 Barrel Exports

Every module must have an `index.ts` that exports public API:

```typescript
// modules/threat-model/index.ts
export { DiagramCanvas } from './components/DiagramCanvas';
export { PropertyPanel } from './components/PropertyPanel';
export { ThreatModelService } from './services/threat-model.service';
export { useThreatModel } from './hooks/useThreatModel';
export type { ThreatModel, ThreatModelGraph } from './types/threat-model.types';
```

---

## 3. Database Rules

### 3.1 Schema Prefix

**Rules:**
- ✅ ALWAYS use `threatmodel.` schema prefix for all tables
- ✅ Admin tables use `admin.` schema prefix
- ❌ NEVER use the default `public` schema

```sql
-- ✅ GOOD
CREATE TABLE threatmodel.threat_models (
  id UUID PRIMARY KEY,
  ...
);

CREATE TABLE admin.shape_mappings (
  id UUID PRIMARY KEY,
  ...
);

-- ❌ BAD
CREATE TABLE threat_models (...);
CREATE TABLE public.threat_models (...);
```

### 3.2 Multi-Tenancy

**Rules:**
- ✅ EVERY user-facing table MUST have `tenant_id` column
- ✅ EVERY query MUST filter by `tenant_id`
- ✅ Row-Level Security (RLS) policies MUST be enabled
- ❌ NEVER allow cross-org data access

```sql
-- Table definition
CREATE TABLE threatmodel.threat_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES threatmodel.tenants(id),
  name VARCHAR(255) NOT NULL,
  ...
);

-- RLS Policy
ALTER TABLE threatmodel.threat_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_isolation ON threatmodel.threat_models
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### 3.3 Prisma Only

**Rules:**
- ✅ ALWAYS use Prisma Client for database operations
- ❌ NEVER use raw SQL in services (except migrations)
- ✅ Use Prisma transactions for multi-table operations
- ✅ Use Prisma middleware for audit logging

```typescript
// ❌ BAD
const result = await pool.query('SELECT * FROM threat_models WHERE id = $1', [id]);

// ✅ GOOD
const result = await prisma.threatModel.findUnique({
  where: { id, tenantId: ctx.tenantId },
  include: { risks: true },
});
```

### 3.4 Migrations

**Rules:**
- ✅ EVERY schema change requires a migration
- ✅ Migrations must be reversible (up and down)
- ✅ Never modify existing migrations — create new ones
- ✅ Run migrations in CI before deployment

```bash
# Create migration
npx prisma migrate dev --name add_risk_status_column

# Apply in production
npx prisma migrate deploy
```

---

## 4. API Patterns

### 4.1 GraphQL for Client Queries

**Rules:**
- ✅ Use GraphQL for all client-facing queries and mutations
- ✅ Define schemas in `.graphql` files
- ✅ Use code generation for types (`graphql-codegen`)
- ✅ Implement DataLoader for N+1 prevention

```graphql
# threat-model.graphql
type ThreatModel {
  id: ID!
  name: String!
  description: String
  diagram: DiagramVersion
  risks: [Risk!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Query {
  threatModel(id: ID!): ThreatModel
  threatModels(filter: ThreatModelFilter, pagination: PaginationInput): ThreatModelConnection!
}

type Mutation {
  createThreatModel(input: CreateThreatModelInput!): ThreatModel!
  updateThreatModel(id: ID!, input: UpdateThreatModelInput!): ThreatModel!
  deleteThreatModel(id: ID!): Boolean!
}
```

### 4.2 REST for Webhooks & Uploads

**Rules:**
- ✅ Use REST for webhooks (GitHub, Jira, etc.)
- ✅ Use REST for file uploads
- ✅ Use REST for health checks
- ✅ Validate webhook signatures

```typescript
// Webhook endpoint
@Post('webhooks/github')
async handleGitHubWebhook(
  @Headers('x-hub-signature-256') signature: string,
  @Body() payload: unknown,
): Promise<{ received: boolean }> {
  this.webhookService.verifySignature(signature, payload);
  await this.webhookService.processGitHubEvent(payload);
  return { received: true };
}
```

### 4.3 Input Validation

**Rules:**
- ✅ ALWAYS validate inputs with class-validator DTOs
- ✅ ALWAYS sanitize string inputs
- ❌ NEVER trust client input

```typescript
import { IsString, IsUUID, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { sanitizeHtml } from '../utils/sanitize';

export class CreateThreatModelDto {
  @IsString()
  @MaxLength(255)
  @Transform(({ value }) => sanitizeHtml(value))
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  @Transform(({ value }) => sanitizeHtml(value))
  description?: string;

  @IsUUID()
  @IsOptional()
  templateId?: string;
}
```

### 4.4 Error Codes

**Standardized error response:**

```typescript
interface ApiError {
  code: string;           // Machine-readable code
  message: string;        // User-friendly message
  details?: unknown;      // Additional context
  requestId: string;      // For debugging
}

// Error codes
enum ErrorCode {
  // 400 Bad Request
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // 401 Unauthorized
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // 403 Forbidden
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // 404 Not Found
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // 409 Conflict
  CONFLICT = 'CONFLICT',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  
  // 429 Rate Limited
  RATE_LIMITED = 'RATE_LIMITED',
  
  // 500 Internal
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}
```

---

## 5. Testing Requirements

### 5.1 Test Coverage Mandates

| Test Type | Requirement | Minimum Coverage |
|-----------|-------------|------------------|
| Unit Tests | Every service method | 80% |
| Integration Tests | Every API endpoint | 90% |
| E2E Tests | Every user flow | Critical paths |
| Component Tests | Every React component | 70% |

### 5.2 Test File Structure

```typescript
// threat-model.service.test.ts
describe('ThreatModelService', () => {
  describe('create', () => {
    it('should create a threat model with valid input', async () => {
      // Happy path
    });

    it('should throw ValidationError for empty name', async () => {
      // Validation error
    });

    it('should throw ForbiddenError for unauthorized org', async () => {
      // Permission error
    });

    it('should handle database errors gracefully', async () => {
      // DB error
    });
  });

  describe('update', () => {
    it('should update threat model properties', async () => {});
    it('should throw NotFoundError for non-existent model', async () => {});
    it('should throw ConflictError when locked by another user', async () => {});
  });
});
```

### 5.3 Mandatory Test Patterns

**Every test file must include:**

```typescript
// 1. Happy path tests
it('should [expected behavior] when [valid conditions]', async () => {});

// 2. Validation error tests
it('should throw ValidationError when [invalid input]', async () => {});

// 3. Permission error tests
it('should throw ForbiddenError when [unauthorized]', async () => {});

// 4. Not found tests
it('should throw NotFoundError when [resource missing]', async () => {});

// 5. Conflict tests (where applicable)
it('should throw ConflictError when [concurrent modification]', async () => {});

// 6. External service failure tests
it('should handle [external service] failure gracefully', async () => {});
```

### 5.4 Mocking Guidelines

```typescript
// ✅ GOOD - Mock external services
jest.mock('../infrastructure/claude.client');
jest.mock('../infrastructure/threagile.client');

// ✅ GOOD - Use test database
beforeAll(async () => {
  await setupTestDatabase();
});

// ❌ BAD - Don't mock internal services in integration tests
// Integration tests should use real service implementations
```

---

## 6. Error Handling

### 6.1 External Call Wrapping

**EVERY external call must be wrapped in try/catch:**

```typescript
// ❌ BAD - Unhandled external call
async function runAnalysis(modelId: string): Promise<AnalysisResult> {
  const yaml = await generateThreagileYaml(modelId);
  const result = await threagileClient.analyze(yaml); // Can throw!
  return result;
}

// ✅ GOOD - Properly wrapped
async function runAnalysis(modelId: string): Promise<AnalysisResult> {
  let yaml: string;
  
  try {
    yaml = await generateThreagileYaml(modelId);
  } catch (error) {
    this.logger.error('Failed to generate YAML', { modelId, error });
    throw new AnalysisError('Failed to prepare analysis', { cause: error });
  }

  try {
    const result = await this.threagileClient.analyze(yaml);
    return result;
  } catch (error) {
    if (error instanceof TimeoutError) {
      this.logger.warn('Threagile analysis timed out', { modelId });
      throw new AnalysisTimeoutError('Analysis timed out after 120s');
    }
    this.logger.error('Threagile analysis failed', { modelId, error });
    throw new AnalysisError('Analysis engine failed', { cause: error });
  }
}
```

### 6.2 Typed Error Classes

```typescript
// errors/index.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.VALIDATION_ERROR, 400, details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, ErrorCode.NOT_FOUND, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, ErrorCode.CONFLICT, 409, details);
  }
}

export class AnalysisError extends AppError {
  constructor(message: string, options?: { cause?: Error }) {
    super(message, ErrorCode.INTERNAL_ERROR, 500);
    if (options?.cause) {
      this.cause = options.cause;
    }
  }
}
```

### 6.3 Retry Logic

**Transient failures must implement retry:**

```typescript
import { retry } from '../utils/retry';

async function callClaudeWithRetry(prompt: string): Promise<string> {
  return retry(
    () => this.claudeClient.complete(prompt),
    {
      maxAttempts: 3,
      delayMs: 1000,
      backoffMultiplier: 2,
      retryOn: (error) => error instanceof RateLimitError || error instanceof TimeoutError,
    }
  );
}
```

---

## 7. Unhappy Path Coverage

### 7.1 Required Test Scenarios

**Every feature must have tests for:**

| Category | Scenarios |
|----------|-----------|
| Network | Connection timeout, DNS failure, SSL error |
| Timeout | Request timeout, operation timeout |
| Invalid Input | Missing required fields, wrong types, out of range |
| Permission | Unauthenticated, wrong org, insufficient role |
| Not Found | Deleted resource, never existed, wrong ID format |
| Conflict | Concurrent edit, locked resource, version mismatch |
| Rate Limit | API quota exceeded, too many requests |
| External Service | Claude down, Threagile crash, DB connection lost |
| Data Integrity | Corrupt data, missing relations, orphaned records |

### 7.2 Test Examples

```typescript
describe('ThreatModelService - Unhappy Paths', () => {
  describe('Network Failures', () => {
    it('should handle database connection timeout', async () => {
      jest.spyOn(prisma, '$connect').mockRejectedValue(new Error('Connection timeout'));
      
      await expect(service.create(validInput)).rejects.toThrow(ServiceUnavailableError);
    });

    it('should handle Claude API timeout', async () => {
      jest.spyOn(claudeClient, 'complete').mockRejectedValue(new TimeoutError());
      
      const result = await service.triageRisk(riskId);
      expect(result.triageStatus).toBe('pending'); // Graceful degradation
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent diagram saves', async () => {
      // First save succeeds
      const save1 = service.saveDiagram(modelId, xml1, version1);
      // Second save with same version should conflict
      const save2 = service.saveDiagram(modelId, xml2, version1);
      
      await expect(Promise.all([save1, save2])).rejects.toThrow(ConflictError);
    });

    it('should prevent editing locked model', async () => {
      await service.acquireLock(modelId, user1);
      
      await expect(service.acquireLock(modelId, user2)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe('Data Validation', () => {
    it('should reject XSS in model name', async () => {
      const maliciousInput = { name: '<script>alert("xss")</script>' };
      
      await expect(service.create(maliciousInput)).rejects.toThrow(ValidationError);
    });

    it('should reject SQL injection in search', async () => {
      const maliciousQuery = "'; DROP TABLE threat_models; --";
      
      // Should not throw, but should return no results
      const results = await service.search(maliciousQuery);
      expect(results).toEqual([]);
    });
  });
});
```

---

## 8. Security Rules & Testing

### 8.1 Input Sanitization

**Rules:**
- ✅ ALWAYS sanitize HTML/script content
- ✅ ALWAYS validate UUID formats
- ✅ ALWAYS escape output in templates
- ❌ NEVER render raw user input

```typescript
import DOMPurify from 'isomorphic-dompurify';
import { validate as isUUID } from 'uuid';

export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

export function validateUUID(input: string): string {
  if (!isUUID(input)) {
    throw new ValidationError('Invalid UUID format');
  }
  return input;
}
```

### 8.2 Parameterized Queries

**Rules:**
- ✅ ALWAYS use parameterized queries (Prisma handles this)
- ❌ NEVER concatenate user input into queries

```typescript
// ❌ BAD - SQL Injection vulnerable
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ✅ GOOD - Prisma parameterized
const user = await prisma.user.findUnique({ where: { email } });
```

### 8.3 Secret Management

**Rules:**
- ❌ NEVER commit secrets to code
- ✅ ALWAYS use environment variables
- ✅ ALWAYS use secret manager in production
- ✅ Rotate secrets regularly

```typescript
// ❌ BAD
const apiKey = 'sk-ant-api03-xxxxx';

// ✅ GOOD
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  throw new ConfigurationError('ANTHROPIC_API_KEY not configured');
}
```

### 8.4 Audit Logging

**Rules:**
- ✅ Log all mutations with user context
- ✅ Log all authentication events
- ✅ Log all permission checks
- ❌ NEVER log sensitive data (passwords, tokens)

```typescript
// Prisma middleware for audit logging
prisma.$use(async (params, next) => {
  const result = await next(params);
  
  if (['create', 'update', 'delete'].includes(params.action)) {
    await auditLogger.log({
      action: params.action,
      model: params.model,
      recordId: result?.id,
      userId: getCurrentUserId(),
      tenantId: getCurrentOrgId(),
      changes: params.args,
      timestamp: new Date(),
    });
  }
  
  return result;
});
```

### 8.5 JWT Validation

**Rules:**
- ✅ Validate JWT on every request
- ✅ Check token expiration
- ✅ Verify token signature
- ✅ Extract and validate tenant_id claim

```typescript
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    
    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.user = payload;
      request.tenantId = payload.tenant_id;
      
      // Set for RLS
      await this.prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${payload.tenant_id}, true)`;
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

### 8.6 Dogfooding: Use ThreatDiviner Scanners

**CRITICAL: Claude Code must run ThreatDiviner's own security scanners on all code before committing.**

**Pre-Commit Security Gate:**

```yaml
# .github/workflows/security-scan.yml
name: Security Scan (Dogfood)

on:
  pull_request:
    branches: [main, develop]

jobs:
  threatdiviner-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run ThreatDiviner Security Suite
        uses: threatdiviner/scan-action@v1
        with:
          api-key: ${{ secrets.TD_API_KEY }}
          scan-types: |
            sast
            sca
            secrets
            iac
          fail-on: critical,high
          sarif-output: true
          
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: threatdiviner-results.sarif
```

**Scanner Configuration:**

| Scanner | Tool | Purpose | Fail Threshold |
|---------|------|---------|----------------|
| SAST | Semgrep | Code vulnerabilities | Critical, High |
| SCA | Trivy | Dependency vulnerabilities | Critical, High (CVSS ≥ 7.0) |
| Secrets | Gitleaks + TruffleHog | Hardcoded secrets | Any detection |
| IaC | Checkov + Trivy | Infrastructure misconfig | Critical, High |
| License | Trivy | License compliance | Copyleft in production |

**Local Development Script:**

```bash
#!/bin/bash
# scripts/security-check.sh
# Run before every commit

echo "🔒 Running ThreatDiviner Security Suite..."

# SAST Scan
echo "📝 SAST Scan (Semgrep)..."
td-scan sast --path . --severity critical,high --fail-on-findings

# SCA Scan  
echo "📦 SCA Scan (Dependencies)..."
td-scan sca --path . --severity critical,high --fail-on-findings

# Secrets Scan
echo "🔑 Secrets Scan..."
td-scan secrets --path . --fail-on-findings

# IaC Scan (if applicable)
if [ -d "infrastructure" ] || [ -d "terraform" ]; then
  echo "🏗️ IaC Scan..."
  td-scan iac --path . --severity critical,high --fail-on-findings
fi

# License Check
echo "📜 License Compliance..."
td-scan license --path . --deny copyleft

echo "✅ All security checks passed!"
```

**Pre-Commit Hook:**

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: threatdiviner-security
        name: ThreatDiviner Security Scan
        entry: ./scripts/security-check.sh
        language: script
        pass_filenames: false
        stages: [commit]
```

**Claude Code Security Protocol:**

1. **Before every commit**, run `./scripts/security-check.sh`
2. **Fix all findings** before proceeding:
   - SAST: Fix code vulnerabilities
   - SCA: Update vulnerable dependencies
   - Secrets: Remove and rotate any detected secrets
   - IaC: Fix misconfigurations
3. **Document exceptions** if a finding is a false positive:
   ```typescript
   // td-ignore: semgrep-rule-id - Reason for exception
   // Approved by: @security-team on 2025-01-23
   ```
4. **Report scan results** in checkpoint output

**Checkpoint Security Report Format:**

```markdown
## Security Scan Results

### SAST (Semgrep)
- Files scanned: 47
- Findings: 0 critical, 0 high, 2 medium, 5 low
- Status: ✅ PASS

### SCA (Dependencies)
- Dependencies scanned: 234
- Vulnerable: 0 critical, 0 high, 3 medium
- Status: ✅ PASS

### Secrets
- Files scanned: 156
- Secrets found: 0
- Status: ✅ PASS

### IaC
- Files scanned: 12
- Misconfigurations: 0 critical, 0 high
- Status: ✅ PASS

### Overall: ✅ READY FOR REVIEW
```

---

## 9. Forbidden Patterns

### 9.1 Hardcoded Data

**❌ ABSOLUTELY FORBIDDEN:**

```typescript
// ❌ BAD - Hardcoded shape mappings
const shapeMappings = [
  { style: 'mxgraph.aws4.ec2', technology: 'web-server' },
  { style: 'mxgraph.aws4.rds', technology: 'database' },
  // ... 200 more hardcoded entries
];

// ✅ GOOD - Load from database
const shapeMappings = await prisma.shapeMapping.findMany({
  where: { status: 'live' },
});
```

### 9.2 Console Logging

**❌ FORBIDDEN in production code:**

```typescript
// ❌ BAD
console.log('Processing risk:', risk);
console.error('Something went wrong');

// ✅ GOOD - Use structured logger
this.logger.debug('Processing risk', { riskId: risk.id });
this.logger.error('Operation failed', { error, context });
```

### 9.3 Any Types

```typescript
// ❌ BAD
function process(data: any): any {
  return data.value;
}

// ✅ GOOD
function process<T extends { value: unknown }>(data: T): T['value'] {
  return data.value;
}
```

### 9.4 Inline Styles

```typescript
// ❌ BAD
<div style={{ color: 'red', fontSize: '14px' }}>

// ✅ GOOD
<div className="text-red-500 text-sm">
```

### 9.5 Direct DOM Manipulation

```typescript
// ❌ BAD
document.getElementById('risk-panel').innerHTML = content;
document.querySelector('.button').addEventListener('click', handler);

// ✅ GOOD - Use React
const [content, setContent] = useState('');
return <div>{content}</div>;
```

### 9.6 Forbidden Dependencies

| Dependency | Reason | Alternative |
|------------|--------|-------------|
| `moment` | Large bundle, deprecated | `date-fns` |
| `lodash` (full) | Large bundle | `lodash-es` (tree-shakeable) |
| `jquery` | Not needed with React | React APIs |
| `axios` | Inconsistent | `fetch` or `ky` |
| `request` | Deprecated | `node-fetch` |

---

## 10. Dynamic Data Rule

### 10.1 The Golden Rule

> **"Sample data in specs is illustrative only — never hardcode; always build CRUD + DB/config loading; if you see 5 examples, build the system that manages N items dynamically."**

### 10.2 Data Sources

Config data enters the system ONLY via:
1. **Admin UI** — Human entry or bulk CSV/JSON import
2. **Feed sync** — External authoritative sources (CWE/CAPEC/NIST/CIS)

No seed scripts. No bootstrap files. No config JSON shipped in repo.

### 10.3 Examples

**Shape Mappings (04_data_models.md shows 15 examples):**

```typescript
// ❌ BAD - Hardcoding the 15 examples
const SHAPE_MAPPINGS = [
  { style: 'mxgraph.aws4.ec2', tech: 'web-server' },
  // ... 14 more
];

// ✅ GOOD - Build the system
interface ShapeMapping {
  id: string;
  drawioStyle: string;
  stylePattern?: string;
  threagileeTechnology: string;
  machineType: string;
  defaultProperties: Record<string, unknown>;
  status: 'pending' | 'review' | 'live';
}

class ShapeMappingService {
  async findByStyle(style: string): Promise<ShapeMapping | null> {
    // Exact match first
    const exact = await prisma.shapeMapping.findFirst({
      where: { drawioStyle: style, status: 'live' },
    });
    if (exact) return exact;
    
    // Pattern match
    const patterns = await prisma.shapeMapping.findMany({
      where: { stylePattern: { not: null }, status: 'live' },
    });
    for (const mapping of patterns) {
      if (new RegExp(mapping.stylePattern!).test(style)) {
        return mapping;
      }
    }
    
    return null; // Unknown shape - prompt for classification
  }
  
  async create(input: CreateShapeMappingDto): Promise<ShapeMapping> { ... }
  async update(id: string, input: UpdateShapeMappingDto): Promise<ShapeMapping> { ... }
  async delete(id: string): Promise<void> { ... }
  async submitForReview(id: string): Promise<ShapeMapping> { ... }
  async approve(id: string): Promise<ShapeMapping> { ... }
}
```

**Wizard Questions (04_data_models.md shows 8 examples):**

```typescript
// ❌ BAD - Hardcoding the 8 questions
const WIZARD_QUESTIONS = [
  { id: 'q_app_type', text: 'What type of application?' },
  // ... 7 more
];

// ✅ GOOD - Build the system
class WizardService {
  async getQuestionFlow(): Promise<WizardQuestion[]> {
    return prisma.wizardQuestion.findMany({
      where: { status: 'live' },
      orderBy: { orderIndex: 'asc' },
      include: { options: true, triggers: true },
    });
  }
  
  async evaluateConditions(
    questionId: string,
    answers: Record<string, string>,
  ): Promise<boolean> {
    const question = await prisma.wizardQuestion.findUnique({
      where: { id: questionId },
      include: { conditions: true },
    });
    
    if (!question?.conditions?.length) return true;
    
    return question.conditions.every(cond => 
      evaluateCondition(cond, answers)
    );
  }
  
  async applyTriggers(
    optionValue: string,
    questionId: string,
  ): Promise<DiagramDelta> {
    // Load triggers from DB, apply to diagram
  }
}
```

### 10.4 Checklist Before Implementation

Before implementing any feature with sample data in the spec:

- [ ] Is there a database table for this data?
- [ ] Is there a service with CRUD operations?
- [ ] Is there an admin UI for management?
- [ ] Is there a staging/promotion workflow?
- [ ] Are there tests for N items (not just the examples)?

---

## 11. Checkpoint Protocol

### 11.1 Critical Rule

> **Claude Code is prone to going off-track if left alone too long. NEVER work for more than 1-2 hours without a checkpoint. When in doubt, checkpoint.**

### 11.2 Checkpoint Triggers

**MUST checkpoint after:**
- Each database migration
- Each API endpoint
- Each UI component
- Each service class
- Each integration (Threagile, feeds, etc.)
- Any file > 200 lines

**NEVER proceed without approval after:**
- Phase completion
- Architectural decisions
- New dependencies
- Schema changes

### 11.3 Checkpoint Procedure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CHECKPOINT PROCEDURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. COMPLETE DELIVERABLE                                                    │
│     └─► Finish the specific component/endpoint/migration                   │
│     └─► Run tests, verify working                                          │
│                                                                             │
│  2. APPEND TO CHECKPOINT.md (preserve history)                              │
│     └─► Use format from §11.4 below                                        │
│     └─► APPEND to: .claude/ThreatModel/CHECKPOINT.md                       │
│     └─► Add separator "---" between checkpoints                            │
│     └─► Newest checkpoint at BOTTOM of file                                │
│                                                                             │
│  3. GENERATE REPOMIX (REPLACE previous, do NOT commit)                     │
│     └─► Run: repomix --output .claude/ThreatModel/repomix-output.xml       │
│     └─► This OVERWRITES previous output (not append)                       │
│                                                                             │
│  4. COMMIT CODE ONLY (not CHECKPOINT.md or repomix-output.xml)             │
│     └─► git add -A                                                         │
│     └─► git reset .claude/ThreatModel/CHECKPOINT.md                        │
│     └─► git reset .claude/ThreatModel/repomix-output.xml                   │
│     └─► git commit -m "Checkpoint X.Y: [description]"                      │
│                                                                             │
│  5. TAG AND PUSH                                                            │
│     └─► git tag -a vX.Y.0 -m "Checkpoint X.Y: [description]"               │
│     └─► git push origin main --tags                                        │
│                                                                             │
│  6. OUTPUT MESSAGE AND STOP                                                 │
│     └─► Print: "═══════════════════════════════════════════════════════"   │
│     └─► Print: "CHECKPOINT vX.Y.0 COMPLETE"                                │
│     └─► Print: "Files ready for review in .claude/ThreatModel/:"           │
│     └─► Print: "  1. CHECKPOINT.md (appended)"                             │
│     └─► Print: "  2. repomix-output.xml (replaced)"                        │
│     └─► Print: "Upload both files to Claude for approval."                 │
│     └─► Print: "═══════════════════════════════════════════════════════"   │
│                                                                             │
│  7. FULL STOP — NO FURTHER WORK                                            │
│     └─► Do NOT continue to next task                                       │
│     └─► Do NOT "get started" on anything                                   │
│     └─► Wait for next session with approval                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 11.4 CHECKPOINT.md Format

```markdown
# Checkpoint X.Y: [Component/Feature Name]

## What Was Built
- [Specific deliverable description]

## Files Changed
| File | Change |
|------|--------|
| `path/to/file.ts` | Created - [description] |
| `path/to/other.ts` | Modified - [description] |

## Tests Run
```
[paste test output]
```

## Verification
- [ ] Component renders / endpoint responds
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] No lint errors

## Screenshots / Output
[ASCII diagram or description of what user would see]

## Questions / Decisions Needed
- [Any blockers or choices that need human input]

## Next Task (DO NOT START)
- [What would come next, but NOT started]

---
**Status: AWAITING APPROVAL**

Upload repomix-output.xml and this file to Claude.
Respond with: APPROVED / FIX: [details] / REJECT: [reason]
```

### 11.5 Version Numbering

| Format | Meaning |
|--------|---------|
| `v0.1.0` | Phase 0, Checkpoint 1 |
| `v0.2.0` | Phase 0, Checkpoint 2 |
| `v1.1.0` | Phase 1, Checkpoint 1 |
| `v1.2.0` | Phase 1, Checkpoint 2 |
| `v1.2.1` | Phase 1, Checkpoint 2, Fix attempt 1 |
| `v1.2.2` | Phase 1, Checkpoint 2, Fix attempt 2 |

### 11.6 Human Response Format

After uploading files to Claude, human receives one of:

**APPROVED**
```
APPROVED — Proceed to Checkpoint X.Y+1: [next deliverable]
```

**FIX**
```
FIX: [specific changes needed]
- Change A: [details]
- Change B: [details]

After fixing, re-checkpoint as vX.Y.Z (increment Z)
```

**REJECT**
```
REJECT: [reason]
- [explanation of what's wrong]
- [guidance on correct approach]

Redo checkpoint X.Y from scratch.
```

### 11.7 What Claude Reviews

When human uploads repomix-output.xml + CHECKPOINT.md, Claude will:

1. Verify code matches spec (correct patterns, naming, structure)
2. Check for hardcoded data (violation of §10)
3. Verify tests exist and cover edge cases
4. Check for security issues
5. Verify checkpoint is complete (not partial work)
6. Confirm ready for next task

---

## 12. Performance Rules

### 12.1 Pagination

**Rules:**
- ✅ ALL list endpoints must support pagination
- ✅ Default page size: 25, max: 100
- ✅ Use cursor-based pagination for large datasets
- ❌ NEVER return unbounded lists

```typescript
// GraphQL pagination
type ThreatModelConnection {
  edges: [ThreatModelEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

// Service implementation
async findMany(options: PaginationOptions): Promise<PaginatedResult<ThreatModel>> {
  const { limit = 25, cursor, direction = 'forward' } = options;
  
  const items = await prisma.threatModel.findMany({
    take: limit + 1, // Fetch one extra to check hasNextPage
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
    orderBy: { createdAt: 'desc' },
  });
  
  const hasMore = items.length > limit;
  const edges = items.slice(0, limit);
  
  return {
    edges: edges.map(item => ({ node: item, cursor: item.id })),
    pageInfo: {
      hasNextPage: hasMore,
      endCursor: edges[edges.length - 1]?.id,
    },
  };
}
```

### 12.2 Caching

**Rules:**
- ✅ Cache configuration data in Redis
- ✅ Cache user sessions
- ✅ Invalidate cache on mutations
- ✅ Use cache-aside pattern

```typescript
class ShapeMappingService {
  private readonly CACHE_KEY = 'shape-mappings:live';
  private readonly CACHE_TTL = 300; // 5 minutes

  async findAll(): Promise<ShapeMapping[]> {
    // Try cache first
    const cached = await this.redis.get(this.CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    
    // Load from DB
    const mappings = await prisma.shapeMapping.findMany({
      where: { status: 'live' },
    });
    
    // Cache result
    await this.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(mappings));
    
    return mappings;
  }

  async update(id: string, input: UpdateDto): Promise<ShapeMapping> {
    const result = await prisma.shapeMapping.update({
      where: { id },
      data: input,
    });
    
    // Invalidate cache
    await this.redis.del(this.CACHE_KEY);
    
    return result;
  }
}
```

### 12.3 Lazy Loading

**Rules:**
- ✅ Lazy load heavy components (diagram editor, report generator)
- ✅ Use React.lazy() and Suspense
- ✅ Show loading states during lazy load

```typescript
// ✅ GOOD - Lazy load heavy components
const DiagramCanvas = lazy(() => import('./DiagramCanvas'));
const ReportGenerator = lazy(() => import('./ReportGenerator'));

function EditorPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DiagramCanvas />
    </Suspense>
  );
}
```

### 12.4 N+1 Prevention

**Rules:**
- ✅ Use DataLoader for batching
- ✅ Use Prisma `include` for eager loading
- ✅ Monitor query counts in development
- ❌ NEVER fetch relations in a loop

```typescript
// ❌ BAD - N+1 queries
const models = await prisma.threatModel.findMany();
for (const model of models) {
  const risks = await prisma.risk.findMany({ where: { modelId: model.id } });
  model.risks = risks;
}

// ✅ GOOD - Single query with include
const models = await prisma.threatModel.findMany({
  include: { risks: true },
});

// ✅ GOOD - DataLoader for GraphQL
const riskLoader = new DataLoader(async (modelIds: string[]) => {
  const risks = await prisma.risk.findMany({
    where: { modelId: { in: modelIds } },
  });
  
  const risksByModel = groupBy(risks, 'modelId');
  return modelIds.map(id => risksByModel[id] || []);
});
```

---

## 13. Document References

| Doc | Purpose |
|-----|---------|
| `00_overview.md` | Product summary, vision, tiers |
| `01_product_context.md` | Personas, stories, JTBD |
| `02_functional_spec.md` | Features, behaviors |
| `03_technical_spec.md` | Architecture, stack, APIs |
| `04_data_models.md` | Schema definitions, mappings |
| `05_ui_screens.md` | UI specifications |
| `06_user_flows.md` | User journeys |
| `07_admin_console.md` | Admin console spec |
| **`08_rules.md`** | **This document** — Code constraints |
| `09_implementation_plan.md` | Phased build order |

---

*Last updated: 2025-01-23*
*Author: ThreatDiviner Product Team*
