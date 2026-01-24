'use client';

export default function FeedsPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Feed Sync</h1>
        <p className="mt-1 text-sm text-gray-400">
          Monitor and manage synchronization of external security data feeds (CWE, CAPEC, NIST, etc.).
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No feed configurations</h3>
        <p className="mt-2 text-sm text-gray-400">
          Feed sync configuration will be added in checkpoint v3.7.0.
        </p>
      </div>
    </div>
  );
}
