'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  SeverityBadge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface CloudFinding {
  id: string;
  accountId: string;
  provider: 'aws' | 'azure' | 'gcp';
  service: string;
  resource: string;
  resourceArn?: string;
  region: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  remediation: string;
  complianceFrameworks: string[];
  status: 'open' | 'fixed' | 'ignored' | 'false_positive';
  createdAt: string;
}

const SERVICES: Record<string, string[]> = {
  aws: ['EC2', 'S3', 'IAM', 'RDS', 'Lambda', 'CloudFront', 'VPC', 'EKS', 'ECS'],
  azure: ['VMs', 'Storage', 'AD', 'SQL', 'Functions', 'AKS', 'VNet', 'KeyVault'],
  gcp: ['Compute', 'Storage', 'IAM', 'CloudSQL', 'Functions', 'GKE', 'VPC', 'KMS'],
};

export default function CloudFindingsPage() {
  const searchParams = useSearchParams();
  const accountIdFilter = searchParams.get('accountId');

  const [findings, setFindings] = useState<CloudFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<CloudFinding | null>(null);
  const [filters, setFilters] = useState({
    provider: '',
    service: '',
    severity: '',
    compliance: '',
  });

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        const params = new URLSearchParams();
        if (accountIdFilter) params.append('accountId', accountIdFilter);
        if (filters.provider) params.append('provider', filters.provider);
        if (filters.service) params.append('service', filters.service);
        if (filters.severity) params.append('severity', filters.severity);
        if (filters.compliance) params.append('compliance', filters.compliance);

        const res = await fetch(`${API_URL}/cspm/findings?${params.toString()}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setFindings(data.findings || []);
        } else {
          // Mock data if API doesn't exist
          setFindings([]);
        }
      } catch (err) {
        console.error('Failed to fetch cloud findings:', err);
        setFindings([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, [accountIdFilter, filters]);

  const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'aws':
        return <Badge variant="warning">AWS</Badge>;
      case 'azure':
        return <Badge variant="info">Azure</Badge>;
      case 'gcp':
        return <Badge variant="success">GCP</Badge>;
      default:
        return <Badge variant="default">{provider}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading cloud findings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/cloud"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cloud Findings</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Security findings from CSPM scans
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Provider
          </label>
          <select
            value={filters.provider}
            onChange={(e) => setFilters({ ...filters, provider: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Providers</option>
            <option value="aws">AWS</option>
            <option value="azure">Azure</option>
            <option value="gcp">GCP</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Service
          </label>
          <select
            value={filters.service}
            onChange={(e) => setFilters({ ...filters, service: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Services</option>
            {filters.provider && SERVICES[filters.provider]?.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Severity
          </label>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Compliance
          </label>
          <select
            value={filters.compliance}
            onChange={(e) => setFilters({ ...filters, compliance: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          >
            <option value="">All Frameworks</option>
            <option value="CIS">CIS Benchmarks</option>
            <option value="SOC2">SOC 2</option>
            <option value="PCI-DSS">PCI-DSS</option>
            <option value="HIPAA">HIPAA</option>
            <option value="NIST">NIST</option>
            <option value="ISO27001">ISO 27001</option>
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Findings Table */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Severity</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.length === 0 ? (
                <TableEmpty colSpan={7} message="No cloud findings match your filters." />
              ) : (
                findings.map((finding) => (
                  <TableRow key={finding.id} onClick={() => setSelectedFinding(finding)}>
                    <TableCell>
                      <SeverityBadge severity={finding.severity} />
                    </TableCell>
                    <TableCell>
                      {getProviderBadge(finding.provider)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{finding.service}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-md">
                        {finding.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded truncate max-w-xs block">
                        {finding.resource}
                      </code>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-600 dark:text-gray-400">{finding.region}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {finding.complianceFrameworks?.slice(0, 2).map((framework) => (
                          <Badge key={framework} variant="outline" size="sm">{framework}</Badge>
                        ))}
                        {finding.complianceFrameworks?.length > 2 && (
                          <Badge variant="outline" size="sm">+{finding.complianceFrameworks.length - 2}</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Finding Detail Modal */}
      <Modal isOpen={!!selectedFinding} onClose={() => setSelectedFinding(null)} size="xl">
        {selectedFinding && (
          <>
            <ModalHeader onClose={() => setSelectedFinding(null)}>
              <div className="flex items-center gap-3">
                <SeverityBadge severity={selectedFinding.severity} />
                <span className="truncate">{selectedFinding.title}</span>
              </div>
            </ModalHeader>
            <ModalBody>
              <div className="space-y-6">
                {/* Resource Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Provider</h4>
                    {getProviderBadge(selectedFinding.provider)}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Service</h4>
                    <Badge variant="default">{selectedFinding.service}</Badge>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Region</h4>
                    <span className="text-gray-600 dark:text-gray-400">{selectedFinding.region}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resource</h4>
                    <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {selectedFinding.resource}
                    </code>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</h4>
                  <p className="text-gray-600 dark:text-gray-400">{selectedFinding.description}</p>
                </div>

                {/* Remediation */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Remediation</h4>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <p className="text-blue-700 dark:text-blue-300">{selectedFinding.remediation}</p>
                  </div>
                </div>

                {/* Compliance Frameworks */}
                {selectedFinding.complianceFrameworks?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Compliance Impact</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedFinding.complianceFrameworks.map((framework) => (
                        <span
                          key={framework}
                          className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium"
                        >
                          {framework}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* ARN */}
                {selectedFinding.resourceArn && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Resource ARN</h4>
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded block overflow-x-auto">
                      {selectedFinding.resourceArn}
                    </code>
                  </div>
                )}
              </div>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setSelectedFinding(null)}>
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
