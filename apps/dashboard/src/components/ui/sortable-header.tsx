'use client';

interface SortState {
  field: string;
  direction: 'asc' | 'desc';
}

interface SortableHeaderProps {
  label: string;
  field: string;
  currentSort: SortState | null;
  onSort: (field: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
  className = '',
}: SortableHeaderProps) {
  const isActive = currentSort?.field === field;
  const direction = isActive ? currentSort.direction : null;

  return (
    <button
      className={`flex items-center gap-1 hover:text-gray-900 dark:hover:text-white font-medium ${className}`}
      onClick={() => onSort(field)}
    >
      {label}
      <span className="flex flex-col">
        {direction === 'asc' && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        )}
        {direction === 'desc' && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
        {!direction && (
          <svg className="h-4 w-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </span>
    </button>
  );
}

// Hook for managing sort state
export function useSort(defaultField?: string, defaultDirection: 'asc' | 'desc' = 'desc') {
  const [sort, setSort] = useState<SortState | null>(
    defaultField ? { field: defaultField, direction: defaultDirection } : null
  );

  const handleSort = (field: string) => {
    if (sort?.field === field) {
      if (sort.direction === 'asc') {
        setSort({ field, direction: 'desc' });
      } else {
        setSort(null);
      }
    } else {
      setSort({ field, direction: 'asc' });
    }
  };

  return { sort, handleSort };
}

import { useState } from 'react';
