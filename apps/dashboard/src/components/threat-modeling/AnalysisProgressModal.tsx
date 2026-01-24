'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Stage types matching backend analysis stages and spec (06_user_flows.md §7.4)
export type AnalysisStage =
  | 'idle'
  | 'queued'
  | 'validating'      // 0-5%
  | 'generating'      // 5-20% - Generating YAML
  | 'running'         // 20-60% - Running Threagile Engine
  | 'processing'      // 60-80% - Processing Results
  | 'triaging'        // 80-95% - AI Triage
  | 'finalizing'      // 95-100% - Finalizing
  | 'completed'
  | 'failed';

export interface AnalysisProgress {
  stage: AnalysisStage;
  progress: number;
  message: string;
  riskCount?: number;
  error?: string;
}

interface AnalysisProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  threatModelId: string;
  analysisRunId: string | null;
  onComplete: (riskCount: number) => void;
  onError: (error: string) => void;
}

// Stage order for progress visualization (matches spec 06_user_flows.md §7.4)
const STAGE_ORDER: AnalysisStage[] = [
  'queued',
  'validating',    // 0-5%
  'generating',    // 5-20%
  'running',       // 20-60%
  'processing',    // 60-80%
  'triaging',      // 80-95%
  'finalizing',    // 95-100%
  'completed',
];

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: 'Preparing',
  queued: 'Queued',
  validating: 'Validating',
  generating: 'Generating YAML',
  running: 'Running Engine',
  processing: 'Processing Results',
  triaging: 'AI Triage',
  finalizing: 'Finalizing',
  completed: 'Completed',
  failed: 'Failed',
};

const STAGE_DESCRIPTIONS: Record<AnalysisStage, string> = {
  idle: 'Preparing analysis job...',
  queued: 'Waiting in analysis queue...',
  validating: 'Checking diagram completeness...',
  generating: 'Converting diagram to Threagile format...',
  running: 'Threagile engine analyzing your threat model...',
  processing: 'Parsing JSON, mapping to canonical risks...',
  triaging: 'Claude analyzing each risk for context...',
  finalizing: 'Saving risks, updating UI...',
  completed: 'Analysis completed successfully!',
  failed: 'Analysis encountered an error.',
};

// Progress percentages by stage (from spec 06_user_flows.md §7.4)
const STAGE_PROGRESS: Record<AnalysisStage, number> = {
  idle: 0,
  queued: 0,
  validating: 5,
  generating: 20,
  running: 60,
  processing: 80,
  triaging: 95,
  finalizing: 100,
  completed: 100,
  failed: 0,
};

export function AnalysisProgressModal({
  isOpen,
  onClose,
  threatModelId,
  analysisRunId,
  onComplete,
  onError,
}: AnalysisProgressModalProps): JSX.Element {
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'idle',
    progress: 0,
    message: 'Initializing...',
  });
  const [isPolling, setIsPolling] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const pollStatus = useCallback(async (): Promise<void> => {
    if (!analysisRunId) return;

    try {
      const res = await fetch(
        `${API_URL}/threat-modeling/${threatModelId}/analysis-runs/${analysisRunId}`,
        { credentials: 'include' }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch analysis status');
      }

      const data = await res.json();
      // Map backend stages to frontend stages
      let stage = data.status as AnalysisStage;

      // Handle potential backend stage name differences
      if (stage === 'running' && data.substage === 'yaml') {
        stage = 'generating';
      }

      // Use spec-defined progress percentages
      const progressPercent = STAGE_PROGRESS[stage] ?? 0;

      setProgress({
        stage,
        progress: progressPercent,
        message: STAGE_DESCRIPTIONS[stage] || data.errorMessage || 'Processing...',
        riskCount: data.riskCount,
        error: data.errorMessage,
      });

      if (stage === 'completed') {
        setIsPolling(false);
        onComplete(data.riskCount || 0);
      } else if (stage === 'failed') {
        setIsPolling(false);
        onError(data.errorMessage || 'Analysis failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setProgress(prev => ({
        ...prev,
        stage: 'failed',
        message: errorMessage,
        error: errorMessage,
      }));
      setIsPolling(false);
      onError(errorMessage);
    }
  }, [analysisRunId, threatModelId, API_URL, onComplete, onError]);

  // Start polling when analysisRunId is available
  useEffect(() => {
    if (!isOpen || !analysisRunId) return;

    setIsPolling(true);
    setProgress({
      stage: 'queued',
      progress: 0,
      message: 'Analysis started...',
    });

    // Poll immediately
    pollStatus();

    // Set up polling interval
    const interval = setInterval(() => {
      if (isPolling) {
        pollStatus();
      }
    }, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [isOpen, analysisRunId, pollStatus, isPolling]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProgress({
        stage: 'idle',
        progress: 0,
        message: 'Initializing...',
      });
      setIsPolling(false);
    }
  }, [isOpen]);

  const getStageIcon = (stage: AnalysisStage, currentStage: AnalysisStage): JSX.Element => {
    const stageIndex = STAGE_ORDER.indexOf(stage);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    if (currentStage === 'failed') {
      if (stage === currentStage || stageIndex > currentIndex) {
        return (
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      }
    }

    if (stageIndex < currentIndex || currentStage === 'completed') {
      return (
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }

    if (stageIndex === currentIndex) {
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      );
    }

    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-gray-400" />
      </div>
    );
  };

  const canClose = progress.stage === 'completed' || progress.stage === 'failed';

  return (
    <Modal isOpen={isOpen} onClose={canClose ? onClose : () => {}} size="md">
      <ModalHeader onClose={canClose ? onClose : undefined}>
        <div className="flex items-center gap-2">
          {progress.stage === 'completed' ? (
            <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : progress.stage === 'failed' ? (
            <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5 text-blue-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          )}
          Threagile Analysis
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">
              {STAGE_LABELS[progress.stage]}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {Math.round(progress.progress)}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                progress.stage === 'failed'
                  ? 'bg-red-500'
                  : progress.stage === 'completed'
                  ? 'bg-green-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${progress.progress}%` }}
            />
          </div>
        </div>

        {/* Stage Steps - Show work stages only (skip queued and completed) */}
        <div className="space-y-4">
          {STAGE_ORDER.slice(1, -1).map((stage, index) => {
            const currentStageIndex = STAGE_ORDER.indexOf(progress.stage);
            const stageIndex = STAGE_ORDER.indexOf(stage);
            const isComplete = currentStageIndex > stageIndex || progress.stage === 'completed';
            const isCurrent = currentStageIndex === stageIndex;
            const isPending = currentStageIndex < stageIndex;

            return (
              <div key={stage} className="flex items-start gap-3">
                {getStageIcon(stage, progress.stage)}
                <div className="flex-1 pt-1">
                  <div className={`font-medium ${
                    isComplete || isCurrent
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-600'
                  }`}>
                    {STAGE_LABELS[stage]}
                  </div>
                  {isCurrent && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {progress.message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Results */}
        {progress.stage === 'completed' && progress.riskCount !== undefined && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Analysis Complete
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {progress.riskCount} risk{progress.riskCount !== 1 ? 's' : ''} identified
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {progress.stage === 'failed' && progress.error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-red-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">
                  Analysis Failed
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {progress.error}
                </p>
              </div>
            </div>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {canClose ? (
          <Button onClick={onClose}>
            {progress.stage === 'completed' ? 'View Risks' : 'Close'}
          </Button>
        ) : (
          <Button variant="secondary" disabled>
            <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Analyzing...
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}

export default AnalysisProgressModal;
