'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { AiGenerationResult } from '@/lib/api';

interface AiPreviewProps {
  result: AiGenerationResult;
  className?: string;
}

export function AiPreview({ result, className }: AiPreviewProps) {
  const { title, description, components, dataFlows, boundaries, suggestedThreats } = result;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard value={components.length} label="Components" color="blue" />
        <StatCard value={dataFlows.length} label="Data Flows" color="purple" />
        <StatCard value={boundaries.length} label="Boundaries" color="orange" />
        <StatCard value={suggestedThreats.length} label="Threats" color="red" />
      </div>

      {/* Components */}
      {components.length > 0 && (
        <Card variant="bordered">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {components.map((comp, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <ComponentIcon type={comp.type} />
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {comp.name}
                      </div>
                      {comp.technology && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {comp.technology}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TypeBadge type={comp.type} />
                    {comp.criticality && <CriticalityBadge criticality={comp.criticality} />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Flows */}
      {dataFlows.length > 0 && (
        <Card variant="bordered">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Data Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {dataFlows.map((flow, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                >
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
                    {flow.sourceName}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[100px]">
                    {flow.targetName}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    {flow.protocol && (
                      <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        {flow.protocol}
                      </span>
                    )}
                    {flow.encrypted && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                        Encrypted
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Suggested Threats */}
      {suggestedThreats.length > 0 && (
        <Card variant="bordered" className="border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Suggested Threats to Investigate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {suggestedThreats.map((threat, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <span className="flex-shrink-0 w-5 h-5 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-xs font-medium text-red-600 dark:text-red-400">
                    {idx + 1}
                  </span>
                  {threat}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Boundaries */}
      {boundaries.length > 0 && (
        <Card variant="bordered" className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Trust Boundaries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {boundaries.map((boundary, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-dashed border-orange-300 dark:border-orange-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{boundary.name}</span>
                    <span className="px-2 py-0.5 text-xs bg-orange-200 dark:bg-orange-800 text-orange-700 dark:text-orange-300 rounded">
                      {boundary.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{boundary.description}</p>
                  {boundary.componentNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {boundary.componentNames.map((name, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: 'blue' | 'purple' | 'orange' | 'red';
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };

  return (
    <div className={cn('p-3 rounded-lg text-center', colors[color])}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

function ComponentIcon({ type }: { type: string }) {
  const iconClass = 'w-5 h-5 text-gray-500 dark:text-gray-400';

  switch (type) {
    case 'data_store':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      );
    case 'external_entity':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
        </svg>
      );
  }
}

function TypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    process: 'Process',
    data_store: 'Data Store',
    external_entity: 'External',
  };
  return (
    <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
      {labels[type] || type}
    </span>
  );
}

function CriticalityBadge({ criticality }: { criticality: string }) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  };
  return (
    <span className={cn('px-2 py-0.5 text-xs rounded', colors[criticality] || colors.medium)}>
      {criticality}
    </span>
  );
}
