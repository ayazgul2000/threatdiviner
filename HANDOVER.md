# ThreatDiviner - Developer Handover Documentation

## Architecture Overview

ThreatDiviner is a security scanning platform built as a monorepo using:

- **Frontend**: Next.js 14 (apps/dashboard)
- **Backend**: NestJS (apps/api)
- **Database**: PostgreSQL with Prisma ORM
- **Queue**: Bull with Redis
- **Real-time**: Socket.IO WebSockets

### Directory Structure

```
threatdiviner/
├── apps/
│   ├── api/                 # NestJS backend
│   │   ├── prisma/          # Database schema & migrations
│   │   └── src/
│   │       ├── pentest/     # Penetration testing module
│   │       ├── scanners/    # Scanner implementations
│   │       │   ├── dast/    # DAST scanners (Nuclei, ZAP)
│   │       │   ├── pentest/ # Pentest scanners (Nikto, SQLMap, SSLyze)
│   │       │   ├── sast/    # SAST scanners (Semgrep)
│   │       │   ├── sca/     # SCA scanners (Trivy)
│   │       │   └── secrets/ # Secret scanners (Gitleaks)
│   │       ├── scans/       # Scan streaming & management
│   │       ├── scm/         # SCM integration (GitHub, GitLab)
│   │       ├── webhooks/    # Webhook handlers
│   │       └── integrations/# Third-party integrations
│   │
│   ├── dashboard/           # Next.js frontend
│   │   └── src/
│   │       ├── app/         # App router pages
│   │       ├── components/  # React components
│   │       ├── hooks/       # Custom hooks
│   │       └── lib/         # Utilities & API client
│   │
│   └── admin/               # Admin dashboard
│
└── packages/
    └── cli/                 # CLI tool
```

## Scanner Plugin Pattern

### Interface

All scanners implement `IScanner` interface:

```typescript
interface IScanner {
  name: string;
  version: string;
  supportedLanguages: string[];
  outputFormat: 'json' | 'sarif' | 'text';

  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;
  scan(context: ScanContext): Promise<ScanOutput>;
  parseOutput(output: ScanOutput): Promise<NormalizedFinding[]>;
}
```

### Adding a New Scanner

1. Create directory: `apps/api/src/scanners/{category}/{scanner-name}/`
2. Implement scanner class:

```typescript
@Injectable()
export class MyScanner implements IScanner {
  readonly name = 'my-scanner';
  readonly version = '1.0';
  readonly supportedLanguages = ['javascript', 'typescript'];
  readonly outputFormat = 'json' as const;

  constructor(
    private readonly executor: LocalExecutorService,
    private readonly configService: ConfigService,
  ) {}

  async isAvailable(): Promise<boolean> {
    return this.executor.isCommandAvailable('my-scanner');
  }

  async getVersion(): Promise<string> {
    return this.executor.getCommandVersion('my-scanner', '--version');
  }

  async scan(context: ScanContext): Promise<ScanOutput> {
    const args = ['--json', '-o', outputFile, context.workDir];
    return this.executor.execute({
      command: 'my-scanner',
      args,
      cwd: context.workDir,
      timeout: context.timeout,
    });
  }

  async parseOutput(output: ScanOutput): Promise<NormalizedFinding[]> {
    // Parse scanner output and normalize to common format
    const content = await fs.readFile(output.outputFile, 'utf-8');
    return JSON.parse(content).map(this.convertResult);
  }
}
```

3. Register in module: `apps/api/src/scanners/scanners.module.ts`
4. Add to scan processor if needed

## Two-Phase Scanning

### How It Works

1. **Discovery Phase** (fast, ~3 min timeout):
   - Nuclei: `http/technologies`, `http/exposed-panels`, `http/misconfiguration`
   - Nikto: `-Tuning 0` (default quick scan)
   - SSLyze: Quick protocol check

2. **Technology Extraction**:
   - Parse findings for technology patterns (Apache, Nginx, PHP, etc.)
   - Store in `detectedTechnologies` array

3. **Deep Phase** (thorough, ~5 min timeout per scanner):
   - Nuclei: Tech-specific templates (`http/apache`, `http/wordpress`, etc.)
   - Nikto: Tech-specific tuning flags
   - Full CVE/vulnerability scanning

### Deduplication

Findings are deduplicated by:
- Key: `(CVE/CWE || title) + endpoint + scanner`
- On duplicate: Keep highest severity, merge descriptions/evidence

## WebSocket Events

### Namespace: `/scans`

