'use client';

import { Badge } from '@/components/ui';

export interface GapData {
  controlId: string;
  controlName: string;
  frameworkId: string;
  frameworkName: string;
  gapStatus: 'gap' | 'partial' | 'satisfied';
  relatedRisks: {
    threatId: string;
    threatTitle: string;
    canonicalRiskId: string;
    canonicalRiskTitle: string;
    severity: string;
    mitigationStatus: string | null;
  }[];
  relevance: string;
}

interface GapCardProps {
  gap: GapData;
  onClick?: () => void;
  onViewRemediation?: () => void;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
};

const statusIcons: Record<string, string> = {
  gap: '✗',
  partial: '◐',
  satisfied: '✓',
};

const statusColors: Record<string, string> = {
  gap: 'text-red-600 dark:text-red-400',
  partial: 'text-yellow-600 dark:text-yellow-400',
  satisfied: 'text-green-600 dark:text-green-400',
};

export function GapCard({ gap, onClick, onViewRemediation }: GapCardProps) {
  const maxSeverity = gap.relatedRisks.reduce((max, risk) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    const riskOrder = order[risk.severity as keyof typeof order] ?? 4;
    const maxOrder = order[max as keyof typeof order] ?? 4;
    return riskOrder < maxOrder ? risk.severity : max;
  }, 'low');

  return (
    <div
      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-white">
              {gap.controlId}
            </span>
            <span className="text-gray-500 dark:text-gray-400">-</span>
            <span className="text-gray-700 dark:text-gray-300">
              {gap.controlName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" size="sm">
              {gap.frameworkName}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium">Related Risks: </span>
          {gap.relatedRisks.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              {gap.relatedRisks[0].canonicalRiskTitle}
              <span className={`px-1.5 py-0.5 rounded text-xs ${severityColors[maxSeverity]}`}>
                {maxSeverity.charAt(0).toUpperCase() + maxSeverity.slice(1)}
              </span>
              {gap.relatedRisks.length > 1 && (
                <span className="text-gray-400">
                  +{gap.relatedRisks.length - 1} more
                </span>
              )}
            </span>
          ) : (
            <span className="text-gray-400">None</span>
          )}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${statusColors[gap.gapStatus]}`}>
              {statusIcons[gap.gapStatus]} Status: {gap.gapStatus.charAt(0).toUpperCase() + gap.gapStatus.slice(1)}
            </span>
          </div>
          {onViewRemediation && gap.gapStatus !== 'satisfied' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewRemediation();
              }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              View Remediation →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
