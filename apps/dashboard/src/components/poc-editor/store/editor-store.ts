/**
 * POC System Design Editor — Zustand Store
 *
 * Central state for the React Flow canvas. Manages nodes, edges,
 * selection, and palette state.
 */

import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type XYPosition,
} from '@xyflow/react';
import type {
  CanvasNodeData,
  ComponentNodeData,
  ZoneNodeData,
  ActorNodeData,
  InlineControlNodeData,
  ConnectionData,
  SelectedElement,
  PaletteCategory,
  DataClassification,
} from '../types';
import { DEFAULT_CONNECTION_DATA, ZONE_PRESETS, ZONE_COLORS } from '../constants';

// ─── Store Types ──────────────────────────────────────────────────────────────

interface EditorState {
  // Canvas elements
  nodes: Node<CanvasNodeData>[];
  edges: Edge<ConnectionData>[];

  // Selection
  selectedElement: SelectedElement | null;

  // Palette
  paletteSearch: string;
  paletteCategory: PaletteCategory | 'all';
  paletteDragItem: string | null;

  // UI state
  propertyPanelOpen: boolean;
  showMinimap: boolean;
  showGrid: boolean;

  // Actions — React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions — Node CRUD
  addComponentNode: (
    iconKey: string,
    label: string,
    category: PaletteCategory,
    technologyType: string,
    position: XYPosition,
    parentId?: string,
  ) => string;
  addZoneNode: (
    zoneType: string,
    label: string,
    position: XYPosition,
    size?: { width: number; height: number },
    parentId?: string,
  ) => string;
  addActorNode: (
    actorType: string,
    label: string,
    position: XYPosition,
  ) => string;
  addInlineControlNode: (
    controlType: string,
    label: string,
    position: XYPosition,
  ) => string;
  splitEdgeWithControl: (
    edgeId: string,
    controlType: string,
    label: string,
    position: XYPosition,
  ) => string;
  removeNode: (nodeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<CanvasNodeData>) => void;

  // Actions — Edge CRUD
  updateEdgeData: (edgeId: string, data: Partial<ConnectionData>) => void;
  removeEdge: (edgeId: string) => void;

  // Actions — Selection
  setSelectedElement: (element: SelectedElement | null) => void;
  clearSelection: () => void;

  // Actions — Palette
  setPaletteSearch: (search: string) => void;
  setPaletteCategory: (category: PaletteCategory | 'all') => void;
  setPaletteDragItem: (itemId: string | null) => void;

  // Actions — UI
  setPropertyPanelOpen: (open: boolean) => void;
  toggleMinimap: () => void;
  toggleGrid: () => void;

  // Actions — Analysis helpers
  getNodeZoneId: (nodeId: string) => string | null;
  isBoundaryCrossing: (edgeId: string) => boolean;

  // Actions — Serialization
  exportDesign: () => DesignExport;
  importDesign: (design: DesignExport) => void;
  resetCanvas: () => void;
}

