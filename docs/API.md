# ThreatDiviner API Documentation

## Overview

ThreatDiviner provides a RESTful API for managing security scans, findings, compliance, and integrations.

**Base URL:** `http://localhost:3001/api` (development)

## Authentication

All API endpoints require authentication via JWT token or API key.

### JWT Authentication
```
Authorization: Bearer <jwt_token>
```

### API Key Authentication
```
X-API-Key: <api_key>
```

---

## Endpoints

### Authentication

#### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

#### POST /auth/register
Register a new user account.

#### GET /auth/me
Get current authenticated user.

---

### Repositories

#### GET /repositories
List all repositories for tenant.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `provider` (string): Filter by provider (github, gitlab, bitbucket, azure-devops)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "my-repo",
      "fullName": "org/my-repo",
      "provider": "github",
      "defaultBranch": "main",
      "isActive": true,
      "lastScanAt": "2024-12-25T00:00:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

#### GET /repositories/:id
Get repository details.

#### POST /repositories/:id/scan
Trigger a new scan for repository.

**Request:**
```json
{
  "branch": "main",
  "scanType": "full"
}
```

---

### Scans

#### GET /scans
List scans with optional filters.

**Query Parameters:**
- `repositoryId` (string): Filter by repository
- `status` (string): Filter by status (queued, running, completed, failed)
- `startDate` (string): Filter by start date
- `endDate` (string): Filter by end date

#### GET /scans/:id
Get scan details including findings summary.

**Response:**
```json
{
  "id": "uuid",
  "repositoryId": "uuid",
  "branch": "main",
  "status": "completed",
  "startedAt": "2024-12-25T00:00:00Z",
  "completedAt": "2024-12-25T00:05:00Z",
  "findingsCount": {
    "critical": 2,
    "high": 5,
    "medium": 10,
    "low": 15
  }
}
```

---

### Findings

#### GET /findings
List findings with filters.

**Query Parameters:**
- `scanId` (string): Filter by scan
- `repositoryId` (string): Filter by repository
- `severity` (string): Filter by severity (critical, high, medium, low)
- `status` (string): Filter by status (open, dismissed, fixed)
- `ruleId` (string): Filter by rule ID

#### GET /findings/:id
Get finding details.

**Response:**
```json
{
  "id": "uuid",
  "ruleId": "sql-injection",
  "title": "SQL Injection Vulnerability",
  "description": "User input is directly concatenated...",
  "severity": "critical",
  "filePath": "src/db.ts",
  "startLine": 42,
  "endLine": 45,
  "snippet": "db.query(`SELECT * FROM users WHERE id = ${id}`)",
  "cweId": "CWE-89",
  "status": "open",
  "autoFix": null
}
```

---

### Fix Actions

#### POST /fix/:findingId
Apply auto-fix to a finding.

**Response:**
```json
{
  "success": true,
  "message": "Fix applied successfully",
  "prUrl": "https://github.com/org/repo/pull/123"
}
```

#### POST /fix/dismiss/:findingId
Dismiss a finding.

**Request:**
```json
{
  "reason": "False positive - input is validated upstream"
}
```

#### POST /fix/triage/:findingId
AI-powered triage of a finding.

**Query Parameters:**
- `replyToPr` (boolean): Post triage result to PR comment

**Response:**
```json
{
  "success": true,
  "analysis": "This is a true positive SQL injection...",
  "confidence": 0.95,
  "falsePositive": false,
  "suggestedSeverity": "critical",
  "remediation": "Use parameterized queries..."
}
```

#### POST /fix/generate/:findingId
Generate auto-fix preview without applying.

**Response:**
```json
{
  "success": true,
  "autoFix": "const query = db.prepare('SELECT * FROM users WHERE id = ?').get(id);",
  "remediation": "Use parameterized queries to prevent SQL injection",
  "cached": false
}
```

#### GET /fix/status/:findingId
Get fix status for a finding.

**Response:**
```json
{
  "findingId": "uuid",
  "status": "triaged",
  "autoFixAvailable": true,
  "aiTriaged": true,
  "aiConfidence": 0.95,
  "aiAnalysis": "True positive SQL injection..."
}
```

---

### Compliance

#### GET /compliance/frameworks
List available compliance frameworks.

