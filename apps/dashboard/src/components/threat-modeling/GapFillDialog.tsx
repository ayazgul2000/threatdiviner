'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

interface GapFillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gaps: GapDetectionResult;
  threatModelId: string;
  onComplete: () => void;
  onSkip?: () => void;
}

type GapUpdate = Record<string, Record<string, any>>;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function GapFillDialog({
  isOpen,
  onClose,
  gaps: gapResult,
  threatModelId,
  onComplete,
  onSkip,
}: GapFillDialogProps) {
  const [updates, setUpdates] = useState<{
    assets: GapUpdate;
    links: GapUpdate;
    boundaries: GapUpdate;
  }>({
    assets: {},
    links: {},
    boundaries: {},
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize updates from current values
  useEffect(() => {
    const newUpdates: typeof updates = {
      assets: {},
      links: {},
      boundaries: {},
    };

    for (const gap of gapResult.gaps) {
      const targetMap = gap.elementType === 'asset'
        ? newUpdates.assets
        : gap.elementType === 'link'
        ? newUpdates.links
        : newUpdates.boundaries;

      if (!targetMap[gap.elementId]) {
        targetMap[gap.elementId] = {};
      }

      // Pre-fill with current value if exists
      if (gap.currentValue !== undefined && gap.currentValue !== null) {
        targetMap[gap.elementId][gap.field] = gap.currentValue;
      } else if (gap.suggestions && gap.suggestions.length > 0) {
        // Pre-fill with first suggestion
        targetMap[gap.elementId][gap.field] = gap.suggestions[0];
      }
    }

    setUpdates(newUpdates);
  }, [gapResult.gaps]);

  const handleFieldChange = (
    elementType: 'asset' | 'link' | 'boundary',
    elementId: string,
    field: string,
    value: string,
  ) => {
    const targetKey = elementType === 'asset'
      ? 'assets'
      : elementType === 'link'
      ? 'links'
      : 'boundaries';

    setUpdates((prev) => ({
      ...prev,
      [targetKey]: {
        ...prev[targetKey],
        [elementId]: {
          ...prev[targetKey][elementId],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Convert updates to array format
      const assetUpdates = Object.entries(updates.assets).map(([id, fields]) => ({
        id,
        fields,
      }));

      const linkUpdates = Object.entries(updates.links).map(([id, fields]) => ({
        id,
        fields,
      }));

      const boundaryUpdates = Object.entries(updates.boundaries).map(([id, fields]) => ({
        id,
        fields,
      }));

      // Call the batch fill gaps API
      const res = await fetch(`${API_URL}/threat-modeling/${threatModelId}/gaps/fill`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetUpdates,
          linkUpdates,
          boundaryUpdates,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fill gaps');
      }

      onClose();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update fields');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getElementTypeLabel = (elementType: string) => {
    switch (elementType) {
      case 'asset':
        return 'Asset';
      case 'link':
        return 'Data Flow';
      case 'boundary':
        return 'Trust Boundary';
      default:
        return elementType;
    }
  };

  const getElementTypeIcon = (elementType: string) => {
    switch (elementType) {
      case 'asset':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
      case 'link':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        );
      case 'boundary':
        return (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getUpdateValue = (gap: Gap): string => {
    const targetMap = gap.elementType === 'asset'
      ? updates.assets
      : gap.elementType === 'link'
      ? updates.links
      : updates.boundaries;

    return targetMap[gap.elementId]?.[gap.field] || '';
  };

  // Group gaps by element
  const groupedGaps = gapResult.gaps.reduce((acc, gap) => {
    const key = `${gap.elementType}-${gap.elementId}`;
    if (!acc[key]) {
      acc[key] = {
        elementType: gap.elementType,
        elementId: gap.elementId,
        elementName: gap.elementName,
        gaps: [],
      };
    }
    acc[key].gaps.push(gap);
    return acc;
  }, {} as Record<string, { elementType: string; elementId: string; elementName: string; gaps: Gap[] }>);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Model Gaps Detected
        </div>
      </ModalHeader>

      <ModalBody className="max-h-[60vh] overflow-y-auto">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          The following fields need to be filled before running analysis. Fill in the required values below.
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="outline">
            {gapResult.summary.totalGaps} total gaps
          </Badge>
          {gapResult.summary.assetGaps > 0 && (
            <Badge variant="secondary">
              {gapResult.summary.assetGaps} asset gaps
            </Badge>
          )}
          {gapResult.summary.linkGaps > 0 && (
            <Badge variant="secondary">
              {gapResult.summary.linkGaps} link gaps
            </Badge>
          )}
          {gapResult.summary.boundaryGaps > 0 && (
            <Badge variant="secondary">
              {gapResult.summary.boundaryGaps} boundary gaps
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {Object.values(groupedGaps).map((group) => (
            <div
              key={`${group.elementType}-${group.elementId}`}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                {getElementTypeIcon(group.elementType)}
                <span className="font-medium text-gray-900 dark:text-white">
                  {group.elementName}
                </span>
                <Badge variant="outline" className="text-xs">
                  {getElementTypeLabel(group.elementType)}
                </Badge>
              </div>

              <div className="space-y-3">
                {group.gaps.map((gap) => (
                  <div key={`${gap.elementId}-${gap.field}`} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {gap.field}
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-normal">
                        ({gap.message})
                      </span>
                    </label>

                    {gap.suggestions && gap.suggestions.length > 0 ? (
                      <select
                        value={getUpdateValue(gap)}
                        onChange={(e) =>
                          handleFieldChange(
                            gap.elementType,
                            gap.elementId,
                            gap.field,
                            e.target.value,
                          )
                        }
                        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select {gap.field}</option>
                        {gap.suggestions.map((suggestion) => (
                          <option key={suggestion} value={suggestion}>
                            {suggestion}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={getUpdateValue(gap)}
                        onChange={(e) =>
                          handleFieldChange(
                            gap.elementType,
                            gap.elementId,
                            gap.field,
                            e.target.value,
                          )
                        }
                        placeholder={`Enter ${gap.field}`}
                        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModalBody>

      <ModalFooter>
        {onSkip && (
          <Button variant="ghost" onClick={onSkip} disabled={isSubmitting}>
            Skip for now
          </Button>
        )}
        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Updating...
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Fill Gaps & Continue
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

export default GapFillDialog;
