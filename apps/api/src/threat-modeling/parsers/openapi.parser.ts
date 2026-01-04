import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';

export interface ParsedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  description?: string;
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: ParsedResponse[];
  security: string[];
  tags: string[];
}

export interface ParsedParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  type: string;
  description?: string;
}

export interface ParsedRequestBody {
  contentType: string;
  required: boolean;
  schema: any;
}

export interface ParsedResponse {
  statusCode: string;
  description: string;
  contentType?: string;
}

export interface OpenApiParseResult {
  title: string;
  version: string;
  description?: string;
  servers: string[];
  endpoints: ParsedEndpoint[];
  securitySchemes: Record<string, any>;
  components: {
    name: string;
    type: string;
    description?: string;
    dataClassification?: string;
  }[];
  dataFlows: {
    source: string;
    target: string;
    protocol: string;
    dataType: string;
    authenticated: boolean;
  }[];
}

@Injectable()
export class OpenApiParser {
  private readonly logger = new Logger(OpenApiParser.name);

  async parse(content: string): Promise<OpenApiParseResult> {
    try {
      // Try to parse as YAML first, then JSON
      let spec: any;
      try {
        spec = yaml.load(content);
      } catch {
        spec = JSON.parse(content);
      }

      const result: OpenApiParseResult = {
        title: spec.info?.title || 'Unknown API',
        version: spec.info?.version || '1.0.0',
        description: spec.info?.description,
        servers: this.extractServers(spec),
        endpoints: this.extractEndpoints(spec),
        securitySchemes: spec.components?.securitySchemes || {},
        components: [],
        dataFlows: [],
      };

      // Generate components from the API spec
      result.components = this.generateComponents(result);
      result.dataFlows = this.generateDataFlows(result);

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to parse OpenAPI spec: ${error.message}`);
      throw new Error(`Invalid OpenAPI specification: ${error.message}`);
    }
  }

  private extractServers(spec: any): string[] {
    if (!spec.servers) return ['http://localhost'];
    return spec.servers.map((s: any) => s.url);
  }

  private extractEndpoints(spec: any): ParsedEndpoint[] {
    const endpoints: ParsedEndpoint[] = [];
    const paths = spec.paths || {};

    for (const [path, pathItem] of Object.entries(paths)) {
      const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

      for (const method of methods) {
        const operation = (pathItem as any)[method];
        if (!operation) continue;

        endpoints.push({
          path,
          method: method.toUpperCase(),
          operationId: operation.operationId,
          summary: operation.summary,
          description: operation.description,
          parameters: this.extractParameters(operation, pathItem),
          requestBody: this.extractRequestBody(operation),
          responses: this.extractResponses(operation),
          security: this.extractSecurity(operation, spec),
          tags: operation.tags || [],
        });
      }
    }

    return endpoints;
  }

  private extractParameters(operation: any, pathItem: any): ParsedParameter[] {
    const params: ParsedParameter[] = [];

    // Combine path-level and operation-level parameters
    const allParams = [
      ...(pathItem.parameters || []),
      ...(operation.parameters || []),
    ];

    for (const param of allParams) {
      params.push({
        name: param.name,
        in: param.in,
        required: param.required || false,
        type: param.schema?.type || 'string',
        description: param.description,
      });
    }

    return params;
  }

  private extractRequestBody(operation: any): ParsedRequestBody | undefined {
    if (!operation.requestBody) return undefined;

    const content = operation.requestBody.content;
    const contentType = Object.keys(content)[0] || 'application/json';

    return {
      contentType,
      required: operation.requestBody.required || false,
      schema: content[contentType]?.schema,
    };
  }

  private extractResponses(operation: any): ParsedResponse[] {
    const responses: ParsedResponse[] = [];
    const opResponses = operation.responses || {};

    for (const [statusCode, response] of Object.entries(opResponses)) {
      const resp = response as any;
      responses.push({
        statusCode,
        description: resp.description || '',
        contentType: resp.content ? Object.keys(resp.content)[0] : undefined,
      });
    }

    return responses;
  }

  private extractSecurity(operation: any, spec: any): string[] {
    const security = operation.security || spec.security || [];
    return security.flatMap((s: any) => Object.keys(s));
  }

  private generateComponents(result: OpenApiParseResult): any[] {
    const components: any[] = [];

    // API Gateway component
    components.push({
      name: result.title,
      type: 'external_entity',
      description: result.description || `${result.title} API Gateway`,
      dataClassification: 'internal',
    });

    // Server components
    for (const server of result.servers) {
      components.push({
        name: `Server: ${new URL(server).hostname}`,
        type: 'process',
        description: `API Server at ${server}`,
        dataClassification: 'internal',
      });
    }

    // Extract data stores from endpoints
    const possibleDataStores = new Set<string>();
    for (const endpoint of result.endpoints) {
      // Detect possible data stores from tags and paths
      for (const tag of endpoint.tags) {
        possibleDataStores.add(tag);
      }
    }

    for (const store of possibleDataStores) {
      components.push({
        name: `${store} Data Store`,
        type: 'datastore',
        description: `Data store for ${store}`,
        dataClassification: 'confidential',
      });
    }

    return components;
  }

  private generateDataFlows(result: OpenApiParseResult): any[] {
    const dataFlows: any[] = [];
    const apiName = result.title;

    for (const endpoint of result.endpoints) {
      const isAuthenticated = endpoint.security.length > 0;
      const method = endpoint.method;
      const hasRequestBody = !!endpoint.requestBody;

      // Client to API flow
      dataFlows.push({
        source: 'External Client',
        target: apiName,
        protocol: 'HTTPS',
        dataType: hasRequestBody ? 'Request Data' : 'Query',
        authenticated: isAuthenticated,
      });

      // API to Data Store flows (for write operations)
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        for (const tag of endpoint.tags) {
          dataFlows.push({
            source: apiName,
            target: `${tag} Data Store`,
            protocol: 'Internal',
            dataType: 'Entity Data',
            authenticated: true,
          });
        }
      }

      // API response flow
      dataFlows.push({
        source: apiName,
        target: 'External Client',
        protocol: 'HTTPS',
        dataType: 'Response Data',
        authenticated: isAuthenticated,
      });
    }

    return dataFlows;
  }

  // Identify potential security concerns from the OpenAPI spec
  identifySecurityConcerns(result: OpenApiParseResult): string[] {
    const concerns: string[] = [];

    // Check for unauthenticated endpoints
    const unauthenticatedEndpoints = result.endpoints.filter(
      (e) => e.security.length === 0
    );
    if (unauthenticatedEndpoints.length > 0) {
      concerns.push(
        `${unauthenticatedEndpoints.length} endpoints have no security requirements defined`
      );
    }

    // Check for sensitive data in query parameters
    for (const endpoint of result.endpoints) {
      for (const param of endpoint.parameters) {
        const lowerName = param.name.toLowerCase();
        if (
          lowerName.includes('password') ||
          lowerName.includes('token') ||
          lowerName.includes('secret') ||
          lowerName.includes('key')
        ) {
          if (param.in === 'query') {
            concerns.push(
              `Sensitive parameter '${param.name}' exposed in query string at ${endpoint.path}`
            );
          }
        }
      }
    }

    // Check for missing HTTPS
    for (const server of result.servers) {
      if (server.startsWith('http://') && !server.includes('localhost')) {
        concerns.push(`Non-HTTPS server defined: ${server}`);
      }
    }

    // Check for weak security schemes
    for (const [name, scheme] of Object.entries(result.securitySchemes)) {
      const s = scheme as any;
      if (s.type === 'http' && s.scheme === 'basic') {
        concerns.push(`Basic authentication used in security scheme '${name}'`);
      }
    }

    return concerns;
  }
}
