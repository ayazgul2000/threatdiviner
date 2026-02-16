'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

interface DescriptionInputProps {
  onGenerate: (description: string, options?: { systemType?: string; industry?: string }) => void;
  isLoading?: boolean;
  className?: string;
}

const SYSTEM_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'web-app', label: 'Web Application' },
  { value: 'api', label: 'REST/GraphQL API' },
  { value: 'mobile', label: 'Mobile App' },
  { value: 'microservices', label: 'Microservices' },
  { value: 'iot', label: 'IoT System' },
  { value: 'data-pipeline', label: 'Data Pipeline' },
];

const INDUSTRIES = [
  { value: '', label: 'General' },
  { value: 'fintech', label: 'FinTech / Banking' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'e-commerce', label: 'E-Commerce' },
  { value: 'saas', label: 'SaaS' },
  { value: 'government', label: 'Government' },
];

const EXAMPLE_PROMPTS = [
  'A three-tier e-commerce web application with React frontend, Node.js API, and PostgreSQL database. Users can browse products, add to cart, and checkout with Stripe payment integration.',
  'A microservices-based banking application with mobile apps (iOS/Android), API Gateway, user authentication service, transaction service, notification service, and PostgreSQL databases.',
  'A healthcare patient portal with React frontend, REST API backend, MongoDB database, and integration with EHR systems. Handles PHI data and requires HIPAA compliance.',
];

export function DescriptionInput({
  onGenerate,
  isLoading = false,
  className,
}: DescriptionInputProps) {
  const [description, setDescription] = useState('');
  const [systemType, setSystemType] = useState('');
  const [industry, setIndustry] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 20) return;

    onGenerate(description.trim(), {
      systemType: systemType || undefined,
      industry: industry || undefined,
    });
  };

  const handleExampleClick = (example: string) => {
    setDescription(example);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-4', className)}>
      {/* Description Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Describe Your System <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your system architecture, components, data flows, and integrations..."
          rows={6}
          disabled={isLoading}
          className={cn(
            'w-full px-3 py-2 border rounded-lg shadow-sm transition-colors',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'dark:bg-gray-800 dark:text-white',
            'border-gray-300 dark:border-gray-600',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Be specific about components, technologies, data types, and integrations for better results.
          Minimum 20 characters.
        </p>
      </div>

      {/* Example Prompts */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Try an example:
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((example, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleExampleClick(example)}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 transition-colors truncate max-w-[200px]"
            >
              {example.slice(0, 40)}...
            </button>
          ))}
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        <svg
          className={cn('w-4 h-4 transition-transform', showAdvanced && 'rotate-90')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Advanced Options
      </button>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              System Type
            </label>
            <select
              value={systemType}
              onChange={(e) => setSystemType(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {SYSTEM_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
              Industry
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <Button
        type="submit"
        variant="primary"
        disabled={isLoading || description.trim().length < 20}
        className="w-full"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
            Generating with AI...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            Generate Threat Model
          </span>
        )}
      </Button>
    </form>
  );
}
