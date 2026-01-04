# ThreatDiviner - BATCH 10: Hierarchy, Connectivity, Functional Testing, Full Completion

## CRITICAL: READ THIS FIRST

This batch must be executed completely. Do not stop until all phases are done and the app runs without errors.

---

## PHASE 0: APP LIFECYCLE MANAGEMENT (DO THIS FIRST)

### 0.1 Create App Management Scripts

**Create: `scripts/app.sh`** (Linux/Mac)
```bash
#!/bin/bash

# ThreatDiviner App Management Script
# Usage: ./scripts/app.sh [start|stop|restart|status|logs]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

API_PORT=3001
DASHBOARD_PORT=3000
PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/.logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

stop_app() {
  echo "Stopping ThreatDiviner..."
  
  # Kill by PID files first
  if [ -f "$PID_DIR/api.pid" ]; then
    kill $(cat "$PID_DIR/api.pid") 2>/dev/null || true
    rm -f "$PID_DIR/api.pid"
  fi
  
  if [ -f "$PID_DIR/dashboard.pid" ]; then
    kill $(cat "$PID_DIR/dashboard.pid") 2>/dev/null || true
    rm -f "$PID_DIR/dashboard.pid"
  fi
  
  # Kill any remaining processes on ports
  lsof -ti:$API_PORT | xargs kill -9 2>/dev/null || true
  lsof -ti:$DASHBOARD_PORT | xargs kill -9 2>/dev/null || true
  
  # Kill by pattern (fallback)
  pkill -f "node.*apps/api" 2>/dev/null || true
  pkill -f "node.*apps/dashboard" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  pkill -f "nest start" 2>/dev/null || true
  
  sleep 2
  echo "✓ Stopped"
}

start_app() {
  echo "Starting ThreatDiviner..."
  
  # Ensure stopped first
  stop_app 2>/dev/null || true
  
  # Start API
  echo "Starting API on port $API_PORT..."
  cd "$PROJECT_ROOT/apps/api"
  nohup pnpm run start:dev > "$LOG_DIR/api.log" 2>&1 &
  echo $! > "$PID_DIR/api.pid"
  
  # Start Dashboard
  echo "Starting Dashboard on port $DASHBOARD_PORT..."
  cd "$PROJECT_ROOT/apps/dashboard"
  nohup pnpm run dev > "$LOG_DIR/dashboard.log" 2>&1 &
  echo $! > "$PID_DIR/dashboard.pid"
  
  cd "$PROJECT_ROOT"
  
  # Wait for services
  echo "Waiting for services..."
  for i in {1..30}; do
    if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
      echo "✓ API ready"
      break
    fi
    sleep 1
  done
  
  for i in {1..30}; do
    if curl -s http://localhost:$DASHBOARD_PORT > /dev/null 2>&1; then
      echo "✓ Dashboard ready"
      break
    fi
    sleep 1
  done
  
  echo ""
  echo "ThreatDiviner running:"
  echo "  API:       http://localhost:$API_PORT"
  echo "  Dashboard: http://localhost:$DASHBOARD_PORT"
  echo "  Logs:      $LOG_DIR/"
}

restart_app() {
  stop_app
  sleep 2
  start_app
}

status_app() {
  echo "ThreatDiviner Status:"
  echo ""
  
  if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
    echo "  API:       ✓ Running (port $API_PORT)"
  else
    echo "  API:       ✗ Not running"
  fi
  
  if curl -s http://localhost:$DASHBOARD_PORT > /dev/null 2>&1; then
    echo "  Dashboard: ✓ Running (port $DASHBOARD_PORT)"
  else
    echo "  Dashboard: ✗ Not running"
  fi
  
  echo ""
  echo "Processes:"
  ps aux | grep -E "(nest|next)" | grep -v grep || echo "  None found"
}

logs_app() {
  echo "=== API Logs (last 50 lines) ==="
  tail -50 "$LOG_DIR/api.log" 2>/dev/null || echo "No API logs"
  echo ""
  echo "=== Dashboard Logs (last 50 lines) ==="
  tail -50 "$LOG_DIR/dashboard.log" 2>/dev/null || echo "No Dashboard logs"
}

case "${1:-start}" in
  start)   start_app ;;
  stop)    stop_app ;;
  restart) restart_app ;;
  status)  status_app ;;
  logs)    logs_app ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
```

