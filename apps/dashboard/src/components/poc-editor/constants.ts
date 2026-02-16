/**
 * POC System Design Editor — Constants
 *
 * Palette categories, zone presets, default values, and color mappings.
 */

import type {
  PaletteCategoryDef,
  ZoneType,
  ActorType,
  InlineControlType,
  ProtocolType,
  PaletteItem,
} from './types';

// ─── Palette Categories ───────────────────────────────────────────────────────

export const PALETTE_CATEGORIES: PaletteCategoryDef[] = [
  { id: 'compute', label: 'Compute', icon: 'server', description: 'Servers, VMs, instances' },
  { id: 'database', label: 'Databases', icon: 'database', description: 'SQL, NoSQL, caches' },
  { id: 'storage', label: 'Storage', icon: 'hard-drive', description: 'Object stores, file systems' },
  { id: 'network', label: 'Networking', icon: 'network', description: 'Load balancers, DNS, VPN' },
  { id: 'security', label: 'Security', icon: 'shield', description: 'WAFs, firewalls, vaults' },
  { id: 'messaging', label: 'Messaging', icon: 'mail', description: 'Queues, topics, streams' },
  { id: 'container', label: 'Containers', icon: 'box', description: 'Docker, Kubernetes, ECS' },
  { id: 'serverless', label: 'Serverless', icon: 'zap', description: 'Functions, edge workers' },
  { id: 'identity', label: 'Identity', icon: 'key', description: 'IAM, SSO, directories' },
  { id: 'monitoring', label: 'Monitoring', icon: 'activity', description: 'Logging, tracing, alerts' },
  { id: 'cdn-edge', label: 'CDN / Edge', icon: 'globe', description: 'CDNs, edge locations' },
  { id: 'ai-ml', label: 'AI / ML', icon: 'brain', description: 'Models, training, inference' },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart', description: 'Data warehouses, BI' },
  { id: 'generic', label: 'Generic', icon: 'square', description: 'Custom components' },
];

// ─── Zone Presets ─────────────────────────────────────────────────────────────

export const ZONE_PRESETS: {
  type: ZoneType;
  label: string;
  color: string;
  trustLevel: number;
  description: string;
}[] = [
  { type: 'internet', label: 'Internet', color: '#ef4444', trustLevel: 1, description: 'Untrusted external zone' },
  { type: 'dmz', label: 'DMZ', color: '#f97316', trustLevel: 2, description: 'Demilitarized zone' },
  { type: 'corporate-network', label: 'Corporate Network', color: '#eab308', trustLevel: 3, description: 'Internal corporate network' },
  { type: 'vpc', label: 'VPC / VNet', color: '#3b82f6', trustLevel: 4, description: 'Virtual private cloud' },
  { type: 'private-subnet', label: 'Private Subnet', color: '#22c55e', trustLevel: 5, description: 'Isolated private subnet' },
  { type: 'kubernetes-cluster', label: 'Kubernetes Cluster', color: '#8b5cf6', trustLevel: 4, description: 'Container orchestration boundary' },
  { type: 'trust-boundary', label: 'Trust Boundary', color: '#6b7280', trustLevel: 3, description: 'Generic trust boundary' },
  { type: 'compliance-boundary', label: 'Compliance Boundary', color: '#ec4899', trustLevel: 4, description: 'PCI, HIPAA, SOX scope' },
  { type: 'custom', label: 'Custom Zone', color: '#64748b', trustLevel: 3, description: 'User-defined boundary' },
];

// ─── Actor Presets ────────────────────────────────────────────────────────────

export const ACTOR_PRESETS: {
  type: ActorType;
  label: string;
  icon: string;
  description: string;
}[] = [
  { type: 'external-user', label: 'External User', icon: 'user', description: 'End user from the internet' },
  { type: 'internal-user', label: 'Internal User', icon: 'user-check', description: 'Corporate employee' },
  { type: 'admin', label: 'Administrator', icon: 'user-cog', description: 'System administrator' },
  { type: 'service-account', label: 'Service Account', icon: 'bot', description: 'Automated service identity' },
  { type: 'third-party', label: 'Third Party', icon: 'building', description: 'External vendor/partner' },
  { type: 'attacker', label: 'Threat Actor', icon: 'skull', description: 'Malicious actor (for modeling)' },
];

// ─── Inline Control Presets ───────────────────────────────────────────────────

