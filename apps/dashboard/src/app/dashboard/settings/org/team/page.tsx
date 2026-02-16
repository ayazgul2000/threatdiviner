'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/components/ui/toast';
import { API_URL } from '@/lib/api';
import { Users, UserPlus, Shield, Trash2, Crown } from 'lucide-react';

interface OrgMember {
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
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  member: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export default function OrgTeamPage() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const loadMembers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/org/members`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load organization members');
      }

      const data = await response.json();
      setMembers(data.members || []);
    } catch (error) {
      toast.error('Error', 'Failed to load organization members');
      console.error('Failed to load organization members:', error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Team"
        description="Manage organization members and their roles"
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/settings' },
          { label: 'Organization', href: '/dashboard/settings/org' },
          { label: 'Team' },
        ]}
        actions={
          <Button>
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        }
      />

      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Organization Members
          </CardTitle>
          <CardDescription>
            All users in your organization and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              Loading organization members...
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon="users"
              title="No organization members"
              description="Invite members to collaborate on your security projects."
              size="sm"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {member.user.name || 'Unnamed User'}
                            </p>
                            {member.role === 'owner' && (
                              <Crown className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
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
                      {member.role !== 'owner' && (
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
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
            Organization Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 dark:text-white">Owner</h4>
                <Crown className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Full access including billing, SSO configuration, and org deletion
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Admin</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage all projects, members, and organization settings
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Member</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Create projects and access assigned project resources
              </p>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white">Viewer</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Read-only access to assigned projects and reports
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
