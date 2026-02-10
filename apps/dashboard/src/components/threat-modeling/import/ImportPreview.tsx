'use client';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import type { ImportPreviewResult } from '@/lib/api';

interface ImportPreviewProps {
  preview: ImportPreviewResult;
  className?: string;
}

export function ImportPreview({ preview, className }: ImportPreviewProps) {
  const { fileType, title, description, components, dataFlows, securityConcerns, metadata } =
    preview;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <FileTypeIcon type={fileType} />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
          )}
        </div>
        <span
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-full',
            fileType === 'openapi' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
            fileType === 'terraform' && 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
            fileType === 'drawio' && 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
          )}
        >
          {fileType.toUpperCase()}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard value={components.length} label="Components" color="blue" />
        <StatCard value={dataFlows.length} label="Data Flows" color="purple" />
        <StatCard
          value={securityConcerns.length}
          label="Security Concerns"
          color={securityConcerns.length > 0 ? 'yellow' : 'green'}
        />
      </div>

      {/* Security Concerns */}
      {securityConcerns.length > 0 && (
        <Card variant="bordered" className="border-yellow-300 dark:border-yellow-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Security Concerns Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {securityConcerns.map((concern, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-sm text-yellow-700 dark:text-yellow-400"
                >
                  <span className="flex-shrink-0 mt-1">•</span>
                  {concern}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Components */}
      {components.length > 0 && (
        <Card variant="bordered">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Components ({components.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
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
                    <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {comp.type}
                    </span>
                    {comp.criticality && (
                      <span
                        className={cn(
                          'px-2 py-0.5 text-xs rounded',
                          comp.criticality === 'critical' &&
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                          comp.criticality === 'high' &&
                            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
                          comp.criticality === 'medium' &&
                            'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                          comp.criticality === 'low' &&
                            'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                        )}
                      >
                        {comp.criticality}
                      </span>
                    )}
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
            <CardTitle className="text-base">Data Flows ({dataFlows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {dataFlows.map((flow, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                >
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                    {flow.sourceName}
                  </span>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                    {flow.targetName}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    {flow.protocol && (
                      <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        {flow.protocol}
                      </span>
                    )}
                    {flow.encrypted && (
                      <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
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

      {/* Metadata */}
      {metadata && Object.keys(metadata).length > 0 && (
        <Card variant="bordered">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Additional Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <dt className="text-gray-500 dark:text-gray-400 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
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
  color: 'blue' | 'purple' | 'green' | 'yellow';
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
  };

  return (
    <div className={cn('p-4 rounded-lg text-center', colors[color])}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm">{label}</div>
    </div>
  );
}

function FileTypeIcon({ type }: { type: string }) {
  const iconClass = 'w-6 h-6';

  switch (type) {
    case 'openapi':
      return (
        <svg className={cn(iconClass, 'text-green-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'terraform':
      return (
        <svg className={cn(iconClass, 'text-purple-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      );
    case 'drawio':
      return (
        <svg className={cn(iconClass, 'text-orange-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      );
    default:
      return (
        <svg className={cn(iconClass, 'text-gray-600')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
  }
}

function ComponentIcon({ type }: { type: string }) {
  const iconClass = 'w-5 h-5 text-gray-500 dark:text-gray-400';

  switch (type.toLowerCase()) {
    case 'data_store':
    case 'datastore':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      );
    case 'external_entity':
    case 'external':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
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
