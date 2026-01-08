'use client';

import { Plug, Github, GitBranch, MessageSquare, Bell, Webhook, CheckCircle } from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'scm' | 'notification' | 'ticketing' | 'cicd';
  connected?: boolean;
  comingSoon?: boolean;
}

const integrations: Integration[] = [
  // SCM
  {
    id: 'github',
    name: 'GitHub',
    description: 'Connect repositories and scan code for vulnerabilities',
    icon: <Github className="w-6 h-6" />,
    category: 'scm',
    connected: true,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Scan GitLab repositories for security issues',
    icon: <GitBranch className="w-6 h-6" />,
    category: 'scm',
    comingSoon: true,
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'Connect Bitbucket Cloud repositories',
    icon: <GitBranch className="w-6 h-6" />,
    category: 'scm',
    comingSoon: true,
  },
  {
    id: 'azure-devops',
    name: 'Azure DevOps',
    description: 'Integrate with Azure DevOps repositories',
    icon: <GitBranch className="w-6 h-6" />,
    category: 'scm',
    comingSoon: true,
  },
  // Notifications
  {
    id: 'slack',
    name: 'Slack',
    description: 'Receive security alerts in Slack channels',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'notification',
    comingSoon: true,
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Escalate critical vulnerabilities to PagerDuty',
    icon: <Bell className="w-6 h-6" />,
    category: 'notification',
    comingSoon: true,
  },
  {
    id: 'webhook',
    name: 'Webhooks',
    description: 'Send scan results to custom endpoints',
    icon: <Webhook className="w-6 h-6" />,
    category: 'notification',
    comingSoon: true,
  },
  // Ticketing
  {
    id: 'jira',
    name: 'Jira',
    description: 'Create tickets for findings automatically',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'ticketing',
    comingSoon: true,
  },
];

const CATEGORY_LABELS = {
  scm: 'Source Code Management',
  notification: 'Notifications',
  ticketing: 'Ticketing & Issue Tracking',
  cicd: 'CI/CD Pipelines',
};

export default function IntegrationsPage() {
  const groupedIntegrations = integrations.reduce((acc, integration) => {
    if (!acc[integration.category]) {
      acc[integration.category] = [];
    }
    acc[integration.category].push(integration);
    return acc;
  }, {} as Record<string, Integration[]>);

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Connect ThreatDiviner with your development and security tools
        </p>
      </div>

      {/* Integration Categories */}
      {Object.entries(groupedIntegrations).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((integration) => (
              <div
                key={integration.id}
                className={`p-5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 ${
                  integration.comingSoon ? 'opacity-60' : 'hover:border-blue-500 cursor-pointer'
                } transition-all`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400">
                      {integration.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {integration.name}
                        </h3>
                        {integration.connected && (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {integration.description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  {integration.comingSoon ? (
                    <span className="inline-flex items-center px-3 py-1 text-sm bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg">
                      Coming Soon
                    </span>
                  ) : integration.connected ? (
                    <button className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      Configure
                    </button>
                  ) : (
                    <button className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
