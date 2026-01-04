'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { API_URL } from '@/lib/api';
import { Users, UserPlus, Shield, Trash2 } from 'lucide-react';

interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  createdAt: string;
}

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  maintainer: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  developer: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export default function ProjectTeamPage() {
  const { currentProject } = useProject();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadMembers = useCallback(async () => {
    if (!currentProject) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/projects/${currentProject.id}/members`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load team members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (error) {
      toast.error('Error', 'Failed to load team members');
      console.error('Failed to load team members:', error);
    } finally {
      setLoading(false);
    }
  }, [currentProject, toast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Project Team"
          description="Select a project to manage its team"
          breadcrumbs={[
            { label: 'Settings', href: '/dashboard/settings' },
            { label: 'Project', href: '/dashboard/settings/project' },
            { label: 'Team' },
          ]}
        />
        <EmptyState
          icon="folder"
          title="No Project Selected"
          description="Please select a project from the sidebar to manage its team."
          actionLabel="Go to Projects"
          actionHref="/dashboard/projects"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project Team"
        description={`Manage team members for ${currentProject.name}`}
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/settings' },
          { label: 'Project', href: '/dashboard/settings/project' },
          { label: 'Team' },
        ]}
        actions={
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Add Member
          </Button>
        }
      />

      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Users with access to this project and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              Loading team members...
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon="users"
              title="No team members"
              description="Add team members to collaborate on this project."
              size="sm"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} hoverable={false}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {member.user.name?.charAt(0).toUpperCase() || member.user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {member.user.name || 'Unnamed User'}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {member.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${roleColors[member.role] || roleColors.viewer}`}>
                        {member.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 dark:text-gray-400">
                        {new Date(member.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Admin</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Full access to project settings, team management, and all features
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Maintainer</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Can manage scans, findings, baselines, and project integrations
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Developer</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Can view findings, run scans, and update finding status
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Viewer</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Read-only access to project data and reports
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
