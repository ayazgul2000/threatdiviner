import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenApiParser } from '../parsers/openapi.parser';
import { TerraformParser } from '../parsers/terraform.parser';
import { PackageJsonParser } from '../parsers/package-json.parser';
import { DiagramSyncService } from './diagram-sync.service';
import { ThreatModelingService } from '../threat-modeling.service';
import { CryptoService } from '../../scm/services/crypto.service';
import { GitHubProvider } from '../../scm/providers';

export type ImportFileType = 'openapi' | 'terraform' | 'drawio' | 'package.json';

export interface ParsedComponent {
  name: string;
  type: string;
  description?: string;
  technology?: string;
  dataClassification?: string;
  criticality?: string;
}

export interface ParsedDataFlow {
  sourceName: string;
  targetName: string;
  protocol?: string;
  dataType?: string;
  authenticated?: boolean;
  encrypted?: boolean;
}

export interface ImportPreviewResult {
  fileType: ImportFileType;
  title: string;
  description?: string;
  components: ParsedComponent[];
  dataFlows: ParsedDataFlow[];
  securityConcerns: string[];
  metadata?: Record<string, unknown>;
}

export interface ImportCreateResult {
  threatModel: { id: string; name: string };
  componentsCreated: number;
  dataFlowsCreated: number;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly openApiParser: OpenApiParser,
    private readonly terraformParser: TerraformParser,
    private readonly packageJsonParser: PackageJsonParser,
    private readonly diagramSyncService: DiagramSyncService,
    private readonly threatModelingService: ThreatModelingService,
    private readonly cryptoService: CryptoService,
    private readonly githubProvider: GitHubProvider,
  ) {}

  /**
   * Detect file type from content and filename
   */
  detectFileType(filename: string, content: string): ImportFileType | null {
    const lowerFilename = filename.toLowerCase();
    const basename = lowerFilename.split('/').pop() || lowerFilename;

    // Check for package.json
    if (basename === 'package.json') {
      if (this.packageJsonParser.isValidPackageJson(content)) {
        return 'package.json';
      }
      return null;
    }

    // Check extension first
    if (lowerFilename.endsWith('.tf') || lowerFilename.endsWith('.hcl')) {
      return 'terraform';
    }
    if (lowerFilename.endsWith('.drawio') || lowerFilename.endsWith('.xml')) {
      // Check if it's actually a Draw.io file
      if (content.includes('<mxfile') || content.includes('<mxGraphModel')) {
        return 'drawio';
      }
      return null;
    }

    // Check for valid OpenAPI spec
    if (lowerFilename.endsWith('.yaml') || lowerFilename.endsWith('.yml') || lowerFilename.endsWith('.json')) {
      if (this.openApiParser.isValidOpenApiSpec(content)) {
        return 'openapi';
      }
      return null;
    }

    // Check for Terraform content
    if (
      content.includes('resource "') ||
      content.includes('provider "') ||
      content.includes('terraform {')
    ) {
      return 'terraform';
    }

    return null;
  }

  /**
   * Parse file content and return preview without creating anything
   */
  async parseFile(
    filename: string,
    content: string,
    fileType?: ImportFileType | null,
  ): Promise<ImportPreviewResult> {
    const detectedType = fileType ?? this.detectFileType(filename, content);

    if (!detectedType) {
      throw new BadRequestException(
        `Unsupported or invalid file: ${filename}. Supported types: OpenAPI (yaml/json with openapi/swagger field), Terraform (.tf), Draw.io (.drawio/.xml), package.json`,
      );
    }

    switch (detectedType) {
      case 'openapi':
        return this.parseOpenApi(content);
      case 'terraform':
        return this.parseTerraform(content);
      case 'drawio':
        return this.parseDrawio(content);
      case 'package.json':
        return this.parsePackageJson(content);
      default:
        throw new BadRequestException(`Unsupported file type: ${detectedType}`);
    }
  }

  /**
   * Parse package.json to detect technologies
   */
  private async parsePackageJson(content: string): Promise<ImportPreviewResult> {
    const result = await this.packageJsonParser.parse(content);

    return {
      fileType: 'package.json',
      title: result.name,
      description: result.description || `Technology stack from ${result.name}`,
      components: result.components.map((c) => ({
        name: c.name,
        type: this.mapComponentType(c.type),
        technology: c.technology,
        description: c.description,
        dataClassification: c.dataClassification,
      })),
      dataFlows: result.dataFlows.map((f) => ({
        sourceName: f.source,
        targetName: f.target,
        protocol: f.protocol,
        dataType: f.dataType,
        authenticated: f.authenticated,
      })),
      securityConcerns: [],
      metadata: {
        technologies: result.technologies.map((t) => ({
          name: t.name,
          type: t.type,
          category: t.category,
          version: t.version,
        })),
      },
    };
  }

  /**
   * Parse OpenAPI specification
   */
  private async parseOpenApi(content: string): Promise<ImportPreviewResult> {
    const result = await this.openApiParser.parse(content);
    const concerns = this.openApiParser.identifySecurityConcerns(result);

    return {
      fileType: 'openapi',
      title: result.title,
      description: result.description,
      components: result.components.map((c) => ({
        name: c.name,
        type: this.mapComponentType(c.type),
        description: c.description,
        dataClassification: c.dataClassification,
      })),
      dataFlows: this.deduplicateDataFlows(
        result.dataFlows.map((f) => ({
          sourceName: f.source,
          targetName: f.target,
          protocol: f.protocol,
          dataType: f.dataType,
          authenticated: f.authenticated,
        })),
      ),
      securityConcerns: concerns,
      metadata: {
        version: result.version,
        servers: result.servers,
        endpointCount: result.endpoints.length,
        securitySchemes: Object.keys(result.securitySchemes),
      },
    };
  }

  /**
   * Parse Terraform configuration
   */
  private async parseTerraform(content: string): Promise<ImportPreviewResult> {
    const result = await this.terraformParser.parse(content);
    const concerns = this.terraformParser.identifySecurityConcerns(result.resources);

    return {
      fileType: 'terraform',
      title: `${result.provider.toUpperCase()} Infrastructure`,
      description: `Imported from Terraform configuration with ${result.resources.length} resources`,
      components: result.components.map((c) => ({
        name: c.name,
        type: this.mapComponentType(c.type),
        description: c.description,
        technology: c.technology,
        dataClassification: c.dataClassification,
        criticality: c.criticality,
      })),
      dataFlows: this.deduplicateDataFlows(
        result.dataFlows.map((f) => ({
          sourceName: f.source,
          targetName: f.target,
          protocol: f.protocol,
          dataType: f.dataType,
          authenticated: f.authenticated,
          encrypted: f.encrypted,
        })),
      ),
      securityConcerns: concerns,
      metadata: {
        provider: result.provider,
        resourceCount: result.resources.length,
        securityGroupCount: result.securityGroups.length,
      },
    };
  }

  /**
   * Parse Draw.io diagram
   */
  private async parseDrawio(content: string): Promise<ImportPreviewResult> {
    try {
      const decodedXml = this.diagramSyncService.decodeMxFileXml(content);
      const parsed = await this.diagramSyncService.parseMxGraphModel(decodedXml);

      if (!parsed) {
        throw new BadRequestException('Failed to parse Draw.io diagram');
      }

      const components: ParsedComponent[] = [];
      const vertexIdToName = new Map<string, string>();

      // Parse vertices as components
      for (const vertex of parsed.vertices) {
        const id = vertex.$.id;
        const name = this.stripHtml(vertex.$.value) || `Component ${id}`;
        const type = this.diagramSyncService.resolveComponentType(vertex.$.style);

        vertexIdToName.set(id, name);

        components.push({
          name,
          type: this.mapComponentType(type),
          description: `Imported from Draw.io diagram`,
        });
      }

      // Parse edges as data flows
      const dataFlows: ParsedDataFlow[] = [];
      for (const edge of parsed.edges) {
        const sourceId = edge.$.source;
        const targetId = edge.$.target;

        if (!sourceId || !targetId) continue;

        const sourceName = vertexIdToName.get(sourceId);
        const targetName = vertexIdToName.get(targetId);

        if (!sourceName || !targetName) continue;

        const label = this.stripHtml(edge.$.value);

        dataFlows.push({
          sourceName,
          targetName,
          protocol: label || undefined,
          dataType: 'Data',
        });
      }

      return {
        fileType: 'drawio',
        title: 'Draw.io Diagram',
        description: `Imported Draw.io diagram with ${components.length} components`,
        components,
        dataFlows,
        securityConcerns: [],
        metadata: {
          vertexCount: parsed.vertices.length,
          edgeCount: parsed.edges.length,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to parse Draw.io: ${message}`);
      throw new BadRequestException(`Invalid Draw.io file: ${message}`);
    }
  }

  /**
   * Parse files from a repository
   */
  async parseRepository(
    repositoryId: string,
    tenantId: string,
    filePaths?: string[],
  ): Promise<ImportPreviewResult[]> {
    // Get repository with connection
    const repo = await this.prisma.repository.findFirst({
      where: { id: repositoryId, tenantId },
      include: { connection: true },
    });

    if (!repo) {
      throw new BadRequestException('Repository not found');
    }

    if (!repo.connection) {
      throw new BadRequestException('Repository has no SCM connection');
    }

    // Only GitHub is supported for now
    if (repo.connection.provider !== 'github') {
      throw new BadRequestException(
        `Repository scanning only supports GitHub currently. Found: ${repo.connection.provider}`,
      );
    }

    // Decrypt access token
    const accessToken = this.cryptoService.decrypt(repo.connection.accessToken);

    // Parse owner/repo from fullName (e.g., "owner/repo")
    const [owner, repoName] = repo.fullName.split('/');
    if (!owner || !repoName) {
      throw new BadRequestException(`Invalid repository name format: ${repo.fullName}`);
    }

    // Default branch
    const defaultBranch = repo.defaultBranch || 'main';

    this.logger.log(
      `Scanning repository ${repo.fullName} (branch: ${defaultBranch}) for parseable files...`,
    );

    // If specific file paths are provided, use them
    // Otherwise, scan the repository tree to find parseable files
    let pathsToCheck: string[] = [];

    if (filePaths?.length) {
      pathsToCheck = filePaths;
      this.logger.log(`Using provided file paths: ${pathsToCheck.join(', ')}`);
    } else {
      // Get repository tree and find parseable files
      const tree = await this.githubProvider.getRepositoryTree(
        accessToken,
        owner,
        repoName,
        defaultBranch,
      );

      this.logger.log(`Repository has ${tree.length} files`);

      // Filter for parseable file types
      const parseableExtensions = [
        '.yaml', '.yml', '.json', // OpenAPI
        '.tf', '.hcl', // Terraform
        '.drawio', '.xml', // Draw.io
      ];

      // Prioritize package.json files first, then other parseable files
      const packageJsonFiles = tree
        .filter((file) => file.path.toLowerCase().endsWith('package.json'))
        .map((file) => file.path);

      const otherParseableFiles = tree
        .filter((file) => {
          const lowerPath = file.path.toLowerCase();
          // Skip package.json (already handled) and node_modules
          if (lowerPath.includes('node_modules/') || lowerPath.endsWith('package.json')) {
            return false;
          }
          return parseableExtensions.some((ext) => lowerPath.endsWith(ext));
        })
        .map((file) => file.path);

      // Package.json first for tech detection, then other files
      pathsToCheck = [...packageJsonFiles, ...otherParseableFiles];

      this.logger.log(
        `Found ${pathsToCheck.length} potentially parseable files: ${pathsToCheck.slice(0, 10).join(', ')}${pathsToCheck.length > 10 ? '...' : ''}`,
      );
    }

    const results: ImportPreviewResult[] = [];
    const errors: string[] = [];

    for (const path of pathsToCheck) {
      try {
        const fileData = await this.githubProvider.getFileContent(
          accessToken,
          owner,
          repoName,
          path,
          defaultBranch,
        );

        if (fileData?.content) {
          // Try to parse the file - not all yaml/json files are OpenAPI specs
          try {
            const preview = await this.parseFile(path, fileData.content);
            this.logger.log(`Successfully parsed: ${path}`);
            preview.title = `${path} - ${preview.title}`;
            results.push(preview);
          } catch (parseErr) {
            // File couldn't be parsed as a known format - skip silently
            this.logger.debug(`File ${path} is not a supported format: ${parseErr}`);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('Not Found') && !message.includes('404')) {
          errors.push(`${path}: ${message}`);
        }
      }
    }

    if (results.length === 0) {
      if (errors.length > 0) {
        throw new BadRequestException(
          `Failed to parse repository files: ${errors.join('; ')}`,
        );
      }
      this.logger.warn(
        `No parseable files found in ${repo.fullName}@${defaultBranch}. Checked ${pathsToCheck.length} files.`,
      );
    } else {
      this.logger.log(`Found ${results.length} parseable file(s) in ${repo.fullName}@${defaultBranch}`);
    }

    return results;
  }

  /**
   * Create a threat model from parsed import result
   */
  async createFromImport(
    tenantId: string,
    userId: string,
    projectId: string,
    importResult: ImportPreviewResult,
    name: string,
    description?: string,
    methodology?: string,
  ): Promise<ImportCreateResult> {
    // Create the threat model
    const threatModel = await this.threatModelingService.createThreatModel(
      tenantId,
      userId,
      {
        name,
        projectId,
        description:
          description || importResult.description || `Imported from ${importResult.fileType}`,
        methodology: methodology || 'stride',
      },
    );

    // Build name to ID map for linking data flows
    const nameToComponentId = new Map<string, string>();

    // Create components
    for (const comp of importResult.components) {
      const created = await this.threatModelingService.addComponent(
        tenantId,
        threatModel.id,
        {
          name: comp.name,
          type: comp.type,
          technology: comp.technology,
          description: comp.description,
          dataClassification: comp.dataClassification,
          criticality: comp.criticality,
        },
      );
      nameToComponentId.set(comp.name, created.id);
    }

    // Create data flows
    let dataFlowsCreated = 0;
    for (const flow of importResult.dataFlows) {
      const sourceId = nameToComponentId.get(flow.sourceName);
      const targetId = nameToComponentId.get(flow.targetName);

      if (sourceId && targetId) {
        await this.threatModelingService.addDataFlow(tenantId, threatModel.id, {
          sourceId,
          targetId,
          protocol: flow.protocol,
          dataType: flow.dataType,
          authentication: flow.authenticated ?? false,
          encryption: flow.encrypted ?? false,
        });
        dataFlowsCreated++;
      }
    }

    return {
      threatModel: {
        id: threatModel.id,
        name: threatModel.name,
      },
      componentsCreated: importResult.components.length,
      dataFlowsCreated,
    };
  }

  /**
   * Map component type to standard types
   */
  private mapComponentType(type: string): string {
    const mapping: Record<string, string> = {
      process: 'process',
      datastore: 'data_store',
      data_store: 'data_store',
      external_entity: 'external_entity',
      external: 'external_entity',
      service: 'service',
      api: 'api',
    };
    return mapping[type.toLowerCase()] || 'process';
  }

  /**
   * Remove duplicate data flows
   */
  private deduplicateDataFlows(flows: ParsedDataFlow[]): ParsedDataFlow[] {
    const seen = new Set<string>();
    return flows.filter((flow) => {
      const key = `${flow.sourceName}|${flow.targetName}|${flow.protocol || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Strip HTML tags from values
   */
  private stripHtml(value: string | undefined): string {
    if (!value) return '';
    return value
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}