/** Serialized format of the canvas for save/load */
export interface DesignExport {
  version: '1.0';
  nodes: Node<CanvasNodeData>[];
  edges: Edge<ConnectionData>[];
  exportedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let nodeIdCounter = 0;
let edgeIdCounter = 0;

function nextNodeId(): string {
  return `node-${++nodeIdCounter}-${Date.now()}`;
}

function nextEdgeId(): string {
  return `edge-${++edgeIdCounter}-${Date.now()}`;
}

// ─── Zone Membership Reconciliation ──────────────────────────────────────────

/** Get absolute position of a node by walking its parent chain */
function getAbsPos(node: Node<CanvasNodeData>, nodes: Node<CanvasNodeData>[]): { x: number; y: number } {
  let ax = node.position.x;
  let ay = node.position.y;
  let pid = node.parentId;
  while (pid) {
    const parent = nodes.find((n) => n.id === pid);
    if (!parent) break;
    ax += parent.position.x;
    ay += parent.position.y;
    pid = parent.parentId;
  }
  return { x: ax, y: ay };
}

/**
 * After any position/dimension change, check each non-zone node:
 * - If it's inside a zone but not parented → adopt it (set parentId, convert to relative pos)
 * - If it's parented but moved outside its parent zone → unparent it (convert to absolute pos)
 * Also updates zoneInternetExposed for component nodes.
 */
function reconcileZoneMembership(nodes: Node<CanvasNodeData>[]): Node<CanvasNodeData>[] {
  const zones = nodes.filter((n) => (n.data as CanvasNodeData).kind === 'zone');
  let changed = false;
  const result = nodes.map((node) => {
    const data = node.data as CanvasNodeData;
    // Only reconcile components, actors, inline-controls (not zones themselves)
    if (data.kind === 'zone') return node;

    const absPos = getAbsPos(node, nodes);

    // Find the innermost zone containing this node's absolute center
    let bestZone: Node<CanvasNodeData> | null = null;
    let bestArea = Infinity;
    for (const zone of zones) {
      // Don't parent a node to itself or to its own children
      if (zone.id === node.id) continue;
      const zAbs = getAbsPos(zone, nodes);
      const zw = (zone.style?.width as number) || 400;
      const zh = (zone.style?.height as number) || 300;
      if (absPos.x >= zAbs.x && absPos.x <= zAbs.x + zw &&
          absPos.y >= zAbs.y && absPos.y <= zAbs.y + zh) {
        const area = zw * zh;
        if (area < bestArea) {
          bestArea = area;
          bestZone = zone;
        }
      }
    }

    const newParentId = bestZone?.id || undefined;

    // No change needed
    if (node.parentId === newParentId) {
      // Still update zoneInternetExposed if component
      if (data.kind === 'component') {
        const zoneData = bestZone?.data as ZoneNodeData | undefined;
        const exposed = zoneData?.zoneType === 'internet';
        if ((data as ComponentNodeData).zoneInternetExposed !== exposed) {
          changed = true;
          return { ...node, data: { ...data, zoneInternetExposed: exposed } as CanvasNodeData };
        }
      }
      return node;
    }

    changed = true;

    if (newParentId && bestZone) {
      // Adopt into zone: convert absolute → relative position
      const zAbs = getAbsPos(bestZone, nodes);
      const relPos = { x: absPos.x - zAbs.x, y: absPos.y - zAbs.y };
      const zoneData = bestZone.data as ZoneNodeData;
      const exposed = zoneData.zoneType === 'internet';
      const updatedData = data.kind === 'component'
        ? { ...data, zoneInternetExposed: exposed }
        : data;
      return { ...node, position: relPos, parentId: newParentId, data: updatedData as CanvasNodeData };
    } else {
      // Unparent: position is already absolute after React Flow applies changes
      // but if it had a parentId, we need to convert relative → absolute
      const updatedData = data.kind === 'component'
        ? { ...data, zoneInternetExposed: false }
        : data;
      const { parentId: _removed, extent: _ext, ...rest } = node;
      return { ...rest, position: absPos, data: updatedData as CanvasNodeData } as Node<CanvasNodeData>;
    }
  });

  return changed ? result : nodes;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  selectedElement: null,
  paletteSearch: '',
  paletteCategory: 'all',
  paletteDragItem: null,
  propertyPanelOpen: false,
  showMinimap: true,
  showGrid: true,

  // ── React Flow Handlers ───────────────────────────────────────────────────

  onNodesChange: (changes) => {
    let nodes = applyNodeChanges(changes, get().nodes) as Node<CanvasNodeData>[];

    // After position/dimension changes, re-evaluate zone membership
    const hasPositionOrResize = changes.some(
      (c) => c.type === 'position' || c.type === 'dimensions',
    );
    if (hasPositionOrResize) {
      nodes = reconcileZoneMembership(nodes);
    }

    set({ nodes });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) as Edge<ConnectionData>[] });
  },

  onConnect: (connection: Connection) => {
    const newEdge: Edge<ConnectionData> = {
      ...connection,
      id: nextEdgeId(),
      type: 'protocol',
      data: { ...DEFAULT_CONNECTION_DATA },
    } as Edge<ConnectionData>;

    set({ edges: addEdge(newEdge, get().edges) as Edge<ConnectionData>[] });
  },

  // ── Node CRUD ─────────────────────────────────────────────────────────────

  addComponentNode: (iconKey, label, category, technologyType, position, parentId) => {
    const id = nextNodeId();
    const data: ComponentNodeData = {
      kind: 'component',
      label,
      description: '',
      iconKey,
      category,
      technologyType,
      internetFacing: false,
      zoneInternetExposed: false,
      isShared: false,
      dataClassification: 'internal' as DataClassification,
      tags: [],
    };

    const node: Node<CanvasNodeData> = {
      id,
      type: 'component',
      position,
      data,
      ...(parentId ? { parentId } : {}),
    };

    set({ nodes: [...get().nodes, node] });
    return id;
  },

  addZoneNode: (zoneType, label, position, size, parentId) => {
    const id = nextNodeId();
    const preset = ZONE_PRESETS.find((z) => z.type === zoneType);
    const colors = ZONE_COLORS[zoneType as keyof typeof ZONE_COLORS] || ZONE_COLORS.custom;

    const data: ZoneNodeData = {
      kind: 'zone',
      label: label || preset?.label || 'Zone',
      description: preset?.description || '',
      zoneType: zoneType as ZoneNodeData['zoneType'],
      trustLevel: preset?.trustLevel || 3,
      color: colors.border,
    };

    const node: Node<CanvasNodeData> = {
      id,
      type: 'zone',
      position,
      data,
      style: {
        width: size?.width || 400,
        height: size?.height || 300,
      },
      ...(parentId ? { parentId } : {}),
    };

    if (parentId) {
      // Child zones go after their parent so they render on top and are clickable
      const currentNodes = get().nodes;
      const parentIndex = currentNodes.findIndex((n) => n.id === parentId);
      const insertAt = parentIndex >= 0 ? parentIndex + 1 : currentNodes.length;
      const updated = [...currentNodes];
      updated.splice(insertAt, 0, node);
      set({ nodes: updated });
    } else {
      // Top-level zones go first so they render behind components
      set({ nodes: [node, ...get().nodes] });
    }
    return id;
  },

  addActorNode: (actorType, label, position) => {
    const id = nextNodeId();
    const data: ActorNodeData = {
      kind: 'actor',
      label,
      description: '',
      actorType: actorType as ActorNodeData['actorType'],
    };

    const node: Node<CanvasNodeData> = {
      id,
      type: 'actor',
      position,
      data,
    };

    set({ nodes: [...get().nodes, node] });
    return id;
  },

  addInlineControlNode: (controlType, label, position) => {
    const id = nextNodeId();
    const data: InlineControlNodeData = {
      kind: 'inline-control',
      label,
      description: '',
      controlType: controlType as InlineControlNodeData['controlType'],
      attachedEdgeId: '',
    };

    const node: Node<CanvasNodeData> = {
      id,
      type: 'inline-control',
      position,
      data,
    };

    set({ nodes: [...get().nodes, node] });
    return id;
  },

  splitEdgeWithControl: (edgeId, controlType, label, position) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return '';

    const controlId = nextNodeId();
    const data: InlineControlNodeData = {
      kind: 'inline-control',
      label,
      description: '',
      controlType: controlType as InlineControlNodeData['controlType'],
      attachedEdgeId: edgeId,
    };

    const controlNode: Node<CanvasNodeData> = {
      id: controlId,
      type: 'inline-control',
      position,
      data,
    };

    // Inherit original edge data for both new edges
    const inheritedData: ConnectionData = {
      ...DEFAULT_CONNECTION_DATA,
      ...(edge.data || {}),
    };

    const edge1: Edge<ConnectionData> = {
      id: nextEdgeId(),
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? undefined,
      target: controlId,
      type: 'protocol',
      data: { ...inheritedData },
    };

    const edge2: Edge<ConnectionData> = {
      id: nextEdgeId(),
      source: controlId,
      target: edge.target,
      targetHandle: edge.targetHandle ?? undefined,
      type: 'protocol',
      data: { ...inheritedData },
    };

    set({
      nodes: [...get().nodes, controlNode],
      edges: [
        ...get().edges.filter((e) => e.id !== edgeId),
        edge1,
        edge2,
      ],
    });

    return controlId;
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedElement:
        get().selectedElement?.id === nodeId ? null : get().selectedElement,
      propertyPanelOpen:
        get().selectedElement?.id === nodeId ? false : get().propertyPanelOpen,
    });
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as CanvasNodeData }
          : node,
      ),
    });
  },

  // ── Edge CRUD ─────────────────────────────────────────────────────────────

  updateEdgeData: (edgeId, data) => {
    set({
      edges: get().edges.map((edge) => {
        if (edge.id !== edgeId) return edge;
        const merged = { ...edge.data, ...data } as ConnectionData;
        // Auto-update completeness flags
        merged.completeness = {
          hasProtocol: merged.protocol !== 'none',
          hasAuth: merged.authentication !== 'none',
          hasEncryption: merged.encryption !== 'none',
        };
        return { ...edge, data: merged };
      }),
    });
  },

  removeEdge: (edgeId) => {
    set({
      edges: get().edges.filter((e) => e.id !== edgeId),
      selectedElement:
        get().selectedElement?.id === edgeId ? null : get().selectedElement,
      propertyPanelOpen:
        get().selectedElement?.id === edgeId ? false : get().propertyPanelOpen,
    });
  },

  // ── Selection ─────────────────────────────────────────────────────────────

  setSelectedElement: (element) => {
    set({
      selectedElement: element,
      propertyPanelOpen: element !== null,
    });
  },

  clearSelection: () => {
    set({ selectedElement: null, propertyPanelOpen: false });
  },

  // ── Palette ───────────────────────────────────────────────────────────────

  setPaletteSearch: (search) => set({ paletteSearch: search }),
  setPaletteCategory: (category) => set({ paletteCategory: category }),
  setPaletteDragItem: (itemId) => set({ paletteDragItem: itemId }),

  // ── UI ────────────────────────────────────────────────────────────────────

  setPropertyPanelOpen: (open) => set({ propertyPanelOpen: open }),
  toggleMinimap: () => set({ showMinimap: !get().showMinimap }),
  toggleGrid: () => set({ showGrid: !get().showGrid }),

  // ── Analysis Helpers ──────────────────────────────────────────────────────

  getNodeZoneId: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return null;
    // Walk up parentId chain to find the nearest zone ancestor
    let current = node;
    while (current.parentId) {
      const parent = get().nodes.find((n) => n.id === current.parentId);
      if (!parent) break;
      const parentData = parent.data as CanvasNodeData;
      if (parentData.kind === 'zone') return parent.id;
      current = parent;
    }
    return null;
  },

  isBoundaryCrossing: (edgeId) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return false;
    const sourceZone = get().getNodeZoneId(edge.source);
    const targetZone = get().getNodeZoneId(edge.target);
    // Crosses boundary if zones differ (including one being null/outside any zone)
    return sourceZone !== targetZone;
  },

  // ── Serialization ─────────────────────────────────────────────────────────

  exportDesign: () => ({
    version: '1.0' as const,
    nodes: get().nodes,
    edges: get().edges,
    exportedAt: new Date().toISOString(),
  }),

  importDesign: (design) => {
    set({
      nodes: design.nodes,
      edges: design.edges,
      selectedElement: null,
      propertyPanelOpen: false,
    });
  },

  resetCanvas: () => {
    set({
      nodes: [],
      edges: [],
      selectedElement: null,
      propertyPanelOpen: false,
    });
  },
}));
