'use client';

import Link from 'next/link';
import { Button } from './button';

interface EmptyStateProps {
  icon?: 'scan' | 'repo' | 'finding' | 'alert' | 'chart' | 'cloud' | 'search' | 'error' | 'connection' | 'threat' | 'shield' | 'sbom';
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  secondaryAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  size?: 'sm' | 'md' | 'lg';
}

const ICONS: Record<string, React.ReactNode> = {
  scan: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  repo: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  ),
  finding: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  alert: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  chart: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  cloud: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  search: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  connection: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  threat: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  ),
  shield: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  sbom: (
    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
};

export function EmptyState({
  icon = 'search',
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
}: EmptyStateProps) {
  const sizeClasses = {
    sm: { padding: 'py-8', icon: 'w-12 h-12', title: 'text-base' },
    md: { padding: 'py-12', icon: 'w-16 h-16', title: 'text-lg' },
    lg: { padding: 'py-16', icon: 'w-20 h-20', title: 'text-xl' },
  };

  const renderActionButton = (actionItem: typeof action, variant: 'primary' | 'secondary') => {
    if (!actionItem) return null;

    const buttonComponent = (
      <Button
        variant={variant === 'primary' ? 'primary' : 'outline'}
        onClick={actionItem.onClick}
      >
        {actionItem.label}
      </Button>
    );

    if (actionItem.href) {
      return <Link href={actionItem.href}>{buttonComponent}</Link>;
    }

    return buttonComponent;
  };

  return (
    <div className={`flex flex-col items-center justify-center ${sizeClasses[size].padding} px-4 text-center`}>
      <div className="text-gray-400 dark:text-gray-500 mb-4">
        <div className={sizeClasses[size].icon}>
          {ICONS[icon]}
        </div>
      </div>
      <h3 className={`${sizeClasses[size].title} font-medium text-gray-900 dark:text-white mb-2`}>
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-6">
          {description}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {renderActionButton(action, 'primary')}
          {renderActionButton(secondaryAction, 'secondary')}
        </div>
      )}
    </div>
  );
}

// Specific empty states
export function NoScansEmpty({ onScan }: { onScan?: () => void }) {
  return (
    <EmptyState
      icon="scan"
      title="No scans yet"
      description="Run your first security scan to start finding vulnerabilities in your code."
      action={onScan ? { label: 'Run First Scan', onClick: onScan } : undefined}
    />
  );
}

export function NoFindingsEmpty() {
  return (
    <EmptyState
      icon="finding"
      title="No findings found"
      description="Great news! No security issues were detected in your code."
    />
  );
}

export function NoRepositoriesEmpty({ onConnect }: { onConnect?: () => void }) {
  return (
    <EmptyState
      icon="repo"
      title="No repositories connected"
      description="Connect your GitHub or GitLab account to start scanning your repositories."
      action={onConnect ? { label: 'Connect Repository', onClick: onConnect } : undefined}
    />
  );
}

export function NoAlertsEmpty() {
  return (
    <EmptyState
      icon="alert"
      title="No alerts"
      description="When security rules are triggered, alerts will appear here."
    />
  );
}

export function NoDataEmpty() {
  return (
    <EmptyState
      icon="chart"
      title="No data available"
      description="Run some scans to see analytics and insights about your security posture."
    />
  );
}

export function SearchNoResults({ query }: { query?: string }) {
  return (
    <EmptyState
      icon="search"
      title="No results found"
      description={query ? `No matches for "${query}". Try a different search term.` : 'Try adjusting your filters or search terms.'}
    />
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="error"
      title="Something went wrong"
      description={message || 'An error occurred while loading this page. Please try again.'}
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  );
}

export function NoConnectionsEmpty({ onConnect }: { onConnect?: () => void }) {
  return (
    <EmptyState
      icon="connection"
      title="No connections yet"
      description="Connect to GitHub, GitLab, or Bitbucket to import your repositories."
      action={onConnect ? { label: 'Add Connection', onClick: onConnect } : { label: 'Add Connection', href: '/dashboard/connections' }}
    />
  );
}

export function NoThreatModelsEmpty() {
  return (
    <EmptyState
      icon="threat"
      title="No threat models yet"
      description="Create your first threat model to analyze and visualize potential security threats."
      action={{ label: 'Create Threat Model', href: '/dashboard/threat-modeling/new' }}
    />
  );
}

export function NoSbomEmpty() {
  return (
    <EmptyState
      icon="sbom"
      title="No SBOM data"
      description="Upload or generate a Software Bill of Materials to track dependencies and vulnerabilities."
      action={{ label: 'Upload SBOM', href: '/dashboard/sbom/upload' }}
    />
  );
}

export function NoCloudFindingsEmpty() {
  return (
    <EmptyState
      icon="cloud"
      title="No cloud findings"
      description="Connect your cloud accounts to start monitoring for misconfigurations."
      action={{ label: 'Connect Cloud', href: '/dashboard/cloud' }}
    />
  );
}

export function NoMatchingResultsEmpty({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon="search"
      title="No matching results"
      description="Try adjusting your filters or search terms to find what you're looking for."
      action={onClear ? { label: 'Clear Filters', onClick: onClear } : undefined}
      size="sm"
    />
  );
}

export function ZeroStateShield() {
  return (
    <EmptyState
      icon="shield"
      title="All clear!"
      description="No security vulnerabilities detected. Your codebase looks secure."
      size="md"
    />
  );
}
