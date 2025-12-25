# ThreatDiviner Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional, for caching and queues)
- Docker & Docker Compose (for containerized deployment)

---

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/your-org/threatdiviner.git
cd threatdiviner
pnpm install
```

### 2. Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Configure required variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/threatdiviner"

# Redis (optional - falls back to in-memory)
REDIS_URL="redis://localhost:6379"

# JWT Secret (generate a secure random string)
JWT_SECRET="your-super-secret-jwt-key"

# OAuth Apps (configure at least one)
GITHUB_CLIENT_ID="..."
GITHUB_CLIENT_SECRET="..."

# AI Features (optional)
ANTHROPIC_API_KEY="..."
```

### 3. Database Setup

```bash
# Generate Prisma client
pnpm --filter api prisma generate

# Run migrations
pnpm --filter api prisma migrate dev

# Seed initial data (optional)
pnpm --filter api db:seed
```

### 4. Start Development Servers

```bash
# Start all apps
pnpm dev

# Or individually:
pnpm --filter api start:dev
pnpm --filter dashboard dev
```

- API: http://localhost:3001
- Dashboard: http://localhost:3000

---

## Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Docker Compose Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: threatdiviner
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/threatdiviner
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "3001:3001"

  dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001
    depends_on:
      - api
    ports:
      - "3000:3000"

  worker:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    command: ["node", "dist/worker.js"]
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/threatdiviner
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  redis_data:
```

---

## Production Deployment

### Environment Variables

Ensure all production variables are set:

```bash
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=<secure-random-string>
NODE_ENV=production

# Recommended
REDIS_URL=redis://...
CACHE_TTL_SECONDS=300

# OAuth (at least one provider)
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Optional Features
ANTHROPIC_API_KEY=...
SLACK_WEBHOOK_URL=...
```

### Database Migrations

Run migrations before deploying new versions:

```bash
pnpm --filter api prisma migrate deploy
```

### Health Checks

The API exposes health endpoints:

- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check (includes DB/Redis)

### Logging

Configure log levels via environment:

```bash
LOG_LEVEL=info  # debug, info, warn, error
LOG_FORMAT=json  # json, pretty
```

---

## Kubernetes Deployment

### Example Manifests

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: threatdiviner-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: threatdiviner-api
  template:
    metadata:
      labels:
        app: threatdiviner-api
    spec:
      containers:
        - name: api
          image: threatdiviner/api:latest
          ports:
            - containerPort: 3001
          envFrom:
            - secretRef:
                name: threatdiviner-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: threatdiviner-api
spec:
  selector:
    app: threatdiviner-api
  ports:
    - port: 80
      targetPort: 3001
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: threatdiviner
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.threatdiviner.io
      secretName: threatdiviner-tls
  rules:
    - host: api.threatdiviner.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: threatdiviner-api
                port:
                  number: 80
```

---

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Build Docker images
        run: |
          docker build -t threatdiviner/api:${{ github.sha }} -f apps/api/Dockerfile .
          docker build -t threatdiviner/dashboard:${{ github.sha }} -f apps/dashboard/Dockerfile .

      - name: Push to registry
        run: |
          docker push threatdiviner/api:${{ github.sha }}
          docker push threatdiviner/dashboard:${{ github.sha }}

      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/threatdiviner-api api=threatdiviner/api:${{ github.sha }}
          kubectl set image deployment/threatdiviner-dashboard dashboard=threatdiviner/dashboard:${{ github.sha }}
```

---

## Scaling Considerations

### Horizontal Scaling

- API servers are stateless - scale horizontally
- Use Redis for session storage
- Use Redis for BullMQ job distribution

### Database Scaling

- Use connection pooling (PgBouncer)
- Consider read replicas for heavy read workloads
- Implement database partitioning for large finding tables

### Caching Strategy

- Enable Redis caching in production
- Configure appropriate TTLs per endpoint
- Use cache invalidation on writes

---

## Backup and Recovery

### Database Backups

```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup-20241225.sql
```

### Automated Backups

Use your cloud provider's managed backup solutions:
- AWS RDS: Automated backups
- GCP Cloud SQL: Automated backups
- Azure Database: Automated backups

---

## Monitoring

### Metrics

Expose Prometheus metrics:

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
```

### Recommended Alerts

- API error rate > 1%
- P95 latency > 500ms
- Queue depth > 1000
- Database connections > 80%
- Memory usage > 85%

---

## Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure JWT secrets
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Regular dependency updates
- [ ] Database encryption at rest
- [ ] Network isolation for databases
