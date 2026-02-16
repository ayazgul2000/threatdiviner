import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as yaml from 'js-yaml';

export interface ThreagileModel {
  threagile_version: string;
  title: string;
  date: string;
  author: {
    name: string;
    homepage?: string;
  };
  management_summary_comment?: string;
  business_criticality: string;
  business_overview: {
    description: string;
    images?: string[];
  };
  technical_overview: {
    description: string;
    images?: string[];
  };
  questions?: Record<string, string>;
  abuse_cases?: Record<string, string>;
  security_requirements?: Record<string, string>;
  tags_available?: string[];
  data_assets: Record<string, ThreagileDataAsset>;
  technical_assets: Record<string, ThreagileAsset>;
  trust_boundaries: Record<string, ThreagileTrustBoundary>;
  shared_runtimes?: Record<string, ThreagileSharedRuntime>;
  individual_risk_categories?: Record<string, any>;
}

export interface ThreagileDataAsset {
  id: string;
  description: string;
  usage: string;
  tags?: string[];
  origin?: string;
  owner?: string;
  quantity?: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  justification_cia_rating?: string;
}

export interface ThreagileAsset {
  id: string;
  description: string;
  type: string;
  usage: string;
  used_as_client_by_human: boolean;
  out_of_scope: boolean;
  justification_out_of_scope?: string;
  size: string;
  technology: string;
  machine: string;
  encryption: string;
  owner?: string;
  confidentiality: string;
  integrity: string;
  availability: string;
  justification_cia_rating?: string;
  multi_tenant: boolean;
  redundant: boolean;
  custom_developed_parts: boolean;
  data_assets_processed?: string[];
  data_assets_stored?: string[];
  data_formats_accepted?: string[];
  communication_links?: Record<string, ThreagileCommunicationLink>;
  tags?: string[];
}

export interface ThreagileCommunicationLink {
  target: string;
  description: string;
  protocol: string;
  authentication: string;
  authorization: string;
  tags?: string[];
  vpn?: boolean;
  ip_filtered?: boolean;
  readonly?: boolean;
  usage: string;
  data_assets_sent?: string[];
  data_assets_received?: string[];
}

export interface ThreagileTrustBoundary {
  id: string;
  description: string;
  type: string;
  tags?: string[];
  technical_assets_inside?: string[];
  trust_boundaries_nested?: string[];
}

export interface ThreagileSharedRuntime {
  id: string;
  description: string;
  tags?: string[];
  technical_assets_running?: string[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  componentId?: string;
  componentName?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  componentId?: string;
  componentName?: string;
}

@Injectable()
export class YamlGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate Threagile YAML from a threat model
   */
  async generateYaml(threatModelId: string, tenantId: string): Promise<string> {
    // Load threat model with all related data
    const threatModel = await this.prisma.threatModel.findFirst({
      where: {
        id: threatModelId,
        tenantId,
      },
      include: {
        components: true,
        dataFlows: {
          include: {
            source: true,
            target: true,
          },
        },
        project: true,
      },
    });

    if (!threatModel) {
      throw new Error(`Threat model ${threatModelId} not found`);
    }

    // Load shape mappings for technology resolution
    const shapeMappings = await this.prisma.shapeMapping.findMany({
      where: { status: 'live' },
    });

    const shapeMappingMap = new Map(
      shapeMappings.map(m => [m.drawioStyle.toLowerCase(), m])
    );

    // Build Threagile model
    const threagileModel = this.buildThreagileModel(
      threatModel,
      shapeMappingMap
    );

    // Convert to YAML
    const yamlContent = yaml.dump(threagileModel, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      quotingType: '"',
    });

