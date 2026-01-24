'use client';

export default function WizardPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Wizard Questions</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure questionnaire flow for guided threat model creation.
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No wizard questions configured</h3>
        <p className="mt-2 text-sm text-gray-400">
          Wizard question management will be added in checkpoint v3.6.0.
        </p>
      </div>
    </div>
  );
}
