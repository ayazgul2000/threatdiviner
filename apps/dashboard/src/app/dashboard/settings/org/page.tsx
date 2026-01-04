'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Key, GitBranch, CreditCard, Building2, Shield, Settings } from 'lucide-react';

const orgSettingsSections = [
  {
    title: 'General Settings',
    description: 'Configure organization-wide settings and preferences',
    href: '/dashboard/settings/org/general',
    icon: Settings,
  },
  {
    title: 'Organization Team',
    description: 'Manage organization members and their roles',
    href: '/dashboard/settings/org/team',
    icon: Users,
  },
  {
    title: 'SCM Connections',
    description: 'Connect GitHub, GitLab, Bitbucket, and Azure DevOps',
    href: '/dashboard/connections',
    icon: GitBranch,
  },
  {
    title: 'API Keys',
    description: 'Manage API keys for CLI and integrations',
    href: '/dashboard/settings/api-keys',
    icon: Key,
  },
  {
    title: 'SSO & Security',
    description: 'Configure single sign-on and security policies',
    href: '/dashboard/settings/org/security',
    icon: Shield,
  },
  {
    title: 'Billing',
    description: 'Manage subscription, invoices, and payment methods',
    href: '/dashboard/settings/org/billing',
    icon: CreditCard,
    ownerOnly: true,
  },
];

export default function OrgSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Settings"
        description="Manage organization-wide settings and configurations"
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/settings' },
          { label: 'Organization' },
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {orgSettingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card variant="bordered" className="h-full hover:border-blue-500 transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{section.title}</h3>
                        {section.ownerOnly && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded">
                            Owner
                          </span>
                        )}
                      </div>
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