**Create: `scripts/app.ps1`** (Windows PowerShell)
```powershell
# ThreatDiviner App Management Script for Windows
# Usage: .\scripts\app.ps1 [-Action start|stop|restart|status|logs]

param(
    [ValidateSet("start", "stop", "restart", "status", "logs")]
    [string]$Action = "start"
)

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ApiPort = 3001
$DashboardPort = 3000
$PidDir = Join-Path $ProjectRoot ".pids"
$LogDir = Join-Path $ProjectRoot ".logs"

New-Item -ItemType Directory -Force -Path $PidDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Stop-ThreatDiviner {
    Write-Host "Stopping ThreatDiviner..." -ForegroundColor Yellow
    
    # Kill by port
    $apiProc = Get-NetTCPConnection -LocalPort $ApiPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    $dashProc = Get-NetTCPConnection -LocalPort $DashboardPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
    
    if ($apiProc) { Stop-Process -Id $apiProc -Force -ErrorAction SilentlyContinue }
    if ($dashProc) { Stop-Process -Id $dashProc -Force -ErrorAction SilentlyContinue }
    
    # Kill by name pattern
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -match "apps[\\/](api|dashboard)" -or $_.CommandLine -match "nest|next"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 2
    Write-Host "✓ Stopped" -ForegroundColor Green
}

function Start-ThreatDiviner {
    Write-Host "Starting ThreatDiviner..." -ForegroundColor Yellow
    
    Stop-ThreatDiviner 2>$null
    
    # Start API
    Write-Host "Starting API on port $ApiPort..."
    $apiLog = Join-Path $LogDir "api.log"
    Start-Process -FilePath "pnpm" -ArgumentList "run", "start:dev" -WorkingDirectory (Join-Path $ProjectRoot "apps\api") -RedirectStandardOutput $apiLog -RedirectStandardError $apiLog -WindowStyle Hidden
    
    # Start Dashboard
    Write-Host "Starting Dashboard on port $DashboardPort..."
    $dashLog = Join-Path $LogDir "dashboard.log"
    Start-Process -FilePath "pnpm" -ArgumentList "run", "dev" -WorkingDirectory (Join-Path $ProjectRoot "apps\dashboard") -RedirectStandardOutput $dashLog -RedirectStandardError $dashLog -WindowStyle Hidden
    
    # Wait for services
    Write-Host "Waiting for services..."
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 1
            Write-Host "✓ API ready" -ForegroundColor Green
            $ready = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$DashboardPort" -UseBasicParsing -TimeoutSec 1
            Write-Host "✓ Dashboard ready" -ForegroundColor Green
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    
    Write-Host ""
    Write-Host "ThreatDiviner running:" -ForegroundColor Cyan
    Write-Host "  API:       http://localhost:$ApiPort"
    Write-Host "  Dashboard: http://localhost:$DashboardPort"
}

function Get-ThreatDivinerStatus {
    Write-Host "ThreatDiviner Status:" -ForegroundColor Cyan
    
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 2
        Write-Host "  API:       ✓ Running" -ForegroundColor Green
    } catch {
        Write-Host "  API:       ✗ Not running" -ForegroundColor Red
    }
    
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$DashboardPort" -UseBasicParsing -TimeoutSec 2
        Write-Host "  Dashboard: ✓ Running" -ForegroundColor Green
    } catch {
        Write-Host "  Dashboard: ✗ Not running" -ForegroundColor Red
    }
}

function Get-ThreatDivinerLogs {
    Write-Host "=== API Logs ===" -ForegroundColor Cyan
    Get-Content (Join-Path $LogDir "api.log") -Tail 50 -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "=== Dashboard Logs ===" -ForegroundColor Cyan
    Get-Content (Join-Path $LogDir "dashboard.log") -Tail 50 -ErrorAction SilentlyContinue
}

switch ($Action) {
    "start"   { Start-ThreatDiviner }
    "stop"    { Stop-ThreatDiviner }
    "restart" { Stop-ThreatDiviner; Start-Sleep -Seconds 2; Start-ThreatDiviner }
    "status"  { Get-ThreatDivinerStatus }
    "logs"    { Get-ThreatDivinerLogs }
}
```

### 0.2 Make Scripts Executable

```bash
chmod +x scripts/app.sh
```

### 0.3 Add to package.json

**Update: `package.json` (root)**
```json
{
  "scripts": {
    "app:start": "bash scripts/app.sh start || powershell -File scripts/app.ps1 -Action start",
    "app:stop": "bash scripts/app.sh stop || powershell -File scripts/app.ps1 -Action stop",
    "app:restart": "bash scripts/app.sh restart || powershell -File scripts/app.ps1 -Action restart",
    "app:status": "bash scripts/app.sh status || powershell -File scripts/app.ps1 -Action status",
    "app:logs": "bash scripts/app.sh logs || powershell -File scripts/app.ps1 -Action logs"
  }
}
```

### 0.4 Create .gitignore entries

**Append to `.gitignore`:**
```
.pids/
.logs/
```

### 0.5 Test App Management

```bash
# Stop any existing processes
./scripts/app.sh stop

# Start fresh
./scripts/app.sh start

# Check status
./scripts/app.sh status

# View logs if issues
./scripts/app.sh logs
```

---

## PHASE 1: TENANT HIERARCHY & MULTI-TENANCY

### 1.1 Verify Tenant Isolation

**File: `apps/api/src/common/guards/tenant.guard.ts`**
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context');
    }
    
    // Attach tenantId to request for easy access
    request.tenantId = user.tenantId;
    return true;
  }
}
```

**File: `apps/api/src/common/decorators/tenant.decorator.ts`**
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.tenantId || request.tenantId;
  },
);

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  },
);
```

### 1.2 Tenant Context Middleware

**File: `apps/api/src/common/middleware/tenant-context.middleware.ts`**
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    
    if (user?.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: {
          id: true,
          name: true,
          status: true,
          settings: true,
          plan: true,
        },
      });
      
      if (tenant?.status !== 'ACTIVE') {
        return res.status(403).json({ message: 'Tenant suspended or inactive' });
      }
      
      (req as any).tenant = tenant;
    }
    
    next();
  }
}
```

### 1.3 Ensure All Services Use TenantId

**Pattern to apply to ALL services:**
```typescript
// EVERY findMany, findFirst, create, update, delete MUST include tenantId

// BAD - No tenant isolation
async findAll() {
  return this.prisma.project.findMany();
}

// GOOD - Tenant isolated
async findAll(tenantId: string) {
  return this.prisma.project.findMany({
    where: { tenantId },
  });
}

// GOOD - With decorator in controller
@Get()
async findAll(@TenantId() tenantId: string) {
  return this.projectsService.findAll(tenantId);
}
```

**Audit these services for tenant isolation:**
- [ ] ProjectsService
- [ ] RepositoriesService
- [ ] ScansService
- [ ] FindingsService
- [ ] BaselineService
- [ ] SbomService
- [ ] ThreatModelingService
- [ ] EnvironmentsService
- [ ] PipelineService
- [ ] CspmService
- [ ] AlertsService
- [ ] ApiKeysService
- [ ] AuditService
- [ ] ComplianceService

---

## PHASE 2: PROJECT HIERARCHY & RELATIONSHIPS

### 2.1 Project-Repository Linking

**Verify/Create: `apps/api/src/projects/projects.service.ts`**
```typescript
// Link repository to project
async linkRepository(projectId: string, repositoryId: string, tenantId: string) {
  // Verify both belong to same tenant
  const [project, repository] = await Promise.all([
    this.prisma.project.findFirst({ where: { id: projectId, tenantId } }),
    this.prisma.repository.findFirst({ where: { id: repositoryId, tenantId } }),
  ]);

  if (!project) throw new NotFoundException('Project not found');
  if (!repository) throw new NotFoundException('Repository not found');

  return this.prisma.repository.update({
    where: { id: repositoryId },
    data: { projectId },
  });
}

// Unlink repository from project
async unlinkRepository(repositoryId: string, tenantId: string) {
  const repository = await this.prisma.repository.findFirst({
    where: { id: repositoryId, tenantId },
  });

  if (!repository) throw new NotFoundException('Repository not found');

  return this.prisma.repository.update({
    where: { id: repositoryId },
    data: { projectId: null },
  });
}

