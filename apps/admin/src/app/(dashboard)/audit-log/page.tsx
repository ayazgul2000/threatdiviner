'use client';

export default function AuditLogPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-gray-400">
          View all configuration changes and admin actions across the platform.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No audit entries</h3>
        <p className="mt-2 text-sm text-gray-400">
          Audit log entries will appear as configuration changes are made.
        </p>
      </div>
    </div>
  );
}
