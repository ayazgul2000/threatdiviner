'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import pako from 'pako';

// Zod schemas for validation
const componentSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  type: z.string().min(1, 'Type is required'),
  technology: z.string().optional(),
  description: z.string().optional(),
  criticality: z.enum(['critical', 'important', 'operational', 'archive']).default('operational'),
  internetFacing: z.boolean().default(false),
  encryption: z.enum(['none', 'transparent', 'data-with-symmetric-shared-key', 'data-with-asymmetric-shared-key', 'data-with-end-user-individual-key']).default('none'),
  authentication: z.enum(['none', 'credentials', 'session-id', 'token', 'client-certificate', 'two-factor', 'externalized']).default('none'),
  multiTenant: z.boolean().default(false),
  redundant: z.boolean().default(false),
  customDevelopment: z.boolean().default(false),
  outOfScope: z.boolean().default(false),
  justificationOutOfScope: z.string().optional(),
});

const dataFlowSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  sourceId: z.string(),
  targetId: z.string(),
  protocol: z.string().optional(),
  authentication: z.boolean().default(false),
  authorization: z.boolean().default(false),
  encryption: z.boolean().default(false),
  vpn: z.boolean().default(false),
  ipFiltered: z.boolean().default(false),
  readonly: z.boolean().default(false),
  dataAssets: z.array(z.string()).default([]),
});

const trustBoundarySchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['network-cloud-provider', 'network-cloud-security-group', 'network-on-prem', 'network-dedicated-hoster', 'network-virtual-lan', 'network-policy-namespace-isolation', 'execution-environment']).default('network-cloud-provider'),
  description: z.string().optional(),
});

export type ComponentFormData = z.infer<typeof componentSchema>;
export type DataFlowFormData = z.infer<typeof dataFlowSchema>;
export type TrustBoundaryFormData = z.infer<typeof trustBoundarySchema>;

export interface DiagramElement {
  id: string;
  name: string;
  type: 'component' | 'dataflow' | 'trust_boundary';
  style: string;
}

export interface PropertyPanelProps {
  selectedType: 'component' | 'dataflow' | 'trust_boundary' | null;
  selectedData: ComponentFormData | DataFlowFormData | TrustBoundaryFormData | null;
  onUpdate: (data: ComponentFormData | DataFlowFormData | TrustBoundaryFormData) => void;
  onClose?: () => void;
  isLoading?: boolean;
  isSaving?: boolean;
  diagramXml?: string;
  onElementSelect?: (elementId: string, elementData: any) => void;
}

// Technology options for components
const TECHNOLOGY_OPTIONS = [
  { value: 'web-application', label: 'Web Application' },
  { value: 'web-service-rest', label: 'REST API' },
  { value: 'web-service-soap', label: 'SOAP Service' },
  { value: 'database', label: 'Database' },
  { value: 'file-server', label: 'File Server' },
  { value: 'erp', label: 'ERP System' },
  { value: 'cms', label: 'CMS' },
  { value: 'identity-provider', label: 'Identity Provider' },
  { value: 'identity-store-ldap', label: 'LDAP Directory' },
  { value: 'identity-store-database', label: 'Identity Database' },
  { value: 'build-pipeline', label: 'CI/CD Pipeline' },
  { value: 'source-code-repository', label: 'Source Code Repository' },
  { value: 'artifact-registry', label: 'Artifact Registry' },
  { value: 'service-mesh', label: 'Service Mesh' },
  { value: 'load-balancer', label: 'Load Balancer' },
  { value: 'reverse-proxy', label: 'Reverse Proxy' },
  { value: 'waf', label: 'WAF' },
  { value: 'gateway', label: 'API Gateway' },
  { value: 'message-queue', label: 'Message Queue' },
  { value: 'stream-processing', label: 'Stream Processing' },
  { value: 'block-storage', label: 'Block Storage' },
  { value: 'local-file-system', label: 'Local File System' },
  { value: 'container-platform', label: 'Container Platform' },
  { value: 'function', label: 'Serverless Function' },
  { value: 'browser', label: 'Browser' },
  { value: 'desktop', label: 'Desktop Application' },
  { value: 'mobile-app', label: 'Mobile Application' },
  { value: 'devops-client', label: 'DevOps Client' },
  { value: 'iot-device', label: 'IoT Device' },
  { value: 'cli', label: 'CLI Tool' },
  { value: 'task', label: 'Scheduled Task' },
  { value: 'unknown-technology', label: 'Unknown' },
];

