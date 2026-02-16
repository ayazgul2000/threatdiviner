'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ComponentNodeData, CanvasNodeData } from '../types';
import { useEditorStore } from '../store/editor-store';
import {
  Server,
  Database,
  HardDrive,
  Globe,
  Zap,
  Box,
  Key,
  Activity,
  BarChart3,
  Brain,
  Mail,
  Shield,
  Cloud,
  Square,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  compute: Server,
  database: Database,
  storage: HardDrive,
  network: Globe,
  serverless: Zap,
  container: Box,
  identity: Key,
  monitoring: Activity,
  analytics: BarChart3,
  'ai-ml': Brain,
  messaging: Mail,
  security: Shield,
  'cdn-edge': Cloud,
  generic: Square,
};

function ComponentNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ComponentNodeData;
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);

  const Icon = CATEGORY_ICONS[nodeData.category] || Square;

  // Warning badge: no zone parent
  const nodes = useEditorStore((s) => s.nodes);
  const thisNode = nodes.find((n) => n.id === id);
  const hasParentZone = thisNode?.parentId
    ? nodes.some((n) => n.id === thisNode.parentId && (n.data as CanvasNodeData).kind === 'zone')
    : false;

  const handleDoubleClick = useCallback(() => {
    setSelectedElement({ type: 'node', id });
  }, [id, setSelectedElement]);

  return (
    <div
      className={`
        relative bg-white dark:bg-gray-800 border-2 rounded-lg shadow-sm
        min-w-[120px] max-w-[180px] transition-all duration-150
        ${selected
          ? 'border-blue-500 shadow-blue-200 dark:shadow-blue-900 shadow-md'
          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
        }
      `}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-500" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-blue-500" id="left-target" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500" id="right-source" />

      {/* Warning badge: not in a zone */}
      {!hasParentZone && (
        <div
          className="absolute -top-2 -right-2 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] font-bold text-yellow-900 z-10"
          title="Not inside a trust boundary"
        >
          !
        </div>
      )}

      {/* Internet-facing badge */}
      {nodeData.internetFacing && (
        <div
          className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10"
          title="Internet-facing"
        >
          <Globe className="w-3 h-3 text-white" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col items-center p-3 gap-1.5">
        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
          <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 text-center leading-tight truncate w-full">
          {nodeData.label}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate w-full text-center">
          {nodeData.technologyType}
        </span>
      </div>
    </div>
  );
}

export const ComponentNode = memo(ComponentNodeInner);
