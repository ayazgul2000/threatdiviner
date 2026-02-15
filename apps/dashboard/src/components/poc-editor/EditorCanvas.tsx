'use client';

import { useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type ReactFlowInstance,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useEditorStore } from './store/editor-store';
import { ComponentNode } from './nodes/ComponentNode';
import { ZoneNode } from './nodes/ZoneNode';
import { ActorNode } from './nodes/ActorNode';
import { ProtocolEdge } from './edges/ProtocolEdge';
import type { PaletteItem, CanvasNodeData, ConnectionData } from './types';

const nodeTypes: NodeTypes = {
  component: ComponentNode,
  zone: ZoneNode,
  actor: ActorNode,
};

const edgeTypes: EdgeTypes = {
  protocol: ProtocolEdge,
};

export function EditorCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const onNodesChange = useEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange);
  const onConnect = useEditorStore((s) => s.onConnect);
  const addComponentNode = useEditorStore((s) => s.addComponentNode);
  const addZoneNode = useEditorStore((s) => s.addZoneNode);
  const addActorNode = useEditorStore((s) => s.addActorNode);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const showMinimap = useEditorStore((s) => s.showMinimap);
  const showGrid = useEditorStore((s) => s.showGrid);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onInit = useCallback((instance: any) => {
    reactFlowInstance.current = instance;
  }, []);

  // Handle node clicks for selection
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedElement({ type: 'node', id: node.id });
    },
    [setSelectedElement],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedElement({ type: 'edge', id: edge.id });
    },
    [setSelectedElement],
  );

  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // ── Drop handler ──────────────────────────────────────────────────────────

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      const type = e.dataTransfer.getData('application/poc-editor-type');
      const payloadStr = e.dataTransfer.getData('application/poc-editor-payload');

      if (!type || !payloadStr || !reactFlowInstance.current) return;

      // Convert screen coords to flow coords
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      try {
        const payload = JSON.parse(payloadStr);

        if (type === 'component') {
          const item = payload as PaletteItem;
          // Check if dropped inside a zone
          const zoneId = findZoneAtPosition(position.x, position.y);
          if (zoneId) {
            // Offset position relative to zone
            const zoneNode = nodes.find((n) => n.id === zoneId);
            if (zoneNode) {
              const relativePosition = {
                x: position.x - zoneNode.position.x,
                y: position.y - zoneNode.position.y,
              };
              addComponentNode(
                item.iconKey,
                item.label,
                item.category,
                item.technologyType,
                relativePosition,
                zoneId,
              );
              return;
            }
          }
          addComponentNode(
            item.iconKey,
            item.label,
            item.category,
            item.technologyType,
            position,
          );
        } else if (type === 'zone') {
          addZoneNode(payload.type, payload.label, position);
        } else if (type === 'actor') {
          addActorNode(payload.type, payload.label, position);
        }
      } catch {
        // Ignore parse errors from malformed drag data
      }
    },
    [addComponentNode, addZoneNode, addActorNode, nodes],
  );

  /** Find the topmost zone node at a given position */
  const findZoneAtPosition = useCallback(
    (x: number, y: number): string | null => {
      // Iterate in reverse (topmost rendered last)
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const data = node.data as CanvasNodeData;
        if (data.kind !== 'zone') continue;

        const w = (node.style?.width as number) || 400;
        const h = (node.style?.height as number) || 300;
        const nx = node.position.x;
        const ny = node.position.y;

        if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
          return node.id;
        }
      }
      return null;
    },
    [nodes],
  );

  // Default edge options
  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'protocol',
      animated: false,
    }),
    [],
  );

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        snapToGrid={showGrid}
        snapGrid={[15, 15]}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        selectionOnDrag
        panOnDrag={[1, 2]} // Left click + middle click to pan
        connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 1.5 }}
        proOptions={{ hideAttribution: true }}
      >
        {showGrid && (
          <Background
            gap={15}
            size={1}
            color="#e2e8f0"
          />
        )}
        <Controls
          showZoom
          showFitView
          showInteractive={false}
          position="bottom-right"
        />
        {showMinimap && (
          <MiniMap
            nodeStrokeWidth={3}
            pannable
            zoomable
            position="bottom-right"
            style={{ bottom: 50 }}
          />
        )}
      </ReactFlow>
    </div>
  );
}
