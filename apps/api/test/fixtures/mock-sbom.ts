/**
 * Mock SBOM Fixtures
 * CycloneDX and SPDX format examples for testing
 */

export const mockCycloneDxSbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: 'urn:uuid:3e671687-395b-41f5-a30f-a58921a69b79',
  version: 1,
  metadata: {
    timestamp: '2025-12-31T00:00:00Z',
    tools: [
      {
        vendor: 'CycloneDX',
        name: 'cyclonedx-cli',
        version: '0.25.0',
      },
    ],
    component: {
      type: 'application',
      name: 'threatdiviner-api',
      version: '1.0.0',
    },
  },
  components: [
    {
      type: 'library',
      name: 'express',
      version: '4.18.2',
      purl: 'pkg:npm/express@4.18.2',
      licenses: [{ license: { id: 'MIT' } }],
      hashes: [
        {
          alg: 'SHA-256',
          content: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      ],
    },
    {
      type: 'library',
      name: 'lodash',
      version: '4.17.21',
      purl: 'pkg:npm/lodash@4.17.21',
      licenses: [{ license: { id: 'MIT' } }],
    },
    {
      type: 'library',
      name: 'axios',
      version: '1.6.2',
      purl: 'pkg:npm/axios@1.6.2',
      licenses: [{ license: { id: 'MIT' } }],
    },
    {
      type: 'library',
      name: '@nestjs/core',
      version: '10.3.0',
      purl: 'pkg:npm/@nestjs/core@10.3.0',
      licenses: [{ license: { id: 'MIT' } }],
    },
    {
      type: 'library',
      name: 'prisma',
      version: '5.7.1',
      purl: 'pkg:npm/prisma@5.7.1',
      licenses: [{ license: { id: 'Apache-2.0' } }],
    },
  ],
  dependencies: [
    {
      ref: 'threatdiviner-api',
      dependsOn: ['express', 'lodash', 'axios', '@nestjs/core', 'prisma'],
    },
  ],
  vulnerabilities: [
    {
      id: 'CVE-2023-45857',
      source: {
        name: 'NVD',
        url: 'https://nvd.nist.gov/',
      },
      ratings: [
        {
          source: { name: 'NVD' },
          score: 6.5,
          severity: 'medium',
          method: 'CVSSv3',
        },
      ],
      description: 'Example vulnerability for testing',
      affects: [{ ref: 'axios' }],
    },
  ],
};

export const mockSpdxSbom = {
  spdxVersion: 'SPDX-2.3',
  dataLicense: 'CC0-1.0',
  SPDXID: 'SPDXRef-DOCUMENT',
  name: 'threatdiviner-api-sbom',
  documentNamespace: 'https://threatdiviner.example.com/sbom/api/1.0.0',
  creationInfo: {
    created: '2025-12-31T00:00:00Z',
    creators: ['Tool: syft-0.98.0', 'Organization: ThreatDiviner'],
    licenseListVersion: '3.21',
  },
  packages: [
    {
      SPDXID: 'SPDXRef-Package-express',
      name: 'express',
      versionInfo: '4.18.2',
      packageFileName: 'express-4.18.2.tgz',
      downloadLocation: 'https://registry.npmjs.org/express/-/express-4.18.2.tgz',
      filesAnalyzed: false,
      licenseConcluded: 'MIT',
      licenseDeclared: 'MIT',
      copyrightText: 'NOASSERTION',
      externalRefs: [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: 'pkg:npm/express@4.18.2',
        },
      ],
    },
    {
      SPDXID: 'SPDXRef-Package-lodash',
      name: 'lodash',
      versionInfo: '4.17.21',
      downloadLocation: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
      filesAnalyzed: false,
      licenseConcluded: 'MIT',
      licenseDeclared: 'MIT',
      copyrightText: 'NOASSERTION',
      externalRefs: [
        {
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: 'pkg:npm/lodash@4.17.21',
        },
      ],
    },
  ],
  relationships: [
    {
      spdxElementId: 'SPDXRef-DOCUMENT',
      relationshipType: 'DESCRIBES',
      relatedSpdxElement: 'SPDXRef-Package-express',
    },
    {
      spdxElementId: 'SPDXRef-Package-express',
      relationshipType: 'DEPENDS_ON',
      relatedSpdxElement: 'SPDXRef-Package-lodash',
    },
  ],
};

export const mockSbomUploadResponse = {
  id: 'sbom-001',
  format: 'CycloneDX',
  version: '1.5',
  componentCount: 5,
  vulnerabilityCount: 1,
  createdAt: '2025-12-31T00:00:00Z',
  status: 'processed',
};

export const mockSbomAnalysis = {
  sbomId: 'sbom-001',
  totalComponents: 5,
  directDependencies: 5,
  transitiveDependencies: 0,
  licenses: {
    MIT: 4,
    'Apache-2.0': 1,
  },
  vulnerabilities: {
    critical: 0,
    high: 0,
    medium: 1,
    low: 0,
  },
  outdatedPackages: [
    {
      name: 'lodash',
      currentVersion: '4.17.21',
      latestVersion: '4.17.21',
      isLatest: true,
    },
  ],
  riskScore: 25,
};

export const mockMinimalSbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.4',
  version: 1,
  components: [],
};

export const mockLargeSbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  version: 1,
  metadata: {
    timestamp: '2025-12-31T00:00:00Z',
    component: {
      type: 'application',
      name: 'large-app',
      version: '1.0.0',
    },
  },
  components: Array.from({ length: 500 }, (_, i) => ({
    type: 'library',
    name: `package-${i}`,
    version: `1.0.${i}`,
    purl: `pkg:npm/package-${i}@1.0.${i}`,
  })),
};
