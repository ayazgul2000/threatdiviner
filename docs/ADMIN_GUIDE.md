# ThreatDiviner Admin Guide

## Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional, for job queue)
- Docker (optional, for scanners)

### Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/threatdiviner.git
cd threatdiviner

# Install dependencies
pnpm install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your settings

# Set up database
cd apps/api
npx prisma migrate deploy
npx prisma db seed

# Start services
pnpm dev
```

---

## Configuration

### Environment Variables

#### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/threatdiviner` |
| `JWT_SECRET` | Secret for JWT tokens (min 32 chars) | `your-super-secret-jwt-key-here` |

#### Optional - Redis & Queue
| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `QUEUE_CONCURRENCY` | Concurrent scan jobs | `2` |

#### Optional - OAuth Providers
| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret |
| `GITLAB_CLIENT_ID` | GitLab OAuth app ID |
| `GITLAB_CLIENT_SECRET` | GitLab OAuth secret |
| `GITLAB_URL` | GitLab instance URL (default: gitlab.com) |
| `BITBUCKET_CLIENT_ID` | Bitbucket OAuth app ID |
| `BITBUCKET_CLIENT_SECRET` | Bitbucket OAuth secret |
| `AZURE_DEVOPS_CLIENT_ID` | Azure DevOps OAuth app ID |
| `AZURE_DEVOPS_CLIENT_SECRET` | Azure DevOps OAuth secret |

#### Optional - AI Features
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for AI features |
| `OPENAI_API_KEY` | OpenAI API key for embeddings |
| `QDRANT_URL` | Qdrant vector database URL |

#### Optional - Notifications
| Variable | Description |
|----------|-------------|
| `SLACK_WEBHOOK_URL` | Slack notifications |
| `TEAMS_WEBHOOK_URL` | Microsoft Teams notifications |
| `DISCORD_WEBHOOK_URL` | Discord notifications |
| `PAGERDUTY_ROUTING_KEY` | PagerDuty alerts |
| `OPSGENIE_API_KEY` | OpsGenie alerts |

---

## Scanner Configuration

### Local Installation

```bash
# Semgrep (SAST)
pip install semgrep

# Trivy (SCA/Container)
brew install aquasecurity/trivy/trivy

# Gitleaks (Secrets)
brew install gitleaks

# TruffleHog (Secrets)
brew install trufflesecurity/trufflehog/trufflehog

# Checkov (IaC)
pip install checkov

# Gosec (Go SAST)
go install github.com/securego/gosec/v2/cmd/gosec@latest

# Bandit (Python SAST)
pip install bandit

# Nuclei (DAST)
go install github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest
```

### Docker (Recommended for Production)

Scanners run automatically in Docker containers when Docker is available. No additional configuration needed.

### Scanner-Specific Settings

In repository settings:
- **Enable/Disable** specific scanners
- **Custom rules**: Upload Semgrep rules
- **Exclusions**: Paths to skip
- **Severity threshold**: Minimum severity to report

---

## Operations

### Database

#### Backups
```bash
# Create backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore backup
psql $DATABASE_URL < backup-20241229.sql
```

#### Migrations
```bash
# Apply pending migrations
npx prisma migrate deploy

# Create new migration
npx prisma migrate dev --name add_feature
```

### Scaling

#### Horizontal Scaling
- **API**: Stateless, run multiple instances behind load balancer
- **Workers**: Scale independently for scan processing
- **Redis**: Use Redis Cluster for high availability

#### Recommended Production Setup
```
Load Balancer
    |
    +-- API Server 1
    +-- API Server 2
    +-- API Server 3
    |
    +-- Worker 1 (SAST)
    +-- Worker 2 (SCA)
    +-- Worker 3 (DAST)
    |
Redis Cluster -- PostgreSQL Primary + Read Replicas
```

### Kubernetes Deployment