**Response:**
```json
[
  {
    "id": "soc2",
    "name": "SOC 2 Type II",
    "description": "Service Organization Control 2",
    "controls": [
      {
        "id": "CC6.1",
        "name": "Logical and Physical Access Controls",
        "description": "..."
      }
    ]
  }
]
```

#### GET /compliance/score
Get tenant-wide compliance score.

**Query Parameters:**
- `frameworkId` (string): Filter by specific framework

**Response:**
```json
{
  "tenantId": "uuid",
  "generatedAt": "2024-12-25T00:00:00Z",
  "frameworks": [
    {
      "framework": "soc2",
      "overallScore": 85.5,
      "passedControls": 17,
      "failedControls": 3,
      "totalControls": 20,
      "controlStatus": [
        {
          "controlId": "CC6.1",
          "status": "passed",
          "findingsCount": 0
        }
      ]
    }
  ]
}
```

#### GET /compliance/score/:repositoryId
Get repository-specific compliance score.

#### GET /compliance/violations/:frameworkId
Get control violations for a framework.

**Query Parameters:**
- `controlId` (string): Filter by specific control
- `repositoryId` (string): Filter by repository

**Response:**
```json
[
  {
    "controlId": "CC6.1",
    "framework": "soc2",
    "findingId": "uuid",
    "severity": "critical",
    "title": "SQL Injection",
    "filePath": "src/db.ts"
  }
]
```

#### GET /compliance/trend/:frameworkId
Get compliance score trend over time.

**Query Parameters:**
- `days` (number): Number of days to include (default: 30)

---

### Export

#### GET /export/findings
Export findings in various formats.

**Query Parameters:**
- `format` (string): Export format (csv, json)
- `repositoryId` (string): Filter by repository
- `scanId` (string): Filter by scan
- `severity` (string): Filter by severity

#### GET /export/sarif/:scanId
Export scan results in SARIF format.

#### GET /export/sbom/:repositoryId
Export Software Bill of Materials in CycloneDX format.

**Response:**
```json
{
  "format": "cyclonedx",
  "filename": "sbom-repo-name-2024-12-25.json",
  "data": {
    "bomFormat": "CycloneDX",
    "specVersion": "1.4",
    "components": [...]
  }
}
```

---

### CLI Integration

#### POST /cli/upload
Upload SARIF scan results from CI/CD.

**Headers:**
```
X-API-Key: <cli_api_key>
```

**Request:**
```json
{
  "repositoryId": "uuid",
  "branch": "main",
  "commitSha": "abc123",
  "sarif": { /* SARIF JSON */ }
}
```

#### POST /cli/register-scan
Register a new scan from CLI.

---

### Webhooks (Inbound)

#### POST /webhooks/github
GitHub webhook receiver.

**Supported Events:**
- `pull_request` (opened, synchronize, reopened)
- `push`

#### POST /webhooks/gitlab
GitLab webhook receiver.

**Supported Events:**
- `merge_request`
- `push`

#### POST /webhooks/bitbucket
Bitbucket webhook receiver.

**Supported Events:**
- `pullrequest:created`
- `pullrequest:updated`
- `repo:push`

#### POST /webhooks/azure-devops
Azure DevOps webhook receiver.

**Supported Events:**
- `git.pullrequest.created`
- `git.pullrequest.updated`

---

### Pipeline Gates

#### GET /pipeline/check/:scanId
Check if scan passes pipeline gate.

**Response:**
```json
{
  "passed": false,
  "reason": "2 critical findings exceed threshold",
  "findings": {
    "critical": 2,
    "high": 5,
    "medium": 10,
    "low": 15
  },
  "thresholds": {
    "critical": 0,
    "high": 5
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Common Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Invalid or missing auth |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |

---

## Rate Limiting

API requests are rate limited:
- **Standard:** 100 requests per minute
- **CLI/Webhook:** 1000 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703462400
```

---

## Pagination

List endpoints support cursor-based pagination:

**Query Parameters:**
- `page` (number): Page number
- `limit` (number): Items per page (max: 100)

**Response includes:**
```json
{
  "data": [...],
  "total": 500,
  "page": 1,
  "limit": 20,
  "totalPages": 25
}
```
