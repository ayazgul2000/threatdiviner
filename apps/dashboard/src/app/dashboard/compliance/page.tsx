'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, Badge, PageHeader, Button } from '@/components/ui';
import { useProject } from '@/contexts/project-context';
import { NoComplianceEmpty, NoProjectSelectedEmpty } from '@/components/ui/empty-state';
import { CheckCircle2, AlertTriangle, XCircle, Lock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ControlStatus {
  controlId: string;
  controlName: string;
  status: 'passed' | 'failed' | 'warning';
  findingsCount: number;
  criticalFindings: number;
  highFindings: number;
}

interface Framework {
  id: string;
  name: string;
  version: string;
  tier: 'free' | 'growth' | 'scale';
  score: number;
  passedControls: number;
  failedControls: number;
  totalControls: number;
  controlStatus: ControlStatus[];
}

interface ComplianceData {
  frameworks: Framework[];
}

const TIER_BADGES: Record<string, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  growth: { label: 'Growth', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  scale: { label: 'Scale', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

export default function CompliancePage() {
  const { currentProject } = useProject();
  const [complianceData, setComplianceData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadComplianceData() {
      if (!currentProject) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch compliance score which includes framework analysis
        const params = new URLSearchParams();
        params.set('projectId', currentProject.id);

        const res = await fetch(`${API_URL}/compliance/score?${params}`, {
          credentials: 'include',
        });

        if (res.ok) {
          const data = await res.json();
          setComplianceData(data);
        }
      } catch (error) {
        console.error('Failed to load compliance data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadComplianceData();
  }, [currentProject]);

  const frameworks = complianceData?.frameworks || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading compliance data...</div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <PageHeader title="Compliance" breadcrumbs={[{ label: 'Compliance' }]} />
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <Lock className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to view compliance status
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        backHref="/dashboard"
        breadcrumbs={[
          { label: currentProject?.name || 'Project', href: '/dashboard' },
          { label: 'Compliance' },
        ]}
      />

      {/* Overall Summary */}
      <Card variant="bordered">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {frameworks.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Frameworks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {frameworks.length > 0
                  ? Math.round(frameworks.reduce((sum, f) => sum + (f.overallScore || f.score || 0), 0) / frameworks.length)
                  : 0}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Score</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {frameworks.reduce((sum, f) => sum + (f.passedControls || 0), 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Passed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-600">
                {frameworks.reduce((sum, f) => sum + ((f.totalControls || 0) - (f.passedControls || 0) - (f.failedControls || 0)), 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {frameworks.reduce((sum, f) => sum + (f.failedControls || 0), 0)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {frameworks.map((fw) => {
          const tierBadge = TIER_BADGES[fw.tier || 'free'];
          return (
            <Card key={fw.id} variant="bordered" className="hover:border-blue-300 transition-colors">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle className="text-lg">{fw.frameworkName || fw.name}</CardTitle>
                      <Badge className={tierBadge.className} size="sm">
                        {tierBadge.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Version {fw.version}
                    </p>
                  </div>
                  <div className={`text-3xl font-bold ${getScoreColor(fw.overallScore || fw.score || 0)}`}>
                    {fw.overallScore || fw.score || 0}%
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                  <div
                    className={`h-2 rounded-full transition-all ${getProgressColor(fw.overallScore || fw.score || 0)}`}
                    style={{ width: `${fw.overallScore || fw.score || 0}%` }}
                  />
                </div>

                {/* Control Summary */}
                <div className="space-y-2">
                  {(fw.controlStatus || []).slice(0, 4).map((ctrl) => (
                    <div key={ctrl.controlId} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2 truncate flex-1">
                        {getStatusIcon(ctrl.status)}
                        <span className="text-gray-700 dark:text-gray-300 truncate">
                          {ctrl.controlName}
                        </span>
                      </div>
                      {ctrl.findingsCount > 0 && (
                        <span className="text-xs text-gray-500">
                          {ctrl.findingsCount} finding{ctrl.findingsCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Stats Row */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-3 text-xs">
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {fw.passedControls || 0}
                    </span>
                    <span className="text-yellow-600 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {(fw.totalControls || 0) - (fw.passedControls || 0) - (fw.failedControls || 0)}
                    </span>
                    <span className="text-red-600 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {fw.failedControls || 0}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/compliance/${fw.framework || fw.id}`}
                    className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    View Details →
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {frameworks.length === 0 && (
        <Card variant="bordered">
          <NoComplianceEmpty />
        </Card>
      )}
    </div>
  );
}
