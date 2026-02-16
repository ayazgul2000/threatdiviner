'use client';

import { useState, useCallback } from 'react';
import { safeFetch } from './use-safe-fetch';

export interface Gap {
  elementType: 'asset' | 'link' | 'boundary';
  elementId: string;
  elementName: string;
  field: string;
  rule: string;
  message: string;
  currentValue?: any;
  suggestions?: string[];
}

export interface GapDetectionResult {
  valid: boolean;
  gaps: Gap[];
  summary: {
    totalGaps: number;
    assetGaps: number;
    linkGaps: number;
    boundaryGaps: number;
  };
}

export interface GapFillResult {
  assetsUpdated: number;
  linksUpdated: number;
  boundariesUpdated: number;
  totalErrors: number;
  gapResult: GapDetectionResult;
}

export interface UseGapDetectionResult {
  gaps: GapDetectionResult | null;
  isLoading: boolean;
  error: string | null;
  detectGaps: (threatModelId: string) => Promise<GapDetectionResult | null>;
  fillGaps: (
    threatModelId: string,
    updates: {
      assetUpdates: Array<{ id: string; fields: Record<string, any> }>;
      linkUpdates: Array<{ id: string; fields: Record<string, any> }>;
      boundaryUpdates: Array<{ id: string; fields: Record<string, any> }>;
    },
  ) => Promise<GapFillResult | null>;
  clearGaps: () => void;
}

export function useGapDetection(): UseGapDetectionResult {
  const [gaps, setGaps] = useState<GapDetectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detectGaps = useCallback(
    async (threatModelId: string): Promise<GapDetectionResult | null> => {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await safeFetch<GapDetectionResult>(
        `/threat-modeling/${threatModelId}/gaps`,
      );

      setIsLoading(false);

      if (fetchError) {
        setError(fetchError);
        return null;
      }

      if (data) {
        setGaps(data);
      }

      return data;
    },
    [],
  );

  const fillGaps = useCallback(
    async (
      threatModelId: string,
      updates: {
        assetUpdates: Array<{ id: string; fields: Record<string, any> }>;
        linkUpdates: Array<{ id: string; fields: Record<string, any> }>;
        boundaryUpdates: Array<{ id: string; fields: Record<string, any> }>;
      },
    ): Promise<GapFillResult | null> => {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await safeFetch<GapFillResult>(
        `/threat-modeling/${threatModelId}/gaps/fill`,
        {
          method: 'POST',
          body: JSON.stringify(updates),
        },
      );

      setIsLoading(false);

      if (fetchError) {
        setError(fetchError);
        return null;
      }

      if (data) {
        setGaps(data.gapResult);
      }

      return data;
    },
    [],
  );

  const clearGaps = useCallback(() => {
    setGaps(null);
    setError(null);
  }, []);

  return {
    gaps,
    isLoading,
    error,
    detectGaps,
    fillGaps,
    clearGaps,
  };
}

export default useGapDetection;