export const INLINE_CONTROL_PRESETS: {
  type: InlineControlType;
  label: string;
  icon: string;
  description: string;
}[] = [
  { type: 'waf', label: 'WAF', icon: 'shield-alert', description: 'Web application firewall' },
  { type: 'load-balancer', label: 'Load Balancer', icon: 'split', description: 'Traffic distribution' },
  { type: 'api-gateway', label: 'API Gateway', icon: 'door-open', description: 'API management & routing' },
  { type: 'auth-proxy', label: 'Auth Proxy', icon: 'key-round', description: 'Authentication proxy' },
  { type: 'firewall', label: 'Firewall', icon: 'flame', description: 'Network firewall' },
  { type: 'ids-ips', label: 'IDS/IPS', icon: 'radar', description: 'Intrusion detection/prevention' },
  { type: 'rate-limiter', label: 'Rate Limiter', icon: 'timer', description: 'Request throttling' },
  { type: 'cdn', label: 'CDN', icon: 'globe', description: 'Content delivery network' },
  { type: 'reverse-proxy', label: 'Reverse Proxy', icon: 'arrow-left-right', description: 'Reverse proxy' },
  { type: 'service-mesh', label: 'Service Mesh', icon: 'network', description: 'Service mesh sidecar' },
];

// ─── Protocol Options ─────────────────────────────────────────────────────────

export const PROTOCOL_OPTIONS: { value: ProtocolType; label: string; group: string }[] = [
  // Web
  { value: 'https', label: 'HTTPS', group: 'Web' },
  { value: 'http', label: 'HTTP', group: 'Web' },
  { value: 'graphql', label: 'GraphQL', group: 'Web' },
  { value: 'websocket', label: 'WebSocket', group: 'Web' },
  // API
  { value: 'grpc', label: 'gRPC', group: 'API' },
  // Messaging
  { value: 'mqtt', label: 'MQTT', group: 'Messaging' },
  { value: 'amqp', label: 'AMQP', group: 'Messaging' },
  { value: 'kafka', label: 'Kafka', group: 'Messaging' },
  // Database
  { value: 'jdbc', label: 'JDBC', group: 'Database' },
  { value: 'odbc', label: 'ODBC', group: 'Database' },
  // Transport
  { value: 'tcp', label: 'TCP', group: 'Transport' },
  { value: 'udp', label: 'UDP', group: 'Transport' },
  // File Transfer
  { value: 'ssh', label: 'SSH', group: 'File Transfer' },
  { value: 'sftp', label: 'SFTP', group: 'File Transfer' },
  { value: 'ftp', label: 'FTP', group: 'File Transfer' },
  // Email/Directory
  { value: 'smtp', label: 'SMTP', group: 'Email/Directory' },
  { value: 'ldap', label: 'LDAP', group: 'Email/Directory' },
  { value: 'dns', label: 'DNS', group: 'Email/Directory' },
  // Storage
  { value: 'nfs', label: 'NFS', group: 'Storage' },
  { value: 'smb', label: 'SMB', group: 'Storage' },
  // Other
  { value: 'custom', label: 'Custom', group: 'Other' },
  { value: 'none', label: 'Not specified', group: 'Other' },
];

// ─── Zone Colors ──────────────────────────────────────────────────────────────

export const ZONE_COLORS: Record<ZoneType, { bg: string; border: string; text: string }> = {
  'internet': { bg: 'rgba(239, 68, 68, 0.05)', border: '#ef4444', text: '#dc2626' },
  'dmz': { bg: 'rgba(249, 115, 22, 0.05)', border: '#f97316', text: '#ea580c' },
  'corporate-network': { bg: 'rgba(234, 179, 8, 0.05)', border: '#eab308', text: '#ca8a04' },
  'private-subnet': { bg: 'rgba(34, 197, 94, 0.05)', border: '#22c55e', text: '#16a34a' },
  'vpc': { bg: 'rgba(59, 130, 246, 0.05)', border: '#3b82f6', text: '#2563eb' },
  'kubernetes-cluster': { bg: 'rgba(139, 92, 246, 0.05)', border: '#8b5cf6', text: '#7c3aed' },
  'trust-boundary': { bg: 'rgba(107, 114, 128, 0.05)', border: '#6b7280', text: '#4b5563' },
  'compliance-boundary': { bg: 'rgba(236, 72, 153, 0.05)', border: '#ec4899', text: '#db2777' },
  'custom': { bg: 'rgba(100, 116, 139, 0.05)', border: '#64748b', text: '#475569' },
};

// ─── Default Connection Data ──────────────────────────────────────────────────

export const DEFAULT_CONNECTION_DATA = {
  label: '',
  protocol: 'none' as ProtocolType,
  authentication: 'none' as const,
  encryption: 'none' as const,
  bidirectional: false,
  dataAssets: [] as string[],
  dataClassification: 'internal' as const,
  completeness: {
    hasProtocol: false,
    hasAuth: false,
    hasEncryption: false,
  },
};

// ─── Starter Palette Items (Generic + Common) ────────────────────────────────
// These are available immediately. Full icon-registry items load async from API.

