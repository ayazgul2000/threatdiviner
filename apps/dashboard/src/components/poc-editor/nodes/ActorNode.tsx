'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ActorNodeData } from '../types';
import { useEditorStore } from '../store/editor-store';
import {
  User,
  UserCheck,
  UserCog,
  Bot,
  Building2,
  Skull,
} from 'lucide-react';

const ACTOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'external-user': User,
  'internal-user': UserCheck,
  'admin': UserCog,
  'service-account': Bot,
  'third-party': Building2,
  'attacker': Skull,
};

const ACTOR_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  'external-user': { bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', icon: 'text-orange-600 dark:text-orange-400' },
  'internal-user': { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', icon: 'text-green-600 dark:text-green-400' },
  'admin': { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-300 dark:border-purple-700', icon: 'text-purple-600 dark:text-purple-400' },
  'service-account': { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', icon: 'text-blue-600 dark:text-blue-400' },
  'third-party': { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-300 dark:border-yellow-700', icon: 'text-yellow-600 dark:text-yellow-400' },
  'attacker': { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-700', icon: 'text-red-600 dark:text-red-400' },
};

function ActorNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ActorNodeData;
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const Icon = ACTOR_ICONS[nodeData.actorType] || User;
  const colors = ACTOR_COLORS[nodeData.actorType] || ACTOR_COLORS['external-user'];

  const handleDoubleClick = useCallback(() => {
    setSelectedElement({ type: 'node', id });
  }, [id, setSelectedElement]);

  return (
    <div
      className={`
        relative flex flex-col items-center gap-1
        ${selected ? 'scale-110' : ''}
        transition-transform duration-150
      `}
      onDoubleClick={handleDoubleClick}
    >
      {/* Handle — actors only have source (they initiate flows) */}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-500" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-blue-500" id="right-source" />

      {/* Stick figure circle */}
      <div
        className={`
          w-14 h-14 rounded-full border-2 flex items-center justify-center
          ${colors.bg} ${colors.border}
          ${selected ? 'shadow-md ring-2 ring-blue-400' : 'shadow-sm'}
        `}
      >
        <Icon className={`w-7 h-7 ${colors.icon}`} />
      </div>

      {/* Label */}
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center max-w-[100px] truncate">
        {nodeData.label}
      </span>
    </div>
  );
}

export const ActorNode = memo(ActorNodeInner);