// Protocol options for data flows
const PROTOCOL_OPTIONS = [
  { value: 'https', label: 'HTTPS' },
  { value: 'http', label: 'HTTP' },
  { value: 'ws', label: 'WebSocket' },
  { value: 'wss', label: 'WebSocket Secure' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'jdbc', label: 'JDBC' },
  { value: 'jdbc-encrypted', label: 'JDBC (Encrypted)' },
  { value: 'odbc', label: 'ODBC' },
  { value: 'odbc-encrypted', label: 'ODBC (Encrypted)' },
  { value: 'sql-access-protocol', label: 'SQL Protocol' },
  { value: 'nosql-access-protocol', label: 'NoSQL Protocol' },
  { value: 'ldap', label: 'LDAP' },
  { value: 'ldaps', label: 'LDAPS' },
  { value: 'ssh', label: 'SSH' },
  { value: 'sftp', label: 'SFTP' },
  { value: 'ftp', label: 'FTP' },
  { value: 'ftps', label: 'FTPS' },
  { value: 'smtp', label: 'SMTP' },
  { value: 'smtps', label: 'SMTPS' },
  { value: 'nfs', label: 'NFS' },
  { value: 'smb', label: 'SMB' },
  { value: 'smb-encrypted', label: 'SMB (Encrypted)' },
  { value: 'amqp', label: 'AMQP' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'binary', label: 'Binary Protocol' },
  { value: 'binary-encrypted', label: 'Binary (Encrypted)' },
  { value: 'in-process-library-call', label: 'In-Process Call' },
  { value: 'local-file-access', label: 'Local File Access' },
  { value: 'container-spawning', label: 'Container Spawning' },
];

// Helper to decode mxfile format (base64 encoded + deflated)
function decodeMxFileXml(xml: string): string {
  if (!xml) return '';

  // If it's already raw mxGraphModel (not wrapped in mxfile), return as-is
  if (xml.includes('<mxGraphModel') && !xml.includes('<mxfile')) {
    return xml;
  }

  // If not mxfile format, return as-is
  if (!xml.includes('<mxfile')) {
    return xml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const diagramEl = doc.getElementsByTagName('diagram')[0];
    if (!diagramEl) return xml;

    const compressed = diagramEl.textContent || '';
    if (!compressed) return xml;
    if (compressed.includes('<mxGraphModel')) return compressed;

    // Decode: base64 → inflate → URL decode
    const decoded = atob(compressed);
    const inflated = pako.inflateRaw(
      Uint8Array.from(decoded, (c) => c.charCodeAt(0)),
      { to: 'string' }
    );
    return decodeURIComponent(inflated);
  } catch (e) {
    console.warn('[PropertyPanel] Failed to decode mxfile:', e);
    return xml;
  }
}

