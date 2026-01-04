'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, Label, FormField } from '@/components/ui/form';
import { API_URL } from '@/lib/api';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface CreateKeyResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showRevokeDialog, setShowRevokeDialog] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);

  const toast = useToast();

  const loadApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api-keys`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load API keys');
      }

      const data = await response.json();
      setApiKeys(data);
    } catch (error) {
      toast.error('Error', 'Failed to load API keys');
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast.warning('Validation Error', 'Please enter a name for the API key');
      return;
    }

    try {
      setCreating(true);
      const response = await fetch(`${API_URL}/api-keys`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const data: CreateKeyResponse = await response.json();
      setNewlyCreatedKey(data.key);
      setNewKeyName('');
      toast.success('Success', 'API key created successfully');
      loadApiKeys();
    } catch (error) {
      toast.error('Error', 'Failed to create API key');
      console.error('Failed to create API key:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeClick = (key: ApiKey) => {
    setKeyToRevoke(key);
    setShowRevokeDialog(true);
  };

  const handleRevokeConfirm = async () => {
    if (!keyToRevoke) return;

    try {
      setRevoking(keyToRevoke.id);
      const response = await fetch(`${API_URL}/api-keys/${keyToRevoke.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      toast.success('Success', 'API key revoked successfully');
      loadApiKeys();
    } catch (error) {
      toast.error('Error', 'Failed to revoke API key');
      console.error('Failed to revoke API key:', error);
    } finally {
      setRevoking(null);
      setShowRevokeDialog(false);
      setKeyToRevoke(null);
    }
  };

  const handleCopyKey = async () => {
    if (!newlyCreatedKey) return;

    try {
      await navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      toast.success('Copied', 'API key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Error', 'Failed to copy API key');
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getKeyPrefix = (key: ApiKey) => {
    return `${key.keyPrefix}...`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="API Keys"
          description="Manage API keys for CLI and integrations"
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 dark:text-gray-400">Loading API keys...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Manage API keys for CLI and integrations"
      />

      {/* Create New Key Section */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Create New API Key</CardTitle>
          <CardDescription>
            Generate a new API key for CLI access or third-party integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {newlyCreatedKey ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Save your API key now
                    </h4>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      This is the only time you will see this key. Make sure to copy and store it securely.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg font-mono text-sm break-all">
                  {newlyCreatedKey}
                </code>
                <Button
                  variant={copied ? 'secondary' : 'primary'}
                  onClick={handleCopyKey}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <Button
                variant="secondary"
                onClick={() => setNewlyCreatedKey(null)}
                className="mt-2"
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-4">
              <FormField className="flex-1">
                <Label htmlFor="keyName">Key Name</Label>
                <Input
                  id="keyName"
                  type="text"
                  placeholder="e.g., CI/CD Pipeline, Local Development"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateKey();
                    }
                  }}
                />
              </FormField>
              <Button
                onClick={handleCreateKey}
                loading={creating}
                disabled={!newKeyName.trim()}
              >
                Create Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing API Keys */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Existing API Keys</CardTitle>
          <CardDescription>
            View and manage your active API keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <EmptyState
              icon="shield"
              title="No API keys"
              description="You haven't created any API keys yet. Create one above to get started with CLI access or integrations."
              size="sm"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow hoverable={false}>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id} hoverable={false}>
                    <TableCell>
                      <span className="font-medium">{key.name}</span>
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">
                        {getKeyPrefix(key)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatDate(key.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 dark:text-gray-400">
                        {formatDate(key.lastUsedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleRevokeClick(key)}
                        loading={revoking === key.id}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showRevokeDialog}
        onClose={() => {
          setShowRevokeDialog(false);
          setKeyToRevoke(null);
        }}
        onConfirm={handleRevokeConfirm}
        title="Revoke API Key"
        message={
          keyToRevoke ? (
            <>
              Are you sure you want to revoke the API key <strong>&quot;{keyToRevoke.name}&quot;</strong>?
              This action cannot be undone and any applications using this key will no longer be able to authenticate.
            </>
          ) : (
            'Are you sure you want to revoke this API key?'
          )
        }
        confirmLabel="Revoke Key"
        cancelLabel="Cancel"
        variant="danger"
        loading={revoking !== null}
      />
    </div>
  );
}
