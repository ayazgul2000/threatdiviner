'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb } from './breadcrumb';
import { Badge } from './badge';
import { Button } from './button';

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  backHref?: string;
  actions?: ReactNode;
  className?: string;
  context?: {
    type?: 'repository' | 'scan' | 'finding' | 'threat-model' | 'sbom' | 'environment' | 'container' | 'cloud';
    name?: string;
    status?: string;
    metadata?: Record<string, string>;
  };
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  backHref,
  actions,
  className,
  context,
}: PageHeaderProps) {
  const router = useRouter();

  const getStatusColor = (status?: string) => {
    if (!status) return 'default';
    const upper = status.toUpperCase();
    switch (upper) {
      case 'COMPLETED':
      case 'HEALTHY':
      case 'ACTIVE':
      case 'RESOLVED':
      case 'FIXED':
      case 'SUCCESS':
        return 'success';
      case 'RUNNING':
      case 'IN_PROGRESS':
      case 'SCANNING':
        return 'info';
      case 'PENDING':
      case 'QUEUED':
      case 'WAITING':
        return 'warning';
      case 'FAILED':
      case 'ERROR':
      case 'CRITICAL':
      case 'BREACHED':
        return 'danger';
      default:
        return 'default';
    }
  };

  return (
    <div className={`mb-6 ${className || ''}`}>
      {breadcrumbs && <Breadcrumb items={breadcrumbs} />}

      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {backHref && (
            <button
              onClick={() => router.push(backHref)}
              className="mt-1 p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
          )}

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
              {context?.status && (
                <Badge variant={getStatusColor(context.status) as any}>
                  {context.status}
                </Badge>
              )}
            </div>

            {description && (
              <p className="text-gray-500 dark:text-gray-400 mt-1">{description}</p>
            )}

            {context?.metadata && Object.keys(context.metadata).length > 0 && (
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                {Object.entries(context.metadata).map(([key, value]) => (
                  <span key={key} className="flex items-center gap-1">
                    <span className="font-medium">{key}:</span>
                    <span>{value}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
