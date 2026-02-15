'use client';

import { useCallback, useMemo } from 'react';
import { useEditorStore } from '../store/editor-store';
import { PROTOCOL_OPTIONS } from '../constants';
import type {
  CanvasNodeData,
  ComponentNodeData,
  ZoneNodeData,
  ActorNodeData,
  ConnectionData,
  ProtocolType,
  AuthMethod,
  EncryptionType,
  DataClassification,
} from '../types';
import { X, Trash2 } from 'lucide-react';

export function PropertyPanel() {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const propertyPanelOpen = useEditorStore((s) => s.propertyPanelOpen);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const updateNodeData = useEditorStore((s) => s.updateNodeData);
  const updateEdgeData = useEditorStore((s) => s.updateEdgeData);
  const removeNode = useEditorStore((s) => s.removeNode);
  const removeEdge = useEditorStore((s) => s.removeEdge);
  const setPropertyPanelOpen = useEditorStore((s) => s.setPropertyPanelOpen);
  const clearSelection = useEditorStore((s) => s.clearSelection);

  const selectedNode = useMemo(
    () =>
      selectedElement?.type === 'node'
        ? nodes.find((n) => n.id === selectedElement.id)
        : null,
    [selectedElement, nodes],
  );

  const selectedEdge = useMemo(
    () =>
      selectedElement?.type === 'edge'
        ? edges.find((e) => e.id === selectedElement.id)
        : null,
    [selectedElement, edges],
  );

  const handleClose = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  const handleDelete = useCallback(() => {
    if (!selectedElement) return;
    if (selectedElement.type === 'node') removeNode(selectedElement.id);
    else removeEdge(selectedElement.id);
  }, [selectedElement, removeNode, removeEdge]);

  if (!propertyPanelOpen || !selectedElement) return null;

  return (
    <div className="w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {selectedElement.type === 'node' ? 'Node Properties' : 'Connection Properties'}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {selectedNode && (
          <NodeProperties
            nodeId={selectedNode.id}
            data={selectedNode.data as CanvasNodeData}
            updateNodeData={updateNodeData}
          />
        )}
        {selectedEdge && (
          <EdgeProperties
            edgeId={selectedEdge.id}
            data={(selectedEdge.data || {}) as ConnectionData}
            updateEdgeData={updateEdgeData}
          />
        )}
      </div>
    </div>
  );
}

// ─── Node Properties ──────────────────────────────────────────────────────────

function NodeProperties({
  nodeId,
  data,
  updateNodeData,
}: {
  nodeId: string;
  data: CanvasNodeData;
  updateNodeData: (id: string, data: Partial<CanvasNodeData>) => void;
}) {
  if (data.kind === 'component') return <ComponentProperties nodeId={nodeId} data={data} updateNodeData={updateNodeData} />;
  if (data.kind === 'zone') return <ZoneProperties nodeId={nodeId} data={data} updateNodeData={updateNodeData} />;
  if (data.kind === 'actor') return <ActorProperties nodeId={nodeId} data={data} updateNodeData={updateNodeData} />;
  return <div className="text-xs text-gray-400">Unknown node type</div>;
}

