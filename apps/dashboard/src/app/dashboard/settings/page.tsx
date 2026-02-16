'use client';

import Link from 'next/link';
import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FolderGit2, Building2, User, Bell } from 'lucide-react';

export default function SettingsPage() {
  const { currentProject } = useProject();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your project, organization, and account settings"
        breadcrumbs={[{ label: 'Settings' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Project Settings */}
        <Link href="/dashboard/settings/project">
          <Card variant="bordered" className="h-full hover:border-blue-500 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FolderGit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Project Settings</CardTitle>
                  <CardDescription>
                    {currentProject
                      ? `Configure settings for ${currentProject.name}`
                      : 'Select a project to configure'}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>Team members & permissions</li>
                <li>Alert configurations</li>
                <li>Security policies</li>
                <li>Integrations</li>
              </ul>
            </CardContent>
          </Card>
        </Link>

        {/* Organization Settings */}
        <Link href="/dashboard/settings/org">
          <Card variant="bordered" className="h-full hover:border-blue-500 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle>Organization Settings</CardTitle>
                  <CardDescription>Manage organization-wide configurations</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>Organization team & roles</li>
                <li>SCM connections</li>
                <li>API keys</li>
                <li>Billing & subscription</li>
              </ul>
            </CardContent>
          </Card>
        </Link>

        {/* Profile Settings */}
        <Link href="/dashboard/settings/profile">
          <Card variant="bordered" className="h-full hover:border-blue-500 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <User className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Profile</CardTitle>
                  <CardDescription>Your personal account settings</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>Display name & avatar</li>
                <li>Email preferences</li>
                <li>Password & security</li>
              </ul>
            </CardContent>
          </Card>
        </Link>

        {/* Notifications */}
        <Link href="/dashboard/settings/notifications">
          <Card variant="bordered" className="h-full hover:border-blue-500 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Bell className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>Configure how you receive alerts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                <li>Email notifications</li>
                <li>Slack integration</li>
                <li>Notification frequency</li>
              </ul>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
