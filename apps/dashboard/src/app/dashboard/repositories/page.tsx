'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardContent, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui';
import { repositoriesApi, connectionsApi, scansApi, type Repository, type ScmConnection } from '@/lib/api';

interface AvailableRepo {
  id: string;
  name: string;
  fullName: string;
  isPrivate: boolean;
}

export default function RepositoriesPage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [connections, setConnections] = useState<ScmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [availableRepos, setAvailableRepos] = useState<AvailableRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [addingRepo, setAddingRepo] = useState<string | null>(null);
  const [triggeringScan, setTriggeringScan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [reposData, connectionsData] = await Promise.all([
        repositoriesApi.list(),
        connectionsApi.list(),
      ]);
      setRepositories(reposData);
      setConnections(connectionsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConnectionChange = async (connectionId: string) => {
    setSelectedConnection(connectionId);
    if (!connectionId) {
      setAvailableRepos([]);
      return;
    }

    setLoadingRepos(true);
    try {
      const repos = await connectionsApi.getAvailableRepos(connectionId);
      setAvailableRepos(repos);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleAddRepo = async (repo: AvailableRepo) => {
    setAddingRepo(repo.id);
    setError(null);

    try {
      await repositoriesApi.add(selectedConnection, repo.id, repo.fullName);
      setShowAddModal(false);
      setSelectedConnection('');
      setAvailableRepos([]);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setAddingRepo(null);
    }
  };

  const handleDeleteRepo = async (id: string) => {
    if (!confirm('Are you sure you want to remove this repository?')) return;

    try {
      await repositoriesApi.delete(id);
      setRepositories(repositories.filter(r => r.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete repository');
    }
  };

  const handleTriggerScan = async (repoId: string) => {
    setTriggeringScan(repoId);
    try {
      await scansApi.trigger(repoId);
      // Refresh to show new scan
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger scan');
    } finally {
      setTriggeringScan(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading repositories...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Repositories</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage repositories for security scanning
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} disabled={connections.length === 0}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Repository
        </Button>
      </div>

      {/* No connections warning */}
      {connections.length === 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-lg text-sm">
          You need to add a connection first before adding repositories.
          <a href="/dashboard/connections" className="ml-2 font-medium underline">Add Connection</a>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Repositories Table */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Repository</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Default Branch</TableHead>
                <TableHead>Last Scan</TableHead>
                <TableHead>Scan Config</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.length === 0 ? (
                <TableEmpty colSpan={6} message="No repositories added yet. Add your first repository to start scanning." />
              ) : (
                repositories.map((repo) => (
                  <TableRow key={repo.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{repo.fullName}</p>
                        {repo.isPrivate && (
                          <Badge variant="default" size="sm" className="mt-1">Private</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">{repo.connection?.provider || 'github'}</span>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                        {repo.defaultBranch}
                      </code>
                    </TableCell>
                    <TableCell>
                      {repo.lastScanAt ? (
                        new Date(repo.lastScanAt).toLocaleDateString()
                      ) : (
                        <span className="text-gray-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {repo.scanConfig?.scanOnPush && (
                          <Badge variant="info" size="sm">Push</Badge>
                        )}
                        {repo.scanConfig?.scanOnPr && (
                          <Badge variant="info" size="sm">PR</Badge>
                        )}
                        {!repo.scanConfig?.scanOnPush && !repo.scanConfig?.scanOnPr && (
                          <Badge variant="default" size="sm">Manual</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleTriggerScan(repo.id)}
                          loading={triggeringScan === repo.id}
                        >
                          Scan Now
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteRepo(repo.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Repository Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="lg">
        <ModalHeader onClose={() => setShowAddModal(false)}>Add Repository</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Connection
              </label>
              <select
                value={selectedConnection}
                onChange={(e) => handleConnectionChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
              >
                <option value="">Select a connection...</option>
                {connections.map((conn) => (
                  <option key={conn.id} value={conn.id}>
                    {conn.provider} - {conn.accountName}
                  </option>
                ))}
              </select>
            </div>

            {loadingRepos && (
              <div className="text-center py-8 text-gray-500">
                Loading repositories...
              </div>
            )}

            {!loadingRepos && selectedConnection && availableRepos.length > 0 && (
              <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                {availableRepos.map((repo) => {
                  const isAdded = repositories.some(r => r.externalId === repo.id);
                  return (
                    <div
                      key={repo.id}
                      className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{repo.fullName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {repo.isPrivate && (
                            <Badge variant="default" size="sm">Private</Badge>
                          )}
                        </div>
                      </div>
                      {isAdded ? (
                        <Badge variant="success">Added</Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleAddRepo(repo)}
                          loading={addingRepo === repo.id}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!loadingRepos && selectedConnection && availableRepos.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No repositories found for this connection.
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowAddModal(false)}>
            Close
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
