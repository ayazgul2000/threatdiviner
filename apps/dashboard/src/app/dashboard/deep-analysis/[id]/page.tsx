'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  Network,
  Microscope,
  Zap,
  Package,
  TestTube,
  Building2,
  Link2,
  FileJson,
  FileText,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  StatusBadge,
  SeverityBadge,
  useToast,
} from '@/components/ui';
import { API_URL } from '@/lib/api';

interface DeepAnalysisResult {
  findingId: string;
  analysisType: string;
  result: any;
  metadata?: Record<string, any>;
}

interface Finding {
  id: string;
  title: string;
  filePath: string;
  startLine: number;
  severity: string;
  ruleId: string;
  cweId?: string;
  snippet?: string;
}

interface DeepAnalysisScan {
  id: string;
  repositoryId: string;
  repository?: { fullName: string; name: string };
  branch: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  duration?: number;
  deepAnalysisOptions?: {
    results?: DeepAnalysisResult[];
    completedAt?: string;
    resultCount?: number;
  };
}

type SectionId = 'summary' | 'attack-chains' | 'call-chain' | 'similar-vulns' | 'fix-strategy' | 'alternatives' | 'tests';

// Helper to safely parse JSON that may be wrapped in markdown code blocks
const safeParseJson = (value: any): any => {
  if (typeof value !== 'string') return value;
  if (!value) return {};

  let jsonStr = value.trim();

  // Remove markdown code block wrappers if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    // If parsing fails, return an object with the raw text
    return { rawText: value };
  }
};

const SECTIONS = [
  { id: 'summary' as SectionId, label: 'Summary', icon: Shield },
  { id: 'attack-chains' as SectionId, label: 'Attack Chains', icon: Link2 },
  { id: 'call-chain' as SectionId, label: 'Call Chain Analysis', icon: Network },
  { id: 'similar-vulns' as SectionId, label: 'Similar Vulnerabilities', icon: Microscope },
  { id: 'fix-strategy' as SectionId, label: 'Fix Strategy', icon: Zap },
  { id: 'alternatives' as SectionId, label: 'Secure Alternatives', icon: Package },
  { id: 'tests' as SectionId, label: 'Security Tests', icon: TestTube },
];

