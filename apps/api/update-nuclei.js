const fs = require('fs');
const path = 'C:/dev/threatdiviner/apps/api/src/scanners/pentest/nuclei/nuclei.scanner.ts';

const newConstants = `
// Technology to template mappings for focused scans
const TECH_TEMPLATE_MAP = {
  apache: ['http/apache', 'http/cves/apache'],
  nginx: ['http/nginx', 'http/cves/nginx'],
  tomcat: ['http/tomcat', 'http/cves/tomcat'],
  wordpress: ['http/wordpress', 'http/cves/wordpress'],
  jenkins: ['http/jenkins', 'http/cves/jenkins'],
  spring: ['http/spring', 'http/cves/spring'],
  php: ['http/php', 'http/cves/php'],
  swagger: ['http/exposures/apis'],
  graphql: ['http/graphql'],
};

`;

const newMethods = `
  /** Get templates for discovery phase */
  getDiscoveryTemplates() {
    return ['http/technologies', 'http/exposed-panels', 'http/cves'];
  }

  /** Get focused templates based on detected technologies */
  getFocusedTemplates(detectedTechs) {
    const templates = new Set();
    for (const tech of detectedTechs) {
      const techLower = tech.toLowerCase();
      for (const [key, templateList] of Object.entries(TECH_TEMPLATE_MAP)) {
        if (techLower.includes(key)) {
          templateList.forEach(t => templates.add(t));
        }
      }
    }
    templates.add('http/vulnerabilities');
    templates.add('http/exposures');
    return Array.from(templates);
  }

  /** Extract detected technologies from scan findings */
  extractDetectedTechnologies(findings) {
    const technologies = new Set();
    const techPatterns = Object.keys(TECH_TEMPLATE_MAP);
    for (const finding of findings) {
      const tags = finding.metadata?.tags || [];
      for (const tag of tags) {
        for (const tech of techPatterns) {
          if (tag.toLowerCase().includes(tech)) technologies.add(tech);
        }
      }
      for (const tech of techPatterns) {
        if (finding.title.toLowerCase().includes(tech)) technologies.add(tech);
      }
    }
    return Array.from(technologies);
  }

`;

let content = fs.readFileSync(path, 'utf8');

// Add constants after the interface closing brace
content = content.replace(
  "'matcher-status': boolean;\n}",
  "'matcher-status': boolean;\n}" + newConstants
);

// Add methods after getVersion
content = content.replace(
  "return '3.3.7';\n    }\n  }\n\n  async scan",
  "return '3.3.7';\n    }\n  }" + newMethods + "\n  async scan"
);

// Update scan method to use phase
content = content.replace(
  "async scan(context: ScanContext): Promise<ScanOutput> {\n    const outputFile = path.join(context.workDir, 'nuclei-results.jsonl');",
  `async scan(context: ScanContext): Promise<ScanOutput> {
    const phase = context.config?.scanPhase || 'both';
    const detectedTechs = context.config?.detectedTechnologies || [];
    const outputFile = path.join(context.workDir, 'nuclei-results.jsonl');`
);

// Update targets normalization
content = content.replace(
  "// Create targets file\n    const targetsFile = path.join(context.workDir, 'nuclei-targets.txt');\n    await fs.writeFile(targetsFile, targetUrls.join('\\n'));",
  `// Normalize URLs and create targets file
    const normalizedUrls = targetUrls.map(url => url.replace(/localhost/gi, '127.0.0.1'));
    this.logger.log('Nuclei targeting [' + phase + ']: ' + normalizedUrls.join(', '));
    const targetsFile = path.join(context.workDir, 'nuclei-targets.txt');
    await fs.writeFile(targetsFile, normalizedUrls.join('\\n'));`
);

// Update args and template selection
content = content.replace(
  `const args = [
      '-l', targetsFile,
      '-jsonl',
      '-o', outputFile,
      '-severity', 'critical,high,medium,low,info',
      '-timeout', '30',
      '-rate-limit', '50',
      '-bulk-size', '25',
      '-concurrency', '10',
      '-silent',
    ];

    // Use specific templates if configured
    const templates = this.configService.get('NUCLEI_TEMPLATES', '');
    if (templates) {
      args.push('-t', templates);
    }`,
  `const args = [
      '-l', targetsFile,
      '-jsonl',
      '-o', outputFile,
      '-timeout', '15',
      '-rate-limit', '20',
      '-bulk-size', '15',
      '-concurrency', '5',
      '-silent',
      '-no-color',
    ];

    // Select templates based on scan phase
    let templates;
    if (phase === 'discovery') {
      templates = this.getDiscoveryTemplates();
      this.logger.log('Running discovery phase');
    } else if (phase === 'deep' && detectedTechs.length > 0) {
      templates = this.getFocusedTemplates(detectedTechs);
      this.logger.log('Running deep phase for: ' + detectedTechs.join(', '));
      args.push('-severity', 'critical,high,medium');
    } else {
      templates = [...this.getDiscoveryTemplates(), 'http/vulnerabilities', 'http/exposures'];
      this.logger.log('Running combined scan');
    }

    for (const t of templates) args.push('-t', t);
    this.logger.log('Templates: ' + templates.join(', '));`
);

fs.writeFileSync(path, content);
console.log('Nuclei scanner updated with two-phase support');
