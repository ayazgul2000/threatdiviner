'use client';

import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface ChartSkeletonProps {
  height?: number;
  type?: 'bar' | 'line' | 'pie' | 'donut';
  className?: string;
}

export function ChartSkeleton({
  height = 256,
  type = 'bar',
  className
}: ChartSkeletonProps) {
  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6',
      className
    )}>
      <Skeleton className="h-5 w-32 mb-4" />

      {type === 'bar' && (
        <div className="flex items-end justify-around gap-2" style={{ height }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton
              key={i}
              className="w-8 rounded-t"
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      )}

      {type === 'line' && (
        <div className="relative" style={{ height }}>
          <Skeleton className="absolute bottom-0 left-0 right-0 h-px" />
          <Skeleton className="absolute top-0 bottom-0 left-0 w-px" />
          <div className="absolute inset-4">
            <Skeleton className="h-full w-full opacity-30" />
          </div>
        </div>
      )}

      {(type === 'pie' || type === 'donut') && (
        <div className="flex items-center justify-center" style={{ height }}>
          <Skeleton
            className={cn(
              'rounded-full',
              type === 'donut' && 'ring-8 ring-gray-100 dark:ring-gray-700'
            )}
            style={{ width: height * 0.8, height: height * 0.8 }}
          />
        </div>
      )}
    </div>
  );
}
