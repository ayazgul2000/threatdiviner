'use client';

import { Bell, AlertTriangle, Settings, Activity } from 'lucide-react';

export default function MonitoringPage() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Monitoring</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Real-time security monitoring, alerts, and automated responses
        </p>
      </div>

      {/* Coming Soon */}
      <div className="text-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
        <Bell className="w-16 h-16 mx-auto text-slate-400 mb-4" />
        <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
          Security Monitoring Coming Soon
        </h3>
        <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6">
          Set up continuous security monitoring with custom alert rules and automated response workflows.
        </p>
      </div>

      {/* Feature Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Security Alerts</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Get notified immediately when new critical vulnerabilities are detected.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
            <Settings className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Custom Rules</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Create custom alert rules based on severity, scanner, or specific vulnerability types.
          </p>
        </div>
        <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Integrations</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Send alerts to Slack, PagerDuty, email, or webhook endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}
