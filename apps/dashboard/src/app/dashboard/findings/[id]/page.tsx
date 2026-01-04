'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  SeverityBadge,
  Button,
  PageHeader,
  useToast,
} from '@/components/ui';
import { useProject } from '@/contexts/project-context';
import { findingsApi, API_URL, type Finding } from '@/lib/api';

type FindingStatus = 'open' | 'in_progress' | 'fixed' | 'false_positive' | 'suppressed';

// CWE descriptions mapping (common CWEs)
const CWE_DESCRIPTIONS: Record<string, string> = {
  'CWE-79': 'Cross-site Scripting (XSS)',
  'CWE-89': 'SQL Injection',
  'CWE-78': 'OS Command Injection',
  'CWE-94': 'Code Injection',
  'CWE-22': 'Path Traversal',
  'CWE-798': 'Hard-coded Credentials',
  'CWE-200': 'Information Exposure',
  'CWE-287': 'Improper Authentication',
  'CWE-306': 'Missing Authentication',
  'CWE-352': 'Cross-Site Request Forgery (CSRF)',
  'CWE-434': 'Unrestricted File Upload',
  'CWE-502': 'Deserialization of Untrusted Data',
  'CWE-611': 'XXE Injection',
  'CWE-918': 'Server-Side Request Forgery (SSRF)',
  'CWE-1321': 'Prototype Pollution',
};

// OWASP Top 10 2021 mapping
const OWASP_MAPPING: Record<string, { id: string; name: string }> = {
  'CWE-79': { id: 'A03:2021', name: 'Injection' },
  'CWE-89': { id: 'A03:2021', name: 'Injection' },
  'CWE-78': { id: 'A03:2021', name: 'Injection' },
  'CWE-94': { id: 'A03:2021', name: 'Injection' },
  'CWE-22': { id: 'A01:2021', name: 'Broken Access Control' },
  'CWE-798': { id: 'A07:2021', name: 'Identification and Authentication Failures' },
  'CWE-200': { id: 'A01:2021', name: 'Broken Access Control' },
  'CWE-287': { id: 'A07:2021', name: 'Identification and Authentication Failures' },
  'CWE-306': { id: 'A07:2021', name: 'Identification and Authentication Failures' },
  'CWE-352': { id: 'A01:2021', name: 'Broken Access Control' },
  'CWE-434': { id: 'A04:2021', name: 'Insecure Design' },
  'CWE-502': { id: 'A08:2021', name: 'Software and Data Integrity Failures' },
  'CWE-611': { id: 'A03:2021', name: 'Injection' },
  'CWE-918': { id: 'A10:2021', name: 'Server-Side Request Forgery' },
};

// Compliance mapping
const COMPLIANCE_FRAMEWORKS: Record<string, string[]> = {
  'CWE-79': ['SOC2', 'PCI-DSS', 'OWASP', 'NIST'],
  'CWE-89': ['SOC2', 'PCI-DSS', 'OWASP', 'NIST', 'ISO27001'],
  'CWE-78': ['SOC2', 'PCI-DSS', 'OWASP', 'NIST'],
  'CWE-798': ['SOC2', 'PCI-DSS', 'CIS', 'NIST', 'ISO27001'],
  'CWE-200': ['SOC2', 'PCI-DSS', 'NIST', 'ISO27001'],
  'CWE-287': ['SOC2', 'PCI-DSS', 'NIST', 'ISO27001'],
};

