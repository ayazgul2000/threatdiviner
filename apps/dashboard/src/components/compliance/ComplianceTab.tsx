'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Button, Modal, ModalHeader, ModalBody, ModalFooter, useToast } from '@/components/ui';
import { FrameworkSelector } from './FrameworkSelector';
import { ComplianceCard, FrameworkStats } from './ComplianceCard';
import { GapList } from './GapList';
import { GapData } from './GapCard';
import { ControlDetailModal } from './ControlDetailModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type ReportFormat = 'pdf' | 'xlsx';

interface ReportSections {
  coverPage: boolean;
  executiveSummary: boolean;
  frameworkOverview: boolean;
  gapDetails: boolean;
  riskInventory: boolean;
  remediationRoadmap: boolean;
}

interface FrameworkApiResponse {
  id: string;
  name: string;
  version?: string;
  tier?: string;
}

interface Framework {
  id: string;
  name: string;
  version?: string;
  isActive: boolean;
}

interface ComplianceResult {
  threatModelId: string;
  threatModelName: string;
  generatedAt: string;
  totalThreats: number;
  threatsWithCanonicalRisk: number;
  frameworks: FrameworkStats[];
}

interface ComplianceTabProps {
  threatModelId: string;
}

export function ComplianceTab({ threatModelId }: ComplianceTabProps) {
  const toastCtx = useToast();
  const [loading, setLoading] = useState(true);
  const [frameworksLoading, setFrameworksLoading] = useState(true);
  const [availableFrameworks, setAvailableFrameworks] = useState<Framework[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [complianceData, setComplianceData] = useState<ComplianceResult | null>(null);
  const [selectedControl, setSelectedControl] = useState<GapData | null>(null);
  const [controlModalOpen, setControlModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ReportFormat>('pdf');
  const [exportSections, setExportSections] = useState<ReportSections>({
    coverPage: true,
    executiveSummary: true,
    frameworkOverview: true,
    gapDetails: true,
    riskInventory: true,
    remediationRoadmap: true,
  });

  // Fetch available frameworks
  useEffect(() => {
    const fetchFrameworks = async () => {
      try {
        setFrameworksLoading(true);
        const res = await fetch(`${API_URL}/compliance/frameworks`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to fetch frameworks');
        const data: FrameworkApiResponse[] = await res.json();
        // Map API response to expected format (all frameworks are active)
        const mappedFrameworks: Framework[] = data.map((f) => ({
          id: f.id,
          name: f.name,
          version: f.version,
          isActive: true, // All returned frameworks are active
        }));
        setAvailableFrameworks(mappedFrameworks);
        // Auto-select first two frameworks if available
        if (mappedFrameworks.length > 0) {
          setSelectedFrameworks(mappedFrameworks.slice(0, 2).map((f) => f.id));
        }
      } catch (err) {
        console.error('Failed to fetch frameworks:', err);
        toastCtx.error('Error', 'Failed to load compliance frameworks');
      } finally {
        setFrameworksLoading(false);
      }
    };
    fetchFrameworks();
  }, [toastCtx]);

  // Fetch compliance data when frameworks change
  const fetchCompliance = useCallback(async () => {
    if (selectedFrameworks.length === 0) {
      setComplianceData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // API expects comma-separated frameworks param
      const frameworksParam = selectedFrameworks.join(',');

      const res = await fetch(
        `${API_URL}/threat-modeling/${threatModelId}/compliance?frameworks=${encodeURIComponent(frameworksParam)}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Failed to fetch compliance data');
      const data = await res.json();
      setComplianceData(data);
    } catch (err) {
      console.error('Failed to fetch compliance:', err);
      toastCtx.error('Error', 'Failed to calculate compliance');
    } finally {
      setLoading(false);
    }
  }, [threatModelId, selectedFrameworks, toastCtx]);

  useEffect(() => {
    if (!frameworksLoading) {
      fetchCompliance();
    }
  }, [fetchCompliance, frameworksLoading]);

  // Collect all gaps from all frameworks
  const allGaps: GapData[] = complianceData?.frameworks.flatMap(
    (f) => f.controlDetails?.filter(c => c.gapStatus !== 'satisfied') || []
  ) || [];

  const handleSelectControl = (gap: GapData) => {
    setSelectedControl(gap);
    setControlModalOpen(true);
  };

  const handleViewRemediation = (gap: GapData) => {
    // TODO: Navigate to remediation playbook when playbookId is available
    toastCtx.info('Coming Soon', 'Remediation playbooks will be available in a future update');
  };

  const handleExportClick = () => {
    setExportModalOpen(true);
  };

  const handleExportConfirm = async () => {
    try {
      setExporting(true);
      const queryParams = new URLSearchParams();
      queryParams.append('format', exportFormat);
      queryParams.append('frameworkIds', selectedFrameworks.join(','));

      // Add section params
      Object.entries(exportSections).forEach(([key, value]) => {
        queryParams.append(key, String(value));
      });

      const res = await fetch(
        `${API_URL}/threat-modeling/${threatModelId}/compliance/export?${queryParams}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Failed to export report');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${threatModelId}.${exportFormat === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      setExportModalOpen(false);
      toastCtx.success('Export Complete', `Compliance report downloaded successfully`);
    } catch (err) {
      console.error('Export failed:', err);
      toastCtx.error('Export Failed', 'Failed to generate compliance report');
    } finally {
      setExporting(false);
    }
  };

  const toggleSection = (section: keyof ReportSections) => {
    setExportSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          COMPLIANCE
        </h2>
        <div className="relative">
          <Button
            variant="secondary"
            disabled={!complianceData || exporting}
            onClick={handleExportClick}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report
          </Button>
        </div>
      </div>

      {/* Framework Selector */}
      <Card variant="bordered">
        <CardContent className="py-4">
          <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
            Select Frameworks:
          </div>
          <FrameworkSelector
            frameworks={availableFrameworks}
            selected={selectedFrameworks}
            onChange={setSelectedFrameworks}
            loading={frameworksLoading}
          />
        </CardContent>
      </Card>

      {/* No Frameworks Selected Message */}
      {selectedFrameworks.length === 0 && !frameworksLoading && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="text-lg mb-2">No frameworks selected</p>
          <p className="text-sm">
            Select one or more compliance frameworks above to view compliance status.
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && selectedFrameworks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Card key={i} variant="bordered">
              <CardContent className="py-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-10 w-24 mx-auto bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="space-y-2">
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Compliance Cards */}
      {!loading && complianceData && complianceData.frameworks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {complianceData.frameworks.map((framework) => (
            <ComplianceCard
              key={framework.frameworkId}
              framework={framework}
              onViewDetails={() => {
                // Scroll to gaps section with this framework filter applied
                const gapsSection = document.getElementById('compliance-gaps');
                if (gapsSection) {
                  gapsSection.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Gap List */}
      {!loading && complianceData && selectedFrameworks.length > 0 && (
        <Card variant="bordered" id="compliance-gaps">
          <CardContent className="py-4">
            <GapList
              gaps={allGaps}
              frameworks={availableFrameworks.filter(f => selectedFrameworks.includes(f.id))}
              onSelect={handleSelectControl}
              onViewRemediation={handleViewRemediation}
            />
          </CardContent>
        </Card>
      )}

      {/* Control Detail Modal */}
      <ControlDetailModal
        isOpen={controlModalOpen}
        onClose={() => {
          setControlModalOpen(false);
          setSelectedControl(null);
        }}
        control={selectedControl}
        onViewRemediation={() => {
          if (selectedControl) {
            handleViewRemediation(selectedControl);
          }
        }}
      />

      {/* Export Report Modal */}
      <Modal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} size="lg">
        <ModalHeader>
          Export Compliance Report
        </ModalHeader>
        <ModalBody>
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Report Format
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    exportFormat === 'pdf'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-white">PDF</div>
                      <div className="text-sm text-gray-500">Executive summary format</div>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => setExportFormat('xlsx')}
                  className={`flex-1 p-4 rounded-lg border-2 transition-colors ${
                    exportFormat === 'xlsx'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <div className="text-left">
                      <div className="font-medium text-gray-900 dark:text-white">Excel</div>
                      <div className="text-sm text-gray-500">Detailed data with filters</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Section Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Report Sections
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'coverPage', label: 'Cover Page', desc: 'Report title and overview' },
                  { key: 'executiveSummary', label: 'Executive Summary', desc: 'Key findings and posture' },
                  { key: 'frameworkOverview', label: 'Framework Overview', desc: 'Compliance scores per framework' },
                  { key: 'gapDetails', label: 'Gap Details', desc: 'Control gaps by framework' },
                  { key: 'riskInventory', label: 'Risk Inventory', desc: 'All identified risks' },
                  { key: 'remediationRoadmap', label: 'Remediation Roadmap', desc: 'Prioritized action items' },
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      exportSections[key as keyof ReportSections]
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={exportSections[key as keyof ReportSections]}
                      onChange={() => toggleSection(key as keyof ReportSections)}
                      className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white text-sm">{label}</div>
                      <div className="text-xs text-gray-500">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Selected Frameworks */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Included Frameworks
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedFrameworks.length > 0 ? (
                  selectedFrameworks.map(id => {
                    const framework = availableFrameworks.find(f => f.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {framework?.name || id}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-gray-500 text-sm">All available frameworks</span>
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setExportModalOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleExportConfirm}
            loading={exporting}
            disabled={exporting}
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Generating...' : `Export ${exportFormat.toUpperCase()}`}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
