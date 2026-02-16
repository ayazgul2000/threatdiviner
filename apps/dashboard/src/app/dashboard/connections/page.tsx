'use client';

import { useEffect, useState, useCallback } from 'react';
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
  NoConnectionsEmpty,
  PageHeader,
  useToast,
  useConfirmDialog,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { connectionsApi, projectsApi, type ScmConnection, type Project, type ProjectRepoAccess } from '@/lib/api';

type Provider = 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';

interface ProviderConfig {
  name: string;
  icon: React.ReactNode;
  bgColor: string;
  patScopes: string;
  available: boolean;
}

const providerConfigs: Record<Provider, ProviderConfig> = {
  github: {
    name: 'GitHub',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
      </svg>
    ),
    bgColor: 'bg-gray-900',
    patScopes: 'repo, read:org',
    available: true,
  },
  gitlab: {
    name: 'GitLab',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 01-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 014.82 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0118.6 2a.43.43 0 01.58 0 .42.42 0 01.11.18l2.44 7.51L23 13.45a.84.84 0 01-.35.94z" />
      </svg>
    ),
    bgColor: 'bg-orange-600',
    patScopes: 'api, read_user',
    available: true,
  },
  bitbucket: {
    name: 'Bitbucket',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M.778 1.211a.768.768 0 00-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 00.77-.646l3.27-20.03a.768.768 0 00-.768-.9H.778zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z" />
      </svg>
    ),
    bgColor: 'bg-blue-600',
    patScopes: 'repository, pullrequest',
    available: true,
  },
  'azure-devops': {
    name: 'Azure DevOps',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z" />
      </svg>
    ),
    bgColor: 'bg-blue-500',
    patScopes: 'Code (Read), Project and Team (Read)',
    available: true,
  },
};

interface AvailableRepo {
  id: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
}

