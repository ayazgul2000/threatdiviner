'use client';

import { useEffect, useState } from 'react';

export interface ScanStage {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number; // milliseconds
}

interface ScanProgressProps {
  stages: ScanStage[];
  currentStage?: string;
  overallProgress?: number; // 0-100
}

const STAGE_ICONS: Record<string, React.ReactNode> = {
  clone: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  sast: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  sca: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  secrets: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  iac: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  dast: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  report: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

export function ScanProgress({ stages, currentStage, overallProgress }: ScanProgressProps) {
  const [pulseStage, setPulseStage] = useState<string | null>(null);

  useEffect(() => {
    // Find the running stage
    const running = stages.find(s => s.status === 'running');
    setPulseStage(running?.id || null);
  }, [stages]);

  const formatDuration = (ms?: number) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="space-y-4">
      {/* Overall Progress Bar */}
      {overallProgress !== undefined && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Overall Progress
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {overallProgress}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stage Pipeline */}
      <div className="flex items-center justify-between">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center flex-1">
            {/* Stage Node */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  relative w-12 h-12 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${stage.status === 'completed' ? 'bg-green-500 text-white' :
                    stage.status === 'running' ? 'bg-blue-500 text-white' :
                    stage.status === 'failed' ? 'bg-red-500 text-white' :
                    'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}
                `}
              >
                {/* Pulse animation for running stage */}
                {stage.status === 'running' && (
                  <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-50" />
                )}

                {/* Spinner for running stage */}
                {stage.status === 'running' ? (
                  <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : stage.status === 'completed' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stage.status === 'failed' ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  STAGE_ICONS[stage.id.toLowerCase()] || DEFAULT_ICON
                )}
              </div>

              {/* Stage Label */}
              <span className={`
                mt-2 text-xs font-medium
                ${stage.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                  stage.status === 'running' ? 'text-blue-600 dark:text-blue-400' :
                  stage.status === 'failed' ? 'text-red-600 dark:text-red-400' :
                  'text-gray-500 dark:text-gray-400'}
              `}>
                {stage.name}
              </span>

              {/* Duration */}
              {stage.duration && stage.status === 'completed' && (
                <span className="text-xs text-gray-400">
                  {formatDuration(stage.duration)}
                </span>
              )}
            </div>

            {/* Connector Line */}
            {index < stages.length - 1 && (
              <div className="flex-1 h-0.5 mx-2">
                <div
                  className={`
                    h-full transition-all duration-500
                    ${stage.status === 'completed' ? 'bg-green-500' :
                      stage.status === 'running' ? 'bg-gradient-to-r from-blue-500 to-gray-300 dark:to-gray-600' :
                      'bg-gray-200 dark:bg-gray-700'}
                  `}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact version for tables/lists
export function ScanProgressCompact({ stages }: { stages: ScanStage[] }) {
  const completed = stages.filter(s => s.status === 'completed').length;
  const total = stages.length;
  const running = stages.find(s => s.status === 'running');
  const failed = stages.find(s => s.status === 'failed');

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${failed ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        {running ? running.name : failed ? 'Failed' : completed === total ? 'Complete' : `${completed}/${total}`}
      </span>
    </div>
  );
}