export const STARTER_PALETTE_ITEMS: PaletteItem[] = [
  // Compute
  { id: 'generic-server', label: 'Server', iconKey: 'server', category: 'compute', technologyType: 'web-server', keywords: ['server', 'vm', 'instance', 'host'], vendor: 'generic' },
  { id: 'generic-web-app', label: 'Web Application', iconKey: 'web-application', category: 'compute', technologyType: 'web-application', keywords: ['web', 'app', 'frontend', 'spa'], vendor: 'generic' },
  { id: 'generic-api', label: 'API Service', iconKey: 'api', category: 'compute', technologyType: 'web-service-rest', keywords: ['api', 'rest', 'service', 'backend'], vendor: 'generic' },
  { id: 'generic-microservice', label: 'Microservice', iconKey: 'microservice', category: 'compute', technologyType: 'web-service-rest', keywords: ['microservice', 'service', 'container'], vendor: 'generic' },
  // Database
  { id: 'generic-rdbms', label: 'SQL Database', iconKey: 'database', category: 'database', technologyType: 'database', keywords: ['sql', 'rdbms', 'postgres', 'mysql', 'relational'], vendor: 'generic' },
  { id: 'generic-nosql', label: 'NoSQL Database', iconKey: 'nosql', category: 'database', technologyType: 'database', keywords: ['nosql', 'mongo', 'dynamo', 'document'], vendor: 'generic' },
  { id: 'generic-cache', label: 'Cache', iconKey: 'cache', category: 'database', technologyType: 'database', keywords: ['cache', 'redis', 'memcached', 'in-memory'], vendor: 'generic' },
  // Storage
  { id: 'generic-object-store', label: 'Object Storage', iconKey: 'storage', category: 'storage', technologyType: 'file-server', keywords: ['s3', 'blob', 'object', 'bucket'], vendor: 'generic' },
  { id: 'generic-file-system', label: 'File System', iconKey: 'file-system', category: 'storage', technologyType: 'file-server', keywords: ['file', 'nfs', 'efs', 'share'], vendor: 'generic' },
  // Messaging
  { id: 'generic-queue', label: 'Message Queue', iconKey: 'queue', category: 'messaging', technologyType: 'message-queue', keywords: ['queue', 'sqs', 'rabbitmq', 'message'], vendor: 'generic' },
  { id: 'generic-event-bus', label: 'Event Bus', iconKey: 'event-bus', category: 'messaging', technologyType: 'message-queue', keywords: ['event', 'bus', 'kafka', 'stream', 'pub/sub'], vendor: 'generic' },
  // Container
  { id: 'generic-container', label: 'Container', iconKey: 'container', category: 'container', technologyType: 'web-server', keywords: ['docker', 'container', 'pod'], vendor: 'generic' },
  { id: 'generic-k8s', label: 'Kubernetes', iconKey: 'kubernetes', category: 'container', technologyType: 'web-server', keywords: ['k8s', 'kubernetes', 'cluster', 'orchestration'], vendor: 'generic' },
  // Serverless
  { id: 'generic-function', label: 'Function', iconKey: 'function', category: 'serverless', technologyType: 'function', keywords: ['lambda', 'function', 'serverless', 'faas'], vendor: 'generic' },
  // Security
  { id: 'generic-vault', label: 'Secrets Vault', iconKey: 'vault', category: 'security', technologyType: 'vault', keywords: ['vault', 'secrets', 'key', 'hsm'], vendor: 'generic' },
  // Identity
  { id: 'generic-idp', label: 'Identity Provider', iconKey: 'identity', category: 'identity', technologyType: 'identity-provider', keywords: ['idp', 'sso', 'oauth', 'saml', 'oidc', 'auth'], vendor: 'generic' },
  // CDN
  { id: 'generic-cdn', label: 'CDN', iconKey: 'cdn', category: 'cdn-edge', technologyType: 'web-server', keywords: ['cdn', 'cloudfront', 'akamai', 'edge'], vendor: 'generic' },
  // Monitoring
  { id: 'generic-logging', label: 'Logging', iconKey: 'logging', category: 'monitoring', technologyType: 'monitoring', keywords: ['log', 'logging', 'elk', 'splunk'], vendor: 'generic' },
  // Generic
  { id: 'generic-external-service', label: 'External Service', iconKey: 'external', category: 'generic', technologyType: 'web-service-rest', keywords: ['external', 'third-party', 'saas', 'api'], vendor: 'generic' },
  { id: 'generic-custom', label: 'Custom Component', iconKey: 'custom', category: 'generic', technologyType: 'web-server', keywords: ['custom', 'other', 'generic'], vendor: 'generic' },
];