// Helper to parse elements from diagram XML
function parseElementsFromXml(xml: string): DiagramElement[] {
  if (!xml) {
    console.log('[PropertyPanel] parseElementsFromXml: empty XML');
    return [];
  }
  try {
    // Decode mxfile format if needed
    console.log('[PropertyPanel] parseElementsFromXml: decoding XML, isMxFile:', xml.includes('<mxfile'));
    const decodedXml = decodeMxFileXml(xml);
    console.log('[PropertyPanel] Decoded XML length:', decodedXml.length);
    console.log('[PropertyPanel] Decoded XML preview:', decodedXml.substring(0, 400));

    const parser = new DOMParser();
    const doc = parser.parseFromString(decodedXml, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('[PropertyPanel] XML parse error:', parseError.textContent);
      return [];
    }

    const elements: DiagramElement[] = [];

    // Select both configured assets (object) AND raw shapes (mxCell[vertex="1"], mxCell[edge="1"])
    doc.querySelectorAll('object, mxCell[vertex="1"], mxCell[edge="1"]').forEach((cell) => {
      const id = cell.getAttribute('id');
      const value = cell.getAttribute('value') || cell.getAttribute('label') || '';
      const style = cell.getAttribute('style') || cell.querySelector('mxCell')?.getAttribute('style') || '';

      // Skip root cells only (not unnamed shapes)
      if (!id || id === '0' || id === '1') return;

      // Determine type from style
      let type: 'component' | 'dataflow' | 'trust_boundary' = 'component';
      if (style.includes('edgeStyle') || style.includes('endArrow')) {
        type = 'dataflow';
      } else if (style.includes('swimlane') || style.includes('group') || style.includes('dashed=1')) {
        type = 'trust_boundary';
      }

      // Only add if not already in list
      if (!elements.find(e => e.id === id)) {
        elements.push({ id, name: value || '(unnamed)', type, style });
      }
    });

    return elements;
  } catch (e) {
    console.error('Failed to parse diagram XML:', e);
    return [];
  }
}

