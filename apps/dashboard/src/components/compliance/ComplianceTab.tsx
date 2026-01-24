'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, Button, useToast } from '@/components/ui';
import { FrameworkSelector } from './FrameworkSelector';
import { ComplianceCard, FrameworkStats } from './ComplianceCard';
import { GapList } from './GapList';
import { GapData } from './GapCard';
import { ControlDetailModal } from './ControlDetailModal';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      setExporting(true);
      const queryParams = new URLSearchParams();
      selectedFrameworks.forEach(id => queryParams.append('frameworkIds', id));
      queryParams.append('format', format);

      const res = await fetch(
        `${API_URL}/threat-modeling/${threatModelId}/compliance/export?${queryParams}`,
        { credentials: 'include' }
      );

      if (!res.ok) throw new Error('Failed to export report');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-report-${threatModelId}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toastCtx.success('Export Complete', `Compliance report downloaded successfully`);
    } catch (err) {
      console.error('Export failed:', err);
      toastCtx.error('Export Failed', 'Failed to generate compliance report');
    } finally {
      setExporting(false);
    }
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
            onClick={() => handleExport('pdf')}
          >
            {exporting ? 'Exporting...' : 'Export Report'}
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
    </div>
  );
}
