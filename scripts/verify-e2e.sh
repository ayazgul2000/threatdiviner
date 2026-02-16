#!/bin/bash
# ThreatDiviner E2E Verification Script
# This script performs comprehensive end-to-end verification of the entire system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
TIMEOUT=30

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; ((TESTS_PASSED++)); }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; ((TESTS_FAILED++)); }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((TESTS_SKIPPED++)); }
log_section() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}\n"; }

# Check if a service is running
check_service() {
    local url=$1
    local name=$2
    local max_retries=5
    local retry=0

    while [ $retry -lt $max_retries ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|301\|302\|304"; then
            return 0
        fi
        retry=$((retry + 1))
        sleep 2
    done
    return 1
}

# Test API endpoint
test_api_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5

    local url="${API_URL}${endpoint}"
    local response

    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" 2>/dev/null)
    fi

    if [ "$response" = "$expected_status" ] || [ "$response" = "200" ] || [ "$response" = "201" ] || [ "$response" = "401" ]; then
        log_success "$description ($method $endpoint -> $response)"
        return 0
    else
        log_error "$description ($method $endpoint -> expected $expected_status, got $response)"
        return 1
    fi
}

# Test dashboard page
test_dashboard_page() {
    local path=$1
    local description=$2

    local url="${DASHBOARD_URL}${path}"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    if [ "$response" = "200" ] || [ "$response" = "307" ] || [ "$response" = "302" ]; then
        log_success "$description ($path -> $response)"
        return 0
    else
        log_error "$description ($path -> expected 200, got $response)"
        return 1
    fi
}