interface ProjectAccess {
  projectId: string;
  projectName: string;
  hasAccess: boolean;
  assignedRepos: ProjectRepoAccess[];
}

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ScmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPatModal, setShowPatModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider>('github');
  const [patToken, setPatToken] = useState('');
  const [patLoading, setPatLoading] = useState(false);

  // Manage Access Modal state
  const [showManageAccessModal, setShowManageAccessModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<ScmConnection | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectAccessList, setProjectAccessList] = useState<ProjectAccess[]>([]);
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [selectedProjectForRepos, setSelectedProjectForRepos] = useState<string | null>(null);
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [savingAccess, setSavingAccess] = useState(false);

  const toastCtx = useToast();
  const { confirm } = useConfirmDialog();

  const fetchConnections = async () => {
    try {
      const data = await connectionsApi.list();
      setConnections(data);
    } catch (err) {
      toastCtx.error('Error', 'Failed to fetch connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleOAuthConnect = async (provider: Provider) => {
    try {
      setShowAddModal(false);
      const { authUrl } = await connectionsApi.initiateOAuth(provider);
      window.location.href = authUrl;
    } catch (err) {
      toastCtx.error('OAuth Error', err instanceof Error ? err.message : 'Failed to initiate OAuth');
    }
  };

  const handlePatConnect = async () => {
    if (!patToken.trim()) return;

    setPatLoading(true);

    try {
      await connectionsApi.connectWithPat(selectedProvider, patToken);
      setShowPatModal(false);
      setPatToken('');
      toastCtx.success('Connected', `Successfully connected to ${providerConfigs[selectedProvider].name}`);
      fetchConnections();
    } catch (err) {
      toastCtx.error('Connection Failed', err instanceof Error ? err.message : 'Failed to connect with PAT');
    } finally {
      setPatLoading(false);
    }
  };

  const handleDeleteConnection = async (connection: ScmConnection) => {
    const confirmed = await confirm({
      title: 'Remove Connection',
      message: `Are you sure you want to remove the connection to ${connection.accountName}? This will not delete any imported repositories.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await connectionsApi.delete(connection.id);
      setConnections(connections.filter(c => c.id !== connection.id));
      toastCtx.success('Connection Removed', `Successfully removed connection to ${connection.accountName}`);
    } catch (err) {
      toastCtx.error('Error', err instanceof Error ? err.message : 'Failed to delete connection');
    }
  };

  const openPatModal = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowAddModal(false);
    setShowPatModal(true);
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (status) {
      case 'active':
        return 'success';
      case 'expired':
        return 'warning';
      case 'revoked':
        return 'danger';
      default:
        return 'default';
    }
  };

  const getProviderConfig = (provider: string): ProviderConfig => {
    return providerConfigs[provider as Provider] || providerConfigs.github;
  };

  // Load project access data for a connection
  const loadProjectAccess = useCallback(async (connection: ScmConnection) => {
    setAccessLoading(true);
    try {
      // Fetch all projects and available repos in parallel
      const [projectsList, reposList] = await Promise.all([
        projectsApi.list(),
        connectionsApi.getAvailableRepos(connection.id),
      ]);

      setProjects(projectsList);
      setAvailableRepos(reposList);

      // For each project, check if it has access to this connection
      const accessPromises = projectsList.map(async (project) => {
        try {
          const scmAccess = await projectsApi.scmAccess.list(project.id);
          const connectionAccess = scmAccess.find((a) => a.connectionId === connection.id);

          return {
            projectId: project.id,
            projectName: project.name,
            hasAccess: !!connectionAccess,
            assignedRepos: connectionAccess?.repoAccess || [],
          };
        } catch {
          return {
            projectId: project.id,
            projectName: project.name,
            hasAccess: false,
            assignedRepos: [],
          };
        }
      });

      const accessList = await Promise.all(accessPromises);
      setProjectAccessList(accessList);
    } catch (err) {
      toastCtx.error('Error', 'Failed to load project access');
    } finally {
      setAccessLoading(false);
    }
  }, [toastCtx]);

  const handleOpenManageAccess = async (connection: ScmConnection) => {
    setSelectedConnection(connection);
    setShowManageAccessModal(true);
    setSelectedProjectForRepos(null);
    setSelectedRepos(new Set());
    await loadProjectAccess(connection);
  };

  const handleToggleProjectAccess = async (projectId: string, currentHasAccess: boolean) => {
    if (!selectedConnection) return;

    setSavingAccess(true);
    try {
      if (currentHasAccess) {
        await projectsApi.scmAccess.revoke(projectId, selectedConnection.id);
        toastCtx.success('Access Revoked', 'Project no longer has access to this connection');
      } else {
        await projectsApi.scmAccess.grant(projectId, selectedConnection.id);
        toastCtx.success('Access Granted', 'Project can now use this connection');
      }
      // Reload access list
      await loadProjectAccess(selectedConnection);
    } catch (err) {
      toastCtx.error('Error', err instanceof Error ? err.message : 'Failed to update access');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleSelectProjectForRepos = (projectId: string) => {
    const projectAccess = projectAccessList.find((p) => p.projectId === projectId);
    setSelectedProjectForRepos(projectId);
    // Pre-select already assigned repos
    const assignedRepoIds = new Set(projectAccess?.assignedRepos.map((r) => r.externalRepoId) || []);
    setSelectedRepos(assignedRepoIds);
  };

  const handleToggleRepo = (repoId: string) => {
    setSelectedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleSaveRepoAssignments = async () => {
    if (!selectedConnection || !selectedProjectForRepos) return;

    setSavingAccess(true);
    try {
      const projectAccess = projectAccessList.find((p) => p.projectId === selectedProjectForRepos);
      const currentRepoIds = new Set(projectAccess?.assignedRepos.map((r) => r.externalRepoId) || []);

      // Find repos to add
      const reposToAdd = availableRepos
        .filter((r) => selectedRepos.has(r.id) && !currentRepoIds.has(r.id))
        .map((r) => ({ externalRepoId: r.id, fullName: r.fullName }));

      // Find repos to remove
      const reposToRemove = Array.from(currentRepoIds).filter((id) => !selectedRepos.has(id));

      // Apply changes
      if (reposToAdd.length > 0) {
        await projectsApi.scmAccess.grantRepos(selectedProjectForRepos, selectedConnection.id, reposToAdd);
      }
      if (reposToRemove.length > 0) {
        await projectsApi.scmAccess.revokeRepos(selectedProjectForRepos, selectedConnection.id, reposToRemove);
      }

      toastCtx.success('Saved', 'Repository assignments updated');
      setSelectedProjectForRepos(null);
      await loadProjectAccess(selectedConnection);
    } catch (err) {
      toastCtx.error('Error', err instanceof Error ? err.message : 'Failed to save assignments');
    } finally {
      setSavingAccess(false);
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
        <TableSkeleton rows={4} columns={6} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Connect your source code management providers to import and scan repositories"
        breadcrumbs={[{ label: 'Connections' }]}
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Connection
          </Button>
        }
      />

      {/* Connections Table */}
      {connections.length === 0 ? (
        <NoConnectionsEmpty
          onConnect={() => setShowAddModal(true)}
        />
      ) : (
        <Card variant="bordered">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Provider</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => {
                  const config = getProviderConfig(connection.provider);
                  return (
                    <TableRow key={connection.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 ${config.bgColor} text-white rounded-lg`}>
                            {config.icon}
                          </div>
                          <span className="font-medium">{config.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{connection.accountName}</span>
                        <span className="text-gray-500 text-sm block">ID: {connection.accountId}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(connection.status)}>
                          {connection.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {connection.scopes?.slice(0, 3).map((scope) => (
                            <Badge key={scope} variant="default" size="sm">
                              {scope}
                            </Badge>
                          ))}
                          {connection.scopes?.length > 3 && (
                            <Badge variant="default" size="sm">
                              +{connection.scopes.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600 dark:text-gray-400">
                          {new Date(connection.createdAt).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenManageAccess(connection)}
                          >
                            Manage Access
                          </Button>
                          {connection.status === 'expired' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOAuthConnect(connection.provider as Provider)}
                            >
                              Reconnect
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteConnection(connection)}
                          >
                            Remove
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Connection Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="lg">
        <ModalHeader onClose={() => setShowAddModal(false)}>Add Connection</ModalHeader>
        <ModalBody>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose a source code provider to connect. You can use OAuth for quick setup or a Personal Access Token for more control.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.entries(providerConfigs) as [Provider, ProviderConfig][]).map(([key, config]) => (
              <div
                key={key}
                className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 ${
                  !config.available ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 ${config.bgColor} text-white rounded-lg`}>
                    {config.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">{config.name}</h3>
                    <p className="text-xs text-gray-500">
                      {config.available ? 'OAuth or PAT' : 'Coming soon'}
                    </p>
                  </div>
                </div>
                {config.available && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleOAuthConnect(key)}
                      size="sm"
                      className="flex-1"
                    >
                      OAuth
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => openPatModal(key)}
                      size="sm"
                      className="flex-1"
                    >
                      PAT
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ModalBody>
      </Modal>

      {/* PAT Modal */}
      <Modal isOpen={showPatModal} onClose={() => setShowPatModal(false)}>
        <ModalHeader onClose={() => setShowPatModal(false)}>
          <div className="flex items-center gap-3">
            <div className={`p-2 ${providerConfigs[selectedProvider].bgColor} text-white rounded-lg`}>
              {providerConfigs[selectedProvider].icon}
            </div>
            Connect with Personal Access Token
          </div>
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400">
              Enter your {providerConfigs[selectedProvider].name} Personal Access Token.
            </p>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Required scopes:</strong>{' '}
                <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
                  {providerConfigs[selectedProvider].patScopes}
                </code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Personal Access Token
              </label>
              <input
                type="password"
                value={patToken}
                onChange={(e) => setPatToken(e.target.value)}
                placeholder={selectedProvider === 'github' ? 'ghp_xxxxxxxxxxxx' : 'Enter token...'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                autoFocus
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowPatModal(false)}>
            Cancel
          </Button>
          <Button onClick={handlePatConnect} loading={patLoading} disabled={!patToken.trim()}>
            Connect
          </Button>
        </ModalFooter>
      </Modal>

      {/* Manage Access Modal */}
      <Modal
        isOpen={showManageAccessModal}
        onClose={() => {
          setShowManageAccessModal(false);
          setSelectedProjectForRepos(null);
        }}
        size="xl"
      >
        <ModalHeader
          onClose={() => {
            setShowManageAccessModal(false);
            setSelectedProjectForRepos(null);
          }}
        >
          <div className="flex items-center gap-3">
            {selectedConnection && (
              <div className={`p-2 ${getProviderConfig(selectedConnection.provider).bgColor} text-white rounded-lg`}>
                {getProviderConfig(selectedConnection.provider).icon}
              </div>
            )}
            Manage Project Access - {selectedConnection?.accountName}
          </div>
        </ModalHeader>
        <ModalBody>
          {accessLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : selectedProjectForRepos ? (
            // Repository assignment view
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="secondary" size="sm" onClick={() => setSelectedProjectForRepos(null)}>
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>
                <span className="text-gray-600 dark:text-gray-400">
                  Assign repositories to{' '}
                  <strong>{projectAccessList.find((p) => p.projectId === selectedProjectForRepos)?.projectName}</strong>
                </span>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Select which repositories this project can access. If no repositories are selected, the project will
                  have access to all repositories from this connection.
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {availableRepos.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No repositories found in this connection</div>
                ) : (
                  availableRepos.map((repo) => (
                    <label
                      key={repo.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepos.has(repo.id)}
                        onChange={() => handleToggleRepo(repo.id)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <span className="font-medium text-gray-900 dark:text-white">{repo.fullName}</span>
                        {repo.isPrivate && (
                          <Badge variant="default" size="sm" className="ml-2">
                            Private
                          </Badge>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : (
            // Project list view
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Select which projects can use this SCM connection, then assign specific repositories to each project.
              </p>

              {projectAccessList.length === 0 ? (
                <div className="p-8 text-center border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-gray-500">No projects found. Create a project first.</p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
                  {projectAccessList.map((project) => (
                    <div
                      key={project.projectId}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={project.hasAccess}
                          onChange={() => handleToggleProjectAccess(project.projectId, project.hasAccess)}
                          disabled={savingAccess}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">{project.projectName}</span>
                          {project.hasAccess && (
                            <span className="text-sm text-gray-500 ml-2">
                              {project.assignedRepos.length === 0
                                ? '(All repositories)'
                                : `(${project.assignedRepos.length} repo${project.assignedRepos.length !== 1 ? 's' : ''})`}
                            </span>
                          )}
                        </div>
                      </div>
                      {project.hasAccess && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSelectProjectForRepos(project.projectId)}
                        >
                          Assign Repos
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          {selectedProjectForRepos ? (
            <>
              <Button variant="secondary" onClick={() => setSelectedProjectForRepos(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRepoAssignments} loading={savingAccess}>
                Save Assignments
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setShowManageAccessModal(false);
                setSelectedProjectForRepos(null);
              }}
            >
              Close
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
