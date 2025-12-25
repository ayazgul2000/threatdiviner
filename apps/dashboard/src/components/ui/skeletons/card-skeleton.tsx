'use client';

import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface CardSkeletonProps {
  className?: string;
  showHeader?: boolean;
  contentLines?: number;
}

export function CardSkeleton({
  className,
  showHeader = true,
  contentLines = 3
}: CardSkeletonProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
      className
    )}>
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <Skeleton className="h-5 w-1/3" />
        </div>
      )}
      <div className="p-6 space-y-3">
        {Array.from({ length: contentLines }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-4"
            style={{ width: `${Math.random() * 40 + 50}%` }}
          />
        ))}
      </div>
    </div>
  );
}