Client subscribes:
```javascript
socket.emit('subscribe', { scanId: 'uuid' });
```

Events emitted:
```typescript
// Scanner starts
{ type: 'scanner:start', scanner: 'semgrep', phase: 'discovery' }

// Progress update
{ type: 'scanner:progress', scanner: 'semgrep', filesScanned: 50, totalFiles: 200 }

// Individual finding (streamed)
{ type: 'scanner:finding', scanner: 'semgrep', finding: {...} }

// Scanner done
{ type: 'scanner:complete', scanner: 'semgrep', findingsCount: 15, duration: 45000 }

// Full scan done
{ type: 'scan:complete', totalFindings: 42, severityBreakdown: {...}, duration: 180000 }
```

## Webhook Flow

### Setup

1. User configures webhook in repository settings
2. System generates unique `webhookUrl` and `webhookSecret`
3. User adds webhook URL to GitHub/GitLab

### Trigger

1. Push/PR event → `POST /webhooks/github/:repoId`
2. Verify signature (HMAC-SHA256 for GitHub)
3. Check branch filters (include/exclude patterns)
4. Queue scan job with trigger metadata

### Callback

1. Scan completes
2. `GitHubService.postScanResults()`:
   - Posts summary comment on PR
   - Posts inline comments on changed lines (if enabled)
   - Updates commit status (pass/fail based on severity threshold)

## CLI Flags & Exit Codes

### Flags

```
--branch <name>       Target branch to scan
--scanners <list>     Comma-separated scanner names
--block-on <level>    Exit 1 if findings at this level or above (critical, high, medium, low)
--output <format>     Output format: json, sarif, text
--stream              Show live progress via SSE
```

### Exit Codes

- `0` - Success (no findings above threshold)
- `1` - Failure (findings above threshold)
- `2` - Error (scan failed)

### SARIF Output

Valid SARIF 2.1.0 format for GitHub Security tab:

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": { "driver": { "name": "ThreatDiviner", "rules": [...] }},
    "results": [...]
  }]
}
```

## Environment Variables

### Required

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/threatdiviner
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
```

### Optional

```env
# Scanner paths (if not in PATH)
SEMGREP_PATH=/usr/local/bin/semgrep
NUCLEI_PATH=/usr/local/bin/nuclei
TRIVY_PATH=/usr/local/bin/trivy
GITLEAKS_PATH=/usr/local/bin/gitleaks

# Docker images for sandboxed scanners
NIKTO_DOCKER_IMAGE=secfigo/nikto
ZAP_DOCKER_IMAGE=owasp/zap2docker-stable

# GitHub App (for PR comments)
GITHUB_APP_ID=12345
GITHUB_APP_PRIVATE_KEY=...
```

## Known Limitations & TODOs

### Current Limitations

1. **WebSocket reconnection**: Client must manually resubscribe after disconnect
2. **SQLMap/SSLyze two-phase**: Not fully implemented (uses level-based approach)
3. **ZAP scanner**: Requires Docker Desktop running
4. **Inline comments**: Only works with line numbers; some scanners don't provide them

### TODOs

- [ ] Implement ZAP two-phase (spider-only discovery, active scan deep)
- [ ] Add SQLMap endpoint storage for deep phase targeting
- [ ] Rate limiting for webhook endpoints
- [ ] Webhook delivery retry with exponential backoff
- [ ] SARIF export button in dashboard
- [ ] CLI binary distribution (homebrew, apt, etc.)

## Testing

### Run Tests

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Test specific scanner
pnpm test -- --grep="NucleiScanner"
```

### Manual Testing

1. Start services:
   ```bash
   pnpm dev
   ```

2. Test webhook (GitHub):
   ```bash
   curl -X POST http://localhost:3001/webhooks/github/REPO_ID \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: push" \
     -d '{"ref":"refs/heads/main","after":"abc123"}'
   ```

3. Test SSE stream:
   ```bash
   curl -N http://localhost:3001/scans/SCAN_ID/stream
   ```

## Database Migrations

```bash
# Create migration
npx prisma migrate dev --name add-feature

# Apply in production
npx prisma migrate deploy

# Reset (dev only)
npx prisma migrate reset
```

## Deployment

### Docker

```bash
docker-compose up -d
```

### PM2

```bash
pm2 start ecosystem.config.js
```

### Environment-Specific

- Development: Uses SQLite, mocked scanners
- Staging: Full stack, limited scanner templates
- Production: Full stack, all templates, rate limiting enabled