export default function DeepAnalysisReportPage() {
  const params = useParams();
  const router = useRouter();
  const toastCtx = useToast();
  const scanId = params.id as string;

  const [scan, setScan] = useState<DeepAnalysisScan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionId>('summary');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [scanRes, findingsRes] = await Promise.all([
          fetch(`${API_URL}/scm/scans/${scanId}`, { credentials: 'include' }),
          fetch(`${API_URL}/scm/findings?scanId=${scanId}`, { credentials: 'include' }),
        ]);

        if (scanRes.ok) {
          const data = await scanRes.json();
          setScan(data.scan || data);
        }
        if (findingsRes.ok) {
          const data = await findingsRes.json();
          setFindings(Array.isArray(data) ? data : data.findings || []);
        }
      } catch (err) {
        toastCtx.error('Error', 'Failed to load analysis report');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [scanId]);

  // Group results by analysis type
  const resultsByType = useMemo(() => {
    const results = scan?.deepAnalysisOptions?.results || [];
    const grouped: Record<string, DeepAnalysisResult[]> = {};

    results.forEach((r) => {
      if (!grouped[r.analysisType]) {
        grouped[r.analysisType] = [];
      }
      grouped[r.analysisType].push(r);
    });

    return grouped;
  }, [scan]);

  // Get finding by ID
  const getFinding = (findingId: string): Finding | undefined => {
    return findings.find((f) => f.id === findingId);
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const exportAsJson = () => {
    const exportData = {
      scan: {
        id: scan?.id,
        repository: scan?.repository?.fullName,
        branch: scan?.branch,
        completedAt: scan?.deepAnalysisOptions?.completedAt,
      },
      results: scan?.deepAnalysisOptions?.results,
      findings: findings.map((f) => ({
        id: f.id,
        title: f.title,
        filePath: f.filePath,
        severity: f.severity,
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deep-analysis-${scan?.id?.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading analysis report...</span>
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="space-y-6">
        <Card variant="bordered">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">Analysis not found</h3>
            <p className="text-gray-500 mb-4">This deep analysis scan could not be found.</p>
            <Link href="/dashboard/deep-analysis">
              <Button>Back to Deep Analysis</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCompleted = scan.status === 'completed';
  const resultCount = scan.deepAnalysisOptions?.resultCount || 0;

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.push('/dashboard/deep-analysis')}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to List
          </button>
          <h2 className="font-semibold text-gray-900 dark:text-white truncate">
            {scan.repository?.fullName || 'Unknown Repository'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {scan.branch}
            </code>
            <StatusBadge status={scan.status as 'pending' | 'running' | 'completed' | 'failed'} />
          </div>
        </div>

        {/* Section Navigation */}
        <nav className="flex-1 overflow-y-auto p-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const hasResults =
              section.id === 'summary' ||
              (section.id === 'attack-chains' && resultsByType['attack_chain']?.length > 0) ||
              (section.id === 'call-chain' && resultsByType['call_chain']?.length > 0) ||
              (section.id === 'similar-vulns' && resultsByType['similar_vulns']?.length > 0) ||
              (section.id === 'fix-strategy' && resultsByType['fix_propagation']?.length > 0) ||
              (section.id === 'alternatives' && resultsByType['secure_alternatives']?.length > 0) ||
              (section.id === 'tests' && resultsByType['security_tests']?.length > 0);

            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mb-1
                  ${
                    activeSection === section.id
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      : hasResults
                        ? 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                        : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }
                `}
                disabled={!hasResults && section.id !== 'summary'}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{section.label}</span>
                {hasResults && section.id !== 'summary' && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Export Actions */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <Button variant="secondary" className="w-full justify-start" onClick={exportAsJson}>
            <FileJson className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
          <Button variant="secondary" className="w-full justify-start" disabled>
            <FileText className="w-4 h-4 mr-2" />
            Export PDF (Coming Soon)
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
        {activeSection === 'summary' && (
          <SummarySection scan={scan} resultsByType={resultsByType} findings={findings} />
        )}
        {activeSection === 'attack-chains' && (
          <AttackChainsSection results={resultsByType['attack_chain'] || []} findings={findings} />
        )}
        {activeSection === 'call-chain' && (
          <CallChainSection
            results={resultsByType['call_chain'] || []}
            findings={findings}
            getFinding={getFinding}
          />
        )}
        {activeSection === 'similar-vulns' && (
          <SimilarVulnsSection
            results={resultsByType['similar_vulns'] || []}
            getFinding={getFinding}
            copyToClipboard={copyToClipboard}
            copiedCode={copiedCode}
          />
        )}
        {activeSection === 'fix-strategy' && (
          <FixStrategySection
            results={resultsByType['fix_propagation'] || []}
            getFinding={getFinding}
            copyToClipboard={copyToClipboard}
            copiedCode={copiedCode}
          />
        )}
        {activeSection === 'alternatives' && (
          <AlternativesSection
            results={resultsByType['secure_alternatives'] || []}
            getFinding={getFinding}
          />
        )}
        {activeSection === 'tests' && (
          <TestsSection
            results={resultsByType['security_tests'] || []}
            getFinding={getFinding}
            copyToClipboard={copyToClipboard}
            copiedCode={copiedCode}
          />
        )}
      </div>
    </div>
  );
}

// ============ SUMMARY SECTION ============
function SummarySection({
  scan,
  resultsByType,
  findings,
}: {
  scan: DeepAnalysisScan;
  resultsByType: Record<string, DeepAnalysisResult[]>;
  findings: Finding[];
}) {
  const stats = [
    { label: 'Findings Analyzed', value: findings.length, icon: Shield },
    { label: 'Attack Chains', value: resultsByType['attack_chain']?.length || 0, icon: Link2 },
    { label: 'Call Chain Results', value: resultsByType['call_chain']?.length || 0, icon: Network },
    { label: 'Similar Patterns Found', value: resultsByType['similar_vulns']?.length || 0, icon: Microscope },
    { label: 'Fix Propagations', value: resultsByType['fix_propagation']?.length || 0, icon: Zap },
    { label: 'Security Tests', value: resultsByType['security_tests']?.length || 0, icon: TestTube },
  ];

  const severityCounts = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Deep Analysis Report</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Comprehensive security analysis for {scan.repository?.fullName} - {scan.branch}
        </p>
      </div>

      {/* Status Banner */}
      <div
        className={`p-4 rounded-lg border ${
          scan.status === 'completed'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : scan.status === 'running'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {scan.status === 'completed' ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : scan.status === 'running' ? (
            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
          ) : (
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          )}
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {scan.status === 'completed'
                ? 'Analysis Complete'
                : scan.status === 'running'
                  ? 'Analysis in Progress...'
                  : 'Analysis Pending'}
            </p>
            {scan.deepAnalysisOptions?.completedAt && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Completed {new Date(scan.deepAnalysisOptions.completedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Severity Breakdown */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Findings by Severity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {['critical', 'high', 'medium', 'low'].map((sev) => (
              <div key={sev} className="flex items-center gap-2">
                <SeverityBadge severity={sev as any}>{severityCounts[sev] || 0}</SeverityBadge>
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{sev}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} variant="bordered">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Insights */}
      {resultsByType['attack_chain']?.[0]?.result && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-red-500" />
              Top Attack Chain Insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none text-sm">
              {typeof resultsByType['attack_chain'][0].result === 'string' ? (
                <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                  {resultsByType['attack_chain'][0].result}
                </pre>
              ) : (
                <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-3 rounded-lg text-xs">
                  {JSON.stringify(resultsByType['attack_chain'][0].result, null, 2)}
                </pre>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ ATTACK CHAINS SECTION ============
function AttackChainsSection({
  results,
  findings,
}: {
  results: DeepAnalysisResult[];
  findings: Finding[];
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Link2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Attack Chains Found</h3>
        <p className="text-gray-500">Attack chain analysis was not run or found no results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attack Chain Mapping</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Potential attack sequences correlating multiple vulnerabilities
        </p>
      </div>

      {results.map((result, idx) => (
        <Card key={idx} variant="bordered">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-red-500" />
              Attack Chain #{idx + 1}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              {typeof result.result === 'string' ? (
                <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
                  {result.result}
                </pre>
              ) : (
                <div className="space-y-4">
                  {result.result.attackChains?.map((chain: any, chainIdx: number) => (
                    <div key={chainIdx} className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <h4 className="font-semibold text-red-900 dark:text-red-300 mb-2">
                        {chain.name || `Chain ${chainIdx + 1}`}
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">{chain.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {chain.steps?.map((step: string, stepIdx: number) => (
                          <Badge key={stepIdx} variant="default">
                            {stepIdx + 1}. {step}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!result.result.attackChains && (
                    <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto">
                      {JSON.stringify(result.result, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============ CALL CHAIN SECTION ============
function CallChainSection({
  results,
  findings,
  getFinding,
}: {
  results: DeepAnalysisResult[];
  findings: Finding[];
  getFinding: (id: string) => Finding | undefined;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Network className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Call Chain Analysis</h3>
        <p className="text-gray-500">Call chain analysis was not run or found no results.</p>
      </div>
    );
  }

  const getExposureBadge = (exposure: string) => {
    switch (exposure) {
      case 'public':
        return <Badge variant="destructive">Public</Badge>;
      case 'authenticated':
        return <Badge variant="warning">Authenticated</Badge>;
      case 'internal':
        return <Badge variant="success">Internal</Badge>;
      default:
        return <Badge variant="default">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Call Chain Analysis</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Data flow analysis showing vulnerability exposure levels
        </p>
      </div>

      {results.map((result, idx) => {
        const finding = getFinding(result.findingId);
        const analysis = safeParseJson(result.result);

        return (
          <Card key={idx} variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-blue-500" />
                  <span className="truncate">{finding?.title || `Finding ${result.findingId.slice(0, 8)}`}</span>
                </div>
                {analysis.exposure && getExposureBadge(analysis.exposure)}
              </CardTitle>
              {finding && (
                <p className="text-sm text-gray-500">
                  {finding.filePath}:{finding.startLine}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Call Chain Visualization */}
              {analysis.callChain && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Call Chain</h4>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    {analysis.callChain.map((step: string, stepIdx: number) => (
                      <div key={stepIdx} className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs">
                          {step}
                        </code>
                        {stepIdx < analysis.callChain.length - 1 && (
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Flow */}
              {analysis.dataFlow && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Data Flow</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    {analysis.dataFlow}
                  </p>
                </div>
              )}

              {/* Entry Points */}
              {analysis.entryPoints && analysis.entryPoints.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Entry Points</h4>
                  <div className="flex flex-wrap gap-2">
                    {analysis.entryPoints.map((entry: string, entryIdx: number) => (
                      <Badge key={entryIdx} variant="secondary">
                        {entry}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Justification */}
              {analysis.justification && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300">{analysis.justification}</p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ SIMILAR VULNS SECTION ============
function SimilarVulnsSection({
  results,
  getFinding,
  copyToClipboard,
  copiedCode,
}: {
  results: DeepAnalysisResult[];
  getFinding: (id: string) => Finding | undefined;
  copyToClipboard: (text: string, id: string) => void;
  copiedCode: string | null;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Microscope className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Similar Vulnerabilities</h3>
        <p className="text-gray-500">Similar vulnerability detection was not run or found no results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Similar Vulnerabilities</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Patterns detected across the codebase that may share the same vulnerability
        </p>
      </div>

      {results.map((result, idx) => {
        const finding = getFinding(result.findingId);
        const analysis = safeParseJson(result.result);

        return (
          <Card key={idx} variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Microscope className="w-5 h-5 text-orange-500" />
                {finding?.title || `Finding ${result.findingId.slice(0, 8)}`}
              </CardTitle>
              {finding && (
                <p className="text-sm text-gray-500">
                  {finding.filePath}:{finding.startLine}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.similarPatterns?.map((pattern: any, patternIdx: number) => (
                <div
                  key={patternIdx}
                  className="p-4 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                >
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">{pattern.pattern}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{pattern.risk}</p>
                  {pattern.searchQuery && (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-gray-800 text-green-400 p-2 rounded font-mono">
                        {pattern.searchQuery}
                      </code>
                      <button
                        onClick={() => copyToClipboard(pattern.searchQuery, `pattern-${idx}-${patternIdx}`)}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        {copiedCode === `pattern-${idx}-${patternIdx}` ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {analysis.recommendedSearch && (
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recommended Search</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-800 text-green-400 p-2 rounded font-mono">
                      {analysis.recommendedSearch}
                    </code>
                    <button
                      onClick={() => copyToClipboard(analysis.recommendedSearch, `search-${idx}`)}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    >
                      {copiedCode === `search-${idx}` ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ FIX STRATEGY SECTION ============
function FixStrategySection({
  results,
  getFinding,
  copyToClipboard,
  copiedCode,
}: {
  results: DeepAnalysisResult[];
  getFinding: (id: string) => Finding | undefined;
  copyToClipboard: (text: string, id: string) => void;
  copiedCode: string | null;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Zap className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Fix Strategy</h3>
        <p className="text-gray-500">Fix propagation analysis was not run or found no results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fix Propagation Strategy</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Comprehensive fix strategies that can be applied across similar occurrences
        </p>
      </div>

      {results.map((result, idx) => {
        const finding = getFinding(result.findingId);
        const analysis = safeParseJson(result.result);

        return (
          <Card key={idx} variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                {finding?.title || `Finding ${result.findingId.slice(0, 8)}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.fixStrategy && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Fix Strategy</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{analysis.fixStrategy}</p>
                </div>
              )}

              {analysis.unifiedFix && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Unified Fix</h4>
                    <button
                      onClick={() => copyToClipboard(analysis.unifiedFix, `fix-${idx}`)}
                      className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      {copiedCode === `fix-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCode === `fix-${idx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-4 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto font-mono">
                    {analysis.unifiedFix}
                  </pre>
                </div>
              )}

              {analysis.affectedLocations && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Affected Locations ({analysis.affectedLocations.length})
                  </h4>
                  <div className="space-y-1">
                    {analysis.affectedLocations.map((loc: string, locIdx: number) => (
                      <code
                        key={locIdx}
                        className="block text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded"
                      >
                        {loc}
                      </code>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ ALTERNATIVES SECTION ============
function AlternativesSection({
  results,
  getFinding,
}: {
  results: DeepAnalysisResult[];
  getFinding: (id: string) => Finding | undefined;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Secure Alternatives</h3>
        <p className="text-gray-500">Secure alternatives analysis was not run or found no results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Secure Alternatives</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Recommended secure replacements for vulnerable code patterns
        </p>
      </div>

      {results.map((result, idx) => {
        const finding = getFinding(result.findingId);
        const analysis = safeParseJson(result.result);

        return (
          <Card key={idx} variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-500" />
                {finding?.title || `Finding ${result.findingId.slice(0, 8)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.alternatives?.map((alt: any, altIdx: number) => (
                <div
                  key={altIdx}
                  className="p-4 border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 rounded-lg mb-3 last:mb-0"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white">{alt.name}</h4>
                    {alt.package && (
                      <Badge variant="secondary">{alt.package}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{alt.description}</p>
                  {alt.example && (
                    <pre className="p-3 bg-gray-900 text-green-400 rounded text-xs overflow-x-auto font-mono">
                      {alt.example}
                    </pre>
                  )}
                </div>
              ))}

              {!analysis.alternatives && (
                <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============ TESTS SECTION ============
function TestsSection({
  results,
  getFinding,
  copyToClipboard,
  copiedCode,
}: {
  results: DeepAnalysisResult[];
  getFinding: (id: string) => Finding | undefined;
  copyToClipboard: (text: string, id: string) => void;
  copiedCode: string | null;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <TestTube className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Security Tests</h3>
        <p className="text-gray-500">Security test generation was not run or found no results.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Tests</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Generated test cases to verify vulnerability fixes
        </p>
      </div>

      {results.map((result, idx) => {
        const finding = getFinding(result.findingId);
        const analysis = safeParseJson(result.result);

        return (
          <Card key={idx} variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5 text-purple-500" />
                {finding?.title || `Finding ${result.findingId.slice(0, 8)}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.tests?.map((test: any, testIdx: number) => (
                <div key={testIdx} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white">{test.name}</h4>
                    <button
                      onClick={() => copyToClipboard(test.code, `test-${idx}-${testIdx}`)}
                      className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      {copiedCode === `test-${idx}-${testIdx}` ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copiedCode === `test-${idx}-${testIdx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-4 bg-gray-900 text-green-400 text-sm overflow-x-auto font-mono">
                    {test.code}
                  </pre>
                </div>
              ))}

              {analysis.testCode && !analysis.tests && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800">
                    <h4 className="font-medium text-gray-900 dark:text-white">Generated Test</h4>
                    <button
                      onClick={() => copyToClipboard(analysis.testCode, `test-${idx}`)}
                      className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
                    >
                      {copiedCode === `test-${idx}` ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedCode === `test-${idx}` ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-4 bg-gray-900 text-green-400 text-sm overflow-x-auto font-mono">
                    {analysis.testCode}
                  </pre>
                </div>
              )}

              {!analysis.tests && !analysis.testCode && (
                <pre className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-sm">
                  {JSON.stringify(analysis, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
