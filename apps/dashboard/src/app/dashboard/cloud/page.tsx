'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type CloudProvider = 'aws' | 'azure' | 'gcp';

interface CloudAccount {
  id: string;
  provider: CloudProvider;
  accountId: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastScanAt: string | null;
  findingsCount: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  createdAt: string;
}

const PROVIDER_INFO: Record<CloudProvider, { name: string; color: string; icon: React.ReactNode }> = {
  aws: {
    name: 'Amazon Web Services',
    color: 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.862.272a2.287 2.287 0 0 1-.28.104.488.488 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.279-.144.614-.264 1.005-.36a4.84 4.84 0 0 1 1.246-.151c.95 0 1.644.216 2.091.647.439.43.662 1.085.662 1.963v2.586zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.095.655.295.846.191.2.47.296.838.296zm6.41.862c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.128.064-.2.191-.2h.783c.151 0 .255.025.31.08.065.048.113.16.16.312l1.342 5.284 1.245-5.284c.04-.16.088-.264.151-.312a.549.549 0 0 1 .32-.08h.638c.152 0 .256.025.32.08.063.048.12.16.151.312l1.261 5.348 1.381-5.348c.048-.16.104-.264.16-.312a.52.52 0 0 1 .311-.08h.743c.127 0 .2.065.2.2 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.263-.168.311a.51.51 0 0 1-.303.08h-.687c-.151 0-.255-.024-.32-.08-.063-.056-.119-.16-.15-.32l-1.238-5.148-1.23 5.14c-.04.16-.087.264-.15.32-.065.056-.177.08-.32.08zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32-.128-.071-.215-.151-.247-.223a.563.563 0 0 1-.048-.224v-.407c0-.167.064-.247.183-.247.048 0 .096.008.144.024.048.016.12.048.2.08.271.12.566.215.878.279.319.064.63.096.95.096.502 0 .894-.088 1.165-.264a.86.86 0 0 0 .415-.758.777.777 0 0 0-.215-.559c-.144-.151-.415-.287-.806-.399l-1.157-.36c-.583-.183-1.014-.454-1.277-.813a1.902 1.902 0 0 1-.4-1.158c0-.335.073-.63.216-.886.144-.255.335-.479.575-.654.24-.184.51-.32.83-.415.32-.096.655-.136 1.006-.136.175 0 .359.008.535.032.183.024.35.056.518.088.16.04.312.08.455.127.144.048.256.096.336.144a.69.69 0 0 1 .24.2.43.43 0 0 1 .071.263v.375c0 .168-.064.256-.184.256a.83.83 0 0 1-.303-.096 3.652 3.652 0 0 0-1.532-.311c-.455 0-.815.071-1.062.223-.248.152-.375.383-.375.71 0 .224.08.416.24.567.159.152.454.304.877.44l1.134.358c.574.184.99.44 1.237.767.247.327.367.702.367 1.117 0 .343-.072.655-.207.926-.144.272-.336.511-.583.703-.248.2-.543.343-.886.447-.36.111-.734.167-1.142.167z"/>
      </svg>
    ),
  },
  azure: {
    name: 'Microsoft Azure',
    color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505l7.725-16.553z"/>
      </svg>
    ),
  },
  gcp: {
    name: 'Google Cloud Platform',
    color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.19 2.38a9.344 9.344 0 0 0-9.234 6.893c.053-.02-.055.013 0 0-3.875 2.551-3.922 8.11-.247 10.941l.006-.007-.007.03a6.717 6.717 0 0 0 4.077 1.356h5.173l.03.03h5.192a6.63 6.63 0 0 0 4.109-1.416A6.576 6.576 0 0 0 23.7 14.09a6.66 6.66 0 0 0-5.113-6.476l.005.012c.008-.022-.01.006 0 0l-.007-.017a9.379 9.379 0 0 0-6.395-5.229zM12.19 4.17c2.33 0 4.471 1.07 5.892 2.903a7.87 7.87 0 0 1 1.422 2.915l.228.94.941.218a4.868 4.868 0 0 1 3.742 4.696 4.793 4.793 0 0 1-1.673 3.655 4.852 4.852 0 0 1-3.014 1.037H7.052a4.932 4.932 0 0 1-2.99-1.005 4.981 4.981 0 0 1-1.87-3.746A4.916 4.916 0 0 1 5.09 10.5l.873-.573.087-.994a7.577 7.577 0 0 1 6.14-4.763z"/>
      </svg>
    ),
  },
};

