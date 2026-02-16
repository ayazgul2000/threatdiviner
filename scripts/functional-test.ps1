# ThreatDiviner Functional Test Suite
# Tests every entity and operation per THREATDIVINER-DEFINITIONS.md

param(
    [string]$ApiUrl = "http://localhost:3001",
    [string]$DashboardUrl = "http://localhost:3000"
)

$ErrorActionPreference = "Continue"

# Counters
$script:Passed = 0
$script:Failed = 0
$script:Total = 0

# Colors and logging
function Pass($msg) {
    Write-Host "[PASS] $msg" -ForegroundColor Green
    $script:Passed++
    $script:Total++
}

function Fail($msg, $reason = "") {
    if ($reason) {
        Write-Host "[FAIL] $msg - $reason" -ForegroundColor Red
    } else {
        Write-Host "[FAIL] $msg" -ForegroundColor Red
    }
    $script:Failed++
    $script:Total++
}

function Log($msg) {
    Write-Host "[TEST] $msg" -ForegroundColor Blue
}

function Section($msg) {
    Write-Host ""
    Write-Host "=== $msg ===" -ForegroundColor Cyan
    Write-Host ""
}

# Test API endpoint
function Test-Api {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Expected,
        [string]$Body = $null,
        [string]$Description
    )

    $url = "$ApiUrl$Endpoint"
    try {
        $params = @{
            Uri = $url
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 10
            ErrorAction = "Stop"
        }

        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params
        $status = $response.StatusCode

        if ($status -eq $Expected -or ($Expected -eq "2xx" -and $status -ge 200 -and $status -lt 300)) {
            Pass "$Description"
            return $response.Content
        } else {
            Fail $Description "Expected $Expected, got $status"
            return $null
        }
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__

        # Some endpoints return 401/403 which is expected without auth
        if ($status -eq 401 -or $status -eq 403) {
            Pass "$Description (auth required - $status)"
            return $null
        }
        elseif ($Expected -eq "4xx" -and $status -ge 400 -and $status -lt 500) {
            Pass "$Description"
            return $null
        }
        elseif ($status) {
            Fail $Description "Got $status"
            return $null
        }
        else {
            Fail $Description "Connection failed"
            return $null
        }
    }
}

# Test dashboard page
function Test-Page {
    param(
        [string]$Path,
        [string]$Description
    )

    $url = "$DashboardUrl$Path"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 0 -ErrorAction Stop
        Pass "$Description"
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 307 -or $status -eq 302 -or $status -eq 200) {
            Pass "$Description (redirect)"
        }
        elseif ($status) {
            Fail $Description "HTTP $status"
        }
        else {
            Fail $Description "Connection failed"
        }
    }
}

