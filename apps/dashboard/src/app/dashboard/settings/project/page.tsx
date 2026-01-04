'use client';

import Link from 'next/link';
import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Users, Bell, Plug, Settings, Shield, GitBranch } from 'lucide-react';

const projectSettingsSections = [
  {
    title: 'SCM Access',
    description: 'Configure which SCM connections and repositories this project can access',
    href: '/dashboard/settings/project/scm-access',
    icon: GitBranch,
  },
  {
    title: 'Project Team',
    description: 'Manage team members and their project access levels',
    href: '/dashboard/settings/project/team',
    icon: Users,
  },
  {
    title: 'Alerts',
    description: 'Configure project-specific alerting rules and thresholds',
    href: '/dashboard/settings/project/alerts',
    icon: Bell,
  },
  {
    title: 'Integrations',
    description: 'Connect project to CI/CD, ticketing, and notification tools',
    href: '/dashboard/settings/project/integrations',
    icon: Plug,
  },
  {
    title: 'Security Policies',
    description: 'Configure severity thresholds and scan policies',
    href: '/dashboard/settings/project/policies',
    icon: Shield,
  },
];

export default function ProjectSettingsPage() {
  const { currentProject } = useProject();

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Project Settings"
          description="Select a project to manage its settings"
          breadcrumbs={[
            { label: 'Settings', href: '/dashboard/settings' },
            { label: 'Project' },
          ]}
        />
        <EmptyState
          icon="folder"
          title="No Project Selected"
          description="Please select a project from the sidebar to configure its settings."
          actionLabel="Go to Projects"
          actionHref="/dashboard/projects"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${currentProject.name} Settings`}
        description="Manage settings specific to this project"
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/settings' },
          { label: 'Project' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projectSettingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card variant="bordered" className="h-full hover:border-blue-500 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{section.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
