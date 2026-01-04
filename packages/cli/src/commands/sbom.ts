#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';

interface CliConfig {
  apiUrl: string;
  token?: string;
}

interface SbomPackage {
  name: string;
  version: string;
  type: string;
  purl?: string;
  licenses?: string[];
}

interface AnalysisResult {
  totalPackages: number;
  vulnerablePackages: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  kevCount: number;
  summary: {
    riskScore: number;
    riskLevel: string;
    topRisks: string[];
    recommendations: string[];
  };
}

const program = new Command();

function loadConfig(): CliConfig {
  const configPath = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.threatdiviner', 'config.json');

  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (error) {
    // Config file doesn't exist or is invalid
  }

  return {
    apiUrl: process.env.THREATDIVINER_API_URL || 'http://localhost:3001',
    token: process.env.THREATDIVINER_TOKEN,
  };
}

function saveConfig(config: CliConfig): void {
  const configDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.threatdiviner');
  const configPath = path.join(configDir, 'config.json');

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const config = loadConfig();

  if (!config.token) {
    console.error('Error: No authentication token configured.');
    console.error('Run: threatdiviner config set-token <your-token>');
    process.exit(1);
  }

  const url = `${config.apiUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API request failed: ${response.status} - ${error}`);
  }

  return response.json();
}

function detectSbomFormat(content: string): 'cyclonedx' | 'spdx' | 'unknown' {
  try {
    const parsed = JSON.parse(content);

    if (parsed.bomFormat === 'CycloneDX' || parsed['$schema']?.includes('cyclonedx')) {
      return 'cyclonedx';
    }

    if (parsed.spdxVersion || parsed.SPDXID) {
      return 'spdx';
    }
  } catch {
    // Not valid JSON
  }

  return 'unknown';
}

function parseCycloneDx(content: string): SbomPackage[] {
  const sbom = JSON.parse(content);
  const packages: SbomPackage[] = [];

  for (const component of sbom.components || []) {
    packages.push({
      name: component.name,
      version: component.version,
      type: detectPackageType(component.purl),
      purl: component.purl,
      licenses: component.licenses?.map((l: any) => l.license?.id || l.license?.name),
    });
  }

  return packages;
}

function parseSpdx(content: string): SbomPackage[] {
  const sbom = JSON.parse(content);
  const packages: SbomPackage[] = [];

  for (const pkg of sbom.packages || []) {
    if (pkg.SPDXID === 'SPDXRef-DOCUMENT') continue;

    const purl = pkg.externalRefs?.find((r: any) => r.referenceType === 'purl')?.referenceLocator;

    packages.push({
      name: pkg.name,
      version: pkg.versionInfo,
      type: detectPackageType(purl),
      purl,
      licenses: pkg.licenseConcluded ? [pkg.licenseConcluded] : undefined,
    });
  }

  return packages;
}

function detectPackageType(purl?: string): string {
  if (!purl) return 'npm';

  if (purl.startsWith('pkg:npm/')) return 'npm';
  if (purl.startsWith('pkg:pypi/')) return 'pypi';
  if (purl.startsWith('pkg:maven/')) return 'maven';
  if (purl.startsWith('pkg:nuget/')) return 'nuget';
  if (purl.startsWith('pkg:golang/')) return 'go';
  if (purl.startsWith('pkg:cargo/')) return 'cargo';
  if (purl.startsWith('pkg:gem/')) return 'gem';
  if (purl.startsWith('pkg:composer/')) return 'composer';

  return 'npm';
}