function ComponentProperties({
  nodeId,
  data,
  updateNodeData,
}: {
  nodeId: string;
  data: ComponentNodeData;
  updateNodeData: (id: string, data: Partial<CanvasNodeData>) => void;
}) {
  return (
    <>
      <FieldGroup label="Label">
        <input
          type="text"
          value={data.label}
          onChange={(e) => updateNodeData(nodeId, { label: e.target.value })}
          className="field-input"
        />
      </FieldGroup>
      <FieldGroup label="Description">
        <textarea
          value={data.description}
          onChange={(e) => updateNodeData(nodeId, { description: e.target.value })}
          rows={2}
          className="field-input resize-none"
        />
      </FieldGroup>
      <FieldGroup label="Technology Type">
        <input
          type="text"
          value={data.technologyType}
          onChange={(e) => updateNodeData(nodeId, { technologyType: e.target.value })}
          className="field-input"
          readOnly
        />
      </FieldGroup>
      <FieldGroup label="Internet-Facing">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.internetFacing}
            onChange={(e) => updateNodeData(nodeId, { internetFacing: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Exposed to the internet
          </span>
        </label>
      </FieldGroup>
      <FieldGroup label="Data Classification">
        <select
          value={data.dataClassification}
          onChange={(e) => updateNodeData(nodeId, { dataClassification: e.target.value as DataClassification })}
          className="field-input"
        >
          <option value="public">Public</option>
          <option value="internal">Internal</option>
          <option value="confidential">Confidential</option>
          <option value="restricted">Restricted</option>
          <option value="pii">PII</option>
          <option value="phi">PHI</option>
          <option value="pci">PCI</option>
        </select>
      </FieldGroup>
    </>
  );
}

function ZoneProperties({
  nodeId,
  data,
  updateNodeData,
}: {
  nodeId: string;
  data: ZoneNodeData;
  updateNodeData: (id: string, data: Partial<CanvasNodeData>) => void;
}) {
  return (
    <>
      <FieldGroup label="Label">
        <input
          type="text"
          value={data.label}
          onChange={(e) => updateNodeData(nodeId, { label: e.target.value })}
          className="field-input"
        />
      </FieldGroup>
      <FieldGroup label="Description">
        <textarea
          value={data.description}
          onChange={(e) => updateNodeData(nodeId, { description: e.target.value })}
          rows={2}
          className="field-input resize-none"
        />
      </FieldGroup>
      <FieldGroup label="Zone Type">
        <input type="text" value={data.zoneType} readOnly className="field-input opacity-60" />
      </FieldGroup>
      <FieldGroup label="Trust Level">
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={5}
            value={data.trustLevel}
            onChange={(e) => updateNodeData(nodeId, { trustLevel: Number(e.target.value) })}
            className="flex-1"
          />
          <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-4 text-center">
            {data.trustLevel}
          </span>
        </div>
      </FieldGroup>
    </>
  );
}

function ActorProperties({
  nodeId,
  data,
  updateNodeData,
}: {
  nodeId: string;
  data: ActorNodeData;
  updateNodeData: (id: string, data: Partial<CanvasNodeData>) => void;
}) {
  return (
    <>
      <FieldGroup label="Label">
        <input
          type="text"
          value={data.label}
          onChange={(e) => updateNodeData(nodeId, { label: e.target.value })}
          className="field-input"
        />
      </FieldGroup>
      <FieldGroup label="Description">
        <textarea
          value={data.description}
          onChange={(e) => updateNodeData(nodeId, { description: e.target.value })}
          rows={2}
          className="field-input resize-none"
        />
      </FieldGroup>
      <FieldGroup label="Actor Type">
        <input type="text" value={data.actorType} readOnly className="field-input opacity-60" />
      </FieldGroup>
    </>
  );
}

// ─── Edge Properties ──────────────────────────────────────────────────────────

function EdgeProperties({
  edgeId,
  data,
  updateEdgeData,
}: {
  edgeId: string;
  data: ConnectionData;
  updateEdgeData: (id: string, data: Partial<ConnectionData>) => void;
}) {
  const protocolGroups = useMemo(() => {
    const groups: Record<string, typeof PROTOCOL_OPTIONS> = {};
    for (const opt of PROTOCOL_OPTIONS) {
      if (!groups[opt.group]) groups[opt.group] = [];
      groups[opt.group].push(opt);
    }
    return groups;
  }, []);

  return (
    <>
      <FieldGroup label="Label">
        <input
          type="text"
          value={data.label || ''}
          onChange={(e) => updateEdgeData(edgeId, { label: e.target.value })}
          placeholder="e.g. 'User data flow'"
          className="field-input"
        />
      </FieldGroup>

      <FieldGroup label="Protocol">
        <select
          value={data.protocol || 'none'}
          onChange={(e) => updateEdgeData(edgeId, { protocol: e.target.value as ProtocolType })}
          className="field-input"
        >
          {Object.entries(protocolGroups).map(([group, options]) => (
            <optgroup key={group} label={group}>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </FieldGroup>

      <FieldGroup label="Authentication">
        <select
          value={data.authentication || 'none'}
          onChange={(e) => updateEdgeData(edgeId, { authentication: e.target.value as AuthMethod })}
          className="field-input"
        >
          <option value="none">None</option>
          <option value="oauth2">OAuth 2.0</option>
          <option value="jwt">JWT</option>
          <option value="api-key">API Key</option>
          <option value="mtls">mTLS</option>
          <option value="basic">Basic Auth</option>
          <option value="saml">SAML</option>
          <option value="kerberos">Kerberos</option>
          <option value="certificate">Certificate</option>
        </select>
      </FieldGroup>

      <FieldGroup label="Encryption">
        <select
          value={data.encryption || 'none'}
          onChange={(e) => updateEdgeData(edgeId, { encryption: e.target.value as EncryptionType })}
          className="field-input"
        >
          <option value="none">None</option>
          <option value="tls-1.3">TLS 1.3</option>
          <option value="tls-1.2">TLS 1.2</option>
          <option value="mtls">mTLS</option>
          <option value="ipsec">IPSec</option>
          <option value="wireguard">WireGuard</option>
          <option value="ssh-tunnel">SSH Tunnel</option>
        </select>
      </FieldGroup>

      <FieldGroup label="Data Classification">
        <select
          value={data.dataClassification || 'internal'}
          onChange={(e) => updateEdgeData(edgeId, { dataClassification: e.target.value as DataClassification })}
          className="field-input"
        >
          <option value="public">Public</option>
          <option value="internal">Internal</option>
          <option value="confidential">Confidential</option>
          <option value="restricted">Restricted</option>
          <option value="pii">PII</option>
          <option value="phi">PHI</option>
          <option value="pci">PCI</option>
        </select>
      </FieldGroup>

      <FieldGroup label="Bidirectional">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={data.bidirectional || false}
            onChange={(e) => updateEdgeData(edgeId, { bidirectional: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
          />
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Data flows both directions
          </span>
        </label>
      </FieldGroup>

      {/* Completeness summary */}
      <div className="mt-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
          Completeness
        </div>
        <div className="flex gap-2">
          <Badge ok={data.protocol !== 'none'} label="Protocol" />
          <Badge ok={data.authentication !== 'none'} label="Auth" />
          <Badge ok={data.encryption !== 'none'} label="Encrypt" />
        </div>
      </div>
    </>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`
        text-[10px] px-1.5 py-0.5 rounded-full font-medium
        ${ok
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
        }
      `}
    >
      {ok ? '\u2713' : '\u2717'} {label}
    </span>
  );
}
