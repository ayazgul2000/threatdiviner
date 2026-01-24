'use client';

import { Card, CardHeader, CardTitle, CardContent, Button } from '@/components/ui';
import { ComplianceProgress } from './ComplianceProgress';
import { GapData } from './GapCard';

export interface FrameworkStats {
  frameworkId: string;
  frameworkName: string;
  version: string;
  totalControls: number;
  satisfiedControls: number;
  partialControls: number;
  gapControls: number;
  compliancePercentage: number;
  controlDetails?: GapData[];
}

interface ComplianceCardProps {
  framework: FrameworkStats;
  onViewDetails?: () => void;
}

export function ComplianceCard({ framework, onViewDetails }: ComplianceCardProps) {
  const {
    frameworkName,
    version,
    totalControls,
    satisfiedControls,
    partialControls,
    gapControls,
    compliancePercentage,
  } = framework;

  return (
    <Card variant="bordered" className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {frameworkName}
          {version && (
            <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
              v{version}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Percentage Display */}
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {compliancePercentage}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Compliant
            </div>
          </div>

          {/* Progress Bar */}
          <ComplianceProgress percentage={compliancePercentage} size="lg" />

          {/* Stats Breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <span>✓</span>
                <span>Satisfied</span>
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {satisfiedControls}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <span>◐</span>
                <span>Partial</span>
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {partialControls}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <span>✗</span>
                <span>Gaps</span>
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {gapControls}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
              <span className="text-gray-500 dark:text-gray-400">Total Controls</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {totalControls}
              </span>
            </div>
          </div>

          {/* View Details Button */}
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onViewDetails}
              className="w-full mt-2"
            >
              View Details →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
