'use client';

import { cn } from '@/lib/utils';

interface CategoryFilterProps {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
  loading?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  web: 'Web App',
  mobile: 'Mobile',
  iot: 'IoT',
  microservices: 'Microservices',
};

export function CategoryFilter({
  categories,
  selected,
  onSelect,
  loading = false,
}: CategoryFilterProps) {
  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'px-4 py-1.5 text-sm rounded-full transition-colors',
          selected === null
            ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        )}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category)}
          className={cn(
            'px-4 py-1.5 text-sm rounded-full transition-colors',
            selected === category
              ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          )}
        >
          {CATEGORY_LABELS[category] || category}
        </button>
      ))}
    </div>
  );
}
