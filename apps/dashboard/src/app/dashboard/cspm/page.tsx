'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, PageHeader } from '@/components/ui';
import { useProject } from '@/contexts/project-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CloudAccount {
  id: string;
  name: string;
  provider: 'AWS' | 'AZURE' | 'GCP';
  accountId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  regions: string[];
  lastScanAt: string | null;
  findingsCount: number;
  criticalCount: number;
}

interface CspmFinding {
  id: string;
  provider: string;
  service: string;
  region: string;
  resourceId: string;
  resourceType: string;
  severity: string;
  title: string;
  description: string;
  status: string;
}

export default function CspmPage() {
  const { currentProject } = useProject();
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [findings, setFindings] = useState<CspmFinding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [accountsRes, findingsRes] = await Promise.all([
          fetch(`${API_URL}/cspm/accounts`, { credentials: 'include' }),
          fetch(`${API_URL}/cspm/findings`, { credentials: 'include' }),
        ]);

        if (accountsRes.ok) {
          const data = await accountsRes.json();
          setAccounts(data.accounts || data || []);
        }

        if (findingsRes.ok) {
          const data = await findingsRes.json();
          setFindings(data.findings || data || []);
        }
      } catch (err) {
        console.error('Failed to load CSPM data', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [currentProject]);

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'AWS':
        return (
          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm">
            AWS
          </div>
        );
      case 'AZURE':
        return (
          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
            AZ
          </div>
        );
      case 'GCP':
        return (
          <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center text-green-600 dark:text-green-400 font-bold text-sm">
            GCP
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-600 dark:text-gray-400 font-bold text-sm">
            ?
          </div>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
      high: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
      medium: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
      low: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
      info: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    };

    return (
      <Badge className={colors[severity.toLowerCase()] || colors.info}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading cloud security data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cloud Security Posture Management"
        backHref="/dashboard"
        breadcrumbs={[
          { label: currentProject?.name || 'Project', href: '/dashboard' },
          { label: 'CSPM' },
        ]}
        actions={
          <Button>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Add Cloud Account
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="bordered">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {accounts.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Cloud Accounts</div>
            </div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {accounts.filter((a) => a.status === 'CONNECTED').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Connected</div>
            </div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {findings.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Findings</div>
            </div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {findings.filter((f) => f.severity === 'critical').length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Critical</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cloud Accounts */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Cloud Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No cloud accounts connected. Add AWS, Azure, or GCP accounts to start scanning.
              </p>
              <Button>Connect Cloud Account</Button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.map((account) => (
                <div key={account.id} className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {getProviderIcon(account.provider)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {account.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {account.provider} - {account.accountId}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {account.findingsCount} findings
                      </p>
                      {account.criticalCount > 0 && (
                        <p className="text-xs text-red-600">
                          {account.criticalCount} critical
                        </p>
                      )}
                    </div>
                    <Badge
                      className={
                        account.status === 'CONNECTED'
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }
                    >
                      {account.status}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Scan
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cloud Security Findings */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Cloud Security Findings</CardTitle>
        </CardHeader>
        <CardContent>
          {findings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No cloud security findings. Connect a cloud account and run a scan.
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {findings.slice(0, 10).map((finding) => (
                <div key={finding.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getSeverityBadge(finding.severity)}
                        <Badge className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                          {finding.service}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {finding.region}
                        </span>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {finding.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {finding.resourceType}: {finding.resourceId}
                      </p>
                    </div>
                    <Badge
                      className={
                        finding.status === 'open'
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                          : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                      }
                    >
                      {finding.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
