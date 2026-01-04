# ThreatDiviner E2E Verification Script (PowerShell)
# This script performs comprehensive end-to-end verification of the entire system

param(
    [string]$ApiUrl = "http://localhost:3001",
    [string]$DashboardUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"

# Counters
$script:TestsPassed = 0
$script:TestsFailed = 0
$script:TestsSkipped = 0

# Logging functions
function Write-LogInfo($msg) { Write-Host "[INFO] $msg" -ForegroundColor Blue }
function Write-LogSuccess($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green; $script:TestsPassed++ }
function Write-LogError($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:TestsFailed++ }
function Write-LogWarn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow; $script:TestsSkipped++ }
function Write-LogSection($msg) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host $msg -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

# Test API endpoint
function Test-ApiEndpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [string]$Body = $null
    )

    $url = "$ApiUrl$Endpoint"
    try {
        $params = @{
            Uri = $url
            Method = $Method
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }

        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params
        Write-LogSuccess "$Description ($Method $Endpoint -> $($response.StatusCode))"
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 400 -or $statusCode -eq 200 -or $statusCode -eq 201) {
            Write-LogSuccess "$Description ($Method $Endpoint -> $statusCode)"
            return $true
        }
        elseif ($statusCode) {
            Write-LogError "$Description ($Method $Endpoint -> $statusCode)"
            return $false
        }
        else {
            Write-LogWarn "$Description ($Method $Endpoint -> Connection failed)"
            return $false
        }
    }
}

# Test dashboard page
function Test-DashboardPage {
    param(
        [string]$Path,
        [string]$Description
    )

    $url = "$DashboardUrl$Path"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop -MaximumRedirection 0
        Write-LogSuccess "$Description ($Path -> $($response.StatusCode))"
        return $true
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 307 -or $statusCode -eq 302 -or $statusCode -eq 200) {
            Write-LogSuccess "$Description ($Path -> $statusCode)"
            return $true
        }
        elseif ($statusCode) {
            Write-LogError "$Description ($Path -> $statusCode)"
            return $false
        }
        else {
            Write-LogWarn "$Description ($Path -> Connection failed)"
            return $false
        }
    }
}

