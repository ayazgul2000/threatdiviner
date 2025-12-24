'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  SeverityBadge,
  Button,
} from '@/components/ui';
import { repositoriesApi, scansApi, findingsApi, type Repository, type Scan, type Finding } from '@/lib/api';

interface PipelineStage {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  scanners: string[];
  status: 'passed' | 'failed' | 'pending' | 'not_configured';
  findings: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
}

interface PipelineRun {
  id: string;
  repositoryId: string;
  repositoryName: string;
  branch: string;
  commitSha: string;
  timestamp: Date;
  stages: PipelineStage[];
  overallScore: number;
}

const STAGE_ICONS = {
  code: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  build: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  test: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  deploy: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  prod: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
};

const STATUS_STYLES = {
  passed: {
    bg: 'bg-green-100 dark:bg-green-900',
    border: 'border-green-500',
    text: 'text-green-600 dark:text-green-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    label: 'Passed',
  },
  failed: {
    bg: 'bg-red-100 dark:bg-red-900',
    border: 'border-red-500',
    text: 'text-red-600 dark:text-red-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    label: 'Failed',
  },
  pending: {
    bg: 'bg-yellow-100 dark:bg-yellow-900',
    border: 'border-yellow-500',
    text: 'text-yellow-600 dark:text-yellow-400',
    icon: (
      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    label: 'Pending',
  },
  not_configured: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-500 dark:text-gray-400',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
    ),
    label: 'Not Configured',
  },
};