// Get project with full hierarchy
async getProjectHierarchy(projectId: string, tenantId: string) {
  return this.prisma.project.findFirst({
    where: { id: projectId, tenantId },
    include: {
      repositories: {
        include: {
          scans: {
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              findings: { where: { status: 'OPEN' } },
            },
          },
        },
      },
      threatModels: true,
      environments: {
        include: {
          deployments: true,
        },
      },
      pipelineGates: true,
      _count: {
        select: {
          repositories: true,
          threatModels: true,
          environments: true,
        },
      },
    },
  });
}
```

### 2.2 Project Hierarchy UI

**Update: `apps/dashboard/src/app/dashboard/projects/[id]/page.tsx`**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FolderGit2, GitBranch, Shield, Server, 
  Plus, Link2, Unlink, ArrowRight, Settings
} from 'lucide-react';
import { PageSkeleton } from '@/components/ui/page-skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Project {
  id: string;
  name: string;
  description: string;
  repositories: Repository[];
  threatModels: ThreatModel[];
  environments: Environment[];
  pipelineGates: PipelineGate[];
  _count: {
    repositories: number;
    threatModels: number;
    environments: number;
  };
}

interface Repository {
  id: string;
  name: string;
  provider: string;
  defaultBranch: string;
  lastScanAt: string;
  scans: Scan[];
  _count: { findings: number };
}

export default function ProjectDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [availableRepos, setAvailableRepos] = useState<Repository[]>([]);

  useEffect(() => {
    fetchProject();
  }, [id]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`${API_URL}/projects/${id}/hierarchy`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load project');
      const data = await res.json();
      setProject(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRepos = async () => {
    const res = await fetch(`${API_URL}/scm/repositories?unlinked=true`, {
      credentials: 'include',
    });
    if (res.ok) {
      setAvailableRepos(await res.json());
    }
  };

  const handleLinkRepo = async (repoId: string) => {
    await fetch(`${API_URL}/projects/${id}/repositories/${repoId}`, {
      method: 'POST',
      credentials: 'include',
    });
    setShowLinkModal(false);
    fetchProject();
  };

  const handleUnlinkRepo = async (repoId: string) => {
    if (!confirm('Unlink this repository from the project?')) return;
    await fetch(`${API_URL}/projects/${id}/repositories/${repoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    fetchProject();
  };

  if (loading) return <PageSkeleton variant="detail" />;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!project) return <div className="p-8">Project not found</div>;

  return (
    <div className="p-8">
      <PageHeader
        title={project.name}
        description={project.description || 'No description'}
        breadcrumbs={[
          { label: 'Projects', href: '/dashboard/projects' },
          { label: project.name },
        ]}
        actions={
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${id}/settings`)}>
              <Settings className="w-4 h-4 mr-2" /> Settings
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard icon={FolderGit2} label="Repositories" value={project._count.repositories} />
        <StatCard icon={Shield} label="Threat Models" value={project._count.threatModels} />
        <StatCard icon={Server} label="Environments" value={project._count.environments} />
        <StatCard 
          icon={GitBranch} 
          label="Open Findings" 
          value={project.repositories.reduce((sum, r) => sum + r._count.findings, 0)} 
          variant="warning"
        />
      </div>

      <Tabs defaultValue="repositories">
        <TabsList>
          <TabsTrigger value="repositories">Repositories ({project.repositories.length})</TabsTrigger>
          <TabsTrigger value="threat-models">Threat Models ({project.threatModels.length})</TabsTrigger>
          <TabsTrigger value="environments">Environments ({project.environments.length})</TabsTrigger>
          <TabsTrigger value="gates">Pipeline Gates ({project.pipelineGates.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="repositories" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Linked Repositories</h3>
            <Button onClick={() => { fetchAvailableRepos(); setShowLinkModal(true); }}>
              <Link2 className="w-4 h-4 mr-2" /> Link Repository
            </Button>
          </div>

          <div className="bg-white rounded-lg shadow divide-y">
            {project.repositories.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No repositories linked. Click "Link Repository" to add one.
              </div>
            ) : (
              project.repositories.map(repo => (
                <div key={repo.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center space-x-4">
                    <FolderGit2 className="w-8 h-8 text-gray-400" />
                    <div>
                      <div className="font-medium">{repo.name}</div>
                      <div className="text-sm text-gray-500">
                        {repo.provider} • {repo.defaultBranch} • {repo._count.findings} open findings
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => router.push(`/dashboard/repositories/${repo.id}`)}
                    >
                      View <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleUnlinkRepo(repo.id)}
                    >
                      <Unlink className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="threat-models" className="mt-4">
          {/* Similar pattern for threat models */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Threat Models</h3>
            <Button onClick={() => router.push(`/dashboard/threat-modeling/new?projectId=${id}`)}>
              <Plus className="w-4 h-4 mr-2" /> New Threat Model
            </Button>
          </div>
          {/* List threat models */}
        </TabsContent>

        <TabsContent value="environments" className="mt-4">
          {/* Similar pattern for environments */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Environments</h3>
            <Button onClick={() => router.push(`/dashboard/environments/new?projectId=${id}`)}>
              <Plus className="w-4 h-4 mr-2" /> New Environment
            </Button>
          </div>
          {/* List environments */}
        </TabsContent>

        <TabsContent value="gates" className="mt-4">
          {/* Similar pattern for pipeline gates */}
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium">Pipeline Gates</h3>
            <Button onClick={() => router.push(`/dashboard/settings/gates/new?projectId=${id}`)}>
              <Plus className="w-4 h-4 mr-2" /> New Gate
            </Button>
          </div>
          {/* List gates */}
        </TabsContent>
      </Tabs>

      {/* Link Repository Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Link Repository to Project</h2>
            
            {availableRepos.length === 0 ? (
              <p className="text-gray-500">No unlinked repositories available.</p>
            ) : (
              <div className="space-y-2">
                {availableRepos.map(repo => (
                  <div 
                    key={repo.id}
                    className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                    onClick={() => handleLinkRepo(repo.id)}
                  >
                    <div>
                      <div className="font-medium">{repo.name}</div>
                      <div className="text-sm text-gray-500">{repo.provider}</div>
                    </div>
                    <Link2 className="w-4 h-4 text-blue-500" />
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <Button variant="outline" onClick={() => setShowLinkModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, variant = 'default' }) {
  const colors = {
    default: 'bg-white',
    warning: 'bg-yellow-50 border-yellow-200',
    danger: 'bg-red-50 border-red-200',
  };
  
  return (
    <div className={`${colors[variant]} border rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <Icon className="w-8 h-8 text-gray-400" />
        <span className="text-2xl font-bold">{value}</span>
      </div>
      <div className="text-sm text-gray-600 mt-2">{label}</div>
    </div>
  );
}
```

---

## PHASE 3: CONNECTION & SCM INTEGRATION

### 3.1 Connection Status Service

**File: `apps/api/src/scm/services/connection-status.service.ts`**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ConnectionStatusService {
  private readonly logger = new Logger(ConnectionStatusService.name);

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkAllConnections() {
    this.logger.log('Checking all SCM connections...');
    
    const connections = await this.prisma.connection.findMany({
      where: { status: { not: 'REVOKED' } },
    });

    for (const connection of connections) {
      await this.checkConnection(connection);
    }
  }

  async checkConnection(connection: any) {
    try {
      let isValid = false;
      
      switch (connection.provider) {
        case 'GITHUB':
          isValid = await this.checkGitHubConnection(connection);
          break;
        case 'GITLAB':
          isValid = await this.checkGitLabConnection(connection);
          break;
        case 'BITBUCKET':
          isValid = await this.checkBitbucketConnection(connection);
          break;
        case 'AZURE_DEVOPS':
          isValid = await this.checkAzureDevOpsConnection(connection);
          break;
      }

      await this.prisma.connection.update({
        where: { id: connection.id },
        data: {
          status: isValid ? 'VALID' : 'EXPIRED',
          lastCheckedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Connection check failed for ${connection.id}:`, error);
      await this.prisma.connection.update({
        where: { id: connection.id },
        data: {
          status: 'EXPIRED',
          lastCheckedAt: new Date(),
          lastError: error.message,
        },
      });
    }
  }

  private async checkGitHubConnection(connection: any): Promise<boolean> {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    return res.ok;
  }

  private async checkGitLabConnection(connection: any): Promise<boolean> {
    const baseUrl = connection.baseUrl || 'https://gitlab.com';
    const res = await fetch(`${baseUrl}/api/v4/user`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    return res.ok;
  }

  private async checkBitbucketConnection(connection: any): Promise<boolean> {
    const res = await fetch('https://api.bitbucket.org/2.0/user', {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    return res.ok;
  }

  private async checkAzureDevOpsConnection(connection: any): Promise<boolean> {
    const res = await fetch(`${connection.orgUrl}/_apis/projects?api-version=7.0`, {
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    return res.ok;
  }

  async refreshToken(connectionId: string): Promise<boolean> {
    const connection = await this.prisma.connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection?.refreshToken) return false;

    // Implement token refresh logic per provider
    // This is provider-specific
    return true;
  }
}
```

### 3.2 Connections Page Enhancement

**Update: `apps/dashboard/src/app/dashboard/connections/page.tsx`**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { 
  Github, Gitlab, Cloud, RefreshCw, Trash2, 
  CheckCircle, XCircle, AlertCircle, Plus, ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Connection {
  id: string;
  provider: 'GITHUB' | 'GITLAB' | 'BITBUCKET' | 'AZURE_DEVOPS';
  type: 'OAUTH' | 'PAT' | 'APP';
  status: 'VALID' | 'EXPIRED' | 'REVOKED';
  accountName?: string;
  repoCount: number;
  lastCheckedAt: string;
  lastError?: string;
  createdAt: string;
}

const PROVIDERS = {
  GITHUB: { icon: Github, name: 'GitHub', color: 'text-gray-900' },
  GITLAB: { icon: Gitlab, name: 'GitLab', color: 'text-orange-600' },
  BITBUCKET: { icon: Cloud, name: 'Bitbucket', color: 'text-blue-600' },
  AZURE_DEVOPS: { icon: Cloud, name: 'Azure DevOps', color: 'text-blue-500' },
};

const STATUS_STYLES = {
  VALID: { icon: CheckCircle, className: 'text-green-500', label: 'Connected' },
  EXPIRED: { icon: AlertCircle, className: 'text-yellow-500', label: 'Token Expired' },
  REVOKED: { icon: XCircle, className: 'text-red-500', label: 'Revoked' },
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const res = await fetch(`${API_URL}/scm/connections`, { credentials: 'include' });
      if (res.ok) setConnections(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthConnect = (provider: string) => {
    window.location.href = `${API_URL}/scm/connections/${provider.toLowerCase()}/oauth`;
  };

  const handleRefresh = async (id: string) => {
    setRefreshingId(id);
    try {
      await fetch(`${API_URL}/scm/connections/${id}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      await fetchConnections();
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this connection? Repositories will be unlinked.')) return;
    await fetch(`${API_URL}/scm/connections/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    setConnections(prev => prev.filter(c => c.id !== id));
  };

  const handleSyncRepos = async (id: string) => {
    await fetch(`${API_URL}/scm/connections/${id}/sync`, {
      method: 'POST',
      credentials: 'include',
    });
    await fetchConnections();
  };

  if (loading) return <div className="p-8">Loading connections...</div>;

  return (
    <div className="p-8">
      <PageHeader
        title="SCM Connections"
        description="Connect to GitHub, GitLab, Bitbucket, or Azure DevOps"
      />

      {/* Add Connection Buttons */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Object.entries(PROVIDERS).map(([key, { icon: Icon, name, color }]) => {
          const existing = connections.find(c => c.provider === key && c.status === 'VALID');
          return (
            <button
              key={key}
              onClick={() => !existing && handleOAuthConnect(key)}
              disabled={!!existing}
              className={`p-6 border rounded-lg flex flex-col items-center space-y-2 
                ${existing ? 'bg-gray-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}
            >
              <Icon className={`w-10 h-10 ${color}`} />
              <span className="font-medium">{name}</span>
              {existing ? (
                <span className="text-xs text-green-600">Connected</span>
              ) : (
                <span className="text-xs text-blue-600">+ Connect</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Existing Connections */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="font-medium">Active Connections</h3>
        </div>
        
        {connections.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No connections yet. Click a provider above to connect.
          </div>
        ) : (
          <div className="divide-y">
            {connections.map(conn => {
              const provider = PROVIDERS[conn.provider];
              const status = STATUS_STYLES[conn.status];
              const Icon = provider.icon;
              const StatusIcon = status.icon;
              
              return (
                <div key={conn.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Icon className={`w-8 h-8 ${provider.color}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{provider.name}</span>
                        <span className="text-sm text-gray-500">
                          ({conn.type.toLowerCase()})
                        </span>
                        <StatusIcon className={`w-4 h-4 ${status.className}`} />
                      </div>
                      <div className="text-sm text-gray-500">
                        {conn.accountName || 'Unknown account'} • {conn.repoCount} repos
                        {conn.lastCheckedAt && (
                          <> • Checked {formatDistanceToNow(new Date(conn.lastCheckedAt))} ago</>
                        )}
                      </div>
                      {conn.lastError && (
                        <div className="text-xs text-red-500 mt-1">{conn.lastError}</div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {conn.status === 'EXPIRED' && (
                      <Button 
                        size="sm" 
                        onClick={() => handleOAuthConnect(conn.provider)}
                      >
                        Reconnect
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSyncRepos(conn.id)}
                      title="Sync repositories"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingId === conn.id ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(conn.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## PHASE 4: AUTOMATED & MANUAL OPERATIONS

### 4.1 Repository Auto-Import on Connection

**Update: `apps/api/src/scm/scm.service.ts`**
```typescript
async onConnectionCreated(connectionId: string, tenantId: string) {
  // Auto-import repositories after OAuth connection
  const connection = await this.prisma.connection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) return;

  const repos = await this.fetchRepositoriesFromProvider(connection);
  
  for (const repo of repos) {
    // Check if already exists
    const existing = await this.prisma.repository.findFirst({
      where: {
        tenantId,
        provider: connection.provider,
        externalId: repo.externalId,
      },
    });

    if (!existing) {
      await this.prisma.repository.create({
        data: {
          tenantId,
          connectionId,
          name: repo.name,
          fullName: repo.fullName,
          provider: connection.provider,
          externalId: repo.externalId,
          url: repo.url,
          defaultBranch: repo.defaultBranch || 'main',
          isPrivate: repo.isPrivate,
          status: 'ACTIVE',
        },
      });
    }
  }
}
```

### 4.2 Manual Scan Trigger with Options

**Update: `apps/dashboard/src/app/dashboard/repositories/[id]/page.tsx`**
```typescript
// Add scan options modal
const [showScanModal, setShowScanModal] = useState(false);
const [scanOptions, setScanOptions] = useState({
  branch: 'main',
  scanners: ['SAST', 'SCA', 'SECRETS'],
  prDiffOnly: false,
});

const triggerScan = async () => {
  const res = await fetch(`${API_URL}/scm/scans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      repositoryId: id,
      branch: scanOptions.branch,
      scanners: scanOptions.scanners,
      prDiffOnly: scanOptions.prDiffOnly,
    }),
  });
  
  if (res.ok) {
    setShowScanModal(false);
    // Refresh or navigate to scan
  }
};

// Scan Modal JSX
{showScanModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 w-full max-w-md">
      <h2 className="text-xl font-semibold mb-4">Run Security Scan</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Branch</label>
          <select
            className="w-full border rounded-lg px-3 py-2"
            value={scanOptions.branch}
            onChange={e => setScanOptions(prev => ({ ...prev, branch: e.target.value }))}
          >
            <option value="main">main</option>
            <option value="develop">develop</option>
            <option value="master">master</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Scanners</label>
          <div className="space-y-2">
            {['SAST', 'SCA', 'SECRETS', 'IAC', 'DAST'].map(scanner => (
              <label key={scanner} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={scanOptions.scanners.includes(scanner)}
                  onChange={e => {
                    if (e.target.checked) {
                      setScanOptions(prev => ({ ...prev, scanners: [...prev.scanners, scanner] }));
                    } else {
                      setScanOptions(prev => ({ ...prev, scanners: prev.scanners.filter(s => s !== scanner) }));
                    }
                  }}
                />
                <span>{scanner}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={scanOptions.prDiffOnly}
            onChange={e => setScanOptions(prev => ({ ...prev, prDiffOnly: e.target.checked }))}
          />
          <span className="text-sm">Scan changed files only (diff mode)</span>
        </label>
      </div>

      <div className="flex justify-end space-x-2 mt-6">
        <Button variant="outline" onClick={() => setShowScanModal(false)}>Cancel</Button>
        <Button onClick={triggerScan}>Start Scan</Button>
      </div>
    </div>
  </div>
)}
```

---

## PHASE 5: FUNCTIONAL TESTING

### 5.1 Comprehensive Test Script

**Create: `scripts/functional-test.sh`**
```bash
#!/bin/bash

# ThreatDiviner Functional Test Suite
# Tests every entity and operation per THREATDIVINER-DEFINITIONS.md

set -e

API_URL="${API_URL:-http://localhost:3001}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0

log() { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASSED++)); ((TOTAL++)); }
fail() { echo -e "${RED}✗ FAIL${NC}: $1 - $2"; ((FAILED++)); ((TOTAL++)); }

# Test helper
test_api() {
  local method=$1
  local endpoint=$2
  local expected=$3
  local body=$4
  local desc=$5
  
  if [ -n "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -H "Cookie: $AUTH_COOKIE" \
      -d "$body" \
      "${API_URL}${endpoint}" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Cookie: $AUTH_COOKIE" \
      "${API_URL}${endpoint}" 2>/dev/null)
  fi
  
  status=$(echo "$response" | tail -1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$status" == "$expected" ]; then
    pass "$desc"
    echo "$body"
    return 0
  else
    fail "$desc" "Expected $expected, got $status"
    return 1
  fi
}

test_page() {
  local path=$1
  local desc=$2
  
  status=$(curl -s -o /dev/null -w "%{http_code}" "${DASHBOARD_URL}${path}" 2>/dev/null)
  
  if [ "$status" == "200" ] || [ "$status" == "307" ]; then
    pass "$desc"
  else
    fail "$desc" "HTTP $status"
  fi
}

echo "================================================"
echo "ThreatDiviner Functional Test Suite"
echo "================================================"
echo ""

# Prerequisites
log "Checking prerequisites..."
./scripts/app.sh status || { echo "App not running. Starting..."; ./scripts/app.sh start; sleep 10; }

# Login and get auth cookie
log "Authenticating..."
AUTH_RESPONSE=$(curl -s -c - -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@acme.com","password":"password123"}' \
  "${API_URL}/auth/login" 2>/dev/null)

AUTH_COOKIE=$(echo "$AUTH_RESPONSE" | grep -o 'session=[^;]*' || echo "")

if [ -z "$AUTH_COOKIE" ]; then
  echo "Warning: Could not authenticate. Some tests may fail."
fi

echo ""
echo "=== ENTITY TESTS ==="
echo ""

# TENANT
log "Testing Tenant..."
test_api GET /tenants/current 200 "" "Get current tenant"

# USER
log "Testing User..."
test_api GET /auth/me 200 "" "Get current user"
test_api GET /users 200 "" "List users"

# PROJECT
log "Testing Project..."
test_api GET /projects 200 "" "List projects"
PROJECT_ID=$(test_api POST /projects 201 '{"name":"Test Project","description":"Test"}' "Create project" | jq -r '.id' 2>/dev/null || echo "")
if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  test_api GET "/projects/$PROJECT_ID" 200 "" "Get project"
  test_api GET "/projects/$PROJECT_ID/hierarchy" 200 "" "Get project hierarchy"
  test_api PUT "/projects/$PROJECT_ID" 200 '{"name":"Updated Project"}' "Update project"
fi

# REPOSITORY
log "Testing Repository..."
test_api GET /scm/repositories 200 "" "List repositories"
test_api GET "/scm/repositories?unlinked=true" 200 "" "List unlinked repositories"

# CONNECTION
log "Testing Connection..."
test_api GET /scm/connections 200 "" "List connections"

# SCAN
log "Testing Scan..."
test_api GET /scm/scans 200 "" "List scans"
test_api GET "/scm/scans?status=COMPLETED" 200 "" "Filter scans by status"

# FINDING
log "Testing Finding..."
test_api GET /scm/findings 200 "" "List findings"
test_api GET "/scm/findings?severity=CRITICAL" 200 "" "Filter by severity"
test_api GET "/scm/findings?status=OPEN" 200 "" "Filter by status"

# BASELINE
log "Testing Baseline..."
test_api GET /baseline 200 "" "List baselines"

# SBOM
log "Testing SBOM..."
test_api GET /sbom 200 "" "List SBOMs"

# THREAT MODEL
log "Testing Threat Model..."
test_api GET /threat-modeling 200 "" "List threat models"

# ENVIRONMENT
log "Testing Environment..."
test_api GET /environments 200 "" "List environments"

# PIPELINE GATE
log "Testing Pipeline Gate..."
test_api GET /pipeline/gates 200 "" "List pipeline gates"

# CSPM
log "Testing CSPM..."
test_api GET /cspm/accounts 200 "" "List cloud accounts"
test_api GET /cspm/findings 200 "" "List CSPM findings"

# COMPLIANCE
log "Testing Compliance..."
test_api GET /compliance/frameworks 200 "" "List frameworks"
test_api GET /compliance/score 200 "" "Get compliance score"

# API KEYS
log "Testing API Keys..."
test_api GET /api-keys 200 "" "List API keys"

# AUDIT LOGS
log "Testing Audit Logs..."
test_api GET /audit-logs 200 "" "List audit logs"

# ALERTS
log "Testing Alerts..."
test_api GET /alerts/rules 200 "" "List alert rules"
test_api GET /alerts/history 200 "" "List alert history"

# EXPORT
log "Testing Export..."
test_api GET "/export/findings?format=json" 200 "" "Export findings JSON"

echo ""
echo "=== DASHBOARD PAGE TESTS ==="
echo ""

pages=(
  "/dashboard:Dashboard Home"
  "/dashboard/projects:Projects List"
  "/dashboard/repositories:Repositories List"
  "/dashboard/scans:Scans List"
  "/dashboard/findings:Findings List"
  "/dashboard/threat-modeling:Threat Models"
  "/dashboard/environments:Environments"
  "/dashboard/compliance:Compliance"
  "/dashboard/baselines:Baselines"
  "/dashboard/connections:Connections"
  "/dashboard/settings:Settings"
  "/dashboard/settings/alerts:Alert Rules"
  "/dashboard/settings/api-keys:API Keys"
)

for entry in "${pages[@]}"; do
  path="${entry%%:*}"
  desc="${entry##*:}"
  test_page "$path" "$desc"
done

echo ""
echo "=== INTEGRATION TESTS ==="
echo ""

# Test scan trigger flow
log "Testing scan trigger flow..."
REPO_ID=$(curl -s -H "Cookie: $AUTH_COOKIE" "${API_URL}/scm/repositories" | jq -r '.[0].id' 2>/dev/null || echo "")
if [ -n "$REPO_ID" ] && [ "$REPO_ID" != "null" ]; then
  test_api POST /scm/scans 201 "{\"repositoryId\":\"$REPO_ID\",\"scanners\":[\"SAST\"]}" "Trigger scan"
fi

# Cleanup
if [ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "null" ]; then
  log "Cleaning up test data..."
  curl -s -X DELETE -H "Cookie: $AUTH_COOKIE" "${API_URL}/projects/$PROJECT_ID" > /dev/null 2>&1
fi

echo ""
echo "================================================"
echo "TEST SUMMARY"
echo "================================================"
echo -e "Total:   $TOTAL"
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo ""

if [ $TOTAL -gt 0 ]; then
  PERCENT=$((PASSED * 100 / TOTAL))
  echo "Success Rate: ${PERCENT}%"
  
  if [ $PERCENT -lt 80 ]; then
    echo -e "${RED}⚠ Below 80% - needs attention${NC}"
  elif [ $PERCENT -lt 95 ]; then
    echo -e "${YELLOW}⚠ Below 95% - minor issues${NC}"
  else
    echo -e "${GREEN}✓ Excellent coverage${NC}"
  fi
fi

echo ""
exit $FAILED
```

### 5.2 Make Executable

```bash
chmod +x scripts/functional-test.sh
```

---

## PHASE 6: REMAINING GAPS

### 6.1 Threat Model Component Editor (Basic)

**Create: `apps/dashboard/src/app/dashboard/threat-modeling/[id]/editor/page.tsx`**
```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Plus, Save, Play, Trash2, ArrowRight } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Component {
  id: string;
  name: string;
  type: 'PROCESS' | 'DATASTORE' | 'EXTERNAL_ENTITY' | 'TRUST_BOUNDARY';
  technology?: string;
  criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dataClassification?: string;
}

interface DataFlow {
  id: string;
  name: string;
  sourceId: string;
  targetId: string;
  protocol?: string;
  dataType?: string;
}

interface Threat {
  id: string;
  title: string;
  category: string;
  description: string;
  componentId: string;
  status: 'IDENTIFIED' | 'MITIGATED' | 'ACCEPTED';
  riskScore: number;
}

export default function ThreatModelEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const [model, setModel] = useState<any>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [dataFlows, setDataFlows] = useState<DataFlow[]>([]);
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Add component modal state
  const [showAddComponent, setShowAddComponent] = useState(false);
  const [newComponent, setNewComponent] = useState({
    name: '',
    type: 'PROCESS' as const,
    technology: '',
    criticality: 'MEDIUM' as const,
  });

  useEffect(() => {
    fetchModel();
  }, [id]);

  const fetchModel = async () => {
    try {
      const res = await fetch(`${API_URL}/threat-modeling/${id}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setModel(data);
        setComponents(data.components || []);
        setDataFlows(data.dataFlows || []);
        setThreats(data.threats || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddComponent = async () => {
    const res = await fetch(`${API_URL}/threat-modeling/${id}/components`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(newComponent),
    });
    
    if (res.ok) {
      const created = await res.json();
      setComponents(prev => [...prev, created]);
      setShowAddComponent(false);
      setNewComponent({ name: '', type: 'PROCESS', technology: '', criticality: 'MEDIUM' });
    }
  };

  const handleDeleteComponent = async (componentId: string) => {
    if (!confirm('Delete this component and its threats?')) return;
    
    await fetch(`${API_URL}/threat-modeling/${id}/components/${componentId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    
    setComponents(prev => prev.filter(c => c.id !== componentId));
    setThreats(prev => prev.filter(t => t.componentId !== componentId));
  };

  const handleRunAnalysis = async (methodology: string) => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${API_URL}/threat-modeling/${id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ methodology }),
      });
      
      if (res.ok) {
        const result = await res.json();
        setThreats(result.threats || []);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/threat-modeling/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          components,
          dataFlows,
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading editor...</div>;

  const COMPONENT_TYPES = {
    PROCESS: { color: 'bg-blue-100 border-blue-300', label: 'Process' },
    DATASTORE: { color: 'bg-green-100 border-green-300', label: 'Data Store' },
    EXTERNAL_ENTITY: { color: 'bg-gray-100 border-gray-300', label: 'External Entity' },
    TRUST_BOUNDARY: { color: 'bg-red-100 border-red-300 border-dashed', label: 'Trust Boundary' },
  };

  return (
    <div className="p-8">
      <PageHeader
        title={`Edit: ${model?.name}`}
        description="Add components, define data flows, and run threat analysis"
        breadcrumbs={[
          { label: 'Threat Models', href: '/dashboard/threat-modeling' },
          { label: model?.name || 'Edit' },
        ]}
        actions={
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => handleRunAnalysis('stride')} disabled={analyzing}>
              <Play className="w-4 h-4 mr-2" />
              {analyzing ? 'Analyzing...' : 'Run STRIDE'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Components Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Components ({components.length})</h3>
            <Button size="sm" onClick={() => setShowAddComponent(true)}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {components.map(comp => (
              <div 
                key={comp.id}
                className={`p-3 rounded border ${COMPONENT_TYPES[comp.type].color}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{comp.name}</div>
                    <div className="text-xs text-gray-500">
                      {COMPONENT_TYPES[comp.type].label}
                      {comp.technology && ` • ${comp.technology}`}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleDeleteComponent(comp.id)}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
            
            {components.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                No components yet. Add one to start.
              </div>
            )}
          </div>
        </div>

        {/* Data Flows Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Data Flows ({dataFlows.length})</h3>
            <Button size="sm" disabled={components.length < 2}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            {dataFlows.map(flow => {
              const source = components.find(c => c.id === flow.sourceId);
              const target = components.find(c => c.id === flow.targetId);
              return (
                <div key={flow.id} className="p-3 bg-gray-50 rounded border">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{source?.name}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{target?.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {flow.name} {flow.protocol && `• ${flow.protocol}`}
                  </div>
                </div>
              );
            })}
            
            {dataFlows.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                Add at least 2 components to create data flows.
              </div>
            )}
          </div>
        </div>

        {/* Threats Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Threats ({threats.length})</h3>
          </div>
          
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {threats.map(threat => (
              <div key={threat.id} className="p-3 bg-red-50 rounded border border-red-200">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-sm">{threat.title}</div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    threat.status === 'MITIGATED' ? 'bg-green-100 text-green-700' :
                    threat.status === 'ACCEPTED' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {threat.status}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {threat.category} • Risk: {threat.riskScore}/10
                </div>
              </div>
            ))}
            
            {threats.length === 0 && (
              <div className="text-sm text-gray-500 text-center py-4">
                Run STRIDE analysis to identify threats.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Component Modal */}
      {showAddComponent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Add Component</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={newComponent.name}
                  onChange={e => setNewComponent(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., API Gateway"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={newComponent.type}
                  onChange={e => setNewComponent(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <option value="PROCESS">Process</option>
                  <option value="DATASTORE">Data Store</option>
                  <option value="EXTERNAL_ENTITY">External Entity</option>
                  <option value="TRUST_BOUNDARY">Trust Boundary</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Technology</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2"
                  value={newComponent.technology}
                  onChange={e => setNewComponent(prev => ({ ...prev, technology: e.target.value }))}
                  placeholder="e.g., NestJS, PostgreSQL"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Criticality</label>
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={newComponent.criticality}
                  onChange={e => setNewComponent(prev => ({ ...prev, criticality: e.target.value as any }))}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={() => setShowAddComponent(false)}>Cancel</Button>
              <Button onClick={handleAddComponent} disabled={!newComponent.name}>Add Component</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## PHASE 7: UPDATE DOCUMENTATION

### 7.1 Update HANDOFF.md

Append to HANDOFF.md:
```markdown
---

### BATCH 10: Hierarchy, Connectivity, Functional Testing, Full Completion

Last Updated: [DATE]

#### Summary
Completed tenant isolation, project hierarchy with linking, SCM connection management, app lifecycle scripts, and comprehensive functional testing.

#### Phase 1: App Lifecycle Management
- Created `scripts/app.sh` (Linux/Mac) and `scripts/app.ps1` (Windows)
- Commands: start, stop, restart, status, logs
- PID tracking in `.pids/`
- Log files in `.logs/`
- Added npm scripts: `app:start`, `app:stop`, `app:restart`, `app:status`, `app:logs`

#### Phase 2: Tenant Isolation
- `TenantGuard` - Enforces tenant context on all requests
- `TenantContextMiddleware` - Loads tenant data, checks status
- `@TenantId()` decorator - Easy access to current tenant
- Audited all services for tenant isolation

#### Phase 3: Project Hierarchy
- Project-Repository linking (link/unlink endpoints)
- `GET /projects/:id/hierarchy` - Full project tree
- Updated project detail page with tabs (Repos, Threat Models, Environments, Gates)
- Link/unlink repository modal

#### Phase 4: Connection Management
- `ConnectionStatusService` - Hourly connection health checks
- Token refresh logic per provider
- Enhanced connections page with status indicators
- Auto-import repositories on OAuth connection
- Sync repositories button

#### Phase 5: Manual Operations
- Scan trigger modal with options (branch, scanners, diff mode)
- Repository linking from project page
- Baseline creation from finding detail

#### Phase 6: Functional Testing
- Created `scripts/functional-test.sh` - Comprehensive test suite
- Tests all entities per THREATDIVINER-DEFINITIONS.md
- Tests all dashboard pages
- Integration flow tests
- 95%+ coverage target

#### Phase 7: Remaining Gaps
- Basic threat model component editor
- Data flow creation UI
- STRIDE analysis integration

#### Files Created
- `scripts/app.sh`
- `scripts/app.ps1`
- `scripts/functional-test.sh`
- `apps/api/src/common/guards/tenant.guard.ts`
- `apps/api/src/common/decorators/tenant.decorator.ts`
- `apps/api/src/common/middleware/tenant-context.middleware.ts`
- `apps/api/src/scm/services/connection-status.service.ts`
- `apps/dashboard/src/app/dashboard/threat-modeling/[id]/editor/page.tsx`

#### Files Modified
- `package.json` - Added app:* scripts
- `.gitignore` - Added .pids/, .logs/
- `apps/api/src/projects/projects.service.ts` - Hierarchy methods
- `apps/dashboard/src/app/dashboard/projects/[id]/page.tsx` - Full hierarchy UI
- `apps/dashboard/src/app/dashboard/connections/page.tsx` - Enhanced UI

#### Build Status
- API: Compiles ✓
- Dashboard: Compiles ✓
- Functional Tests: XX/XX passing

---
```

### 7.2 Update CHANGELOG.md

Append to CHANGELOG.md:
```markdown
## [Unreleased] - Hierarchy, Connectivity, Functional Testing (DATE)

### Added

#### BATCH 10: Full Completion

**App Lifecycle Management:**
- `scripts/app.sh` - Linux/Mac app management (start/stop/restart/status/logs)
- `scripts/app.ps1` - Windows PowerShell equivalent
- PID tracking for clean process management
- Centralized logging to `.logs/` directory
- NPM scripts for easy access

**Tenant Isolation:**
- TenantGuard for enforcing tenant context
- TenantContextMiddleware for loading tenant data
- @TenantId() decorator for controllers
- All services audited for proper tenant isolation

**Project Hierarchy:**
- Project-Repository linking and unlinking
- Full hierarchy endpoint with nested includes
- Enhanced project detail page with tabbed interface
- Visual relationship display

**Connection Management:**
- ConnectionStatusService with hourly health checks
- Token refresh logic per SCM provider
- Auto-import repositories on OAuth connection
- Enhanced connections page with status indicators

**Functional Testing:**
- Comprehensive test script testing all entities
- Dashboard page accessibility tests
- Integration flow tests
- 95%+ coverage target

**Threat Model Editor:**
- Basic component editor (add/delete)
- Component types (Process, Datastore, External Entity, Trust Boundary)
- STRIDE analysis trigger
- Threats panel with status

### Changed
- Project detail page now shows full hierarchy
- Connections page enhanced with status and actions
- Repository page has scan options modal
```

---

## EXECUTION INSTRUCTIONS

### For Claude Code CLI:

```bash
claude --dangerously-skip-permissions "Execute BATCH-10.md completely. 

ORDER OF OPERATIONS:
1. Create app.sh and app.ps1 scripts first
2. Make them executable and test app:start works
3. Implement tenant isolation (guard, middleware, decorator)
4. Update all services for tenant isolation
5. Implement project hierarchy endpoints and UI
6. Implement connection status service
7. Create functional test script
8. Run functional tests and fix any failures
9. Implement threat model editor
10. Update HANDOFF.md and CHANGELOG.md

RESTART THE APP after each major phase to verify it still works.
Use ./scripts/app.sh restart

Do not stop until:
- App starts and stops cleanly
- All functional tests pass (95%+)
- HANDOFF.md and CHANGELOG.md are updated

Current date: $(date '+%Y-%m-%d')"
```

### Quick Start:

```bash
# Copy BATCH-10.md to project root, then:
claude --dangerously-skip-permissions "Read BATCH-10.md. Start with Phase 0 - create app management scripts and verify app starts cleanly."
```

---

## SUCCESS CRITERIA

- [ ] `./scripts/app.sh start` works reliably
- [ ] `./scripts/app.sh stop` kills all processes cleanly
- [ ] `./scripts/app.sh status` shows accurate state
- [ ] All API endpoints enforce tenant isolation
- [ ] Project hierarchy displays correctly
- [ ] Repositories can be linked/unlinked from projects
- [ ] Connections show accurate status
- [ ] Functional tests pass 95%+
- [ ] Threat model editor allows adding components
- [ ] HANDOFF.md updated with Batch 10
- [ ] CHANGELOG.md updated with Batch 10
