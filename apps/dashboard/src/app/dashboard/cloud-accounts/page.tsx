'use client';

import { Cloud, Plus, AlertCircle } from 'lucide-react';

export default function CloudAccountsPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cloud Accounts</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Connect and scan AWS, Azure, and GCP accounts for misconfigurations
          </p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg opacity-50 cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Connect Account
        </button>
      </div>

      {/* Coming Soon */}
      <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
        <Cloud className="w-16 h-16 mx-auto text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Cloud Security Coming Soon
        </h3>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
          Connect your cloud accounts to scan for misconfigurations, compliance violations, and security risks across AWS, Azure, and GCP.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">AWS</span>
          </div>
          <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Azure</span>
          </div>
          <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">GCP</span>
          </div>
        </div>
      </div>

      {/* Feature Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
            <Cloud className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Resource Inventory</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Discover and catalog all cloud resources across your accounts automatically.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center mb-4">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Misconfiguration Detection</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Identify security misconfigurations and get actionable remediation guidance.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
            <Cloud className="w-5 h-5 text-green-600" />
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Compliance Mapping</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Map findings to CIS Benchmarks, SOC2, PCI-DSS, and other compliance frameworks.
          </p>
        </div>
      </div>
    </div>
  );
}
