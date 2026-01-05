'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  NoRepositoriesEmpty,
  PageHeader,
  useToast,
  useConfirmDialog,
  Input,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { repositoriesApi, connectionsApi, settingsApi, type Repository, type ScmConnection, API_URL } from '@/lib/api';
import { useProject } from '@/contexts/project-context';
import { useAuth } from '@/lib/auth-context';

interface TenantSettings {
  allowProjectConnections: boolean;
}

interface AvailableRepo {
  id: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
}

// Scan status types for status dot indicator
type ScanStatus = 'success' | 'warning' | 'error' | 'none';

// Get scan status based on last scan results
function getScanStatus(repo: Repository): ScanStatus {
  if (!repo.lastScanAt) return 'none';

  // Check if we have findings data from the last scan
  const lastScan = repo.lastScan;
  if (!lastScan) return 'none';

  // Check based on severity counts
  if (lastScan.criticalCount > 0 || lastScan.highCount > 0) {
    return 'error';
  }
  if (lastScan.mediumCount > 0) {
    return 'warning';
  }
  return 'success';
}

// Status dot component
function StatusDot({ status }: { status: ScanStatus }) {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    none: 'bg-gray-400',
  };

  const titles = {
    success: 'No critical/high findings',
    warning: 'Medium findings present',
    error: 'Critical or high findings',
    none: 'Never scanned',
  };

  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status]}`}
      title={titles[status]}
    />
  );
}

export default function RepositoriesPage() {
  const { currentProject } = useProject();
  const { user } = useAuth();
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [connections, setConnections] = useState<ScmConnection[]>([]);
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [addingRepo, setAddingRepo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [repoSearchQuery, setRepoSearchQuery] = useState('');

  const toastCtx = useToast();
  const { confirm } = useConfirmDialog();

  // Check if user can add connections (org admin or allowProjectConnections enabled)
  const isOrgAdmin = user?.role === 'admin' || user?.role === 'owner';
  const canAddConnection = isOrgAdmin || tenantSettings?.allowProjectConnections;

  const fetchData = async () => {
    if (!currentProject) {
      setLoading(false);
      return;
    }

    try {
      const [reposRes, connectionsData, settings] = await Promise.all([
        fetch(`${API_URL}/scm/repositories?projectId=${currentProject.id}`, { credentials: 'include' }),
        connectionsApi.list(),
        settingsApi.tenant().catch(() => null),
      ]);
      const reposData = reposRes.ok ? await reposRes.json() : [];
      setRepositories(reposData);
      setConnections(connectionsData.filter(c => c.status === 'active'));
      if (settings) {
        setTenantSettings(settings);
      }
    } catch (err) {
      toastCtx.error('Error', 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentProject]);

  const handleConnectionChange = async (connectionId: string) => {
    setSelectedConnection(connectionId);
    setRepoSearchQuery('');
    if (!connectionId) {
      setAvailableRepos([]);
      return;
    }

    setLoadingRepos(true);
    try {
      const repos = await connectionsApi.getAvailableRepos(connectionId, currentProject?.id);
      setAvailableRepos(repos);
    } catch (err) {
      toastCtx.error('Error', err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleAddRepo = async (repo: AvailableRepo) => {
    if (!currentProject) return;
    setAddingRepo(repo.id);

    try {
      const res = await fetch(`${API_URL}/scm/repositories`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          externalId: repo.id,
          fullName: repo.fullName,
          projectId: currentProject.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to add repository');
      toastCtx.success('Repository Added', `${repo.fullName} has been added successfully`);
      fetchData();
    } catch (err) {
      toastCtx.error('Error', err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setAddingRepo(null);
    }
  };

  const handleDeleteRepo = async (repo: Repository) => {
    const confirmed = await confirm({
      title: 'Remove Repository',
      message: `Are you sure you want to remove ${repo.fullName}? This will delete all scan history and findings for this repository.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await repositoriesApi.delete(repo.id);
      setRepositories(repositories.filter(r => r.id !== repo.id));
      toastCtx.success('Repository Removed', `${repo.fullName} has been removed`);
    } catch (err) {
      toastCtx.error('Error', err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const filteredRepositories = repositories.filter(repo =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAvailableRepos = availableRepos.filter(repo =>
    repo.fullName.toLowerCase().includes(repoSearchQuery.toLowerCase())
  );

  const getProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'github':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        );
      case 'gitlab':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={6} columns={6} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Repositories" breadcrumbs={[{ label: 'Repositories' }]} />
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to view repositories
            </p>
            <Link href="/dashboard/projects">
              <Button>Go to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Repositories"
        description="Manage repositories for security scanning"
        breadcrumbs={[{ label: 'Repositories' }]}
        actions={
          <Button onClick={() => setShowAddModal(true)} disabled={connections.length === 0}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Import Repository
          </Button>
        }
      />

      {/* No connections warning */}
      {connections.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200">No Active Connections</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                You need to add an active SCM connection before you can import repositories.
              </p>
              {canAddConnection ? (
                <Link href="/dashboard/connections">
                  <Button variant="secondary" size="sm" className="mt-3">
                    Add Connection
                  </Button>
                </Link>
              ) : (
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                  Contact your organization admin to add SCM connections.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search and filters */}
      {repositories.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="text-sm text-gray-500">
            {filteredRepositories.length} of {repositories.length} repositories
          </span>
        </div>
      )}

      {/* Repositories Table - Simplified: status dot, repo name, last scanned, Open button */}
      {repositories.length === 0 ? (
        <NoRepositoriesEmpty
          onConnect={() => setShowAddModal(true)}
        />
      ) : (
        <Card variant="bordered">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead className="w-12">Status</TableHead>
                  <TableHead>Repository</TableHead>
                  <TableHead>Last Scanned</TableHead>
                  <TableHead className="text-right w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRepositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>
                      <StatusDot status={getScanStatus(repo)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                          {getProviderIcon(repo.connection?.provider || 'github')}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {repo.fullName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {repo.isPrivate && (
                              <Badge variant="default" size="sm">Private</Badge>
                            )}
                            <span className="text-xs text-gray-500 capitalize">
                              {repo.connection?.provider || 'github'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {repo.lastScanAt ? (
                        <div className="text-sm">
                          <p className="text-gray-900 dark:text-white">
                            {new Date(repo.lastScanAt).toLocaleDateString()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(repo.lastScanAt).toLocaleTimeString()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Never scanned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/dashboard/repositories/${repo.id}`}>
                        <Button variant="primary" size="sm">
                          Open
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Repository Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="lg">
        <ModalHeader onClose={() => setShowAddModal(false)}>Import Repository</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                SCM Connection
              </label>
              <select
                value={selectedConnection}
                onChange={(e) => handleConnectionChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a connection...</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.provider.charAt(0).toUpperCase() + conn.provider.slice(1)} - {conn.accountName}
                  </option>
                ))}
              </select>
            </div>

            {loadingRepos && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-500">Loading repositories...</span>
              </div>
            )}

            {!loadingRepos && selectedConnection && availableRepos.length > 0 && (
              <>
                <div>
                  <Input
                    placeholder="Search repositories..."
                    value={repoSearchQuery}
                    onChange={(e) => setRepoSearchQuery(e.target.value)}
                  />
                </div>
                <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredAvailableRepos.map((repo) => {
                    const isAdded = repositories.some(r => r.externalId === repo.id);
                    return (
                      <div
                        key={repo.id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            {getProviderIcon(connections.find(c => c.id === selectedConnection)?.provider || 'github')}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{repo.fullName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {repo.isPrivate && (
                                <Badge variant="default" size="sm">Private</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        {isAdded ? (
                          <Badge variant="success">
                            <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Added
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAddRepo(repo)}
                            loading={addingRepo === repo.id}
                          >
                            Import
                          </Button>
                        )}
                      </div>
                    );
                  })}
                  {filteredAvailableRepos.length === 0 && repoSearchQuery && (
                    <div className="text-center py-8 text-gray-500">
                      No repositories match &quot;{repoSearchQuery}&quot;
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  Showing {filteredAvailableRepos.length} of {availableRepos.length} repositories
                </p>
              </>
            )}

            {!loadingRepos && selectedConnection && availableRepos.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                No repositories found for this connection.
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => { setShowAddModal(false); setSelectedConnection(''); setAvailableRepos([]); }}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