export default function FindingDetailPage() {
  const params = useParams();
  const findingId = params.id as string;
  const { currentProject } = useProject();
  const toastCtx = useToast();

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [triaging, setTriaging] = useState(false);
  const [applyingFix, setApplyingFix] = useState(false);
  const [suppressing, setSuppressing] = useState(false);
  const [creatingJira, setCreatingJira] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const findingData = await findingsApi.get(findingId);
        setFinding(findingData);
      } catch (err) {
        console.error('Failed to fetch finding:', err);
        setError(err instanceof Error ? err.message : 'Failed to load finding');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [findingId]);

  // AI Triage - POST to /fix/triage/:id
  const handleAiTriage = async () => {
    if (!finding) return;
    setTriaging(true);
    try {
      const res = await fetch(`${API_URL}/fix/triage/${findingId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('AI triage failed');
      const result = await res.json();
      setFinding({
        ...finding,
        aiAnalysis: result.aiAnalysis,
        aiConfidence: result.aiConfidence,
        aiSeverity: result.aiSeverity,
        aiFalsePositive: result.aiFalsePositive,
        aiExploitability: result.aiExploitability,
        aiRemediation: result.aiRemediation,
        aiTriagedAt: result.aiTriagedAt,
      });
      toastCtx.success('AI Triage Complete', 'Finding has been analyzed by AI.');
    } catch (err) {
      console.error('Failed to triage finding:', err);
      toastCtx.error('AI Triage Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setTriaging(false);
    }
  };

  // Apply Fix - POST to /fix/:id
  const handleApplyFix = async () => {
    if (!finding) return;
    setApplyingFix(true);
    try {
      const res = await fetch(`${API_URL}/fix/${findingId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to apply fix');
      const result = await res.json();
      toastCtx.success('Fix Applied', result.message || 'The fix has been applied successfully.');
    } catch (err) {
      console.error('Failed to apply fix:', err);
      toastCtx.error('Apply Fix Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setApplyingFix(false);
    }
  };

  // Suppress - POST to /scm/findings/:id/status with { status: 'suppressed' }
  const handleSuppress = async () => {
    if (!finding) return;
    setSuppressing(true);
    try {
      const res = await fetch(`${API_URL}/scm/findings/${findingId}/status`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suppressed' }),
      });
      if (!res.ok) throw new Error('Failed to suppress finding');
      setFinding({ ...finding, status: 'false_positive' });
      toastCtx.success('Finding Suppressed', 'This finding has been suppressed.');
    } catch (err) {
      console.error('Failed to suppress finding:', err);
      toastCtx.error('Suppress Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setSuppressing(false);
    }
  };

  // Create Jira Ticket - POST to /jira/finding/:id
  const handleCreateJira = async () => {
    if (!finding) return;
    setCreatingJira(true);
    try {
      const res = await fetch(`${API_URL}/jira/finding/${findingId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to create Jira ticket');
      const data = await res.json();
      toastCtx.success('Jira Ticket Created', `Ticket ${data.key || data.id} has been created.`);
    } catch (err) {
      console.error('Failed to create Jira ticket:', err);
      toastCtx.error('Create Jira Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setCreatingJira(false);
    }
  };

  // Status change - PUT to /scm/findings/:id/status
  const handleStatusChange = async (newStatus: FindingStatus) => {
    if (!finding) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`${API_URL}/scm/findings/${findingId}/status`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setFinding({ ...finding, status: newStatus as any });
      toastCtx.success('Status Updated', `Finding status changed to ${newStatus.replace('_', ' ')}.`);
    } catch (err) {
      console.error('Failed to update status:', err);
      toastCtx.error('Status Update Failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getCvssScore = (severity: string): number => {
    switch (severity) {
      case 'critical': return 9.5;
      case 'high': return 7.5;
      case 'medium': return 5.0;
      case 'low': return 3.0;
      default: return 1.0;
    }
  };

  const getCvssColor = (score: number): string => {
    if (score >= 9.0) return 'text-red-600';
    if (score >= 7.0) return 'text-orange-500';
    if (score >= 4.0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getConfidenceLabel = (confidence: number | null | undefined): string => {
    if (confidence === null || confidence === undefined) return 'Unknown';
    if (confidence >= 0.9) return 'Very High';
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.5) return 'Medium';
    return 'Low';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading finding details...</div>
      </div>
    );
  }

  if (error || !finding) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error || 'Finding not found'}
        </div>
        <Link href="/dashboard/findings" className="text-blue-600 hover:text-blue-700">
          Back to Findings
        </Link>
      </div>
    );
  }

  const cvssScore = getCvssScore(finding.severity);
  const primaryCwe = finding.cwe?.[0] || null;
  const owaspMapping = primaryCwe ? OWASP_MAPPING[primaryCwe] : null;
  const complianceTags = primaryCwe ? COMPLIANCE_FRAMEWORKS[primaryCwe] || ['SOC2', 'NIST'] : ['SOC2', 'NIST'];

  // Truncate title for breadcrumb
  const truncatedTitle = finding.title.length > 30
    ? finding.title.substring(0, 30) + '...'
    : finding.title;

  return (
    <div className="space-y-6">
      {/* PageHeader */}
      <PageHeader
        title={finding.title}
        backHref="/dashboard/findings"
        breadcrumbs={[
          { label: currentProject?.name || 'Project', href: '/dashboard' },
          { label: 'Findings', href: '/dashboard/findings' },
          { label: truncatedTitle },
        ]}
        context={{
          type: 'finding',
          status: finding.status,
          metadata: {
            Scanner: finding.scanner || 'Unknown',
            File: finding.filePath || 'N/A',
            Line: String(finding.startLine || 0),
          },
        }}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleAiTriage}
              disabled={triaging}
            >
              {triaging ? 'Triaging...' : 'AI Triage'}
            </Button>
            <Button
              variant="outline"
              onClick={handleApplyFix}
              disabled={applyingFix}
            >
              {applyingFix ? 'Applying...' : 'Apply Fix'}
            </Button>
            <Button
              variant="outline"
              onClick={handleSuppress}
              disabled={suppressing}
            >
              {suppressing ? 'Suppressing...' : 'Suppress'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCreateJira}
              disabled={creatingJira}
            >
              {creatingJira ? 'Creating...' : 'Create Jira Ticket'}
            </Button>
          </div>
        }
      />

      {/* Status Dropdown */}
      <Card variant="bordered">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Status:
            </label>
            <select
              value={finding.status}
              onChange={(e) => handleStatusChange(e.target.value as FindingStatus)}
              disabled={updatingStatus}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="fixed">Fixed</option>
              <option value="false_positive">False Positive</option>
              <option value="suppressed">Suppressed</option>
            </select>
            <SeverityBadge severity={finding.severity} />
          </div>
        </CardContent>
      </Card>

      {/* Description Card */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            {finding.description || finding.message || finding.title}
          </p>
        </CardContent>
      </Card>

      {/* Remediation Card - Show if remediation field exists */}
      {finding.remediation && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Remediation Guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {finding.remediation}
            </p>
          </CardContent>
        </Card>
      )}

      {/* SLA Deadline Card - Show if slaDeadline exists */}
      {(finding as any).slaDeadline && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>SLA Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const deadline = new Date((finding as any).slaDeadline);
              const now = new Date();
              const isOverdue = deadline < now;
              const hoursRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

              return (
                <div className={`flex items-center gap-3 ${isOverdue ? 'text-red-600' : 'text-yellow-600'}`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">
                    {deadline.toLocaleDateString()} {deadline.toLocaleTimeString()}
                  </span>
                  <Badge variant={isOverdue ? 'danger' : 'warning'}>
                    {isOverdue ? 'OVERDUE' : `${hoursRemaining}h remaining`}
                  </Badge>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Package Info Card - For SCA findings */}
      {(finding as any).packageName && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Package Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Package</dt>
                <dd className="text-gray-900 dark:text-white font-medium">{(finding as any).packageName}</dd>
              </div>
              {(finding as any).currentVersion && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Current Version</dt>
                  <dd className="text-red-600 font-medium">{(finding as any).currentVersion}</dd>
                </div>
              )}
              {(finding as any).fixedVersion && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">Fixed Version</dt>
                  <dd className="text-green-600 font-medium">{(finding as any).fixedVersion}</dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Code Snippet */}
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Vulnerable Code</CardTitle>
            <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {finding.filePath}:{finding.startLine}
              {finding.endLine && finding.endLine !== finding.startLine ? `-${finding.endLine}` : ''}
            </code>
          </div>
        </CardHeader>
        <CardContent>
          {finding.snippet ? (
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              <code>{finding.snippet}</code>
            </pre>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No code snippet available</p>
          )}
        </CardContent>
      </Card>

      {/* Scanner and Rule Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Scanner Info</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Scanner</dt>
                <dd className="text-gray-900 dark:text-white font-medium">{finding.scanner}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Rule ID</dt>
                <dd>
                  <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {finding.ruleId}
                  </code>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">Fingerprint</dt>
                <dd className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
                  {finding.fingerprint}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Vulnerability Details */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Vulnerability Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              {/* CVSS Score */}
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">CVSS Score</dt>
                <dd className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${
                        cvssScore >= 9 ? 'bg-red-600' :
                        cvssScore >= 7 ? 'bg-orange-500' :
                        cvssScore >= 4 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${(cvssScore / 10) * 100}%` }}
                    />
                  </div>
                  <span className={`font-bold ${getCvssColor(cvssScore)}`}>
                    {cvssScore.toFixed(1)}
                  </span>
                </dd>
              </div>
              {/* CWE */}
              {finding.cwe && finding.cwe.length > 0 && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">CWE</dt>
                  <dd className="flex flex-wrap gap-2 mt-1">
                    {finding.cwe.map((cwe) => (
                      <a
                        key={cwe}
                        href={`https://cwe.mitre.org/data/definitions/${cwe.replace('CWE-', '')}.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-sm hover:bg-purple-200 dark:hover:bg-purple-800"
                      >
                        {cwe}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ))}
                  </dd>
                  {primaryCwe && CWE_DESCRIPTIONS[primaryCwe] && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {CWE_DESCRIPTIONS[primaryCwe]}
                    </p>
                  )}
                </div>
              )}
              {/* OWASP */}
              {owaspMapping && (
                <div>
                  <dt className="text-sm text-gray-500 dark:text-gray-400">OWASP Top 10</dt>
                  <dd>
                    <Badge variant="danger">
                      {owaspMapping.id}: {owaspMapping.name}
                    </Badge>
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Mapping */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Compliance Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {complianceTags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
            This finding may affect your compliance with the above security frameworks.
          </p>
        </CardContent>
      </Card>

      {/* AI Triage Section */}
      <Card variant="bordered">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI Triage</CardTitle>
            {!finding.aiTriagedAt && (
              <Button onClick={handleAiTriage} disabled={triaging}>
                {triaging ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analyzing...
                  </>
                ) : (
                  'Run AI Triage'
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {finding.aiTriagedAt ? (
            <div className="space-y-4">
              {/* AI Verdict */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Confidence</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {finding.aiConfidence ? `${(finding.aiConfidence * 100).toFixed(0)}%` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">{getConfidenceLabel(finding.aiConfidence)}</p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">False Positive</p>
                  <p className={`text-xl font-bold ${finding.aiFalsePositive ? 'text-green-600' : 'text-red-600'}`}>
                    {finding.aiFalsePositive ? 'Likely' : 'Unlikely'}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">AI Severity</p>
                  <p className="text-xl font-bold">
                    <SeverityBadge severity={(finding.aiSeverity || finding.severity) as 'critical' | 'high' | 'medium' | 'low' | 'info'} />
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Exploitability</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white capitalize">
                    {finding.aiExploitability || 'Unknown'}
                  </p>
                </div>
              </div>

              {/* AI Analysis */}
              {finding.aiAnalysis && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Analysis</h4>
                  <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    {finding.aiAnalysis}
                  </p>
                </div>
              )}

              {/* AI Remediation */}
              {finding.aiRemediation && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    AI-Generated Fix Suggestion
                  </h4>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                    <code>{finding.aiRemediation}</code>
                  </pre>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Triaged at: {new Date(finding.aiTriagedAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              AI triage has not been run on this finding. Click &quot;Run AI Triage&quot; to get AI-powered analysis including
              false positive detection, severity assessment, exploitability rating, and remediation suggestions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Remediation Section */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Remediation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {finding.message && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scanner Recommendation
                </h4>
                <p className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  {finding.message}
                </p>
              </div>
            )}

            {/* External References */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                External References
              </h4>
              <div className="flex flex-wrap gap-2">
                {primaryCwe && (
                  <a
                    href={`https://cwe.mitre.org/data/definitions/${primaryCwe.replace('CWE-', '')}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm inline-flex items-center gap-1"
                  >
                    CWE Details
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
                {owaspMapping && (
                  <a
                    href={`https://owasp.org/Top10/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm inline-flex items-center gap-1"
                  >
                    OWASP Top 10
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card variant="bordered">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">First Seen</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {finding.firstSeenAt ? new Date(finding.firstSeenAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Last Seen</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {finding.lastSeenAt ? new Date(finding.lastSeenAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Scan</p>
              <Link
                href={`/dashboard/scans/${finding.scanId}`}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium"
              >
                View Scan
              </Link>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Finding ID</p>
              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                {finding.id.substring(0, 8)}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
