'use client';

export default function CanonicalRisksPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Canonical Risks</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage deduplication rules that consolidate overlapping risks from different sources.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No canonical risks configured</h3>
        <p className="mt-2 text-sm text-gray-400">
          Canonical risk mappings will be added in checkpoint v3.3.0.
        </p>
      </div>
    </div>
  );
}
