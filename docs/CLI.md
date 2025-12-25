# ThreatDiviner CLI Guide

The ThreatDiviner CLI enables integration with CI/CD pipelines for automated security scanning.

## Installation

```bash
# Install globally
npm install -g @threatdiviner/cli

# Or use npx
npx @threatdiviner/cli <command>
```

## Configuration

### API Key Setup

Generate an API key from the ThreatDiviner dashboard:

1. Navigate to Settings > API Keys
2. Click "Generate New Key"
3. Copy the key and store it securely

Configure the CLI:

```bash
# Set API endpoint and key
threatdiviner config set api-url https://api.threatdiviner.io
threatdiviner config set api-key <your-api-key>

# Or use environment variables
export THREATDIVINER_API_URL=https://api.threatdiviner.io
export THREATDIVINER_API_KEY=<your-api-key>
```

---

## Commands

### upload

Upload SARIF scan results to ThreatDiviner.

```bash
threatdiviner upload <sarif-file> [options]

Options:
  -r, --repository <id>   Repository ID (required)
  -b, --branch <name>     Branch name (default: current git branch)
  -c, --commit <sha>      Commit SHA (default: current git commit)
  --pr <number>           Pull request number
  --fail-on-critical      Exit with error if critical findings found
  --fail-on-high          Exit with error if high+ findings found
```

**Examples:**

```bash
# Basic upload
threatdiviner upload results.sarif -r repo-123

# With PR integration
threatdiviner upload results.sarif -r repo-123 --pr 456

# Fail pipeline on critical findings
threatdiviner upload results.sarif -r repo-123 --fail-on-critical
```

### baseline

Manage finding baselines for differential scanning.

```bash
threatdiviner baseline <action> [options]

Actions:
  create    Create a new baseline from current findings
  list      List available baselines
  apply     Apply baseline to filter known findings
  delete    Delete a baseline
```

**Examples:**

```bash
# Create baseline from current main branch
threatdiviner baseline create -r repo-123 -b main

# List baselines
threatdiviner baseline list -r repo-123

# Apply baseline to scan results
threatdiviner baseline apply -r repo-123 --baseline baseline-123 < results.sarif > filtered.sarif
```

### scan

Trigger a scan and wait for results.

```bash
threatdiviner scan [options]

Options:
  -r, --repository <id>   Repository ID (required)
  -b, --branch <name>     Branch to scan
  --wait                  Wait for scan completion
  --timeout <seconds>     Wait timeout (default: 300)
```

**Examples:**

```bash
# Trigger scan
threatdiviner scan -r repo-123 -b feature-branch

# Trigger and wait for results
threatdiviner scan -r repo-123 -b main --wait --timeout 600
```

### status

Check scan or finding status.

```bash
threatdiviner status <scan-id>
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan

on:
  pull_request:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Semgrep
        run: |
          pip install semgrep
          semgrep scan --config auto --sarif -o results.sarif

      - name: Upload to ThreatDiviner
        env:
          THREATDIVINER_API_KEY: ${{ secrets.THREATDIVINER_API_KEY }}
          THREATDIVINER_API_URL: ${{ secrets.THREATDIVINER_API_URL }}
        run: |
          npx @threatdiviner/cli upload results.sarif \
            -r ${{ vars.REPOSITORY_ID }} \
            -b ${{ github.head_ref }} \
            -c ${{ github.sha }} \
            --pr ${{ github.event.pull_request.number }} \
            --fail-on-critical
```

### GitLab CI

```yaml
security_scan:
  stage: test
  script:
    - pip install semgrep
    - semgrep scan --config auto --sarif -o results.sarif
    - npx @threatdiviner/cli upload results.sarif
        -r $REPOSITORY_ID
        -b $CI_COMMIT_REF_NAME
        -c $CI_COMMIT_SHA
        --fail-on-critical
  variables:
    THREATDIVINER_API_KEY: $THREATDIVINER_API_KEY
    THREATDIVINER_API_URL: $THREATDIVINER_API_URL
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

### Azure DevOps

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: UsePythonVersion@0
    inputs:
      versionSpec: '3.x'

  - script: |
      pip install semgrep
      semgrep scan --config auto --sarif -o results.sarif
    displayName: 'Run Semgrep'

  - script: |
      npx @threatdiviner/cli upload results.sarif \
        -r $(REPOSITORY_ID) \
        -b $(Build.SourceBranchName) \
        -c $(Build.SourceVersion) \
        --fail-on-critical
    displayName: 'Upload to ThreatDiviner'
    env:
      THREATDIVINER_API_KEY: $(THREATDIVINER_API_KEY)
      THREATDIVINER_API_URL: $(THREATDIVINER_API_URL)
```

### Jenkins

```groovy
pipeline {
    agent any

    environment {
        THREATDIVINER_API_KEY = credentials('threatdiviner-api-key')
        THREATDIVINER_API_URL = 'https://api.threatdiviner.io'
    }

    stages {
        stage('Scan') {
            steps {
                sh 'pip install semgrep'
                sh 'semgrep scan --config auto --sarif -o results.sarif'
            }
        }

        stage('Upload') {
            steps {
                sh '''
                    npx @threatdiviner/cli upload results.sarif \
                        -r ${REPOSITORY_ID} \
                        -b ${GIT_BRANCH} \
                        -c ${GIT_COMMIT} \
                        --fail-on-critical
                '''
            }
        }
    }
}
```

### CircleCI

```yaml
version: 2.1

jobs:
  security-scan:
    docker:
      - image: cimg/python:3.11-node
    steps:
      - checkout
      - run:
          name: Install Semgrep
          command: pip install semgrep
      - run:
          name: Run Scan
          command: semgrep scan --config auto --sarif -o results.sarif
      - run:
          name: Upload Results
          command: |
            npx @threatdiviner/cli upload results.sarif \
              -r $REPOSITORY_ID \
              -b $CIRCLE_BRANCH \
              -c $CIRCLE_SHA1 \
              --fail-on-critical

workflows:
  main:
    jobs:
      - security-scan
```

---

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Critical findings found (with --fail-on-critical) |
| 3 | High+ findings found (with --fail-on-high) |
| 4 | Authentication error |
| 5 | Network error |

---

## Troubleshooting

### Authentication Errors

```bash
# Verify API key is set
threatdiviner config get api-key

# Test connection
threatdiviner status test
```

### Upload Failures

```bash
# Enable debug logging
DEBUG=threatdiviner:* threatdiviner upload results.sarif -r repo-123

# Validate SARIF file
cat results.sarif | jq .
```

### Rate Limiting

The CLI respects rate limits. If you encounter rate limiting:
- Reduce parallel uploads
- Add delays between uploads in batch scripts
- Contact support for higher limits
