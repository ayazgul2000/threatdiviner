/**
 * POC System Design Editor — Type Definitions
 *
 * These types define the canvas elements for the system design editor.
 * They are kept separate from existing threat-modeling types.
 */

// ─── Element Categories ───────────────────────────────────────────────────────

/** Functional categories for the palette (grouped by function, not vendor) */
export type PaletteCategory =
  | 'compute'
  | 'database'
  | 'storage'
  | 'network'
  | 'security'
  | 'messaging'
  | 'monitoring'
  | 'container'
  | 'serverless'
  | 'ai-ml'
  | 'analytics'
  | 'identity'
  | 'cdn-edge'
  | 'iot'
  | 'generic';

/** Trust boundary / zone types */
export type ZoneType =
  | 'internet'
  | 'dmz'
  | 'corporate-network'
  | 'private-subnet'
  | 'vpc'
  | 'kubernetes-cluster'
  | 'trust-boundary'
  | 'compliance-boundary'
  | 'custom';

/** Actor types */
export type ActorType =
  | 'external-user'
  | 'internal-user'
  | 'admin'
  | 'service-account'
  | 'third-party'
  | 'attacker';

/** Inline control types (snap onto connections) */
export type InlineControlType =
  | 'waf'
  | 'load-balancer'
  | 'api-gateway'
  | 'auth-proxy'
  | 'firewall'
  | 'ids-ips'
  | 'rate-limiter'
  | 'cdn'
  | 'reverse-proxy'
  | 'service-mesh';

/** Protocol types for connections */
export type ProtocolType =
  | 'https'
  | 'http'
  | 'grpc'
  | 'graphql'
  | 'websocket'
  | 'tcp'
  | 'udp'
  | 'mqtt'
  | 'amqp'
  | 'kafka'
  | 'jdbc'
  | 'odbc'
  | 'ssh'
  | 'sftp'
  | 'ftp'
  | 'smtp'
  | 'ldap'
  | 'dns'
  | 'nfs'
  | 'smb'
  | 'custom'
  | 'none';

/** Authentication methods */
export type AuthMethod =
  | 'oauth2'
  | 'jwt'
  | 'api-key'
  | 'mtls'
  | 'basic'
  | 'saml'
  | 'kerberos'
  | 'certificate'
  | 'none';

/** Encryption types */
export type EncryptionType =
  | 'tls-1.3'
  | 'tls-1.2'
  | 'mtls'
  | 'ipsec'
  | 'wireguard'
  | 'ssh-tunnel'
  | 'none';

/** Data classification levels */
export type DataClassification =
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pii'
  | 'phi'
  | 'pci';

// ─── Canvas Node Data ─────────────────────────────────────────────────────────

/** Data stored in a technology component node */
export interface ComponentNodeData extends Record<string, unknown> {
  kind: 'component';
  label: string;
  description: string;
  /** Icon key from icon-registry (e.g., 'aws-ec2', 'postgresql') */
  iconKey: string;
  /** Palette category for grouping */
  category: PaletteCategory;
  /** Technology type from bridge (maps to CWE categories) */
  technologyType: string;
  /** Whether the component is internet-facing */
  internetFacing: boolean;
  /** Whether the component is in an internet-type zone (auto-computed) */
  zoneInternetExposed: boolean;
  /** Whether the component is shared/multi-tenant (for isolation CWEs) */
  isShared: boolean;
  /** Data classification of data handled */
  dataClassification: DataClassification;
  /** Custom tags */
  tags: string[];
}

/** Data stored in a zone (trust boundary) group node */
export interface ZoneNodeData extends Record<string, unknown> {
  kind: 'zone';
  label: string;
  description: string;
  zoneType: ZoneType;
  /** Trust level (1-5, higher = more trusted) */
  trustLevel: number;
  /** Color for the zone border */
  color: string;
}

/** Data stored in an actor node */
export interface ActorNodeData extends Record<string, unknown> {
  kind: 'actor';
  label: string;
  description: string;
  actorType: ActorType;
}

/** Data stored in an inline control node (snaps onto edges) */
export interface InlineControlNodeData extends Record<string, unknown> {
  kind: 'inline-control';
  label: string;
  description: string;
  controlType: InlineControlType;
  /** The edge ID this control is placed on */
  attachedEdgeId: string;
}

/** Union of all node data types */
export type CanvasNodeData =
  | ComponentNodeData
  | ZoneNodeData
  | ActorNodeData
  | InlineControlNodeData;

// ─── Canvas Edge Data ─────────────────────────────────────────────────────────

/** Data stored on a connection (edge) between nodes */
export interface ConnectionData extends Record<string, unknown> {
  label: string;
  protocol: ProtocolType;
  authentication: AuthMethod;
  encryption: EncryptionType;
  /** Whether data is bidirectional */
  bidirectional: boolean;
  /** Data assets flowing through this connection */
  dataAssets: string[];
  /** Data classification of the flow */
  dataClassification: DataClassification;
  /** Completeness flags for visual badges */
  completeness: {
    hasProtocol: boolean;
    hasAuth: boolean;
    hasEncryption: boolean;
  };
}

// ─── Palette Items ────────────────────────────────────────────────────────────

/** An item in the palette that can be dragged onto the canvas */
export interface PaletteItem {
  id: string;
  label: string;
  iconKey: string;
  category: PaletteCategory;
  technologyType: string;
  /** For search/filter */
  keywords: string[];
  /** Vendor (aws, azure, gcp, generic, etc.) */
  vendor: string;
}

/** Category definition for palette grouping */
export interface PaletteCategoryDef {
  id: PaletteCategory;
  label: string;
  icon: string;
  description: string;
}

// ─── Editor State ─────────────────────────────────────────────────────────────

/** Selected element in the editor */
export interface SelectedElement {
  type: 'node' | 'edge';
  id: string;
}

/** Completeness badge info for a node */
export interface CompletenessInfo {
  complete: boolean;
  missing: string[];
}
