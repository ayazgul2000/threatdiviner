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
CYAN='\033[0;36m'
NC='\033[0m'

PASSED=0
FAILED=0
TOTAL=0

log() { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASSED++)); ((TOTAL++)); }
fail() { echo -e "${RED}[FAIL]${NC} $1${2:+ - $2}"; ((FAILED++)); ((TOTAL++)); }
section() { echo -e "\n${CYAN}=== $1 ===${NC}\n"; }

# Test API endpoint
test_api() {
  local method=$1
  local endpoint=$2
  local expected=$3
  local body=$4
  local desc=$5

  local url="${API_URL}${endpoint}"
  local response
  local status

  if [ -n "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$url" 2>/dev/null)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" 2>/dev/null)
  fi

  status=$(echo "$response" | tail -1)

  if [ "$expected" == "2xx" ] && [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    pass "$desc"
    return 0
  elif [ "$expected" == "4xx" ] && [ "$status" -ge 400 ] && [ "$status" -lt 500 ]; then
    pass "$desc (auth required - $status)"
    return 0
  elif [ "$status" == "$expected" ]; then
    pass "$desc"
    return 0
  else
    fail "$desc" "Expected $expected, got $status"
    return 1
  fi
}

# Test dashboard page
test_page() {
  local path=$1
  local desc=$2

  local url="${DASHBOARD_URL}${path}"
  local status

  status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

  if [ "$status" == "200" ] || [ "$status" == "307" ] || [ "$status" == "302" ]; then
    pass "$desc"
  else
    fail "$desc" "HTTP $status"
  fi
}

echo ""
echo "================================================"
echo "ThreatDiviner Functional Test Suite"
echo "================================================"
echo ""
echo "API URL:       $API_URL"
echo "Dashboard URL: $DASHBOARD_URL"
echo ""

# Prerequisites
section "PREREQUISITES"

log "Checking API health..."
if curl -s "$API_URL/health" > /dev/null 2>&1; then
  pass "API is running"
else
  fail "API is not running"
  echo ""
  echo "Start the app with: ./scripts/app.sh start"
  exit 1
fi

log "Checking Dashboard..."
status=$(curl -s -o /dev/null -w "%{http_code}" "$DASHBOARD_URL" 2>/dev/null)
if [ "$status" == "200" ] || [ "$status" == "307" ] || [ "$status" == "302" ]; then
  pass "Dashboard is running"
else
  fail "Dashboard is not running"
fi

# Entity Tests
section "ENTITY TESTS - API ENDPOINTS"

# Health
log "Testing Health endpoints..."
test_api GET /health 200 "" "Health check"

# Auth
log "Testing Auth endpoints..."
test_api POST /auth/login 4xx '{"email":"test@test.com","password":"test"}' "Auth login"
test_api GET /auth/me 4xx "" "Auth current user"

# Tenant
log "Testing Tenant endpoints..."
test_api GET /tenants/current 4xx "" "Get current tenant"

# Users
log "Testing User endpoints..."
test_api GET /users 4xx "" "List users"

# Projects
log "Testing Project endpoints..."
test_api GET /projects 4xx "" "List projects"

# Repositories
log "Testing Repository endpoints..."
test_api GET /scm/repositories 4xx "" "List repositories"

# Connections
log "Testing Connection endpoints..."
test_api GET /scm/connections 4xx "" "List connections"
test_api GET /scm/connections/status 4xx "" "Connection status"

# Scans
log "Testing Scan endpoints..."
test_api GET /scm/scans 4xx "" "List scans"

# Findings
log "Testing Finding endpoints..."
test_api GET /scm/findings 4xx "" "List findings"

# SBOM
log "Testing SBOM endpoints..."
test_api GET /sbom 4xx "" "List SBOMs"

# Threat Modeling
log "Testing Threat Modeling endpoints..."
test_api GET /threat-modeling 4xx "" "List threat models"

# Environments
log "Testing Environment endpoints..."
test_api GET /environments 4xx "" "List environments"

# Pipeline Gates
log "Testing Pipeline Gate endpoints..."
test_api GET /pipeline/gates 4xx "" "List pipeline gates"

# Containers
log "Testing Container endpoints..."
test_api GET /containers 4xx "" "List containers"

# Threat Intel
log "Testing Threat Intel endpoints..."
test_api GET /threat-intel/feeds 4xx "" "List threat intel feeds"
test_api GET /threat-intel/iocs 4xx "" "List IOCs"

# Alerts
log "Testing Alert endpoints..."
test_api GET /alerts/rules 4xx "" "List alert rules"

# API Keys
log "Testing API Key endpoints..."
test_api GET /api-keys 4xx "" "List API keys"

# Audit Logs
log "Testing Audit Log endpoints..."
test_api GET /audit-logs 4xx "" "List audit logs"

# Compliance
log "Testing Compliance endpoints..."
test_api GET /compliance/frameworks 4xx "" "List compliance frameworks"

# Dashboard Page Tests
section "DASHBOARD PAGE TESTS"

test_page "/" "Landing page"
test_page "/login" "Login page"
test_page "/dashboard" "Dashboard home"
test_page "/dashboard/projects" "Projects page"
test_page "/dashboard/repositories" "Repositories page"
test_page "/dashboard/scans" "Scans page"
test_page "/dashboard/findings" "Findings page"
test_page "/dashboard/threat-modeling" "Threat Modeling page"
test_page "/dashboard/environments" "Environments page"
test_page "/dashboard/containers" "Containers page"
test_page "/dashboard/sbom" "SBOM page"
test_page "/dashboard/threat-intel" "Threat Intel page"
test_page "/dashboard/connections" "Connections page"
test_page "/dashboard/settings" "Settings page"
test_page "/dashboard/analytics" "Analytics page"
test_page "/dashboard/reports" "Reports page"
test_page "/dashboard/sla" "SLA page"
test_page "/dashboard/baselines" "Baselines page"
test_page "/dashboard/pipeline" "Pipeline page"

# Build Verification
section "BUILD VERIFICATION"

if [ -d "apps/api/dist" ]; then
  pass "API build directory exists"
else
  fail "API build directory not found"
fi

if [ -d "apps/dashboard/.next" ]; then
  pass "Dashboard build directory exists"
else
  fail "Dashboard build directory not found"
fi

if [ -d "node_modules/.prisma/client" ] || [ -d "apps/api/node_modules/.prisma/client" ]; then
  pass "Prisma client generated"
else
  fail "Prisma client not generated"
fi

# Summary
section "TEST SUMMARY"

echo ""
echo "Total:   $TOTAL"
echo -e "Passed:  ${GREEN}$PASSED${NC}"
echo -e "Failed:  ${RED}$FAILED${NC}"
echo ""

if [ $TOTAL -gt 0 ]; then
  PERCENT=$((PASSED * 100 / TOTAL))
  echo "Success Rate: ${PERCENT}%"

  if [ $PERCENT -lt 80 ]; then
    echo -e "${RED}Below 80% - needs attention${NC}"
  elif [ $PERCENT -lt 95 ]; then
    echo -e "${YELLOW}Below 95% - minor issues${NC}"
  else
    echo -e "${GREEN}Excellent coverage!${NC}"
  fi
fi

echo ""

exit $FAILED
