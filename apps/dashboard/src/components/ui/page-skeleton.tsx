'use client';

import { Skeleton, SkeletonTable, SkeletonCard, SkeletonChart, SkeletonStats } from './skeleton';

interface PageSkeletonProps {
  variant?: 'default' | 'table' | 'cards' | 'detail';
}

export function PageSkeleton({ variant = 'default' }: PageSkeletonProps) {
  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {variant === 'table' ? (
        <SkeletonTable rows={10} />
      ) : variant === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : variant === 'detail' ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SkeletonCard className="h-64" />
            </div>
            <SkeletonCard className="h-64" />
          </div>
          <SkeletonTable rows={5} />
        </>
      ) : (
        <>
          {/* Stats */}
          <SkeletonStats />

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonChart />
          </div>

          {/* Table */}
          <SkeletonTable />
        </>
      )}
    </div>
  );
}

// Specific skeleton variants for common pages
export function DashboardSkeleton() {
  return <PageSkeleton variant="default" />;
}

export function TablePageSkeleton() {
  return <PageSkeleton variant="table" />;
}

export function CardGridSkeleton() {
  return <PageSkeleton variant="cards" />;
}

export function DetailPageSkeleton() {
  return <PageSkeleton variant="detail" />;
}

// Inline loading state for smaller components
export function InlineLoadingState({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <svg
        className="animate-spin h-5 w-5 text-blue-600 mr-3"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="text-gray-500 dark:text-gray-400">{text}</span>
    </div>
  );
}
