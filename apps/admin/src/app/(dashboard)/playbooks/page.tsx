'use client';

export default function PlaybooksPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Remediation Playbooks</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage step-by-step remediation guides with IaC snippets for fixing security risks.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No playbooks configured</h3>
        <p className="mt-2 text-sm text-gray-400">
          Remediation playbooks will be added in checkpoint v3.5.0.
        </p>
      </div>
    </div>
  );
}
