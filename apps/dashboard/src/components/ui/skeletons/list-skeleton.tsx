'use client';

import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface ListSkeletonProps {
  items?: number;
  showAvatar?: boolean;
  showBadge?: boolean;
  className?: string;
}

export function ListSkeleton({
  items = 5,
  showAvatar = false,
  showBadge = true,
  className
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          {showAvatar && (
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          {showBadge && (
            <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

export function FindingListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex gap-2 mt-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <Skeleton className="h-8 w-8 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
