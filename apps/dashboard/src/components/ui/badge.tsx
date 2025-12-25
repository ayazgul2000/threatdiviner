'use client';

import { HTMLAttributes, forwardRef } from 'react';

export type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'destructive' | 'info' | 'critical' | 'high' | 'medium' | 'low' | 'outline';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  secondary: 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300',
  success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  destructive: 'bg-red-600 text-white dark:bg-red-700 dark:text-white',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  outline: 'bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300',
  // Severity-specific variants
  critical: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  medium: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  low: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'sm', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center font-medium rounded-full
          ${variants[variant]}
          ${sizes[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Convenience component for severity badges
interface SeverityBadgeProps extends Omit<BadgeProps, 'variant'> {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export const SeverityBadge = forwardRef<HTMLSpanElement, SeverityBadgeProps>(
  ({ severity, children, ...props }, ref) => {
    return (
      <Badge ref={ref} variant={severity} {...props}>
        {children || severity.toUpperCase()}
      </Badge>
    );
  }
);

SeverityBadge.displayName = 'SeverityBadge';

// Convenience component for status badges
interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'open' | 'fixed' | 'ignored' | 'false_positive';
}

const statusVariants: Record<StatusBadgeProps['status'], BadgeVariant> = {
  pending: 'default',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'warning',
  // Finding statuses
  open: 'danger',
  fixed: 'success',
  ignored: 'default',
  false_positive: 'warning',
};

const statusLabels: Record<StatusBadgeProps['status'], string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  open: 'Open',
  fixed: 'Fixed',
  ignored: 'Ignored',
  false_positive: 'False Positive',
};

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, children, ...props }, ref) => {
    return (
      <Badge ref={ref} variant={statusVariants[status]} {...props}>
        {children || statusLabels[status] || status}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';
