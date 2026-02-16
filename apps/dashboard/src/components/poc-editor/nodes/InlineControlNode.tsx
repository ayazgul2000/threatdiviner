'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { InlineControlNodeData } from '../types';
import { useEditorStore } from '../store/editor-store';
import {
  ShieldAlert,
  Split,
  DoorOpen,
  KeyRound,
  Flame,
  Radar,
  Timer,
  Globe,
  ArrowLeftRight,
  Network,
} from 'lucide-react';

const CONTROL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  waf: ShieldAlert,
  'load-balancer': Split,
  'api-gateway': DoorOpen,
  'auth-proxy': KeyRound,
  firewall: Flame,
  'ids-ips': Radar,
  'rate-limiter': Timer,
  cdn: Globe,
  'reverse-proxy': ArrowLeftRight,
  'service-mesh': Network,
};

function InlineControlNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as InlineControlNodeData;
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const Icon = CONTROL_ICONS[nodeData.controlType] || ShieldAlert;

  const handleDoubleClick = useCallback(() => {
    setSelectedElement({ type: 'node', id });
  }, [id, setSelectedElement]);

  return (
    <div
      className={`
        px-2.5 py-1.5 rounded-lg border-2 bg-white dark:bg-gray-800
        flex items-center gap-1.5 cursor-pointer transition-all duration-150
        ${selected
          ? 'border-amber-500 shadow-md shadow-amber-100 dark:shadow-amber-900/30'
          : 'border-amber-300 dark:border-amber-600 hover:border-amber-400'
        }
      `}
      onDoubleClick={handleDoubleClick}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-amber-400" />

      <Icon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {nodeData.label}
      </span>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-amber-400" />
    </div>
  );
}

export const InlineControlNode = memo(InlineControlNodeInner);
