'use client';

import { useState } from 'react';
import { GapCard, GapData } from './GapCard';
import { Select } from '@/components/ui';

interface GapListProps {
  gaps: GapData[];
  onSelect?: (gap: GapData) => void;
  onViewRemediation?: (gap: GapData) => void;
  frameworks?: { id: string; name: string }[];
}

export function GapList({ gaps, onSelect, onViewRemediation, frameworks = [] }: GapListProps) {
  const [frameworkFilter, setFrameworkFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('gap');

  const filteredGaps = gaps.filter((gap) => {
    if (frameworkFilter !== 'all' && gap.frameworkId !== frameworkFilter) {
      return false;
    }
    if (statusFilter !== 'all' && gap.gapStatus !== statusFilter) {
      return false;
    }
    return true;
  });

  const gapCount = gaps.filter(g => g.gapStatus === 'gap').length;
  const partialCount = gaps.filter(g => g.gapStatus === 'partial').length;

  const frameworkOptions = [
    { value: 'all', label: 'All Frameworks' },
    ...frameworks.map(f => ({ value: f.id, label: f.name })),
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'gap', label: `Gaps (${gapCount})` },
    { value: 'partial', label: `Partial (${partialCount})` },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          GAPS ({gapCount + partialCount} total)
        </h3>
        <div className="flex items-center gap-3">
          <Select
            value={frameworkFilter}
            onChange={(e) => setFrameworkFilter(e.target.value)}
            options={frameworkOptions}
            className="w-40"
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={statusOptions}
            className="w-36"
          />
        </div>
      </div>

      {filteredGaps.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          {gaps.length === 0 ? (
            <div>
              <div className="text-green-600 dark:text-green-400 font-medium text-lg mb-2">
                ✓ Fully Compliant
              </div>
              <p>No compliance gaps found for the selected frameworks.</p>
            </div>
          ) : (
            <p>No gaps match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGaps.map((gap) => (
            <GapCard
              key={`${gap.frameworkId}-${gap.controlId}`}
              gap={gap}
              onClick={() => onSelect?.(gap)}
              onViewRemediation={() => onViewRemediation?.(gap)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
