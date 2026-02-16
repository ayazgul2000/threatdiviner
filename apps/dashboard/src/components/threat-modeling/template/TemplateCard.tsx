'use client';

import { cn } from '@/lib/utils';
import type { TemplateListItem } from '@/lib/api';

interface TemplateCardProps {
  template: TemplateListItem;
  selected?: boolean;
  onSelect: (template: TemplateListItem) => void;
  onPreview?: (template: TemplateListItem) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  aws: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  azure: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  gcp: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  web: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  mobile: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  iot: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  microservices: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
};

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  aws: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  azure: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  gcp: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  web: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  mobile: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  iot: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
    </svg>
  ),
  microservices: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
};

export function TemplateCard({ template, selected, onSelect, onPreview }: TemplateCardProps) {
  const categoryColor = CATEGORY_COLORS[template.category] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  const categoryIcon = CATEGORY_ICONS[template.category] || (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
    </svg>
  );

  return (
    <div
      className={cn(
        'relative p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md',
        'bg-white dark:bg-gray-900',
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
      )}
      onClick={() => onSelect(template)}
    >
      {/* Selected Indicator */}
      {selected && (
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Preview Image or Placeholder */}
      <div className="mb-3 h-24 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center">
        {template.previewImageUrl ? (
          <img
            src={template.previewImageUrl}
            alt={template.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={cn('p-4 rounded-lg', categoryColor)}>
            {categoryIcon}
          </div>
        )}
      </div>

      {/* Template Info */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900 dark:text-white line-clamp-1">
            {template.name}
          </h3>
          <span className={cn('px-2 py-0.5 text-xs rounded-full flex-shrink-0', categoryColor)}>
            {template.category}
          </span>
        </div>

        {template.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {template.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            {template.componentCount} components
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {template.dataFlowCount} flows
          </span>
        </div>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="px-1.5 py-0.5 text-xs text-gray-400">
                +{template.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Preview Button */}
        {onPreview && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPreview(template);
            }}
            className="mt-2 w-full py-1.5 text-xs text-center text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            View Details
          </button>
        )}
      </div>
    </div>
  );
}