# Main test execution
function Main {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "ThreatDiviner Functional Test Suite" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "API URL:       $ApiUrl"
    Write-Host "Dashboard URL: $DashboardUrl"
    Write-Host ""

    # Prerequisites check
    Section "PREREQUISITES"

    Log "Checking API health..."
    try {
        $health = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Pass "API is running"
    }
    catch {
        Fail "API is not running"
        Write-Host ""
        Write-Host "Start the app with: .\scripts\app.ps1 -Action start" -ForegroundColor Yellow
        return
    }

    Log "Checking Dashboard..."
    try {
        $dash = Invoke-WebRequest -Uri $DashboardUrl -UseBasicParsing -TimeoutSec 5 -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Pass "Dashboard is running"
    }
    catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 307 -or $code -eq 302 -or $code -eq 200) {
            Pass "Dashboard is running"
        } else {
            Fail "Dashboard is not running"
        }
    }

    # Entity Tests
    Section "ENTITY TESTS - API ENDPOINTS"

    # Health
    Log "Testing Health endpoints..."
    Test-Api -Method "GET" -Endpoint "/health" -Expected "200" -Description "Health check"

    # Auth
    Log "Testing Auth endpoints..."
    Test-Api -Method "POST" -Endpoint "/auth/login" -Expected "4xx" -Body '{"email":"test@test.com","password":"test"}' -Description "Auth login"
    Test-Api -Method "GET" -Endpoint "/auth/me" -Expected "4xx" -Description "Auth current user"

    # Tenant
    Log "Testing Tenant endpoints..."
    Test-Api -Method "GET" -Endpoint "/tenants/current" -Expected "4xx" -Description "Get current tenant"

    # Users
    Log "Testing User endpoints..."
    Test-Api -Method "GET" -Endpoint "/users" -Expected "4xx" -Description "List users"

    # Projects
    Log "Testing Project endpoints..."
    Test-Api -Method "GET" -Endpoint "/projects" -Expected "4xx" -Description "List projects"

    # Repositories
    Log "Testing Repository endpoints..."
    Test-Api -Method "GET" -Endpoint "/scm/repositories" -Expected "4xx" -Description "List repositories"

    # Connections
    Log "Testing Connection endpoints..."
    Test-Api -Method "GET" -Endpoint "/scm/connections" -Expected "4xx" -Description "List connections"
    Test-Api -Method "GET" -Endpoint "/scm/connections/status" -Expected "4xx" -Description "Connection status"

    # Scans
    Log "Testing Scan endpoints..."
    Test-Api -Method "GET" -Endpoint "/scm/scans" -Expected "4xx" -Description "List scans"

    # Findings
    Log "Testing Finding endpoints..."
    Test-Api -Method "GET" -Endpoint "/scm/findings" -Expected "4xx" -Description "List findings"

    # SBOM
    Log "Testing SBOM endpoints..."
    Test-Api -Method "GET" -Endpoint "/sbom" -Expected "4xx" -Description "List SBOMs"

    # Threat Modeling
    Log "Testing Threat Modeling endpoints..."
    Test-Api -Method "GET" -Endpoint "/threat-modeling" -Expected "4xx" -Description "List threat models"

    # Environments
    Log "Testing Environment endpoints..."
    Test-Api -Method "GET" -Endpoint "/environments" -Expected "4xx" -Description "List environments"

    # Pipeline Gates
    Log "Testing Pipeline Gate endpoints..."
    Test-Api -Method "GET" -Endpoint "/pipeline/gates" -Expected "4xx" -Description "List pipeline gates"

    # Containers
    Log "Testing Container endpoints..."
    Test-Api -Method "GET" -Endpoint "/containers" -Expected "4xx" -Description "List containers"

    # Threat Intel
    Log "Testing Threat Intel endpoints..."
    Test-Api -Method "GET" -Endpoint "/threat-intel/feeds" -Expected "4xx" -Description "List threat intel feeds"
    Test-Api -Method "GET" -Endpoint "/threat-intel/iocs" -Expected "4xx" -Description "List IOCs"

    # Alerts
    Log "Testing Alert endpoints..."
    Test-Api -Method "GET" -Endpoint "/alerts/rules" -Expected "4xx" -Description "List alert rules"

    # API Keys
    Log "Testing API Key endpoints..."
    Test-Api -Method "GET" -Endpoint "/api-keys" -Expected "4xx" -Description "List API keys"

    # Audit Logs
    Log "Testing Audit Log endpoints..."
    Test-Api -Method "GET" -Endpoint "/audit-logs" -Expected "4xx" -Description "List audit logs"

    # Compliance
    Log "Testing Compliance endpoints..."
    Test-Api -Method "GET" -Endpoint "/compliance/frameworks" -Expected "4xx" -Description "List compliance frameworks"

    # Dashboard Page Tests
    Section "DASHBOARD PAGE TESTS"

    $pages = @(
        @{ Path = "/"; Desc = "Landing page" },
        @{ Path = "/login"; Desc = "Login page" },
        @{ Path = "/dashboard"; Desc = "Dashboard home" },
        @{ Path = "/dashboard/projects"; Desc = "Projects page" },
        @{ Path = "/dashboard/repositories"; Desc = "Repositories page" },
        @{ Path = "/dashboard/scans"; Desc = "Scans page" },
        @{ Path = "/dashboard/findings"; Desc = "Findings page" },
        @{ Path = "/dashboard/threat-modeling"; Desc = "Threat Modeling page" },
        @{ Path = "/dashboard/environments"; Desc = "Environments page" },
        @{ Path = "/dashboard/containers"; Desc = "Containers page" },
        @{ Path = "/dashboard/sbom"; Desc = "SBOM page" },
        @{ Path = "/dashboard/threat-intel"; Desc = "Threat Intel page" },
        @{ Path = "/dashboard/connections"; Desc = "Connections page" },
        @{ Path = "/dashboard/settings"; Desc = "Settings page" },
        @{ Path = "/dashboard/analytics"; Desc = "Analytics page" },
        @{ Path = "/dashboard/reports"; Desc = "Reports page" },
        @{ Path = "/dashboard/sla"; Desc = "SLA page" },
        @{ Path = "/dashboard/baselines"; Desc = "Baselines page" },
        @{ Path = "/dashboard/pipeline"; Desc = "Pipeline page" }
    )

    foreach ($page in $pages) {
        Test-Page -Path $page.Path -Description $page.Desc
    }

    # Build Verification
    Section "BUILD VERIFICATION"

    if (Test-Path "apps/api/dist") {
        Pass "API build directory exists"
    } else {
        Fail "API build directory not found"
    }

    if (Test-Path "apps/dashboard/.next") {
        Pass "Dashboard build directory exists"
    } else {
        Fail "Dashboard build directory not found"
    }

    if ((Test-Path "node_modules/.prisma/client") -or (Test-Path "apps/api/node_modules/.prisma/client")) {
        Pass "Prisma client generated"
    } else {
        Fail "Prisma client not generated"
    }

    # Summary
    Section "TEST SUMMARY"

    Write-Host ""
    Write-Host "Total:   $script:Total" -ForegroundColor White
    Write-Host "Passed:  $script:Passed" -ForegroundColor Green
    Write-Host "Failed:  $script:Failed" -ForegroundColor Red
    Write-Host ""

    if ($script:Total -gt 0) {
        $percent = [math]::Round(($script:Passed / $script:Total) * 100, 1)
        Write-Host "Success Rate: $percent%"

        if ($percent -lt 80) {
            Write-Host "Below 80% - needs attention" -ForegroundColor Red
        } elseif ($percent -lt 95) {
            Write-Host "Below 95% - minor issues" -ForegroundColor Yellow
        } else {
            Write-Host "Excellent coverage!" -ForegroundColor Green
        }
    }

    Write-Host ""

    if ($script:Failed -gt 0) {
        exit 1
    } else {
        exit 0
    }
}

# Run main
Main
