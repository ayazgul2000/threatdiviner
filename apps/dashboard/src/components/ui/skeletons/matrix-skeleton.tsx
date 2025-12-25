'use client';

import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface MatrixSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function MatrixSkeleton({
  rows = 12,
  columns = 8,
  className
}: MatrixSkeletonProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 overflow-x-auto',
      className
    )}>
      {/* Header */}
      <Skeleton className="h-6 w-48 mb-4" />

      {/* Column headers */}
      <div className="flex gap-2 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <Skeleton className="h-4 w-24 flex-shrink-0" />
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-16 flex-shrink-0" />
        ))}
      </div>

      {/* Matrix rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex gap-2">
            <Skeleton className="h-8 w-24 flex-shrink-0" />
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={colIndex}
                className={cn(
                  'h-8 w-16 flex-shrink-0 rounded',
                  Math.random() > 0.7 ? 'opacity-100' : 'opacity-30'
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AttackMatrixSkeleton() {
  return (
    <MatrixSkeleton rows={14} columns={10} />
  );
}
