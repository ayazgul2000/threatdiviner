'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useProject } from '@/contexts/project-context';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@/components/ui';
import { TableSkeleton } from '@/components/ui/skeletons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ReportType = 'executive' | 'compliance' | 'vulnerability' | 'sbom' | 'custom';
type ReportFormat = 'pdf' | 'html' | 'csv' | 'json';
type ReportStatus = 'pending' | 'generating' | 'completed' | 'failed';

interface Report {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  size?: number;
  parameters?: Record<string, unknown>;
}

interface ReportTemplate {
  type: ReportType;
  name: string;
  description: string;
  icon: React.ReactNode;
  formats: ReportFormat[];
}

const reportTemplates: ReportTemplate[] = [
  {
    type: 'executive',
    name: 'Executive Summary',
    description: 'High-level overview of security posture for leadership',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    formats: ['pdf', 'html'],
  },
  {
    type: 'compliance',
    name: 'Compliance Report',
    description: 'Detailed compliance status against security frameworks',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    formats: ['pdf', 'html', 'csv'],
  },
  {
    type: 'vulnerability',
    name: 'Vulnerability Report',
    description: 'Comprehensive list of all findings with remediation guidance',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    formats: ['pdf', 'html', 'csv', 'json'],
  },
  {
    type: 'sbom',
    name: 'SBOM Export',
    description: 'Export software bill of materials in standard formats',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    formats: ['json', 'csv'],
  },
  {
    type: 'custom',
    name: 'Custom Report',
    description: 'Build a custom report with selected data and filters',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    formats: ['pdf', 'html', 'csv', 'json'],
  },
];

const statusStyles: Record<ReportStatus, { color: string; label: string }> = {
  pending: { color: 'secondary', label: 'Pending' },
  generating: { color: 'info', label: 'Generating' },
  completed: { color: 'success', label: 'Completed' },
  failed: { color: 'danger', label: 'Failed' },
};

export default function ReportsPage() {
  const { currentProject } = useProject();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf');
  const [reportName, setReportName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentProject) {
      setLoading(false);
      return;
    }
    fetchReports();
  }, [currentProject]);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${API_URL}/reports?projectId=${currentProject!.id}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      } else {
        // API may not exist yet - use empty array
        setReports([]);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/reports/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedTemplate.type,
          format: selectedFormat,
          name: reportName || `${selectedTemplate.name} - ${new Date().toLocaleDateString()}`,
          projectId: currentProject!.id,
        }),
      });

      if (res.ok) {
        const newReport = await res.json();
        setReports([newReport, ...reports]);
        setShowGenerateModal(false);
        setSelectedTemplate(null);
        setReportName('');
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to generate report');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report?')) return;

    try {
      await fetch(`${API_URL}/reports/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      setReports(reports.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const formatBytes = (bytes: number | undefined): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
          </div>
          <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <TableSkeleton rows={5} columns={6} />
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Generate and download security reports
            </p>
          </div>
        </div>
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No project selected</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Select a project from the sidebar to generate reports
            </p>
            <Link href="/dashboard/projects">
              <Button>Go to Projects</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Generate and download security reports
          </p>
        </div>
        <Button onClick={() => setShowGenerateModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Generate Report
        </Button>
      </div>

      {/* Report Templates Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {reportTemplates.map((template) => (
          <button
            key={template.type}
            onClick={() => {
              setSelectedTemplate(template);
              setSelectedFormat(template.formats[0]);
              setShowGenerateModal(true);
            }}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 transition-colors text-left"
          >
            <div className="text-blue-600 dark:text-blue-400 mb-2">{template.icon}</div>
            <h3 className="font-medium text-gray-900 dark:text-white text-sm">{template.name}</h3>
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{template.description}</p>
          </button>
        ))}
      </div>

      {/* Reports Table */}
      <Card variant="bordered">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow hoverable={false}>
                <TableHead>Report Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="text-gray-400">
                      <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400">No reports generated yet</p>
                      <p className="text-sm text-gray-400 mt-1">Generate your first report to see it here</p>
                      <Button
                        onClick={() => setShowGenerateModal(true)}
                        className="mt-4"
                      >
                        Generate Report
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {report.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {report.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="uppercase text-xs font-medium text-gray-500">
                        {report.format}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusStyles[report.status].color as 'success' | 'danger' | 'warning' | 'secondary' | 'info'}>
                        {statusStyles[report.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500">{formatBytes(report.size)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-gray-500 text-sm">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.status === 'completed' && report.downloadUrl && (
                          <a href={report.downloadUrl} download>
                            <Button variant="secondary" size="sm">
                              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => handleDelete(report.id)}
                        >
                          Delete
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

      {/* Generate Report Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} size="lg">
        <ModalHeader onClose={() => setShowGenerateModal(false)}>
          Generate Report
        </ModalHeader>
        <ModalBody>
          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {!selectedTemplate ? (
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400">Select a report type:</p>
              <div className="grid grid-cols-1 gap-3">
                {reportTemplates.map((template) => (
                  <button
                    key={template.type}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setSelectedFormat(template.formats[0]);
                    }}
                    className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                  >
                    <div className="text-blue-600 dark:text-blue-400 mt-1">{template.icon}</div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      <div className="flex gap-1 mt-2">
                        {template.formats.map((fmt) => (
                          <Badge key={fmt} variant="outline" size="sm" className="uppercase">
                            {fmt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to templates
              </button>

              <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-blue-600 dark:text-blue-400">{selectedTemplate.icon}</div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Report Name (optional)
                </label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder={`${selectedTemplate.name} - ${new Date().toLocaleDateString()}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Format
                </label>
                <div className="flex gap-2">
                  {selectedTemplate.formats.map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setSelectedFormat(fmt)}
                      className={`px-4 py-2 rounded-lg border uppercase text-sm font-medium transition-colors ${
                        selectedFormat === fmt
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-500'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setShowGenerateModal(false)}>
            Cancel
          </Button>
          {selectedTemplate && (
            <Button onClick={handleGenerate} loading={generating}>
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Generate Report
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
