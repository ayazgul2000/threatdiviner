'use client';

import { useState, useCallback } from 'react';
import { safeFetch } from './use-safe-fetch';
import type { GapDetectionResult } from './useGapDetection';

export interface AnalysisRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  riskCount?: number;
  errorMessage?: string;
}

export interface AnalysisStartResult {
  success: boolean;
  analysisRunId?: string;
  gaps?: GapDetectionResult;
  error?: string;
}

export interface UseAnalysisOptions {
  skipGapCheck?: boolean;
}

export interface UseAnalysisResult {
  isStarting: boolean;
  analysisRunId: string | null;
  gaps: GapDetectionResult | null;
  error: string | null;
  startAnalysis: (
    threatModelId: string,
    options?: UseAnalysisOptions
  ) => Promise<AnalysisStartResult>;
  clearAnalysis: () => void;
}

export function useAnalysis(): UseAnalysisResult {
  const [isStarting, setIsStarting] = useState(false);
  const [analysisRunId, setAnalysisRunId] = useState<string | null>(null);
  const [gaps, setGaps] = useState<GapDetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(
    async (
      threatModelId: string,
      options: UseAnalysisOptions = {}
    ): Promise<AnalysisStartResult> => {
      setIsStarting(true);
      setError(null);
      setGaps(null);
      setAnalysisRunId(null);

      try {
        const queryParams = options.skipGapCheck ? '?skipGapCheck=true' : '';
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/threat-modeling/${threatModelId}/analyze/threagile${queryParams}`,
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        // Handle 422 - gaps found
        if (response.status === 422) {
          const gapData = await response.json();
          setGaps(gapData);
          setIsStarting(false);
          return {
            success: false,
            gaps: gapData,
          };
        }

        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage = errorData.message || `Analysis failed with status ${response.status}`;
          setError(errorMessage);
          setIsStarting(false);
          return {
            success: false,
            error: errorMessage,
          };
        }

        // Success - analysis started
        const data = await response.json();
        const runId = data.analysisRunId || data.id;
        setAnalysisRunId(runId);
        setIsStarting(false);

        return {
          success: true,
          analysisRunId: runId,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to start analysis';
        setError(errorMessage);
        setIsStarting(false);
        return {
          success: false,
          error: errorMessage,
        };
      }
    },
    []
  );

  const clearAnalysis = useCallback((): void => {
    setIsStarting(false);
    setAnalysisRunId(null);
    setGaps(null);
    setError(null);
  }, []);

  return {
    isStarting,
    analysisRunId,
    gaps,
    error,
    startAnalysis,
    clearAnalysis,
  };
}

export default useAnalysis;