export default function PipelinePage() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRepositories = async () => {
      try {
        const repos = await repositoriesApi.list();
        setRepositories(repos);
        if (repos.length > 0) {
          setSelectedRepo(repos[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch repositories:', err);
        setError('Failed to load repositories');
      } finally {
        setLoading(false);
      }
    };

    fetchRepositories();
  }, []);

  useEffect(() => {
    if (!selectedRepo) return;

    const fetchPipelineData = async () => {
      try {
        const [scans, findingsData] = await Promise.all([
          scansApi.list(selectedRepo),
          findingsApi.list({ repositoryId: selectedRepo }),
        ]);

        // Group findings by scanner type
        const findingsByScanner: Record<string, Finding[]> = {};
        findingsData.findings?.forEach((f) => {
          const scanner = f.scanner.toLowerCase();
          if (!findingsByScanner[scanner]) findingsByScanner[scanner] = [];
          findingsByScanner[scanner].push(f);
        });

        // Calculate findings by stage
        const getStageFindings = (scanners: string[]) => {
          const findings = scanners.flatMap(s => findingsByScanner[s] || []);
          return {
            critical: findings.filter(f => f.severity === 'critical').length,
            high: findings.filter(f => f.severity === 'high').length,
            medium: findings.filter(f => f.severity === 'medium').length,
            low: findings.filter(f => f.severity === 'low').length,
            total: findings.length,
          };
        };

        const getStageStatus = (findings: { critical: number; high: number; total: number }): 'passed' | 'failed' | 'pending' | 'not_configured' => {
          if (findings.total === 0) return 'passed';
          if (findings.critical > 0 || findings.high > 0) return 'failed';
          return 'passed';
        };

        // Create pipeline stages
        const stages: PipelineStage[] = [
          {
            id: 'code',
            name: 'Code',
            description: 'SAST + Secrets scanning (pre-commit)',
            icon: STAGE_ICONS.code,
            scanners: ['semgrep', 'gitleaks', 'trufflehog'],
            findings: getStageFindings(['semgrep', 'gitleaks', 'trufflehog']),
            status: 'passed',
          },
          {
            id: 'build',
            name: 'Build',
            description: 'SCA + Container scanning',
            icon: STAGE_ICONS.build,
            scanners: ['trivy'],
            findings: getStageFindings(['trivy']),
            status: 'passed',
          },
          {
            id: 'test',
            name: 'Test',
            description: 'IaC scanning (Terraform, CloudFormation)',
            icon: STAGE_ICONS.test,
            scanners: ['checkov'],
            findings: getStageFindings(['checkov']),
            status: 'passed',
          },
          {
            id: 'deploy',
            name: 'Deploy',
            description: 'DAST scanning (staging URL)',
            icon: STAGE_ICONS.deploy,
            scanners: ['nuclei', 'zap'],
            findings: getStageFindings(['nuclei', 'zap']),
            status: 'passed',
          },
          {
            id: 'prod',
            name: 'Prod',
            description: 'CSPM findings (cloud config)',
            icon: STAGE_ICONS.prod,
            scanners: ['prowler'],
            findings: getStageFindings(['prowler']),
            status: 'passed',
          },
        ];

        // Update status based on findings
        stages.forEach(stage => {
          stage.status = getStageStatus(stage.findings);
        });

        // Create pipeline runs from recent scans
        const runs: PipelineRun[] = scans.slice(0, 5).map((scan: Scan) => {
          const scanStages = stages.map(s => ({ ...s }));
          const totalFindings = scanStages.reduce((sum, s) => sum + s.findings.total, 0);
          const criticalHigh = scanStages.reduce((sum, s) => sum + s.findings.critical + s.findings.high, 0);
          const score = totalFindings === 0 ? 100 : Math.max(0, 100 - (criticalHigh * 20) - ((totalFindings - criticalHigh) * 2));

          return {
            id: scan.id,
            repositoryId: scan.repositoryId,
            repositoryName: scan.repository?.fullName || 'Unknown',
            branch: scan.branch,
            commitSha: scan.commitSha,
            timestamp: new Date(scan.createdAt),
            stages: scanStages,
            overallScore: score,
          };
        });

        setPipelineRuns(runs);
      } catch (err) {
        console.error('Failed to fetch pipeline data:', err);
        setError('Failed to load pipeline data');
      }
    };

    fetchPipelineData();
  }, [selectedRepo]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 40) return 'text-orange-500 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading pipeline view...</div>
      </div>
    );
  }

  const currentPipeline = pipelineRuns[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline Security</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Security gates across your CI/CD pipeline
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
          >
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Overall Security Score */}
      {currentPipeline && (
        <Card variant="bordered">
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Overall Security Score</p>
                <p className={`text-4xl font-bold ${getScoreColor(currentPipeline.overallScore)}`}>
                  {currentPipeline.overallScore}
                </p>
              </div>
              <div className="w-32 h-32 relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    className="text-gray-200 dark:text-gray-700"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                  <circle
                    className={getScoreColor(currentPipeline.overallScore)}
                    strokeWidth="8"
                    strokeDasharray={`${(currentPipeline.overallScore / 100) * 352} 352`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r="56"
                    cx="64"
                    cy="64"
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-2xl font-bold ${getScoreColor(currentPipeline.overallScore)}`}>
                  {currentPipeline.overallScore}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pipeline Visualization */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Pipeline Stages</CardTitle>
        </CardHeader>
        <CardContent>
          {currentPipeline ? (
            <div className="flex items-start justify-between overflow-x-auto pb-4">
              {currentPipeline.stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center">
                  {/* Stage Card */}
                  <div
                    className={`min-w-[180px] p-4 rounded-lg border-2 ${STATUS_STYLES[stage.status].border} ${STATUS_STYLES[stage.status].bg}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className={STATUS_STYLES[stage.status].text}>
                        {stage.icon}
                      </div>
                      <div className={`flex items-center gap-1 ${STATUS_STYLES[stage.status].text}`}>
                        {STATUS_STYLES[stage.status].icon}
                        <span className="text-xs font-medium">{STATUS_STYLES[stage.status].label}</span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{stage.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{stage.description}</p>

                    {/* Findings Summary */}
                    {stage.findings.total > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex flex-wrap gap-1">
                          {stage.findings.critical > 0 && (
                            <SeverityBadge severity="critical">{stage.findings.critical}</SeverityBadge>
                          )}
                          {stage.findings.high > 0 && (
                            <SeverityBadge severity="high">{stage.findings.high}</SeverityBadge>
                          )}
                          {stage.findings.medium > 0 && (
                            <SeverityBadge severity="medium">{stage.findings.medium}</SeverityBadge>
                          )}
                          {stage.findings.low > 0 && (
                            <SeverityBadge severity="low">{stage.findings.low}</SeverityBadge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Configure Gate Button */}
                    <Link
                      href={selectedRepo ? `/dashboard/repositories/${selectedRepo}/settings` : '#'}
                      className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline block"
                    >
                      Configure Gate
                    </Link>
                  </div>

                  {/* Connector Arrow */}
                  {index < currentPipeline.stages.length - 1 && (
                    <div className="px-2">
                      <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No pipeline data available. Run a scan to see pipeline status.</p>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Run History */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Recent Pipeline Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelineRuns.length > 0 ? (
            <div className="space-y-4">
              {pipelineRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      {run.stages.map((stage) => (
                        <div
                          key={stage.id}
                          className={`w-3 h-3 rounded-full ${
                            stage.status === 'passed' ? 'bg-green-500' :
                            stage.status === 'failed' ? 'bg-red-500' :
                            stage.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-400'
                          }`}
                          title={`${stage.name}: ${stage.status}`}
                        />
                      ))}
                    </div>
                    <div>
                      <Link
                        href={`/dashboard/scans/${run.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      >
                        {run.repositoryName}
                      </Link>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {run.branch} / {run.commitSha.substring(0, 7)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-bold ${getScoreColor(run.overallScore)}`}>
                        {run.overallScore}%
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {run.timestamp.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getScoreBgColor(run.overallScore)}`}
                        style={{ width: `${run.overallScore}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No pipeline runs yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
