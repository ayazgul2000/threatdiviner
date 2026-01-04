'use client';

import { useState, useCallback } from 'react';
import { Button } from './button';

interface FilterOption {
  label: string;
  value: string;
}

interface Filter {
  name: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface TableToolbarProps {
  searchPlaceholder?: string;
  onSearch: (query: string) => void;
  searchValue?: string;
  filters?: Filter[];
  onClearFilters?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export function TableToolbar({
  searchPlaceholder = 'Search...',
  onSearch,
  searchValue = '',
  filters = [],
  onClearFilters,
  actions,
  className = '',
}: TableToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchValue);

  const handleSearch = useCallback((value: string) => {
    setLocalSearch(value);
    onSearch(value);
  }, [onSearch]);

  const hasActiveFilters = filters.some((f) => f.value !== '' && f.value !== 'all');

  return (
    <div className={`flex flex-col sm:flex-row gap-4 mb-4 ${className}`}>
      {/* Search input */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={localSearch}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {localSearch && (
          <button
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <select
            key={filter.name}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">{filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}

        {/* Clear filters */}
        {hasActiveFilters && onClearFilters && (
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear
          </Button>
        )}

        {/* Custom actions */}
        {actions}
      </div>
    </div>
  );
}