```bash
# Apply manifests
kubectl apply -f deploy/k8s/

# Check status
kubectl get pods -n threatdiviner

# View logs
kubectl logs -f deployment/api -n threatdiviner
```

---

## Monitoring

### Health Checks

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Full health check (DB, Redis, Queue) |
| `GET /health/live` | Liveness probe |
| `GET /health/ready` | Readiness probe |

### Prometheus Metrics

Enable metrics:
```env
METRICS_ENABLED=true
METRICS_PORT=9090
```

Available metrics:
- `threatdiviner_scans_total` - Total scans
- `threatdiviner_scans_duration_seconds` - Scan duration
- `threatdiviner_findings_total` - Total findings by severity
- `threatdiviner_api_requests_total` - API request count
- `threatdiviner_queue_depth` - Queue depth

### Grafana Dashboard

Import dashboard from `deploy/grafana/dashboard.json`

---

## Security

### Authentication
- JWT tokens with configurable expiration
- API keys for programmatic access
- OAuth for SCM providers

### Authorization
- Role-based access control (RBAC)
- Tenant isolation via Row Level Security
- Scoped API keys

### Data Protection
- All data encrypted at rest (PostgreSQL)
- TLS for all connections
- Secrets masked in logs

### Audit Logging
All sensitive actions are logged:
- User authentication
- Resource creation/modification/deletion
- Scan triggers
- Finding status changes

View audit logs:
```sql
SELECT * FROM audit_logs
WHERE tenant_id = 'your-tenant-id'
ORDER BY created_at DESC
LIMIT 100;
```

---

## Troubleshooting

### Common Issues

#### Scans Stuck in QUEUED
1. Check Redis connection: `redis-cli ping`
2. Check worker logs: `docker logs threatdiviner-worker`
3. Verify scanner is installed: `semgrep --version`
4. Check queue: `redis-cli LLEN bull:scans:wait`

#### OAuth Not Working
1. Verify callback URLs match exactly
2. Check client ID/secret are correct
3. Verify network access to provider
4. Check browser console for errors

#### High Memory Usage
1. Increase Node.js heap: `NODE_OPTIONS=--max-old-space-size=4096`
2. Check for memory leaks in workers
3. Reduce concurrent scan limit
4. Enable swap if needed

#### Slow Scans
1. Check available disk space
2. Reduce concurrent scanners
3. Exclude unnecessary paths
4. Check network connectivity for SCA

### Log Levels

Set log level:
```env
LOG_LEVEL=debug  # debug, verbose, log, warn, error
```

### Debug Mode

Enable debug mode:
```env
DEBUG=true
```

This enables:
- Verbose logging
- Stack traces in API responses
- Query timing logs

---

## Backup & Recovery

### Full Backup
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backups/db_$DATE.sql
tar -czf backups/uploads_$DATE.tar.gz uploads/
```

### Restore
```bash
#!/bin/bash
# restore.sh
psql $DATABASE_URL < backups/db_$1.sql
tar -xzf backups/uploads_$1.tar.gz -C .
```

### Disaster Recovery
1. Restore database from backup
2. Apply any pending migrations
3. Restart API and worker services
4. Verify health endpoints
5. Check queue processing

---

## Upgrades

### Minor Updates (x.Y.z)
```bash
git pull
pnpm install
npx prisma migrate deploy
pnpm build
# Restart services
```

### Major Updates (X.0.0)
1. Review changelog for breaking changes
2. Backup database
3. Stop all services
4. Pull new code
5. Run migrations
6. Update environment variables
7. Start services
8. Verify functionality

---

## Support

### Logs Location
- API: `logs/api.log`
- Workers: `logs/worker.log`
- Scans: `logs/scans/`

### Debug Data Collection
```bash
# Collect debug info
./scripts/collect-debug.sh > debug-$(date +%Y%m%d).txt
```

Include in support tickets:
- Debug output
- Relevant log sections
- Steps to reproduce
- Expected vs actual behavior
