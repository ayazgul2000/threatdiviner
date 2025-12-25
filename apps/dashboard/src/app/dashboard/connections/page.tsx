'use client';

import { useEffect, useState } from 'react';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Modal, ModalHeader, ModalBody, ModalFooter, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';
import { connectionsApi, type ScmConnection } from '@/lib/api';

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<ScmConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPatModal, setShowPatModal] = useState(false);
  const [patToken, setPatToken] = useState('');
  const [patLoading, setPatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = async () => {
    try {
      const data = await connectionsApi.list();
      setConnections(data);
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleOAuthConnect = async (provider: string) => {
    try {
      const { authUrl } = await connectionsApi.initiateOAuth(provider);
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate OAuth');
    }
  };

  const handlePatConnect = async () => {
    if (!patToken.trim()) return;

    setPatLoading(true);
    setError(null);

    try {
      await connectionsApi.connectWithPat('github', patToken);
      setShowPatModal(false);
      setPatToken('');
      fetchConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect with PAT');
    } finally {
      setPatLoading(false);
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to remove this connection?')) return;

    try {
      await connectionsApi.delete(id);
      setConnections(connections.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
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
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        );
    }
  };

  const getStatusVariant = (status: string) => {
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Connections</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage your SCM provider connections
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Connection
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Connections Table */}
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
              {connections.length === 0 ? (
                <TableEmpty colSpan={6} message="No connections yet. Add your first connection to get started." />
              ) : (
                connections.map((connection) => (
                  <TableRow key={connection.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getProviderIcon(connection.provider)}
                        <span className="capitalize">{connection.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{connection.accountName}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(connection.status) as any}>
                        {connection.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
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
                      {new Date(connection.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteConnection(connection.id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Connection Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <ModalHeader onClose={() => setShowAddModal(false)}>Add Connection</ModalHeader>
        <ModalBody>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Choose a provider and authentication method to connect your repositories.
          </p>

          <div className="space-y-4">
            {/* GitHub */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-gray-900 text-white rounded-lg">
                  {getProviderIcon('github')}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">GitHub</h3>
                  <p className="text-sm text-gray-500">Connect with OAuth or Personal Access Token</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleOAuthConnect('github')} size="sm">
                  Connect with OAuth
                </Button>
                <Button variant="secondary" onClick={() => { setShowAddModal(false); setShowPatModal(true); }} size="sm">
                  Use PAT
                </Button>
              </div>
            </div>

            {/* GitLab - Coming Soon */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 opacity-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-600 text-white rounded-lg">
                  {getProviderIcon('gitlab')}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">GitLab</h3>
                  <p className="text-sm text-gray-500">Coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </ModalBody>
      </Modal>

      {/* PAT Modal */}
      <Modal isOpen={showPatModal} onClose={() => setShowPatModal(false)}>
        <ModalHeader onClose={() => setShowPatModal(false)}>Connect with Personal Access Token</ModalHeader>
        <ModalBody>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Enter your GitHub Personal Access Token. The token needs the following scopes:
            <code className="ml-1 text-sm bg-gray-100 dark:bg-gray-700 px-1 rounded">repo, read:org</code>
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Personal Access Token
            </label>
            <input
              type="password"
              value={patToken}
              onChange={(e) => setPatToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
            />
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
    </div>
  );
}