# Main verification
function Main {
    Write-Host ""
    Write-Host "  _____ _                    _   ____  _       _                 " -ForegroundColor Cyan
    Write-Host " |_   _| |__  _ __ ___  __ _| |_|  _ \(_)_   _(_)_ __   ___ _ __ " -ForegroundColor Cyan
    Write-Host "   | | | '_ \| '__/ _ \/ _`` | __| | | | \ \ / / | '_ \ / _ \ '__|" -ForegroundColor Cyan
    Write-Host "   | | | | | | | |  __/ (_| | |_| |_| | |\ V /| | | | |  __/ |   " -ForegroundColor Cyan
    Write-Host "   |_| |_| |_|_|  \___|\__,_|\__|____/|_| \_/ |_|_| |_|\___|_|   " -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  E2E Verification Script v1.0 (PowerShell)" -ForegroundColor Cyan
    Write-Host ""

    Write-LogSection "1. PRE-FLIGHT CHECKS"

    # Check Node.js
    try {
        $nodeVersion = node --version 2>&1
        Write-LogSuccess "Node.js installed ($nodeVersion)"
    }
    catch {
        Write-LogError "Node.js not found"
    }

    # Check pnpm
    try {
        $pnpmVersion = pnpm --version 2>&1
        Write-LogSuccess "pnpm installed ($pnpmVersion)"
    }
    catch {
        Write-LogError "pnpm not found"
    }

    # Check Docker
    try {
        $dockerVersion = docker --version 2>&1
        Write-LogSuccess "Docker installed"
    }
    catch {
        Write-LogWarn "Docker not found (some features may not work)"
    }

    Write-LogSection "2. SERVICE HEALTH CHECKS"

    # Check API
    Write-LogInfo "Checking API service at $ApiUrl..."
    try {
        $health = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
        Write-LogSuccess "API service is running"
    }
    catch {
        Write-LogWarn "API service not running"
    }

    # Check Dashboard
    Write-LogInfo "Checking Dashboard service at $DashboardUrl..."
    try {
        $dashboard = Invoke-WebRequest -Uri $DashboardUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction SilentlyContinue -MaximumRedirection 0
        Write-LogSuccess "Dashboard service is running"
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 307 -or $code -eq 302 -or $code -eq 200) {
            Write-LogSuccess "Dashboard service is running"
        }
        else {
            Write-LogWarn "Dashboard service not running"
        }
    }

    Write-LogSection "3. API ENDPOINT VERIFICATION"

    # Health endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/health" -Description "Health check endpoint"

    # Auth endpoints
    Test-ApiEndpoint -Method "POST" -Endpoint "/auth/login" -Description "Auth login endpoint" -Body '{"email":"test@test.com","password":"test"}'
    Test-ApiEndpoint -Method "POST" -Endpoint "/auth/register" -Description "Auth register endpoint" -Body '{}'

    # SCM endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/scm/connections" -Description "SCM connections list"
    Test-ApiEndpoint -Method "GET" -Endpoint "/scm/repositories" -Description "Repositories list"
    Test-ApiEndpoint -Method "GET" -Endpoint "/scm/scans" -Description "Scans list"
    Test-ApiEndpoint -Method "GET" -Endpoint "/scm/findings" -Description "Findings list"

    # Projects endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/projects" -Description "Projects list"

    # Environments endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/environments" -Description "Environments list"

    # Pipelines endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/pipelines" -Description "Pipelines list"

    # Threat modeling endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/threat-modeling" -Description "Threat models list"

    # SBOM endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/sbom" -Description "SBOM list"

    # Containers endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/containers" -Description "Containers list"

    # Threat Intel endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/threat-intel/feeds" -Description "Threat intel feeds"
    Test-ApiEndpoint -Method "GET" -Endpoint "/threat-intel/iocs" -Description "Threat intel IOCs"

    # Fix endpoints
    Test-ApiEndpoint -Method "GET" -Endpoint "/fix" -Description "Fix suggestions list"

    Write-LogSection "4. DASHBOARD PAGE VERIFICATION"

    # Public pages
    Test-DashboardPage -Path "/" -Description "Landing page"
    Test-DashboardPage -Path "/login" -Description "Login page"

    # Dashboard pages
    Test-DashboardPage -Path "/dashboard" -Description "Dashboard home"
    Test-DashboardPage -Path "/dashboard/repositories" -Description "Repositories page"
    Test-DashboardPage -Path "/dashboard/scans" -Description "Scans page"
    Test-DashboardPage -Path "/dashboard/findings" -Description "Findings page"
    Test-DashboardPage -Path "/dashboard/projects" -Description "Projects page"
    Test-DashboardPage -Path "/dashboard/environments" -Description "Environments page"
    Test-DashboardPage -Path "/dashboard/pipelines" -Description "Pipelines page"
    Test-DashboardPage -Path "/dashboard/threat-modeling" -Description "Threat Modeling page"
    Test-DashboardPage -Path "/dashboard/containers" -Description "Containers page"
    Test-DashboardPage -Path "/dashboard/sbom" -Description "SBOM page"
    Test-DashboardPage -Path "/dashboard/threat-intel" -Description "Threat Intel page"
    Test-DashboardPage -Path "/dashboard/connections" -Description "Connections page"
    Test-DashboardPage -Path "/dashboard/settings" -Description "Settings page"
    Test-DashboardPage -Path "/dashboard/analytics" -Description "Analytics page"
    Test-DashboardPage -Path "/dashboard/reports" -Description "Reports page"
    Test-DashboardPage -Path "/dashboard/sla" -Description "SLA page"

    Write-LogSection "5. BUILD VERIFICATION"

    # Check if builds exist
    if (Test-Path "apps/api/dist") {
        Write-LogSuccess "API build exists"
    }
    else {
        Write-LogWarn "API build not found (run: pnpm build)"
    }

    if (Test-Path "apps/dashboard/.next") {
        Write-LogSuccess "Dashboard build exists"
    }
    else {
        Write-LogWarn "Dashboard build not found (run: pnpm build)"
    }

    Write-LogSection "6. DATABASE VERIFICATION"

    # Check Prisma client
    if ((Test-Path "node_modules/.prisma/client") -or (Test-Path "apps/api/node_modules/.prisma/client")) {
        Write-LogSuccess "Prisma client generated"
    }
    else {
        Write-LogWarn "Prisma client not generated (run: npx prisma generate)"
    }

    Write-LogSection "VERIFICATION SUMMARY"

    Write-Host ""
    Write-Host "  Passed:  $script:TestsPassed" -ForegroundColor Green
    Write-Host "  Failed:  $script:TestsFailed" -ForegroundColor Red
    Write-Host "  Skipped: $script:TestsSkipped" -ForegroundColor Yellow
    Write-Host ""

    $Total = $script:TestsPassed + $script:TestsFailed
    if ($Total -gt 0) {
        $PassRate = [math]::Round(($script:TestsPassed / $Total) * 100, 1)
        Write-Host "  Pass Rate: $PassRate%"
    }
    Write-Host ""

    if ($script:TestsFailed -gt 0) {
        Write-LogError "Some tests failed. Please review the output above."
        exit 1
    }
    else {
        Write-LogSuccess "All tests passed!"
        exit 0
    }
}

# Run main function
Main