    return yamlContent;
  }

  /**
   * Validate a threat model before generating YAML
   */
  async validateModel(threatModelId: string, tenantId: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const threatModel = await this.prisma.threatModel.findFirst({
      where: {
        id: threatModelId,
        tenantId,
      },
      include: {
        components: true,
        dataFlows: {
          include: {
            source: true,
            target: true,
          },
        },
      },
    });

    if (!threatModel) {
      return {
        valid: false,
        errors: [{ field: 'threatModel', message: 'Threat model not found' }],
        warnings: [],
      };
    }

    // Check for required fields
    if (!threatModel.name) {
      errors.push({ field: 'name', message: 'Threat model name is required' });
    }

    if (threatModel.components.length === 0) {
      errors.push({ field: 'components', message: 'At least one component is required' });
    }

    // Load shape mappings
    const shapeMappings = await this.prisma.shapeMapping.findMany({
      where: { status: 'live' },
    });
    const shapeMappingMap = new Map(
      shapeMappings.map(m => [m.drawioStyle.toLowerCase(), m])
    );

    // Validate each component
    for (const component of threatModel.components) {
      // Check for technology mapping
      const technology = (component.technology || '').toLowerCase();
      if (technology && !shapeMappingMap.has(technology)) {
        warnings.push({
          field: 'technology',
          message: `Technology "${component.technology}" has no shape mapping - will use default`,
          componentId: component.id,
          componentName: component.name,
        });
      }

      // Check required component fields
      if (!component.name) {
        errors.push({
          field: 'name',
          message: 'Component name is required',
          componentId: component.id,
        });
      }

      if (!component.type) {
        errors.push({
          field: 'type',
          message: 'Component type is required',
          componentId: component.id,
          componentName: component.name,
        });
      }
    }

    // Validate data flows
    for (const flow of threatModel.dataFlows) {
      if (!flow.sourceId || !flow.targetId) {
        errors.push({
          field: 'dataFlow',
          message: 'Data flow must have source and target',
          componentId: flow.id,
        });
      }

      // Check if source and target exist
      const sourceExists = threatModel.components.some(c => c.id === flow.sourceId);
      const targetExists = threatModel.components.some(c => c.id === flow.targetId);

      if (!sourceExists) {
        errors.push({
          field: 'sourceId',
          message: `Data flow source component not found`,
          componentId: flow.id,
        });
      }

      if (!targetExists) {
        errors.push({
          field: 'targetId',
          message: `Data flow target component not found`,
          componentId: flow.id,
        });
      }

      // Warn if no protocol specified
      if (!flow.protocol) {
        warnings.push({
          field: 'protocol',
          message: 'No protocol specified for data flow - will default to HTTPS',
          componentId: flow.id,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Build Threagile model structure
   */
  private buildThreagileModel(
    threatModel: any,
    shapeMappings: Map<string, any>
  ): ThreagileModel {
    const now = new Date().toISOString().split('T')[0];

    // Group components by type for trust boundaries
    const trustBoundaries = this.buildTrustBoundaries(threatModel.components);
    const technicalAssets = this.buildTechnicalAssets(
      threatModel.components,
      threatModel.dataFlows,
      shapeMappings
    );
    const dataAssets = this.buildDataAssets(threatModel.dataFlows);

    // Collect all tags used by technical assets for tags_available
    const allTags = new Set<string>();
    for (const asset of Object.values(technicalAssets)) {
      if (asset.tags) {
        for (const tag of asset.tags) {
          allTags.add(tag);
        }
      }
    }

    return {
      threagile_version: '1.0.0',
      title: threatModel.name,
      date: now,
      author: {
        name: 'ThreatDiviner',
        homepage: 'https://threatdiviner.io',
      },
      management_summary_comment: threatModel.description || '',
      business_criticality: this.mapBusinessCriticality(threatModel.businessCriticality),
      business_overview: {
        description: threatModel.description || 'Threat model created by ThreatDiviner',
      },
      technical_overview: {
        description: `Technical architecture with ${threatModel.components.length} components and ${threatModel.dataFlows.length} data flows`,
      },
      tags_available: allTags.size > 0 ? Array.from(allTags) : undefined,
      data_assets: dataAssets,
      technical_assets: technicalAssets,
      trust_boundaries: trustBoundaries,
    };
  }

  /**
   * Build technical assets from components
   */
  private buildTechnicalAssets(
    components: any[],
    dataFlows: any[],
    shapeMappings: Map<string, any>
  ): Record<string, ThreagileAsset> {
    const assets: Record<string, ThreagileAsset> = {};

    for (const component of components) {
      const assetId = this.sanitizeId(component.name);
      const mapping = this.getShapeMapping(component.technology, shapeMappings);

      // Build communication links for this component
      const communicationLinks: Record<string, ThreagileCommunicationLink> = {};
      const outgoingFlows = dataFlows.filter(f => f.sourceId === component.id);

      for (const flow of outgoingFlows) {
        const linkId = this.sanitizeId(flow.label || `${component.name}-to-${flow.target.name}`);
        communicationLinks[linkId] = {
          target: this.sanitizeId(flow.target.name),
          description: flow.label || `Connection from ${component.name} to ${flow.target.name}`,
          protocol: this.mapProtocol(flow.protocol),
          authentication: flow.authentication ? 'credentials' : 'none',
          authorization: 'none',
          usage: 'business',
          vpn: false,
          ip_filtered: false,
          readonly: false,
        };
      }

      assets[assetId] = {
        id: assetId,
        description: component.description || `${component.name} component`,
        type: this.mapComponentType(component.type),
        usage: 'business',
        used_as_client_by_human: component.type === 'external_entity',
        out_of_scope: false,
        size: 'component',
        technology: mapping?.threagileType || this.mapTechnology(component.technology),
        machine: mapping?.machineType || 'virtual',
        encryption: mapping?.defaultEncryption || 'none',
        confidentiality: this.mapConfidentiality(component.criticality),
        integrity: this.mapIntegrityAvailability(component.criticality),
        availability: this.mapIntegrityAvailability(component.criticality),
        multi_tenant: mapping?.defaultMultiTenant || false,
        redundant: false,
        custom_developed_parts: component.type === 'process',
        communication_links: Object.keys(communicationLinks).length > 0 ? communicationLinks : undefined,
        tags: component.technology ? [component.technology] : [],
      };
    }

    return assets;
  }

  /**
   * Build data assets from data flows
   */
  private buildDataAssets(dataFlows: any[]): Record<string, ThreagileDataAsset> {
    const assets: Record<string, ThreagileDataAsset> = {};
    const seenDataTypes = new Set<string>();

    for (const flow of dataFlows) {
      const dataType = flow.dataType || 'business-data';
      if (seenDataTypes.has(dataType)) continue;
      seenDataTypes.add(dataType);

      const assetId = this.sanitizeId(dataType);
      assets[assetId] = {
        id: assetId,
        description: `${dataType} data transferred between components`,
        usage: 'business',
        quantity: 'few',
        confidentiality: flow.encryption ? 'confidential' : 'internal',
        integrity: 'important',
        availability: 'important',
      };
    }

    // Add default data asset if none exist
    if (Object.keys(assets).length === 0) {
      assets['business-data'] = {
        id: 'business-data',
        description: 'General business data',
        usage: 'business',
        quantity: 'few',
        confidentiality: 'internal',
        integrity: 'important',
        availability: 'important',
      };
    }

    return assets;
  }

  /**
   * Build trust boundaries from components
   */
  private buildTrustBoundaries(components: any[]): Record<string, ThreagileTrustBoundary> {
    const boundaries: Record<string, ThreagileTrustBoundary> = {};

    // Group internal components by criticality (exclude external entities — they go in external boundary)
    const internal = components.filter((c: any) => c.type !== 'external_entity');
    const criticalComponents = internal.filter((c: any) => c.criticality === 'critical');
    const highComponents = internal.filter((c: any) => c.criticality === 'high');
    const mediumComponents = internal.filter((c: any) => c.criticality === 'medium');

    // Create internal network boundary for critical/high components
    if (criticalComponents.length > 0 || highComponents.length > 0) {
      boundaries['internal-network'] = {
        id: 'internal-network',
        description: 'Internal network containing critical components',
        type: 'network-cloud-security-group',
        technical_assets_inside: [
          ...criticalComponents.map(c => this.sanitizeId(c.name)),
          ...highComponents.map(c => this.sanitizeId(c.name)),
        ],
      };
    }

    // Create DMZ boundary for medium criticality components that might be external-facing
    if (mediumComponents.length > 0) {
      boundaries['dmz'] = {
        id: 'dmz',
        description: 'DMZ for external-facing components',
        type: 'network-cloud-security-group',
        technical_assets_inside: mediumComponents.map(c => this.sanitizeId(c.name)),
      };
    }

    // External boundary for low criticality/external entities
    const externalEntities = components.filter(c => c.type === 'external_entity');
    if (externalEntities.length > 0) {
      boundaries['external'] = {
        id: 'external',
        description: 'External network',
        type: 'network-on-prem',
        technical_assets_inside: externalEntities.map(c => this.sanitizeId(c.name)),
      };
    }

    return boundaries;
  }

  /**
   * Get shape mapping for a technology
   */
  private getShapeMapping(technology: string | null, mappings: Map<string, any>): any | null {
    if (!technology) return null;
    return mappings.get(technology.toLowerCase()) || null;
  }

  /**
   * Sanitize string to be a valid Threagile ID
   */
  private sanitizeId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Map component type to Threagile type
   */
  private mapComponentType(type: string): string {
    const mapping: Record<string, string> = {
      'process': 'process',
      'datastore': 'datastore',
      'data_store': 'datastore',
      'external_entity': 'external-entity',
      'web_application': 'process',
      'service': 'process',
      'database': 'datastore',
      'api': 'process',
      'gateway': 'process',
      'message_queue': 'datastore',
      'cache': 'datastore',
    };
    return mapping[type?.toLowerCase()] || 'process';
  }

  /**
   * Map technology to Threagile technology
   */
  private mapTechnology(technology: string | null): string {
    if (!technology) return 'unknown-technology';

    const tech = technology.toLowerCase();

    // Exact match lookup
    const mapping: Record<string, string> = {
      'ec2': 'web-server',
      'rds': 'database',
      's3': 'file-server',
      'lambda': 'function',
      'api-gateway': 'gateway',
      'dynamodb': 'database',
      'cloudfront': 'reverse-proxy',
      'sqs': 'message-queue',
      'sns': 'message-queue',
      'eks': 'container-platform',
      'ecs': 'container-platform',
      'azure-vm': 'web-server',
      'azure-sql': 'database',
      'azure-storage': 'file-server',
      'gcp-compute': 'web-server',
      'gcp-cloud-sql': 'database',
      'kubernetes': 'container-platform',
      'docker': 'container-platform',
      'nginx': 'web-server',
      'apache': 'web-server',
      'nodejs': 'web-application',
      'python': 'web-application',
      'java': 'application-server',
      'postgresql': 'database',
      'mysql': 'database',
      'mongodb': 'database',
      'redis': 'database',
      'kafka': 'message-queue',
      'rabbitmq': 'message-queue',
      'browser': 'browser',
      'react': 'web-application',
      'angular': 'web-application',
      'vue': 'web-application',
      'express': 'web-application',
      'spring': 'application-server',
      'django': 'web-application',
      'flask': 'web-application',
      'gateway': 'gateway',
      'load-balancer': 'load-balancer',
      'vault': 'vault',
      'waf': 'waf',
    };

    if (mapping[tech]) return mapping[tech];

    // Keyword-based fallback for multi-word technology names
    if (tech.includes('browser')) return 'browser';
    if (tech.includes('react') || tech.includes('angular') || tech.includes('vue') || tech.includes('spa')) return 'web-application';
    if (tech.includes('node') || tech.includes('express') || tech.includes('django') || tech.includes('flask')) return 'web-application';
    if (tech.includes('spring') || tech.includes('java') || tech.includes('.net')) return 'application-server';
    if (tech.includes('postgres') || tech.includes('mysql') || tech.includes('sql') || tech.includes('mongo') || tech.includes('database') || tech.includes('db')) return 'database';
    if (tech.includes('redis') || tech.includes('cache') || tech.includes('memcache')) return 'database';
    if (tech.includes('kafka') || tech.includes('rabbit') || tech.includes('queue') || tech.includes('sqs')) return 'message-queue';
    if (tech.includes('nginx') || tech.includes('apache') || tech.includes('web server')) return 'web-server';
    if (tech.includes('api') || tech.includes('rest') || tech.includes('graphql')) return 'web-service-rest';
    if (tech.includes('gateway')) return 'gateway';
    if (tech.includes('docker') || tech.includes('container') || tech.includes('k8s') || tech.includes('kubernetes')) return 'container-platform';
    if (tech.includes('lambda') || tech.includes('function') || tech.includes('serverless')) return 'function';
    if (tech.includes('s3') || tech.includes('storage') || tech.includes('blob')) return 'file-server';
    if (tech.includes('stripe') || tech.includes('payment') || tech.includes('external')) return 'web-service-rest';
    if (tech.includes('ldap') || tech.includes('active directory')) return 'ldap-server';
    if (tech.includes('mail') || tech.includes('smtp') || tech.includes('email')) return 'mail-server';

    return 'unknown-technology';
  }

  /**
   * Map protocol to Threagile protocol
   */
  private mapProtocol(protocol: string | null): string {
    if (!protocol) return 'https';

    const mapping: Record<string, string> = {
      'http': 'http',
      'https': 'https',
      'tcp': 'binary',
      'udp': 'binary',
      'grpc': 'binary',
      'websocket': 'ws',
      'ws': 'ws',
      'wss': 'wss',
      'mqtt': 'mqtt',
      'amqp': 'binary',
      'jdbc': 'jdbc',
      'odbc': 'odbc',
      'ldap': 'ldap',
      'ldaps': 'ldaps',
      'ssh': 'ssh',
      'sftp': 'sftp',
      'ftp': 'ftp',
      'ftps': 'ftps',
      'smtp': 'smtp',
      'smtps': 'smtp-encrypted',
      'sql': 'sql-access-protocol',
      'nosql': 'nosql-access-protocol',
      'nfs': 'nfs',
      'smb': 'smb',
    };

    return mapping[protocol.toLowerCase()] || 'https';
  }

  /**
   * Map criticality to Threagile confidentiality rating
   * Valid: public, internal, restricted, confidential, strictly-confidential
   */
  private mapConfidentiality(criticality: string | null): string {
    const mapping: Record<string, string> = {
      'critical': 'strictly-confidential',
      'high': 'confidential',
      'medium': 'internal',
      'low': 'public',
    };
    return mapping[criticality?.toLowerCase() || ''] || 'internal';
  }

  /**
   * Map criticality to Threagile integrity/availability rating
   * Valid: archive, operational, important, critical, mission-critical
   */
  private mapIntegrityAvailability(criticality: string | null): string {
    const mapping: Record<string, string> = {
      'critical': 'mission-critical',
      'high': 'critical',
      'medium': 'important',
      'low': 'operational',
    };
    return mapping[criticality?.toLowerCase() || ''] || 'important';
  }

  /**
   * Map business criticality to Threagile business criticality
   */
  private mapBusinessCriticality(criticality: string | null): string {
    const mapping: Record<string, string> = {
      'mission-critical': 'mission-critical',
      'critical': 'critical',
      'important': 'important',
      'archive': 'archive',
    };
    return mapping[criticality?.toLowerCase() || ''] || 'important';
  }
}