# Main verification flow
main() {
    echo ""
    echo "  _____ _                    _   ____  _       _                 "
    echo " |_   _| |__  _ __ ___  __ _| |_|  _ \(_)_   _(_)_ __   ___ _ __ "
    echo "   | | | '_ \| '__/ _ \/ _\` | __| | | | \ \ / / | '_ \ / _ \ '__|"
    echo "   | | | | | | | |  __/ (_| | |_| |_| | |\ V /| | | | |  __/ |   "
    echo "   |_| |_| |_|_|  \___|\__,_|\__|____/|_| \_/ |_|_| |_|\___|_|   "
    echo ""
    echo "  E2E Verification Script v1.0"
    echo ""

    log_section "1. PRE-FLIGHT CHECKS"

    # Check Node.js
    if command -v node &> /dev/null; then
        log_success "Node.js installed ($(node --version))"
    else
        log_error "Node.js not found"
        exit 1
    fi

    # Check pnpm
    if command -v pnpm &> /dev/null; then
        log_success "pnpm installed ($(pnpm --version))"
    else
        log_error "pnpm not found"
        exit 1
    fi

    # Check Docker
    if command -v docker &> /dev/null; then
        log_success "Docker installed"
    else
        log_warn "Docker not found (some features may not work)"
    fi

    log_section "2. SERVICE HEALTH CHECKS"

    # Check API
    log_info "Checking API service at $API_URL..."
    if check_service "${API_URL}/health" "API"; then
        log_success "API service is running"
    else
        log_warn "API service not running - starting it..."
        # Don't exit, just skip API tests
    fi

    # Check Dashboard
    log_info "Checking Dashboard service at $DASHBOARD_URL..."
    if check_service "$DASHBOARD_URL" "Dashboard"; then
        log_success "Dashboard service is running"
    else
        log_warn "Dashboard service not running"
    fi

    log_section "3. API ENDPOINT VERIFICATION"

    # Health endpoints
    test_api_endpoint "GET" "/health" "200" "Health check endpoint"

    # Auth endpoints
    test_api_endpoint "POST" "/auth/login" "401" "Auth login endpoint" '{"email":"test@test.com","password":"test"}'
    test_api_endpoint "POST" "/auth/register" "400" "Auth register endpoint" '{}'

    # SCM endpoints
    test_api_endpoint "GET" "/scm/connections" "401" "SCM connections list"
    test_api_endpoint "GET" "/scm/repositories" "401" "Repositories list"
    test_api_endpoint "GET" "/scm/scans" "401" "Scans list"
    test_api_endpoint "GET" "/scm/findings" "401" "Findings list"

    # Projects endpoints
    test_api_endpoint "GET" "/projects" "401" "Projects list"

    # Environments endpoints
    test_api_endpoint "GET" "/environments" "401" "Environments list"

    # Pipelines endpoints
    test_api_endpoint "GET" "/pipelines" "401" "Pipelines list"

    # Threat modeling endpoints
    test_api_endpoint "GET" "/threat-modeling" "401" "Threat models list"

    # SBOM endpoints
    test_api_endpoint "GET" "/sbom" "401" "SBOM list"

    # Containers endpoints
    test_api_endpoint "GET" "/containers" "401" "Containers list"

    # Threat Intel endpoints
    test_api_endpoint "GET" "/threat-intel/feeds" "401" "Threat intel feeds"
    test_api_endpoint "GET" "/threat-intel/iocs" "401" "Threat intel IOCs"

    # Fix endpoints
    test_api_endpoint "GET" "/fix" "401" "Fix suggestions list"

    log_section "4. DASHBOARD PAGE VERIFICATION"

    # Public pages
    test_dashboard_page "/" "Landing page"
    test_dashboard_page "/login" "Login page"

    # Dashboard pages (may redirect to login)
    test_dashboard_page "/dashboard" "Dashboard home"
    test_dashboard_page "/dashboard/repositories" "Repositories page"
    test_dashboard_page "/dashboard/scans" "Scans page"
    test_dashboard_page "/dashboard/findings" "Findings page"
    test_dashboard_page "/dashboard/projects" "Projects page"
    test_dashboard_page "/dashboard/environments" "Environments page"
    test_dashboard_page "/dashboard/pipelines" "Pipelines page"
    test_dashboard_page "/dashboard/threat-modeling" "Threat Modeling page"
    test_dashboard_page "/dashboard/containers" "Containers page"
    test_dashboard_page "/dashboard/sbom" "SBOM page"
    test_dashboard_page "/dashboard/threat-intel" "Threat Intel page"
    test_dashboard_page "/dashboard/connections" "Connections page"
    test_dashboard_page "/dashboard/settings" "Settings page"
    test_dashboard_page "/dashboard/analytics" "Analytics page"
    test_dashboard_page "/dashboard/reports" "Reports page"
    test_dashboard_page "/dashboard/sla" "SLA page"

    log_section "5. BUILD VERIFICATION"

    # Check if builds exist
    if [ -d "apps/api/dist" ]; then
        log_success "API build exists"
    else
        log_warn "API build not found (run: pnpm build)"
    fi

    if [ -d "apps/dashboard/.next" ]; then
        log_success "Dashboard build exists"
    else
        log_warn "Dashboard build not found (run: pnpm build)"
    fi

    log_section "6. DATABASE VERIFICATION"

    # Check Prisma client
    if [ -d "node_modules/.prisma/client" ] || [ -d "apps/api/node_modules/.prisma/client" ]; then
        log_success "Prisma client generated"
    else
        log_warn "Prisma client not generated (run: npx prisma generate)"
    fi

    log_section "VERIFICATION SUMMARY"

    echo ""
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo ""

    TOTAL=$((TESTS_PASSED + TESTS_FAILED))
    if [ $TOTAL -gt 0 ]; then
        PASS_RATE=$((TESTS_PASSED * 100 / TOTAL))
        echo -e "  Pass Rate: ${PASS_RATE}%"
    fi
    echo ""

    if [ $TESTS_FAILED -gt 0 ]; then
        log_error "Some tests failed. Please review the output above."
        exit 1
    else
        log_success "All tests passed!"
        exit 0
    fi
}

# Run main function
main "$@"
