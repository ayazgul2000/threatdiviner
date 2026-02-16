'use client';

import { cn } from '@/lib/utils';
import type { WizardQuestion } from '@/lib/api';

interface WizardStepProps {
  question: WizardQuestion;
  onSelect: (value: string) => void;
  isLoading?: boolean;
  selectedValue?: string;
}

export function WizardStep({
  question,
  onSelect,
  isLoading = false,
  selectedValue,
}: WizardStepProps) {
  return (
    <div className="space-y-6">
      {/* Question */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {question.text}
        </h2>
        {question.helpText && (
          <p className="text-gray-500 dark:text-gray-400">{question.helpText}</p>
        )}
      </div>

      {/* Options */}
      <div className="grid gap-3">
        {question.options.map((option) => {
          const isSelected = selectedValue === option.value;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.value)}
              disabled={isLoading}
              className={cn(
                'flex items-start gap-4 p-4 rounded-lg border-2 text-left transition-all',
                'hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                'dark:focus:ring-offset-gray-900',
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {/* Icon or Radio indicator */}
              <div
                className={cn(
                  'flex-shrink-0 w-5 h-5 mt-0.5 rounded-full border-2',
                  isSelected
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {isSelected && (
                  <svg
                    className="w-full h-full text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>

              {/* Option content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {option.iconUrl && (
                    <img
                      src={option.iconUrl}
                      alt=""
                      className="w-5 h-5 rounded"
                    />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </span>
                </div>
                {option.description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {option.description}
                  </p>
                )}
              </div>

              {/* Loading indicator on selected */}
              {isSelected && isLoading && (
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-500 animate-spin"
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
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