export default function CloudAccountsPage() {
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [scanning, setScanningId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch(`${API_URL}/cspm/accounts`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAccounts(data);
        } else {
          // API may not exist yet, use mock data
          setAccounts([]);
        }
      } catch (err) {
        console.error('Failed to fetch cloud accounts:', err);
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleAddAccount = async () => {
    if (!selectedProvider) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/cspm/accounts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          credentials,
        }),
      });

      if (res.ok) {
        const newAccount = await res.json();
        setAccounts([...accounts, newAccount]);
        setShowAddModal(false);
        setSelectedProvider(null);
        setCredentials({});
      } else {
        const err = await res.json();
        setError(err.message || 'Failed to add account');
      }
    } catch (err) {
      setError('Failed to add account');
    } finally {
      setAdding(false);
    }
  };

  const handleTriggerScan = async (accountId: string) => {
    setScanningId(accountId);
    try {
      await fetch(`${API_URL}/cspm/accounts/${accountId}/scan`, {
        method: 'POST',
        credentials: 'include',
      });
      // Refresh accounts to get updated scan status
      const res = await fetch(`${API_URL}/cspm/accounts`, { credentials: 'include' });
      if (res.ok) {
        setAccounts(await res.json());
      }
    } catch (err) {
      console.error('Failed to trigger scan:', err);
    } finally {
      setScanningId(null);
    }
  };

  const getCredentialFields = (provider: CloudProvider): Array<{ key: string; label: string; type: string }> => {
    switch (provider) {
      case 'aws':
        return [
          { key: 'accessKeyId', label: 'Access Key ID', type: 'text' },
          { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password' },
          { key: 'region', label: 'Default Region', type: 'text' },
        ];
      case 'azure':
        return [
          { key: 'tenantId', label: 'Tenant ID', type: 'text' },
          { key: 'clientId', label: 'Client ID', type: 'text' },
          { key: 'clientSecret', label: 'Client Secret', type: 'password' },
          { key: 'subscriptionId', label: 'Subscription ID', type: 'text' },
        ];
      case 'gcp':
        return [
          { key: 'projectId', label: 'Project ID', type: 'text' },
          { key: 'clientEmail', label: 'Service Account Email', type: 'text' },
          { key: 'privateKey', label: 'Private Key (JSON)', type: 'textarea' },
        ];
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading cloud accounts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cloud Accounts</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage cloud provider connections for CSPM scanning
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Cloud Account
        </Button>
      </div>

      {/* Quick Links */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/cloud/findings"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium"
        >
          View All Findings
        </Link>
        <Link
          href="/dashboard/cloud/compliance"
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm font-medium"
        >
          Compliance Dashboard
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 font-medium underline">Dismiss</button>
        </div>
      )}

      {/* Accounts Grid */}
      {accounts.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="py-12 text-center">
            <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            <p className="mt-4 text-gray-500 dark:text-gray-400">No cloud accounts connected</p>
            <p className="text-sm text-gray-400">Add your first cloud account to start CSPM scanning</p>
            <Button onClick={() => setShowAddModal(true)} className="mt-4">
              Add Cloud Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <Card key={account.id} variant="bordered">
              <CardContent>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${PROVIDER_INFO[account.provider].color}`}>
                    {PROVIDER_INFO[account.provider].icon}
                  </div>
                  <Badge
                    variant={
                      account.status === 'active' ? 'success' :
                      account.status === 'error' ? 'danger' : 'default'
                    }
                  >
                    {account.status}
                  </Badge>
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-white">{account.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{PROVIDER_INFO[account.provider].name}</p>
                <p className="text-xs text-gray-400 mt-1">ID: {account.accountId}</p>

                {/* Findings Summary */}
                {account.findingsCount && account.findingsCount.total > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Findings</p>
                    <div className="flex items-center gap-2">
                      {account.findingsCount.critical > 0 && (
                        <Badge variant="critical">{account.findingsCount.critical} Critical</Badge>
                      )}
                      {account.findingsCount.high > 0 && (
                        <Badge variant="high">{account.findingsCount.high} High</Badge>
                      )}
                      {account.findingsCount.medium > 0 && (
                        <Badge variant="medium">{account.findingsCount.medium} Med</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Last Scan */}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last scan: {account.lastScanAt ? new Date(account.lastScanAt).toLocaleString() : 'Never'}
                  </p>
                </div>

                {/* Actions */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTriggerScan(account.id)}
                    disabled={scanning === account.id}
                  >
                    {scanning === account.id ? 'Scanning...' : 'Scan Now'}
                  </Button>
                  <Link href={`/dashboard/cloud/findings?accountId=${account.id}`}>
                    <Button variant="ghost" size="sm">
                      View Findings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} size="lg">
        <ModalHeader onClose={() => setShowAddModal(false)}>
          Add Cloud Account
        </ModalHeader>
        <ModalBody>
          {!selectedProvider ? (
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400">Select a cloud provider:</p>
              <div className="grid grid-cols-3 gap-4">
                {(['aws', 'azure', 'gcp'] as CloudProvider[]).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setSelectedProvider(provider)}
                    className={`p-6 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors ${PROVIDER_INFO[provider].color}`}
                  >
                    <div className="flex flex-col items-center">
                      {PROVIDER_INFO[provider].icon}
                      <span className="mt-2 font-medium">{provider.toUpperCase()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedProvider(null)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
              >
                &larr; Back to provider selection
              </button>

              <div className={`p-4 rounded-lg ${PROVIDER_INFO[selectedProvider].color}`}>
                <div className="flex items-center gap-3">
                  {PROVIDER_INFO[selectedProvider].icon}
                  <span className="font-semibold">{PROVIDER_INFO[selectedProvider].name}</span>
                </div>
              </div>

              <div className="space-y-4">
                {getCredentialFields(selectedProvider).map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.label}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        value={credentials[field.key] || ''}
                        onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                        rows={4}
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={credentials[field.key] || ''}
                        onChange={(e) => setCredentials({ ...credentials, [field.key]: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                        placeholder={`Enter ${field.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowAddModal(false)}>
            Cancel
          </Button>
          {selectedProvider && (
            <Button onClick={handleAddAccount} disabled={adding}>
              {adding ? 'Adding...' : 'Add Account'}
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
