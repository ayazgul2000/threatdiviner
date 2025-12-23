# ThreatDiviner CLI

Security scanner for CI/CD pipelines. Run SAST, SCA, secrets detection, and IaC security scans from the command line.

## Installation

```bash
npm install -g @threatdiviner/cli
```

Or use npx:

```bash
npx @threatdiviner/cli scan
```

## Quick Start

```bash
# Scan current directory with all scanners
tdiv scan

# Scan specific path
tdiv scan --path ./src

# Output as JSON
tdiv scan --output json --output-file results.json

# Output as SARIF (for GitHub/GitLab integration)
tdiv scan --output sarif --output-file results.sarif

# Fail on high severity or above
tdiv scan --fail-on high
```

## Commands

### `tdiv scan`

Run security scans on a directory.

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --path <path>` | Path to scan | `.` (current directory) |
| `-c, --config <file>` | Path to configuration file | Auto-detect |
| `--sast` / `--no-sast` | Enable/disable SAST scanning | enabled |
| `--sca` / `--no-sca` | Enable/disable SCA scanning | enabled |
| `--secrets` / `--no-secrets` | Enable/disable secrets scanning | enabled |
| `--iac` / `--no-iac` | Enable/disable IaC scanning | enabled |
| `-o, --output <format>` | Output format: `json`, `sarif`, `text` | `text` |
| `-f, --output-file <file>` | Write output to file | stdout |
| `--fail-on <severity>` | Fail if findings at or above severity | none |
| `--max-findings <n>` | Fail if total findings exceed n | none |
| `--skip <paths>` | Comma-separated paths to skip | `node_modules,vendor,.git` |
| `-v, --verbose` | Verbose output | false |
| `-q, --quiet` | Suppress non-essential output | false |

### `tdiv config init`

Create a new configuration file.

```bash
tdiv config init
```

### `tdiv config show`

Show current configuration.

### `tdiv config validate`

Validate configuration file.

## Configuration File

Create a `.threatdiviner.json` file in your project root:

```json
{
  "enableSast": true,
  "enableSca": true,
  "enableSecrets": true,
  "enableIac": true,
  "skipPaths": [
    "node_modules",
    "vendor",
    ".git",
    "dist",
    "build"
  ],
  "outputFormat": "text",
  "failOnSeverity": "high"
}
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Scan completed successfully, no findings above threshold |
| 1 | Scan completed with findings above threshold |
| 2 | Scan failed due to errors |

## CI/CD Integration

### GitHub Actions

```yaml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install scanners
        run: |
          pip install semgrep checkov
          curl -sfL https://github.com/aquasecurity/trivy/releases/latest/download/trivy_Linux-64bit.tar.gz | tar xz
          curl -sfL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_Linux_x64.tar.gz | tar xz

      - name: Run ThreatDiviner scan
        run: |
          npx @threatdiviner/cli scan \
            --output sarif \
            --output-file results.sarif \
            --fail-on high

      - name: Upload SARIF to GitHub
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: results.sarif
```

### GitLab CI

```yaml
security-scan:
  image: node:20
  stage: test
  before_script:
    - pip install semgrep checkov
    - curl -sfL https://github.com/aquasecurity/trivy/releases/latest/download/trivy_Linux-64bit.tar.gz | tar xz -C /usr/local/bin
    - curl -sfL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_Linux_x64.tar.gz | tar xz -C /usr/local/bin
  script:
    - npx @threatdiviner/cli scan --output sarif --output-file gl-sast-report.sarif --fail-on high
  artifacts:
    reports:
      sast: gl-sast-report.sarif
  allow_failure: true
```

### Azure DevOps

```yaml
- task: Bash@3
  displayName: 'Run ThreatDiviner Scan'
  inputs:
    targetType: 'inline'
    script: |
      pip install semgrep checkov
      npx @threatdiviner/cli scan \
        --output sarif \
        --output-file $(Build.ArtifactStagingDirectory)/results.sarif \
        --fail-on high

- task: PublishBuildArtifacts@1
  inputs:
    PathtoPublish: '$(Build.ArtifactStagingDirectory)/results.sarif'
    ArtifactName: 'security-results'
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Security Scan') {
            steps {
                sh 'pip install semgrep checkov'
                sh 'npx @threatdiviner/cli scan --output json --output-file results.json --fail-on high'
            }
            post {
                always {
                    archiveArtifacts artifacts: 'results.json'
                }
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
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install scanners
          command: |
            pip install semgrep checkov
      - run:
          name: Run security scan
          command: |
            npx @threatdiviner/cli scan \
              --output sarif \
              --output-file results.sarif \
              --fail-on high
      - store_artifacts:
          path: results.sarif
          destination: security-results
```

## Scanner Requirements

The CLI requires the following tools to be installed:

| Scanner | Tool | Installation |
|---------|------|--------------|
| SAST | Semgrep | `pip install semgrep` |
| SCA | Trivy | [Install Trivy](https://github.com/aquasecurity/trivy) |
| Secrets | Gitleaks | [Install Gitleaks](https://github.com/gitleaks/gitleaks) |
| IaC | Checkov | `pip install checkov` |

## License

MIT
