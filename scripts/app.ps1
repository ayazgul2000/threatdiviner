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
    $apiProcs = Get-NetTCPConnection -LocalPort $ApiPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    $dashProcs = Get-NetTCPConnection -LocalPort $DashboardPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($proc in $apiProcs) {
        if ($proc -and $proc -ne 0) {
            Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
        }
    }
    foreach ($proc in $dashProcs) {
        if ($proc -and $proc -ne 0) {
            Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
        }
    }

    # Kill node processes related to our apps
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -match "apps[\\/](api|dashboard)" -or $cmdLine -match "nest|next") {
                Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
            }
        } catch {}
    }

    Start-Sleep -Seconds 2
    Write-Host "Stopped" -ForegroundColor Green
}

function Start-DockerServices {
    Write-Host "Ensuring Docker services are running..." -ForegroundColor Yellow

    # Check if Docker is available
    try {
        $null = docker info 2>&1
    } catch {
        Write-Host "Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
        return $false
    }

    # Start all containers (including threagile)
    Push-Location $ProjectRoot
    docker compose up -d 2>&1 | Out-Null
    Pop-Location

    # Wait for critical services
    $services = @(
        @{ Name = "PostgreSQL"; Url = $null; Container = "td-postgres" },
        @{ Name = "Redis"; Url = $null; Container = "td-redis" },
        @{ Name = "Threagile"; Url = "http://localhost:8080/direct/analyze"; Container = "td-threagile" }
    )

    foreach ($svc in $services) {
        $ready = $false
        for ($i = 0; $i -lt 30; $i++) {
            $status = docker inspect --format='{{.State.Running}}' $svc.Container 2>$null
            if ($status -eq "true") {
                Write-Host "  $($svc.Name): Running" -ForegroundColor Green
                $ready = $true
                break
            }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) {
            Write-Host "  $($svc.Name): Failed to start" -ForegroundColor Red
        }
    }

    return $true
}

function Start-ThreatDiviner {
    Write-Host "Starting ThreatDiviner..." -ForegroundColor Yellow

    # Ensure Docker services (postgres, redis, threagile, etc.) are up first
    $dockerOk = Start-DockerServices
    if (-not $dockerOk) {
        Write-Host "Cannot start without Docker services." -ForegroundColor Red
        return
    }

    Stop-ThreatDiviner 2>$null

    # Start API
    Write-Host "Starting API on port $ApiPort..."
    $apiLog = Join-Path $LogDir "api.log"
    $apiDir = Join-Path $ProjectRoot "apps\api"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$apiDir`" && pnpm run start:dev > `"$apiLog`" 2>&1" -WindowStyle Hidden

    # Start Dashboard
    Write-Host "Starting Dashboard on port $DashboardPort..."
    $dashLog = Join-Path $LogDir "dashboard.log"
    $dashDir = Join-Path $ProjectRoot "apps\dashboard"
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "cd /d `"$dashDir`" && pnpm run dev > `"$dashLog`" 2>&1" -WindowStyle Hidden

    # Wait for services
    Write-Host "Waiting for services..."

    $apiReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
            Write-Host "API ready" -ForegroundColor Green
            $apiReady = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if (-not $apiReady) {
        Write-Host "API did not start in time (check logs)" -ForegroundColor Yellow
    }

    $dashReady = $false
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $null = Invoke-WebRequest -Uri "http://localhost:$DashboardPort" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
            Write-Host "Dashboard ready" -ForegroundColor Green
            $dashReady = $true
            break
        } catch {
            $code = $_.Exception.Response.StatusCode.value__
            if ($code -eq 307 -or $code -eq 302) {
                Write-Host "Dashboard ready" -ForegroundColor Green
                $dashReady = $true
                break
            }
            Start-Sleep -Seconds 1
        }
    }
    if (-not $dashReady) {
        Write-Host "Dashboard did not start in time (check logs)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "ThreatDiviner running:" -ForegroundColor Cyan
    Write-Host "  API:       http://localhost:$ApiPort"
    Write-Host "  Dashboard: http://localhost:$DashboardPort"
    Write-Host "  Logs:      $LogDir"
}

function Get-ThreatDivinerStatus {
    Write-Host "ThreatDiviner Status:" -ForegroundColor Cyan
    Write-Host ""

    # Docker services
    Write-Host "Docker Services:" -ForegroundColor Cyan
    foreach ($container in @("td-postgres", "td-redis", "td-threagile", "td-minio", "td-qdrant")) {
        $status = docker inspect --format='{{.State.Status}}' $container 2>$null
        if ($status -eq "running") {
            Write-Host "  ${container}: Running" -ForegroundColor Green
        } else {
            Write-Host "  ${container}: $($status ?? 'Not found')" -ForegroundColor Red
        }
    }
    Write-Host ""

    Write-Host "App Services:" -ForegroundColor Cyan
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$ApiPort/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        Write-Host "  API:       Running (port $ApiPort)" -ForegroundColor Green
    } catch {
        Write-Host "  API:       Not running" -ForegroundColor Red
    }

    try {
        $null = Invoke-WebRequest -Uri "http://localhost:$DashboardPort" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        Write-Host "  Dashboard: Running (port $DashboardPort)" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 307 -or $code -eq 302) {
            Write-Host "  Dashboard: Running (port $DashboardPort)" -ForegroundColor Green
        } else {
            Write-Host "  Dashboard: Not running" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "Node processes:" -ForegroundColor Cyan
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -match "nest|next|apps[\\/](api|dashboard)") {
            Write-Host "  PID $($_.Id): $($cmdLine.Substring(0, [Math]::Min(80, $cmdLine.Length)))..."
        }
    }
}

function Get-ThreatDivinerLogs {
    Write-Host "=== API Logs (last 50 lines) ===" -ForegroundColor Cyan
    $apiLog = Join-Path $LogDir "api.log"
    if (Test-Path $apiLog) {
        Get-Content $apiLog -Tail 50
    } else {
        Write-Host "No API logs found"
    }

    Write-Host ""
    Write-Host "=== Dashboard Logs (last 50 lines) ===" -ForegroundColor Cyan
    $dashLog = Join-Path $LogDir "dashboard.log"
    if (Test-Path $dashLog) {
        Get-Content $dashLog -Tail 50
    } else {
        Write-Host "No Dashboard logs found"
    }
}

switch ($Action) {
    "start"   { Start-ThreatDiviner }
    "stop"    { Stop-ThreatDiviner }
    "restart" { Stop-ThreatDiviner; Start-Sleep -Seconds 2; Start-ThreatDiviner }
    "status"  { Get-ThreatDivinerStatus }
    "logs"    { Get-ThreatDivinerLogs }
}
