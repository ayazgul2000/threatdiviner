import { Injectable, Logger } from '@nestjs/common';

export interface DetectedTechnology {
  name: string;
  type: 'frontend' | 'backend' | 'database' | 'cache' | 'queue' | 'payment' | 'auth' | 'cloud' | 'monitoring' | 'other';
  category: string;
  version?: string;
}

export interface PackageJsonParseResult {
  name: string;
  description?: string;
  technologies: DetectedTechnology[];
  components: {
    name: string;
    type: string;
    technology: string;
    description: string;
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

// Technology detection rules
const TECHNOLOGY_PATTERNS: {
  pattern: RegExp;
  name: string;
  type: DetectedTechnology['type'];
  category: string;
  componentType: string;
}[] = [
  // Frontend frameworks
  { pattern: /^next$/, name: 'Next.js', type: 'frontend', category: 'Frontend Framework', componentType: 'process' },
  { pattern: /^react$/, name: 'React', type: 'frontend', category: 'Frontend Library', componentType: 'process' },
  { pattern: /^vue$/, name: 'Vue.js', type: 'frontend', category: 'Frontend Framework', componentType: 'process' },
  { pattern: /^@angular\/core$/, name: 'Angular', type: 'frontend', category: 'Frontend Framework', componentType: 'process' },
  { pattern: /^svelte$/, name: 'Svelte', type: 'frontend', category: 'Frontend Framework', componentType: 'process' },

  // Backend frameworks
  { pattern: /^@nestjs\/core$/, name: 'NestJS', type: 'backend', category: 'Backend Framework', componentType: 'process' },
  { pattern: /^express$/, name: 'Express.js', type: 'backend', category: 'Backend Framework', componentType: 'process' },
  { pattern: /^fastify$/, name: 'Fastify', type: 'backend', category: 'Backend Framework', componentType: 'process' },
  { pattern: /^koa$/, name: 'Koa', type: 'backend', category: 'Backend Framework', componentType: 'process' },
  { pattern: /^hapi$/, name: 'Hapi', type: 'backend', category: 'Backend Framework', componentType: 'process' },

  // Databases
  { pattern: /^pg$|^postgres$|^@prisma\/client$/, name: 'PostgreSQL', type: 'database', category: 'Relational Database', componentType: 'data_store' },
  { pattern: /^mysql2?$/, name: 'MySQL', type: 'database', category: 'Relational Database', componentType: 'data_store' },
  { pattern: /^mongodb$|^mongoose$/, name: 'MongoDB', type: 'database', category: 'Document Database', componentType: 'data_store' },
  { pattern: /^sqlite3$|^better-sqlite3$/, name: 'SQLite', type: 'database', category: 'Embedded Database', componentType: 'data_store' },
  { pattern: /^mssql$/, name: 'SQL Server', type: 'database', category: 'Relational Database', componentType: 'data_store' },

  // ORMs
  { pattern: /^prisma$/, name: 'Prisma', type: 'database', category: 'ORM', componentType: 'process' },
  { pattern: /^typeorm$/, name: 'TypeORM', type: 'database', category: 'ORM', componentType: 'process' },
  { pattern: /^sequelize$/, name: 'Sequelize', type: 'database', category: 'ORM', componentType: 'process' },
  { pattern: /^knex$/, name: 'Knex.js', type: 'database', category: 'Query Builder', componentType: 'process' },

  // Caching
  { pattern: /^redis$|^ioredis$/, name: 'Redis', type: 'cache', category: 'Cache/Queue', componentType: 'data_store' },
  { pattern: /^memcached$/, name: 'Memcached', type: 'cache', category: 'Cache', componentType: 'data_store' },

  // Message queues
  { pattern: /^bullmq$|^bull$/, name: 'Bull Queue', type: 'queue', category: 'Message Queue', componentType: 'process' },
  { pattern: /^amqplib$/, name: 'RabbitMQ', type: 'queue', category: 'Message Queue', componentType: 'process' },
  { pattern: /^kafkajs$/, name: 'Kafka', type: 'queue', category: 'Message Queue', componentType: 'process' },

  // Payment
  { pattern: /^stripe$/, name: 'Stripe', type: 'payment', category: 'Payment Gateway', componentType: 'external_entity' },
  { pattern: /^paypal-rest-sdk$|^@paypal\/checkout-server-sdk$/, name: 'PayPal', type: 'payment', category: 'Payment Gateway', componentType: 'external_entity' },
  { pattern: /^braintree$/, name: 'Braintree', type: 'payment', category: 'Payment Gateway', componentType: 'external_entity' },

  // Auth
  { pattern: /^passport$/, name: 'Passport.js', type: 'auth', category: 'Authentication', componentType: 'process' },
  { pattern: /^@auth0\/nextjs-auth0$|^auth0$/, name: 'Auth0', type: 'auth', category: 'Identity Provider', componentType: 'external_entity' },
  { pattern: /^next-auth$/, name: 'NextAuth.js', type: 'auth', category: 'Authentication', componentType: 'process' },
  { pattern: /^jsonwebtoken$/, name: 'JWT', type: 'auth', category: 'Token Auth', componentType: 'process' },
  { pattern: /^bcrypt$|^bcryptjs$/, name: 'Password Hashing', type: 'auth', category: 'Security', componentType: 'process' },

  // Cloud services
  { pattern: /^@aws-sdk\//, name: 'AWS SDK', type: 'cloud', category: 'Cloud Provider', componentType: 'external_entity' },
  { pattern: /^@google-cloud\//, name: 'Google Cloud', type: 'cloud', category: 'Cloud Provider', componentType: 'external_entity' },
  { pattern: /^@azure\//, name: 'Azure', type: 'cloud', category: 'Cloud Provider', componentType: 'external_entity' },

  // Email
  { pattern: /^nodemailer$/, name: 'Nodemailer', type: 'other', category: 'Email', componentType: 'process' },
  { pattern: /^@sendgrid\/mail$/, name: 'SendGrid', type: 'other', category: 'Email Service', componentType: 'external_entity' },
  { pattern: /^postmark$/, name: 'Postmark', type: 'other', category: 'Email Service', componentType: 'external_entity' },

  // Monitoring
  { pattern: /^@sentry\/node$|^@sentry\/nextjs$/, name: 'Sentry', type: 'monitoring', category: 'Error Tracking', componentType: 'external_entity' },
  { pattern: /^newrelic$/, name: 'New Relic', type: 'monitoring', category: 'APM', componentType: 'external_entity' },
  { pattern: /^prom-client$/, name: 'Prometheus', type: 'monitoring', category: 'Metrics', componentType: 'external_entity' },

  // Storage
  { pattern: /^@aws-sdk\/client-s3$/, name: 'AWS S3', type: 'cloud', category: 'Object Storage', componentType: 'data_store' },
  { pattern: /^minio$/, name: 'MinIO', type: 'cloud', category: 'Object Storage', componentType: 'data_store' },

  // GraphQL
  { pattern: /^@apollo\/server$|^apollo-server/, name: 'Apollo Server', type: 'backend', category: 'GraphQL', componentType: 'process' },
  { pattern: /^graphql$/, name: 'GraphQL', type: 'backend', category: 'API', componentType: 'process' },

  // WebSocket
  { pattern: /^socket\.io$/, name: 'Socket.IO', type: 'backend', category: 'WebSocket', componentType: 'process' },
  { pattern: /^ws$/, name: 'WebSocket', type: 'backend', category: 'WebSocket', componentType: 'process' },
];

@Injectable()
export class PackageJsonParser {
  private readonly logger = new Logger(PackageJsonParser.name);

  /**
   * Check if content is a valid package.json
   */
  isValidPackageJson(content: string): boolean {
    try {
      const pkg = JSON.parse(content);
      return !!(pkg.name && (pkg.dependencies || pkg.devDependencies));
    } catch {
      return false;
    }
  }

  async parse(content: string): Promise<PackageJsonParseResult> {
    try {
      const pkg = JSON.parse(content);

      if (!pkg.name) {
        throw new Error('Invalid package.json: missing name');
      }

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };

      const technologies = this.detectTechnologies(allDeps);
      const components = this.generateComponents(pkg.name, technologies);
      const dataFlows = this.generateDataFlows(pkg.name, technologies, components);

      return {
        name: pkg.name,
        description: pkg.description,
        technologies,
        components,
        dataFlows,
      };
    } catch (error: any) {
      this.logger.error(`Failed to parse package.json: ${error.message}`);
      throw new Error(`Invalid package.json: ${error.message}`);
    }
  }

  private detectTechnologies(deps: Record<string, string>): DetectedTechnology[] {
    const technologies: DetectedTechnology[] = [];
    const seen = new Set<string>();

    for (const [depName, version] of Object.entries(deps || {})) {
      for (const pattern of TECHNOLOGY_PATTERNS) {
        if (pattern.pattern.test(depName) && !seen.has(pattern.name)) {
          seen.add(pattern.name);
          technologies.push({
            name: pattern.name,
            type: pattern.type,
            category: pattern.category,
            version: version?.replace(/[\^~]/, ''),
          });
        }
      }
    }

    return technologies;
  }

  private generateComponents(
    projectName: string,
    technologies: DetectedTechnology[],
  ): PackageJsonParseResult['components'] {
    const components: PackageJsonParseResult['components'] = [];

    // Group technologies by type
    const frontendTech = technologies.filter((t) => t.type === 'frontend');
    const backendTech = technologies.filter((t) => t.type === 'backend');
    const databaseTech = technologies.filter((t) => t.type === 'database' && t.category !== 'ORM');
    const cacheTech = technologies.filter((t) => t.type === 'cache');
    const queueTech = technologies.filter((t) => t.type === 'queue');
    const paymentTech = technologies.filter((t) => t.type === 'payment');
    const authTech = technologies.filter((t) => t.type === 'auth' && t.category === 'Identity Provider');
    const monitoringTech = technologies.filter((t) => t.type === 'monitoring');
    const storageTech = technologies.filter((t) => t.type === 'cloud' && t.category.includes('Storage'));

    // Frontend component
    if (frontendTech.length > 0) {
      const mainFrontend = frontendTech[0];
      components.push({
        name: `${projectName} Frontend`,
        type: 'process',
        technology: mainFrontend.name,
        description: `${mainFrontend.name} frontend application`,
        dataClassification: 'public',
      });
    }

    // Backend component
    if (backendTech.length > 0) {
      const mainBackend = backendTech[0];
      components.push({
        name: `${projectName} API`,
        type: 'process',
        technology: mainBackend.name,
        description: `${mainBackend.name} backend API server`,
        dataClassification: 'internal',
      });
    }

    // Database components
    for (const db of databaseTech) {
      components.push({
        name: `${db.name} Database`,
        type: 'data_store',
        technology: db.name,
        description: `${db.category} for data persistence`,
        dataClassification: 'confidential',
      });
    }

    // Cache components
    for (const cache of cacheTech) {
      components.push({
        name: cache.name,
        type: 'data_store',
        technology: cache.name,
        description: `${cache.category} for caching and sessions`,
        dataClassification: 'internal',
      });
    }

    // Queue components
    for (const queue of queueTech) {
      components.push({
        name: `${queue.name} Queue`,
        type: 'process',
        technology: queue.name,
        description: `${queue.category} for async job processing`,
        dataClassification: 'internal',
      });
    }

    // Payment gateways
    for (const payment of paymentTech) {
      components.push({
        name: `${payment.name} Payment Gateway`,
        type: 'external_entity',
        technology: payment.name,
        description: `External ${payment.category} integration`,
        dataClassification: 'restricted',
      });
    }

    // Auth providers
    for (const auth of authTech) {
      components.push({
        name: auth.name,
        type: 'external_entity',
        technology: auth.name,
        description: `External ${auth.category}`,
        dataClassification: 'confidential',
      });
    }

    // Monitoring services
    for (const monitor of monitoringTech) {
      components.push({
        name: monitor.name,
        type: 'external_entity',
        technology: monitor.name,
        description: `External ${monitor.category} service`,
        dataClassification: 'internal',
      });
    }

    // Storage services (S3, MinIO, etc.)
    for (const storage of storageTech) {
      components.push({
        name: storage.name,
        type: 'data_store',
        technology: storage.name,
        description: `${storage.category} for file storage`,
        dataClassification: 'confidential',
      });
    }

    return components;
  }

  private generateDataFlows(
    _projectName: string,
    _technologies: DetectedTechnology[],
    components: PackageJsonParseResult['components'],
  ): PackageJsonParseResult['dataFlows'] {
    const dataFlows: PackageJsonParseResult['dataFlows'] = [];

    const frontendComponent = components.find((c) => c.name.includes('Frontend'));
    const backendComponent = components.find((c) => c.name.includes('API'));
    const databases = components.filter((c) => c.type === 'data_store' && c.name.includes('Database'));
    const caches = components.filter((c) => c.type === 'data_store' && !c.name.includes('Database'));
    const externalServices = components.filter((c) => c.type === 'external_entity');

    // Frontend -> Backend
    if (frontendComponent && backendComponent) {
      dataFlows.push({
        source: frontendComponent.name,
        target: backendComponent.name,
        protocol: 'HTTPS',
        dataType: 'API Requests',
        authenticated: true,
      });
      dataFlows.push({
        source: backendComponent.name,
        target: frontendComponent.name,
        protocol: 'HTTPS',
        dataType: 'API Responses',
        authenticated: true,
      });
    }

    // Backend -> Databases
    if (backendComponent) {
      for (const db of databases) {
        dataFlows.push({
          source: backendComponent.name,
          target: db.name,
          protocol: db.technology === 'MongoDB' ? 'MongoDB Protocol' : 'TCP/SQL',
          dataType: 'Queries/Data',
          authenticated: true,
        });
      }

      // Backend -> Cache
      for (const cache of caches) {
        dataFlows.push({
          source: backendComponent.name,
          target: cache.name,
          protocol: 'TCP',
          dataType: 'Cache Data',
          authenticated: true,
        });
      }

      // Backend -> External Services
      for (const service of externalServices) {
        dataFlows.push({
          source: backendComponent.name,
          target: service.name,
          protocol: 'HTTPS',
          dataType: service.technology.includes('Payment') ? 'Payment Data' : 'API Data',
          authenticated: true,
        });
      }
    }

    return dataFlows;
  }
}
