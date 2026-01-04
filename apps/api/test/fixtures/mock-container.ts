/**
 * Mock Container Fixtures
 * Container images and scan results for testing
 */

export const mockContainerImage = {
  id: 'container-001',
  registry: 'docker.io',
  repository: 'threatdiviner/api',
  tag: 'v1.0.0',
  digest: 'sha256:abc123def456789abc123def456789abc123def456789abc123def456789abcd',
  size: 125000000, // 125 MB
  architecture: 'amd64',
  os: 'linux',
  created: '2025-12-30T12:00:00Z',
  labels: {
    'org.opencontainers.image.title': 'ThreatDiviner API',
    'org.opencontainers.image.version': '1.0.0',
    'org.opencontainers.image.vendor': 'ThreatDiviner',
  },
};

export const mockContainerScanResult = {
  imageId: 'container-001',
  scanId: 'container-scan-001',
  scanner: 'trivy',
  scanType: 'container',
  status: 'completed',
  startedAt: '2025-12-31T00:00:00Z',
  completedAt: '2025-12-31T00:01:30Z',
  osFindings: [
    {
      pkgName: 'openssl',
      installedVersion: '1.1.1k-r0',
      fixedVersion: '1.1.1l-r0',
      severity: 'HIGH',
      cve: 'CVE-2021-3711',
      title: 'OpenSSL SM2 Decryption Buffer Overflow',
      description: 'A buffer overflow vulnerability in OpenSSL.',
    },
    {
      pkgName: 'curl',
      installedVersion: '7.79.0',
      fixedVersion: '7.79.1',
      severity: 'MEDIUM',
      cve: 'CVE-2021-22945',
      title: 'curl STARTTLS protocol injection',
      description: 'A protocol injection vulnerability in curl.',
    },
  ],
  appFindings: [
    {
      pkgName: 'lodash',
      installedVersion: '4.17.15',
      fixedVersion: '4.17.21',
      severity: 'HIGH',
      cve: 'CVE-2021-23337',
      title: 'Prototype Pollution in lodash',
      language: 'node',
      filePath: '/app/node_modules/lodash/package.json',
    },
  ],
  secretFindings: [
    {
      ruleId: 'private-key',
      severity: 'CRITICAL',
      title: 'Private key found in container',
      filePath: '/app/config/server.key',
      match: '-----BEGIN RSA PRIVATE KEY-----',
    },
  ],
  misconfigFindings: [
    {
      ruleId: 'running-as-root',
      severity: 'MEDIUM',
      title: 'Container running as root user',
      description: 'The container is configured to run as the root user.',
      remediation: 'Add USER directive to Dockerfile',
    },
    {
      ruleId: 'no-healthcheck',
      severity: 'LOW',
      title: 'No HEALTHCHECK instruction',
      description: 'Dockerfile does not contain a HEALTHCHECK instruction.',
      remediation: 'Add HEALTHCHECK instruction to Dockerfile',
    },
  ],
  summary: {
    critical: 1,
    high: 2,
    medium: 2,
    low: 1,
    total: 6,
  },
  layers: [
    {
      digest: 'sha256:layer1',
      size: 5000000,
      command: 'ADD file:... in /',
    },
    {
      digest: 'sha256:layer2',
      size: 50000000,
      command: 'RUN apk add --no-cache nodejs npm',
    },
    {
      digest: 'sha256:layer3',
      size: 70000000,
      command: 'COPY . /app',
    },
  ],
};

export const mockContainerRegistries = [
  {
    id: 'registry-001',
    name: 'Docker Hub',
    type: 'dockerhub',
    url: 'https://registry.hub.docker.com',
    connected: true,
    lastSync: '2025-12-31T00:00:00Z',
  },
  {
    id: 'registry-002',
    name: 'AWS ECR',
    type: 'ecr',
    url: 'https://123456789.dkr.ecr.us-east-1.amazonaws.com',
    connected: true,
    lastSync: '2025-12-30T23:00:00Z',
  },
  {
    id: 'registry-003',
    name: 'GitHub Container Registry',
    type: 'ghcr',
    url: 'https://ghcr.io',
    connected: false,
    lastSync: null,
  },
];

export const mockContainerImageList = [
  {
    id: 'container-001',
    registry: 'docker.io',
    repository: 'threatdiviner/api',
    tag: 'v1.0.0',
    lastScanned: '2025-12-31T00:00:00Z',
    vulnerabilities: { critical: 1, high: 2, medium: 2, low: 1 },
  },
  {
    id: 'container-002',
    registry: 'docker.io',
    repository: 'threatdiviner/dashboard',
    tag: 'v1.0.0',
    lastScanned: '2025-12-31T00:00:00Z',
    vulnerabilities: { critical: 0, high: 1, medium: 3, low: 2 },
  },
  {
    id: 'container-003',
    registry: 'docker.io',
    repository: 'threatdiviner/worker',
    tag: 'latest',
    lastScanned: null,
    vulnerabilities: null,
  },
];

export const mockBaseImageAnalysis = {
  baseImage: 'node:18-alpine',
  baseImageDigest: 'sha256:base123',
  recommendation: 'node:18-alpine3.18',
  reason: 'Current base image has known vulnerabilities. Recommended image is patched.',
  vulnerabilitiesInBase: 3,
  vulnerabilitiesInRecommended: 0,
};

export const mockLayerAnalysis = [
  {
    layerIndex: 0,
    digest: 'sha256:layer1',
    size: 5000000,
    addedPackages: ['alpine-baselayout', 'busybox', 'musl'],
    vulnerabilities: 0,
  },
  {
    layerIndex: 1,
    digest: 'sha256:layer2',
    size: 50000000,
    addedPackages: ['nodejs', 'npm', 'openssl'],
    vulnerabilities: 1,
  },
  {
    layerIndex: 2,
    digest: 'sha256:layer3',
    size: 70000000,
    addedPackages: [],
    addedFiles: 1247,
    vulnerabilities: 2,
  },
];

export const mockDockerfileAnalysis = {
  issues: [
    {
      line: 1,
      severity: 'MEDIUM',
      rule: 'DL3006',
      message: 'Always tag the version of an image explicitly',
      suggestion: 'Use FROM node:18-alpine instead of FROM node:alpine',
    },
    {
      line: 5,
      severity: 'HIGH',
      rule: 'DL3002',
      message: 'Last USER should not be root',
      suggestion: 'Add a USER instruction to run as non-root',
    },
    {
      line: 8,
      severity: 'LOW',
      rule: 'DL3020',
      message: 'Use COPY instead of ADD for files and folders',
      suggestion: 'Replace ADD with COPY',
    },
  ],
  bestPractices: {
    multiStage: false,
    nonRootUser: false,
    healthcheck: false,
    noCache: true,
    minimalBase: true,
  },
};