function printAnalysisResult(result: AnalysisResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('SBOM VULNERABILITY ANALYSIS RESULTS');
  console.log('='.repeat(60));

  console.log(`\nPackages analyzed: ${result.totalPackages}`);
  console.log(`Vulnerable packages: ${result.vulnerablePackages}`);

  console.log('\nVulnerability breakdown:');
  console.log(`  Critical: ${result.vulnerabilities.critical}`);
  console.log(`  High:     ${result.vulnerabilities.high}`);
  console.log(`  Medium:   ${result.vulnerabilities.medium}`);
  console.log(`  Low:      ${result.vulnerabilities.low}`);

  if (result.kevCount > 0) {
    console.log(`\n⚠️  KEV (Known Exploited): ${result.kevCount}`);
  }

  console.log(`\nRisk Score: ${result.summary.riskScore}/100`);
  console.log(`Risk Level: ${result.summary.riskLevel.toUpperCase()}`);

  if (result.summary.topRisks.length > 0) {
    console.log('\nTop Risks:');
    for (const risk of result.summary.topRisks) {
      console.log(`  - ${risk}`);
    }
  }

  if (result.summary.recommendations.length > 0) {
    console.log('\nRecommendations:');
    for (const rec of result.summary.recommendations) {
      console.log(`  • ${rec}`);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// SBOM Commands
const sbomCommand = new Command('sbom')
  .description('SBOM management commands');

sbomCommand
  .command('upload <file>')
  .description('Upload and analyze an SBOM file')
  .option('-f, --format <format>', 'SBOM format (cyclonedx, spdx, auto)', 'auto')
  .option('-n, --name <name>', 'Name for the SBOM')
  .option('--json', 'Output results as JSON')
  .action(async (file: string, options: { format: string; name?: string; json?: boolean }) => {
    try {
      const filePath = path.resolve(file);

      if (!fs.existsSync(filePath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      let format = options.format;
      if (format === 'auto') {
        format = detectSbomFormat(content);
        if (format === 'unknown') {
          console.error('Error: Could not detect SBOM format. Use --format to specify.');
          process.exit(1);
        }
        console.log(`Detected format: ${format}`);
      }

      // Parse the SBOM
      let packages: SbomPackage[];
      if (format === 'cyclonedx') {
        packages = parseCycloneDx(content);
      } else if (format === 'spdx') {
        packages = parseSpdx(content);
      } else {
        console.error(`Error: Unsupported format: ${format}`);
        process.exit(1);
      }

      console.log(`Found ${packages.length} packages in SBOM`);

      if (packages.length === 0) {
        console.log('No packages to analyze.');
        return;
      }

      console.log('Analyzing packages for vulnerabilities...');

      const result = await apiRequest('/sbom/analyze', {
        method: 'POST',
        body: JSON.stringify({ packages }),
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        printAnalysisResult(result);
      }

      // Exit with appropriate code based on risk
      if (result.summary.riskLevel === 'critical') {
        process.exit(2);
      } else if (result.summary.riskLevel === 'high') {
        process.exit(1);
      }

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

sbomCommand
  .command('check <name> <version>')
  .description('Check a single package for vulnerabilities')
  .option('-t, --type <type>', 'Package type (npm, pypi, maven, etc.)', 'npm')
  .option('--json', 'Output results as JSON')
  .action(async (name: string, version: string, options: { type: string; json?: boolean }) => {
    try {
      console.log(`Checking ${name}@${version} (${options.type})...`);

      const result = await apiRequest('/sbom/check-package', {
        method: 'POST',
        body: JSON.stringify({
          name,
          version,
          type: options.type,
        }),
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\nPackage: ${name}@${version}`);
        console.log(`Vulnerabilities found: ${result.vulnerabilities.length}`);

        if (result.vulnerabilities.length > 0) {
          console.log('\nVulnerabilities:');
          for (const vuln of result.vulnerabilities) {
            console.log(`  [${vuln.severity.toUpperCase()}] ${vuln.cveId}: ${vuln.title}`);
            if (vuln.fixedVersion) {
              console.log(`    Fixed in: ${vuln.fixedVersion}`);
            }
          }
        }

        console.log(`\nRisk Score: ${result.riskScore}/100`);
        console.log(`KEV: ${result.hasKEV ? 'Yes (actively exploited)' : 'No'}`);
        console.log(`Fix Available: ${result.fixAvailable ? 'Yes' : 'No'}`);
      }

      if (result.hasKEV || result.vulnerabilities.some((v: any) => v.severity === 'critical')) {
        process.exit(1);
      }

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

sbomCommand
  .command('generate')
  .description('Generate SBOM from package manager files')
  .option('-d, --dir <directory>', 'Project directory', '.')
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format (cyclonedx, spdx)', 'cyclonedx')
  .action(async (options: { dir: string; output?: string; format: string }) => {
    try {
      const dir = path.resolve(options.dir);

      console.log(`Scanning ${dir} for dependencies...`);

      // Check for package.json (npm)
      const packageJsonPath = path.join(dir, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const packages: SbomPackage[] = [];

        const addDeps = (deps: Record<string, string>, isDev = false) => {
          for (const [name, version] of Object.entries(deps || {})) {
            packages.push({
              name,
              version: version.replace(/^[\^~]/, ''),
              type: 'npm',
              purl: `pkg:npm/${name}@${version.replace(/^[\^~]/, '')}`,
            });
          }
        };

        addDeps(packageJson.dependencies);
        addDeps(packageJson.devDependencies, true);

        console.log(`Found ${packages.length} npm packages`);

        // Generate SBOM
        const sbom = {
          bomFormat: 'CycloneDX',
          specVersion: '1.4',
          version: 1,
          metadata: {
            timestamp: new Date().toISOString(),
            tools: [{ vendor: 'ThreatDiviner', name: 'CLI', version: '1.0.0' }],
            component: {
              type: 'application',
              name: packageJson.name || 'unknown',
              version: packageJson.version || '0.0.0',
            },
          },
          components: packages.map(pkg => ({
            type: 'library',
            name: pkg.name,
            version: pkg.version,
            purl: pkg.purl,
          })),
        };

        const output = options.output || 'sbom.json';
        fs.writeFileSync(output, JSON.stringify(sbom, null, 2));
        console.log(`SBOM written to ${output}`);

        return;
      }

      // Check for requirements.txt (pip)
      const requirementsPath = path.join(dir, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        const content = fs.readFileSync(requirementsPath, 'utf-8');
        const packages: SbomPackage[] = [];

        for (const line of content.split('\n')) {
          const match = line.trim().match(/^([^=<>!]+)([=<>!]+.*)?$/);
          if (match && !match[0].startsWith('#')) {
            const name = match[1].trim();
            const version = match[2]?.replace(/[=<>!]+/, '').trim() || 'unknown';
            packages.push({
              name,
              version,
              type: 'pypi',
              purl: `pkg:pypi/${name}@${version}`,
            });
          }
        }

        console.log(`Found ${packages.length} Python packages`);

        const sbom = {
          bomFormat: 'CycloneDX',
          specVersion: '1.4',
          version: 1,
          metadata: {
            timestamp: new Date().toISOString(),
            tools: [{ vendor: 'ThreatDiviner', name: 'CLI', version: '1.0.0' }],
          },
          components: packages.map(pkg => ({
            type: 'library',
            name: pkg.name,
            version: pkg.version,
            purl: pkg.purl,
          })),
        };

        const output = options.output || 'sbom.json';
        fs.writeFileSync(output, JSON.stringify(sbom, null, 2));
        console.log(`SBOM written to ${output}`);

        return;
      }

      console.log('No supported package files found (package.json, requirements.txt)');

    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Config Commands
const configCommand = new Command('config')
  .description('Configuration management');

configCommand
  .command('set-url <url>')
  .description('Set the API URL')
  .action((url: string) => {
    const config = loadConfig();
    config.apiUrl = url;
    saveConfig(config);
    console.log(`API URL set to: ${url}`);
  });

configCommand
  .command('set-token <token>')
  .description('Set the authentication token')
  .action((token: string) => {
    const config = loadConfig();
    config.token = token;
    saveConfig(config);
    console.log('Token saved successfully');
  });

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    console.log('Current configuration:');
    console.log(`  API URL: ${config.apiUrl}`);
    console.log(`  Token: ${config.token ? '***' + config.token.slice(-4) : '(not set)'}`);
  });

// Main program
program
  .name('threatdiviner')
  .description('ThreatDiviner CLI - Security vulnerability management')
  .version('1.0.0');

program.addCommand(sbomCommand);
program.addCommand(configCommand);

program.parse();