export default function PropertyPanel({
  selectedType,
  selectedData,
  onUpdate,
  onClose,
  isLoading = false,
  isSaving = false,
  diagramXml = '',
  onElementSelect,
}: PropertyPanelProps) {
  const [formData, setFormData] = useState<any>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [diagramElements, setDiagramElements] = useState<DiagramElement[]>([]);

  // Parse elements when XML changes
  useEffect(() => {
    console.log('[PropertyPanel] Raw XML received, length:', diagramXml?.length || 0);
    console.log('[PropertyPanel] Raw XML preview:', diagramXml?.substring(0, 100));
    const elements = parseElementsFromXml(diagramXml);
    console.log('[PropertyPanel] Parsed elements count:', elements.length);
    console.log('[PropertyPanel] Parsed elements:', elements);
    setDiagramElements(elements);
  }, [diagramXml]);

  // Reset form when selection changes
  useEffect(() => {
    if (selectedData) {
      setFormData({ ...selectedData });
      setErrors({});
      setIsDirty(false);
    } else {
      setFormData(null);
    }
  }, [selectedData]);

  // Update form field
  const updateField = useCallback((field: string, value: any) => {
    setFormData((prev: any) => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
    // Clear error for this field
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Validate and submit
  const handleSubmit = useCallback(() => {
    if (!formData || !selectedType) return;

    let schema: z.ZodSchema;
    switch (selectedType) {
      case 'component':
        schema = componentSchema;
        break;
      case 'dataflow':
        schema = dataFlowSchema;
        break;
      case 'trust_boundary':
        schema = trustBoundarySchema;
        break;
      default:
        return;
    }

    const result = schema.safeParse(formData);
    if (result.success) {
      // Cast to the union type expected by onUpdate
      onUpdate(result.data as ComponentFormData | DataFlowFormData | TrustBoundaryFormData);
      setIsDirty(false);
    } else {
      const newErrors: Record<string, string> = {};
      // Use .issues (not .errors) for ZodError
      for (const err of result.error.issues) {
        const path = err.path.join('.');
        newErrors[path] = err.message;
      }
      setErrors(newErrors);
    }
  }, [formData, selectedType, onUpdate]);

  // Render form field
  const renderField = (
    label: string,
    field: string,
    type: 'text' | 'select' | 'checkbox' | 'textarea',
    options?: { value: string; label: string }[]
  ) => {
    const value = formData?.[field];
    const error = errors[field];

    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
        {type === 'text' && (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => updateField(field, e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        )}
        {type === 'textarea' && (
          <textarea
            value={value || ''}
            onChange={(e) => updateField(field, e.target.value)}
            rows={3}
            className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
        )}
        {type === 'select' && options && (
          <select
            value={value || ''}
            onChange={(e) => updateField(field, e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
          >
            <option value="">Select...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
        {type === 'checkbox' && (
          <input
            type="checkbox"
            checked={value || false}
            onChange={(e) => updateField(field, e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
        )}
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  };

  // Render component form
  const renderComponentForm = () => (
    <>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-600">
        Basic Information
      </h4>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
        <input
          type="text"
          value={formData?.name || ''}
          disabled
          className="w-full px-3 py-2 text-sm border rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-400">Edit name in Draw.io directly</p>
      </div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
        <input
          type="text"
          value={formData?.type || ''}
          disabled
          className="w-full px-3 py-2 text-sm border rounded-md bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600 cursor-not-allowed"
        />
      </div>
      {renderField('Technology', 'technology', 'select', TECHNOLOGY_OPTIONS)}
      {renderField('Description', 'description', 'textarea')}

      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-6 pb-2 border-b border-gray-200 dark:border-gray-600">
        Security Properties
      </h4>
      {renderField('Criticality', 'criticality', 'select', [
        { value: 'critical', label: 'Critical' },
        { value: 'important', label: 'Important' },
        { value: 'operational', label: 'Operational' },
        { value: 'archive', label: 'Archive' },
      ])}
      {renderField('Encryption', 'encryption', 'select', [
        { value: 'none', label: 'None' },
        { value: 'transparent', label: 'Transparent' },
        { value: 'data-with-symmetric-shared-key', label: 'Symmetric Key' },
        { value: 'data-with-asymmetric-shared-key', label: 'Asymmetric Key' },
        { value: 'data-with-end-user-individual-key', label: 'End-User Key' },
      ])}
      {renderField('Authentication', 'authentication', 'select', [
        { value: 'none', label: 'None' },
        { value: 'credentials', label: 'Credentials' },
        { value: 'session-id', label: 'Session ID' },
        { value: 'token', label: 'Token' },
        { value: 'client-certificate', label: 'Client Certificate' },
        { value: 'two-factor', label: 'Two-Factor' },
        { value: 'externalized', label: 'Externalized' },
      ])}

      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-6 pb-2 border-b border-gray-200 dark:border-gray-600">
        Attributes
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.internetFacing || false}
            onChange={(e) => updateField('internetFacing', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Internet Facing
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.multiTenant || false}
            onChange={(e) => updateField('multiTenant', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Multi-Tenant
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.redundant || false}
            onChange={(e) => updateField('redundant', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Redundant
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.customDevelopment || false}
            onChange={(e) => updateField('customDevelopment', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Custom Development
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.outOfScope || false}
            onChange={(e) => updateField('outOfScope', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Out of Scope
        </label>
      </div>
      {formData?.outOfScope && (
        <div className="mt-4">
          {renderField('Justification', 'justificationOutOfScope', 'textarea')}
        </div>
      )}
    </>
  );

  // Render data flow form
  const renderDataFlowForm = () => (
    <>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-600">
        Data Flow Properties
      </h4>
      {renderField('Label', 'label', 'text')}
      {renderField('Protocol', 'protocol', 'select', PROTOCOL_OPTIONS)}

      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 mt-6 pb-2 border-b border-gray-200 dark:border-gray-600">
        Security Controls
      </h4>
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.authentication || false}
            onChange={(e) => updateField('authentication', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Authentication Required
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.authorization || false}
            onChange={(e) => updateField('authorization', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Authorization Required
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.encryption || false}
            onChange={(e) => updateField('encryption', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Encrypted
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.vpn || false}
            onChange={(e) => updateField('vpn', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          VPN Protected
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.ipFiltered || false}
            onChange={(e) => updateField('ipFiltered', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          IP Filtered
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={formData?.readonly || false}
            onChange={(e) => updateField('readonly', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          Read-Only Access
        </label>
      </div>

      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Source:</strong> {formData?.sourceId || 'N/A'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          <strong>Target:</strong> {formData?.targetId || 'N/A'}
        </p>
      </div>
    </>
  );

  // Render trust boundary form
  const renderTrustBoundaryForm = () => (
    <>
      <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b border-gray-200 dark:border-gray-600">
        Trust Boundary Properties
      </h4>
      {renderField('Name', 'name', 'text')}
      {renderField('Type', 'type', 'select', [
        { value: 'network-cloud-provider', label: 'Cloud Provider' },
        { value: 'network-cloud-security-group', label: 'Security Group' },
        { value: 'network-on-prem', label: 'On-Premises' },
        { value: 'network-dedicated-hoster', label: 'Dedicated Host' },
        { value: 'network-virtual-lan', label: 'Virtual LAN' },
        { value: 'network-policy-namespace-isolation', label: 'Namespace Isolation' },
        { value: 'execution-environment', label: 'Execution Environment' },
      ])}
      {renderField('Description', 'description', 'textarea')}
    </>
  );

  // Handle element selection from dropdown - parse real properties from XML
  const handleElementClick = (element: DiagramElement) => {
    if (onElementSelect && diagramXml) {
      // Parse actual properties from the diagram XML
      const decodedXml = decodeMxFileXml(diagramXml);
      const parser = new DOMParser();
      const doc = parser.parseFromString(decodedXml, 'text/xml');

      const customProperties: Record<string, any> = {};

      // Check object element first (configured assets)
      const objectEl = doc.querySelector(`object[id="${element.id}"]`);
      if (objectEl) {
        Array.from(objectEl.attributes).forEach(attr => {
          if (!['id', 'label'].includes(attr.name)) {
            customProperties[attr.name] = attr.value;
          }
        });
      }

      // Also check mxCell for data-* attributes
      const cellEl = doc.querySelector(`mxCell[id="${element.id}"]`);
      if (cellEl) {
        Array.from(cellEl.attributes).forEach(attr => {
          if (attr.name.startsWith('data-')) {
            customProperties[attr.name.replace('data-', '')] = attr.value;
          }
        });
      }

      onElementSelect(element.id, {
        id: element.id,
        value: element.name,
        style: element.style,
        geometry: { x: 0, y: 0, width: 100, height: 60 },
        customProperties,
      });
    }
  };

  // No selection state - show element list
  if (!selectedType || !selectedData) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Properties</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {diagramElements.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Select an element to edit its properties:
              </p>
              <div className="space-y-2">
                {diagramElements.map((element) => (
                  <button
                    key={element.id}
                    onClick={() => handleElementClick(element)}
                    className="w-full text-left px-3 py-2 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        element.type === 'component' ? 'bg-blue-500' :
                        element.type === 'dataflow' ? 'bg-green-500' : 'bg-purple-500'
                      }`} />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {element.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                      {element.type.replace('_', ' ')}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <p className="text-sm">Add shapes to the diagram to edit their properties</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="w-80 h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
      {/* Header with back button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => onElementSelect?.(null as any, null)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500"
            title="Back to element list"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">
            {selectedType === 'component' && 'Component Properties'}
            {selectedType === 'dataflow' && 'Data Flow Properties'}
            {selectedType === 'trust_boundary' && 'Trust Boundary Properties'}
          </h3>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 ml-6">
          {formData?.name || '(unnamed)'} {formData?.id && <span className="text-gray-400">({formData.id})</span>}
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedType === 'component' && renderComponentForm()}
        {selectedType === 'dataflow' && renderDataFlowForm()}
        {selectedType === 'trust_boundary' && renderTrustBoundaryForm()}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <button
          onClick={handleSubmit}
          disabled={!isDirty || isSaving}
          className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors
            ${isDirty && !isSaving
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : isDirty ? (
            'Apply Changes'
          ) : (
            'No Changes'
          )}
        </button>
        {Object.keys(errors).length > 0 && (
          <p className="mt-2 text-xs text-red-500 text-center">
            Please fix the errors above
          </p>
        )}
      </div>
    </div>
  );
}
