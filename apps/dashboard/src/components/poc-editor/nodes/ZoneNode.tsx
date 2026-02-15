'use client';

import { memo, useCallback } from 'react';
import { type NodeProps } from '@xyflow/react';
import type { ZoneNodeData } from '../types';
import { useEditorStore } from '../store/editor-store';
import { ZONE_COLORS } from '../constants';

function ZoneNodeInner({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ZoneNodeData;
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const colors = ZONE_COLORS[nodeData.zoneType] || ZONE_COLORS.custom;

  const handleDoubleClick = useCallback(() => {
    setSelectedElement({ type: 'node', id });
  }, [id, setSelectedElement]);

  return (
    <div
      className={`
        w-full h-full rounded-xl transition-all duration-150
        ${selected ? 'shadow-lg' : ''}
      `}
      style={{
        backgroundColor: colors.bg,
        border: `2px ${selected ? 'solid' : 'dashed'} ${colors.border}`,
        minWidth: 200,
        minHeight: 150,
      }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Zone Label (top-left) */}
      <div
        className="absolute top-0 left-3 -translate-y-1/2 px-2 py-0.5 rounded text-xs font-semibold"
        style={{
          backgroundColor: colors.border,
          color: 'white',
        }}
      >
        {nodeData.label}
        <span className="ml-1.5 opacity-75">
          L{nodeData.trustLevel}
        </span>
      </div>

      {/* Trust level indicator (top-right) */}
      <div className="absolute top-2 right-2 flex gap-0.5">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className="w-1.5 h-3 rounded-sm"
            style={{
              backgroundColor: level <= nodeData.trustLevel ? colors.border : 'rgba(0,0,0,0.1)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const ZoneNode = memo(ZoneNodeInner);
