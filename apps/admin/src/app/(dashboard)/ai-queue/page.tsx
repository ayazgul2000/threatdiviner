'use client';

export default function AIQueuePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">AI Queue</h1>
        <p className="mt-1 text-sm text-gray-400">
          Review and approve AI-generated suggestions for mappings and playbooks.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No pending AI suggestions</h3>
        <p className="mt-2 text-sm text-gray-400">
          AI suggestions will appear here after feed syncs run in checkpoint v3.8.0.
        </p>
      </div>
    </div>
  );
}
