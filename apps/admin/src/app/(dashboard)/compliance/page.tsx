'use client';

export default function CompliancePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Compliance Frameworks</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage compliance frameworks and controls (ISO 27001, NIST 800-53, PCI-DSS, etc.).
        </p>
      </div>

      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <h3 className="mt-4 text-lg font-medium text-white">No compliance frameworks configured</h3>
        <p className="mt-2 text-sm text-gray-400">
          Compliance framework management will be added in checkpoint v3.4.0.
        </p>
      </div>
    </div>
  );
}
