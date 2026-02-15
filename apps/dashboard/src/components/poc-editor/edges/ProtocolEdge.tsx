'use client';

import { memo, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  type EdgeProps,
} from '@xyflow/react';
import type { ConnectionData } from '../types';
import { useEditorStore } from '../store/editor-store';
import { AlertTriangle, Lock, KeyRound, Wifi } from 'lucide-react';

function ProtocolEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const edgeData = data as unknown as ConnectionData | undefined;
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleClick = useCallback(() => {
    setSelectedElement({ type: 'edge', id });
  }, [id, setSelectedElement]);

  const protocol = edgeData?.protocol || 'none';
  const hasProtocol = protocol !== 'none';
  const hasAuth = edgeData?.authentication !== 'none' && edgeData?.authentication !== undefined;
  const hasEncryption = edgeData?.encryption !== 'none' && edgeData?.encryption !== undefined;

  // Red flag if protocol not set
  const isIncomplete = !hasProtocol;
  const missingCount = [!hasProtocol, !hasAuth, !hasEncryption].filter(Boolean).length;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={edgeData?.bidirectional ? undefined : MarkerType.ArrowClosed}
        style={{
          stroke: selected ? '#3b82f6' : isIncomplete ? '#ef4444' : '#94a3b8',
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: isIncomplete ? '5 3' : undefined,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className={`
            absolute pointer-events-auto cursor-pointer
            flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
            transform -translate-x-1/2 -translate-y-1/2
            transition-all duration-150
            ${selected
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400 shadow-sm'
              : isIncomplete
                ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 ring-1 ring-red-300'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-gray-600'
            }
          `}
          style={{
            position: 'absolute',
            left: labelX,
            top: labelY,
          }}
          onClick={handleClick}
        >
          {/* Protocol label */}
          {hasProtocol ? (
            <>
              <Wifi className="w-3 h-3" />
              <span>{protocol.toUpperCase()}</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>No protocol</span>
            </>
          )}

          {/* Security indicators */}
          {hasAuth && <KeyRound className="w-3 h-3 text-green-500" />}
          {hasEncryption && <Lock className="w-3 h-3 text-green-500" />}

          {/* Missing count badge */}
          {missingCount > 0 && (
            <span className="ml-0.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold">
              {missingCount}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const ProtocolEdge = memo(ProtocolEdgeInner);
