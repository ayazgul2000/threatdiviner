'use client';

import { useEffect, useState } from 'react';
import { useProject } from '@/contexts/project-context';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/modal';
import { useToast } from '@/components/ui';
import { API_URL } from '@/lib/api';
import { GitBranch, Plus, Trash2, Check, X, ChevronRight, Loader2 } from 'lucide-react';

interface ScmConnection {
  id: string;
  provider: string;
  externalName: string;
  isActive: boolean;
}

interface RepoAccess {
  id: string;
  externalRepoId: string;
  fullName: string;
}

interface ProjectScmAccess {
  id: string;
  connectionId: string;
  connection: ScmConnection;
  repoAccess: RepoAccess[];
}

interface AvailableRepo {
  id: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
}

export default function ScmAccessPage() {
  const { currentProject } = useProject();
  const toastCtx = useToast();

  const [scmAccess, setScmAccess] = useState<ProjectScmAccess[]>([]);
  const [allConnections, setAllConnections] = useState<ScmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddConnectionModal, setShowAddConnectionModal] = useState(false);
  const [showRepoModal, setShowRepoModal] = useState(false);
  const [selectedAccess, setSelectedAccess] = useState<ProjectScmAccess | null>(null);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingRepos, setSavingRepos] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!currentProject) return;

    try {
      const [accessRes, connectionsRes] = await Promise.all([
        fetch(`${API_URL}/projects/${currentProject.id}/scm-access`, { credentials: 'include' }),
        fetch(`${API_URL}/scm/connections`, { credentials: 'include' }),
      ]);

      if (accessRes.ok) {
        const access = await accessRes.json();
        setScmAccess(access);
      }

      if (connectionsRes.ok) {
        const connections = await connectionsRes.json();
        setAllConnections(connections.filter((c: ScmConnection) => c.isActive));
      }
    } catch (err) {
      toastCtx.error('Error', 'Failed to fetch SCM access settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentProject]);

  const handleGrantAccess = async (connectionId: string) => {
    if (!currentProject) return;

    try {
      const res = await fetch(`${API_URL}/projects/${currentProject.id}/scm-access`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });

      if (!res.ok) throw new Error('Failed to grant access');

      toastCtx.success('Access Granted', 'Project now has access to this SCM connection');
      setShowAddConnectionModal(false);
      fetchData();
    } catch (err) {
      toastCtx.error('Error', 'Failed to grant SCM access');
    }
  };

  const handleRevokeAccess = async (connectionId: string) => {
    if (!currentProject) return;

    try {
      const res = await fetch(`${API_URL}/projects/${currentProject.id}/scm-access/${connectionId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to revoke access');

      toastCtx.success('Access Revoked', 'Project no longer has access to this SCM connection');
      fetchData();
    } catch (err) {
      toastCtx.error('Error', 'Failed to revoke SCM access');
    }
  };

  const openRepoModal = async (access: ProjectScmAccess) => {
    setSelectedAccess(access);
    setShowRepoModal(true);
    setLoadingRepos(true);

    // Set currently selected repos
    const currentRepoIds = new Set(access.repoAccess.map((r) => r.externalRepoId));
    setSelectedRepos(currentRepoIds);

    try {
      const res = await fetch(`${API_URL}/scm/connections/${access.connectionId}/repositories`, {
        credentials: 'include',
      });

      if (res.ok) {
        const repos = await res.json();
        setAvailableRepos(repos);
      }
    } catch (err) {
      toastCtx.error('Error', 'Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const toggleRepoSelection = (repoId: string) => {
    const newSelected = new Set(selectedRepos);
    if (newSelected.has(repoId)) {
      newSelected.delete(repoId);
    } else {
      newSelected.add(repoId);
    }
    setSelectedRepos(newSelected);
  };

  const handleSaveRepoAccess = async () => {
    if (!currentProject || !selectedAccess) return;

    setSavingRepos(true);

    try {
      // Get current repo IDs
      const currentRepoIds = new Set(selectedAccess.repoAccess.map((r) => r.externalRepoId));

      // Find repos to add
      const reposToAdd = availableRepos
        .filter((r) => selectedRepos.has(r.id) && !currentRepoIds.has(r.id))
        .map((r) => ({ externalRepoId: r.id, fullName: r.fullName }));

      // Find repos to remove
      const reposToRemove = selectedAccess.repoAccess
        .filter((r) => !selectedRepos.has(r.externalRepoId))
        .map((r) => r.externalRepoId);

      // Add new repos
      if (reposToAdd.length > 0) {
        await fetch(`${API_URL}/projects/${currentProject.id}/scm-access/${selectedAccess.connectionId}/repos`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repos: reposToAdd }),
        });
      }

      // Remove repos
      if (reposToRemove.length > 0) {
        await fetch(`${API_URL}/projects/${currentProject.id}/scm-access/${selectedAccess.connectionId}/repos`, {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ externalRepoIds: reposToRemove }),
        });
      }

      toastCtx.success('Saved', 'Repository access updated successfully');
      setShowRepoModal(false);
      fetchData();
    } catch (err) {
      toastCtx.error('Error', 'Failed to update repository access');
    } finally {
      setSavingRepos(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider?.toLowerCase()) {
      case 'github':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
        );
      case 'gitlab':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
          </svg>
        );
      default:
        return <GitBranch className="w-5 h-5" />;
    }
  };

  // Connections not yet granted to this project
  const availableConnections = allConnections.filter(
    (conn) => !scmAccess.some((access) => access.connectionId === conn.id)
  );

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="SCM Access"
          description="Configure SCM access for your project"
          breadcrumbs={[
            { label: 'Settings', href: '/dashboard/settings' },
            { label: 'Project', href: '/dashboard/settings/project' },
            { label: 'SCM Access' },
          ]}
        />
        <EmptyState
          icon="folder"
          title="No Project Selected"
          description="Please select a project from the sidebar."
          actionLabel="Go to Projects"
          actionHref="/dashboard/projects"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="SCM Access"
        description="Configure which SCM connections and repositories this project can use"
        breadcrumbs={[
          { label: 'Settings', href: '/dashboard/settings' },
          { label: 'Project', href: '/dashboard/settings/project' },
          { label: 'SCM Access' },
        ]}
        actions={
          availableConnections.length > 0 && (
            <Button onClick={() => setShowAddConnectionModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Connection
            </Button>
          )
        }
      />

      {scmAccess.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No SCM Connections</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              This project doesn&apos;t have access to any SCM connections yet.
              {availableConnections.length > 0
                ? ' Grant access to allow importing repositories.'
                : ' Add an SCM connection in organization settings first.'}
            </p>
            {availableConnections.length > 0 && (
              <Button onClick={() => setShowAddConnectionModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Connection
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {scmAccess.map((access) => (
            <Card key={access.id} variant="bordered">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                      {getProviderIcon(access.connection.provider)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {access.connection.externalName}
                      </h3>
                      <p className="text-sm text-gray-500 capitalize">{access.connection.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-4">
                      {access.repoAccess.length === 0 ? (
                        <Badge variant="info">All Repositories</Badge>
                      ) : (
                        <Badge variant="default">{access.repoAccess.length} Repositories</Badge>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {access.repoAccess.length === 0
                          ? 'Access to all repos from this connection'
                          : 'Restricted to specific repos'}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => openRepoModal(access)}>
                      Configure Repos
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleRevokeAccess(access.connectionId)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {access.repoAccess.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-500 mb-2">Allowed Repositories:</p>
                    <div className="flex flex-wrap gap-2">
                      {access.repoAccess.slice(0, 5).map((repo) => (
                        <Badge key={repo.id} variant="default" size="sm">
                          {repo.fullName}
                        </Badge>
                      ))}
                      {access.repoAccess.length > 5 && (
                        <Badge variant="default" size="sm">
                          +{access.repoAccess.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Connection Modal */}
      <Modal isOpen={showAddConnectionModal} onClose={() => setShowAddConnectionModal(false)}>
        <ModalHeader onClose={() => setShowAddConnectionModal(false)}>Grant SCM Access</ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-500 mb-4">
            Select an SCM connection to grant this project access to import repositories from.
          </p>
          <div className="space-y-2">
            {availableConnections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                    {getProviderIcon(conn.provider)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{conn.externalName}</p>
                    <p className="text-sm text-gray-500 capitalize">{conn.provider}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => handleGrantAccess(conn.id)}>
                  Grant Access
                </Button>
              </div>
            ))}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowAddConnectionModal(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </Modal>

      {/* Repository Selection Modal */}
      <Modal isOpen={showRepoModal} onClose={() => setShowRepoModal(false)} size="lg">
        <ModalHeader onClose={() => setShowRepoModal(false)}>
          Configure Repository Access
        </ModalHeader>
        <ModalBody>
          <p className="text-sm text-gray-500 mb-4">
            Select which repositories this project can access. If none are selected, the project can access all
            repositories from this connection.
          </p>

          {loadingRepos ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-500">Loading repositories...</span>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              {availableRepos.map((repo) => {
                const isSelected = selectedRepos.has(repo.id);
                return (
                  <div
                    key={repo.id}
                    onClick={() => toggleRepoSelection(repo.id)}
                    className={`flex items-center justify-between px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{repo.fullName}</p>
                        {repo.isPrivate && (
                          <Badge variant="default" size="sm">
                            Private
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-sm text-gray-500 mt-4">
            {selectedRepos.size === 0
              ? 'No specific repositories selected - project will have access to all.'
              : `${selectedRepos.size} repositories selected`}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowRepoModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveRepoAccess} loading={savingRepos}>
            Save Changes
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
