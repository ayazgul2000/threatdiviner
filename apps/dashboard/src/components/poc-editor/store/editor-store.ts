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
    set({ nodes: applyNodeChanges(changes, get().nodes) as Node<CanvasNodeData>[] });
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
      dataClassification: 'internal' as DataClassification,
      tags: [],
    };

    const node: Node<CanvasNodeData> = {
      id,
      type: 'component',
      position,
      data,
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
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
      ...(parentId ? { parentId, extent: 'parent' as const } : {}),
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
