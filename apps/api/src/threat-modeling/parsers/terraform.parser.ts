import { Injectable, Logger } from '@nestjs/common';

export interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  config: Record<string, any>;
  dependencies: string[];
}

export interface TerraformParseResult {
  provider: string;
  resources: TerraformResource[];
  components: {
    name: string;
    type: string;
    description: string;
    technology: string;
    dataClassification: string;
    criticality: string;
  }[];
  dataFlows: {
    source: string;
    target: string;
    protocol: string;
    dataType: string;
    authenticated: boolean;
    encrypted: boolean;
  }[];
  securityGroups: {
    name: string;
    rules: {
      type: 'ingress' | 'egress';
      protocol: string;
      port: string;
      cidr: string;
    }[];
  }[];
}

@Injectable()
export class TerraformParser {
  private readonly logger = new Logger(TerraformParser.name);

  async parse(content: string): Promise<TerraformParseResult> {
    try {
      const resources = this.extractResources(content);
      const provider = this.detectProvider(resources);

      const result: TerraformParseResult = {
        provider,
        resources,
        components: this.generateComponents(resources, provider),
        dataFlows: this.generateDataFlows(resources),
        securityGroups: this.extractSecurityGroups(resources),
      };

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to parse Terraform: ${error.message}`);
      throw new Error(`Invalid Terraform configuration: ${error.message}`);
    }
  }

  private extractResources(content: string): TerraformResource[] {
    const resources: TerraformResource[] = [];

    // Match resource blocks: resource "type" "name" { ... }
    const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
    let match;

    while ((match = resourceRegex.exec(content)) !== null) {
      const [, type, name, body] = match;
      const provider = type.split('_')[0];

      resources.push({
        type,
        name,
        provider,
        config: this.parseBlock(body),
        dependencies: this.extractDependencies(body),
      });
    }

    return resources;
  }

  private parseBlock(body: string): Record<string, any> {
    const config: Record<string, any> = {};

    // Extract simple key = value pairs
    const kvRegex = /(\w+)\s*=\s*"([^"]*)"/g;
    let match;

    while ((match = kvRegex.exec(body)) !== null) {
      config[match[1]] = match[2];
    }

    // Extract boolean and number values
    const boolNumRegex = /(\w+)\s*=\s*(true|false|\d+)/g;
    while ((match = boolNumRegex.exec(body)) !== null) {
      const value = match[2];
      config[match[1]] = value === 'true' ? true : value === 'false' ? false : parseInt(value);
    }

    return config;
  }

  private extractDependencies(body: string): string[] {
    const deps: string[] = [];

    // Match references like: aws_instance.example or var.something
    const refRegex = /\$\{([^}]+)\}|(\w+)\.(\w+)\.(\w+)/g;
    let match;

    while ((match = refRegex.exec(body)) !== null) {
      if (match[1]) deps.push(match[1]);
      else if (match[2] && match[2] !== 'var') deps.push(`${match[2]}.${match[3]}`);
    }

    return [...new Set(deps)];
  }

  private detectProvider(resources: TerraformResource[]): string {
    const providerCounts: Record<string, number> = {};

    for (const resource of resources) {
      providerCounts[resource.provider] = (providerCounts[resource.provider] || 0) + 1;
    }

    const sortedProviders = Object.entries(providerCounts).sort((a, b) => b[1] - a[1]);
    return sortedProviders[0]?.[0] || 'unknown';
  }

  private generateComponents(resources: TerraformResource[], provider: string): any[] {
    const components: any[] = [];
    const componentTypeMap: Record<string, { type: string; criticality: string; classification: string }> = {
      // AWS
      'aws_instance': { type: 'process', criticality: 'high', classification: 'internal' },
      'aws_lambda_function': { type: 'process', criticality: 'high', classification: 'internal' },
      'aws_rds_instance': { type: 'datastore', criticality: 'critical', classification: 'confidential' },
      'aws_dynamodb_table': { type: 'datastore', criticality: 'high', classification: 'confidential' },
      'aws_s3_bucket': { type: 'datastore', criticality: 'high', classification: 'confidential' },
      'aws_elasticache_cluster': { type: 'datastore', criticality: 'medium', classification: 'internal' },
      'aws_lb': { type: 'process', criticality: 'critical', classification: 'public' },
      'aws_api_gateway_rest_api': { type: 'external_entity', criticality: 'critical', classification: 'public' },
      'aws_sqs_queue': { type: 'datastore', criticality: 'medium', classification: 'internal' },
      'aws_sns_topic': { type: 'process', criticality: 'medium', classification: 'internal' },
      'aws_cognito_user_pool': { type: 'process', criticality: 'critical', classification: 'confidential' },
      'aws_kms_key': { type: 'datastore', criticality: 'critical', classification: 'restricted' },

      // Azure
      'azurerm_virtual_machine': { type: 'process', criticality: 'high', classification: 'internal' },
      'azurerm_function_app': { type: 'process', criticality: 'high', classification: 'internal' },
      'azurerm_sql_database': { type: 'datastore', criticality: 'critical', classification: 'confidential' },
      'azurerm_storage_account': { type: 'datastore', criticality: 'high', classification: 'confidential' },
      'azurerm_cosmosdb_account': { type: 'datastore', criticality: 'critical', classification: 'confidential' },
      'azurerm_key_vault': { type: 'datastore', criticality: 'critical', classification: 'restricted' },
      'azurerm_application_gateway': { type: 'process', criticality: 'critical', classification: 'public' },

      // GCP
      'google_compute_instance': { type: 'process', criticality: 'high', classification: 'internal' },
      'google_cloud_run_service': { type: 'process', criticality: 'high', classification: 'internal' },
      'google_sql_database_instance': { type: 'datastore', criticality: 'critical', classification: 'confidential' },
      'google_storage_bucket': { type: 'datastore', criticality: 'high', classification: 'confidential' },
      'google_bigquery_dataset': { type: 'datastore', criticality: 'high', classification: 'confidential' },
    };

    for (const resource of resources) {
      const typeInfo = componentTypeMap[resource.type] || {
        type: 'process',
        criticality: 'medium',
        classification: 'internal',
      };

      const technology = this.getTechnology(resource.type, provider);

      components.push({
        name: `${resource.name} (${resource.type})`,
        type: typeInfo.type,
        description: `${this.formatResourceType(resource.type)} - ${resource.name}`,
        technology,
        dataClassification: typeInfo.classification,
        criticality: typeInfo.criticality,
      });
    }

    return components;
  }

  private getTechnology(resourceType: string, provider: string): string {
    const techMap: Record<string, string> = {
      'aws_instance': 'AWS EC2',
      'aws_lambda_function': 'AWS Lambda',
      'aws_rds_instance': 'AWS RDS',
      'aws_dynamodb_table': 'AWS DynamoDB',
      'aws_s3_bucket': 'AWS S3',
      'aws_lb': 'AWS ELB',
      'aws_api_gateway_rest_api': 'AWS API Gateway',
      'azurerm_virtual_machine': 'Azure VM',
      'azurerm_function_app': 'Azure Functions',
      'azurerm_sql_database': 'Azure SQL',
      'azurerm_storage_account': 'Azure Blob Storage',
      'google_compute_instance': 'GCE',
      'google_cloud_run_service': 'Cloud Run',
      'google_sql_database_instance': 'Cloud SQL',
      'google_storage_bucket': 'GCS',
    };

    return techMap[resourceType] || `${provider.toUpperCase()} ${resourceType.split('_').slice(1).join(' ')}`;
  }

  private formatResourceType(type: string): string {
    return type
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateDataFlows(resources: TerraformResource[]): any[] {
    const dataFlows: any[] = [];
    const resourceMap = new Map(resources.map((r) => [`${r.type}.${r.name}`, r]));

    for (const resource of resources) {
      for (const dep of resource.dependencies) {
        const depResource = resourceMap.get(dep);
        if (depResource) {
          dataFlows.push({
            source: `${resource.name} (${resource.type})`,
            target: `${depResource.name} (${depResource.type})`,
            protocol: this.inferProtocol(resource.type, depResource.type),
            dataType: this.inferDataType(resource.type, depResource.type),
            authenticated: true,
            encrypted: this.isEncrypted(resource, depResource),
          });
        }
      }
    }

    // Add common flow patterns
    const lbs = resources.filter((r) => r.type.includes('lb') || r.type.includes('gateway'));
    const compute = resources.filter((r) =>
      r.type.includes('instance') || r.type.includes('function') || r.type.includes('run')
    );
    const databases = resources.filter((r) =>
      r.type.includes('rds') || r.type.includes('sql') || r.type.includes('dynamo')
    );

    // LB to compute
    for (const lb of lbs) {
      for (const c of compute) {
        dataFlows.push({
          source: `${lb.name} (${lb.type})`,
          target: `${c.name} (${c.type})`,
          protocol: 'HTTPS',
          dataType: 'Request/Response',
          authenticated: true,
          encrypted: true,
        });
      }
    }

    // Compute to database
    for (const c of compute) {
      for (const db of databases) {
        dataFlows.push({
          source: `${c.name} (${c.type})`,
          target: `${db.name} (${db.type})`,
          protocol: this.getDatabaseProtocol(db.type),
          dataType: 'Query/Data',
          authenticated: true,
          encrypted: true,
        });
      }
    }

    return dataFlows;
  }

  private inferProtocol(_sourceType: string, targetType: string): string {
    if (targetType.includes('s3') || targetType.includes('storage')) return 'HTTPS';
    if (targetType.includes('sqs') || targetType.includes('queue')) return 'HTTPS';
    if (targetType.includes('rds') || targetType.includes('sql')) return 'TLS/SQL';
    if (targetType.includes('dynamo') || targetType.includes('cosmos')) return 'HTTPS';
    return 'TCP';
  }

  private inferDataType(_sourceType: string, targetType: string): string {
    if (targetType.includes('s3') || targetType.includes('storage')) return 'Objects/Files';
    if (targetType.includes('queue')) return 'Messages';
    if (targetType.includes('rds') || targetType.includes('sql')) return 'SQL Queries';
    if (targetType.includes('dynamo') || targetType.includes('cosmos')) return 'Documents';
    return 'Data';
  }

  private isEncrypted(source: TerraformResource, target: TerraformResource): boolean {
    // Check for encryption indicators in config
    return (
      source.config.encrypted === true ||
      target.config.encrypted === true ||
      source.config.kms_key_id !== undefined ||
      target.config.kms_key_id !== undefined ||
      source.config.storage_encrypted === true ||
      target.config.storage_encrypted === true
    );
  }

  private getDatabaseProtocol(type: string): string {
    if (type.includes('mysql')) return 'MySQL/TLS';
    if (type.includes('postgres')) return 'PostgreSQL/TLS';
    if (type.includes('sql')) return 'SQL/TLS';
    if (type.includes('dynamo') || type.includes('cosmos')) return 'HTTPS';
    return 'Database/TLS';
  }

  private extractSecurityGroups(resources: TerraformResource[]): any[] {
    const securityGroups: any[] = [];

    const sgResources = resources.filter(
      (r) =>
        r.type === 'aws_security_group' ||
        r.type === 'azurerm_network_security_group' ||
        r.type === 'google_compute_firewall'
    );

    for (const sg of sgResources) {
      securityGroups.push({
        name: sg.name,
        rules: [], // Would need deeper parsing for rules
      });
    }

    return securityGroups;
  }

  // Identify potential security concerns from Terraform config
  identifySecurityConcerns(resources: TerraformResource[]): string[] {
    const concerns: string[] = [];

    for (const resource of resources) {
      // Public S3 buckets
      if (resource.type === 'aws_s3_bucket') {
        if (resource.config.acl === 'public-read' || resource.config.acl === 'public-read-write') {
          concerns.push(`S3 bucket '${resource.name}' has public ACL`);
        }
      }

      // Unencrypted storage
      if (
        (resource.type.includes('rds') || resource.type.includes('s3') || resource.type.includes('ebs')) &&
        resource.config.encrypted !== true && resource.config.storage_encrypted !== true
      ) {
        concerns.push(`${resource.type} '${resource.name}' may not have encryption enabled`);
      }

      // Wide open security groups
      if (resource.type === 'aws_security_group_rule') {
        if (resource.config.cidr_blocks?.includes('0.0.0.0/0') &&
            resource.config.type === 'ingress') {
          concerns.push(`Security group rule '${resource.name}' allows ingress from 0.0.0.0/0`);
        }
      }

      // Public RDS instances
      if (resource.type === 'aws_db_instance') {
        if (resource.config.publicly_accessible === true) {
          concerns.push(`RDS instance '${resource.name}' is publicly accessible`);
        }
      }
    }

    return concerns;
  }
}
