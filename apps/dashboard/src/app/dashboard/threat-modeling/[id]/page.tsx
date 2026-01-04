'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Form,
  FormField,
  Label,
  Input,
  Textarea,
  Select,
  FormError,
  PageHeader,
  useToast,
} from '@/components/ui';
import { CardSkeleton } from '@/components/ui/skeletons';
import { useProject } from '@/contexts/project-context';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Component {
  id: string;
  name: string;
  description?: string;
  type: string;
  technology?: string;
  criticality?: string;
  dataClassification?: string;
  positionX?: number;
  positionY?: number;
}

interface DataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  dataType?: string;
  protocol?: string;
  authentication?: boolean;
  encryption?: boolean;
  source: Component;
  target: Component;
}

interface Threat {
  id: string;
  title: string;
  description: string;
  category: string;
  strideCategory?: string;
  likelihood?: string;
  impact?: string;
  riskScore?: number;
  status: string;
  components: { component: Component }[];
  dataFlows: { dataFlow: DataFlow }[];
}

interface Mitigation {
  id: string;
  title: string;
  description: string;
  type: string;
  priority?: number;
  effort?: string;
  implementationStatus: string;
  threats: { threat: Threat }[];
}

interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  methodology: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  components: Component[];
  dataFlows: DataFlow[];
  threats: Threat[];
  mitigations: Mitigation[];
}

const componentTypes = [
  { value: 'process', label: 'Process' },
  { value: 'data_store', label: 'Data Store' },
  { value: 'external_entity', label: 'External Entity' },
  { value: 'trust_boundary', label: 'Trust Boundary' },
  { value: 'service', label: 'Service' },
  { value: 'api', label: 'API' },
];

const criticalityLevels = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const strideCategories = [
  { value: 'spoofing', label: 'Spoofing' },
  { value: 'tampering', label: 'Tampering' },
  { value: 'repudiation', label: 'Repudiation' },
  { value: 'information_disclosure', label: 'Information Disclosure' },
  { value: 'denial_of_service', label: 'Denial of Service' },
  { value: 'elevation_of_privilege', label: 'Elevation of Privilege' },
];

const likelihoodLevels = [
  { value: 'very_high', label: 'Very High' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'very_low', label: 'Very Low' },
];

const impactLevels = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'negligible', label: 'Negligible' },
];

const mitigationTypes = [
  { value: 'preventive', label: 'Preventive' },
  { value: 'detective', label: 'Detective' },
  { value: 'corrective', label: 'Corrective' },
  { value: 'compensating', label: 'Compensating' },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  archived: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
};

const threatStatusColors: Record<string, string> = {
  identified: 'bg-gray-100 text-gray-700',
  analyzing: 'bg-blue-100 text-blue-700',
  mitigated: 'bg-green-100 text-green-700',
  accepted: 'bg-yellow-100 text-yellow-700',
  transferred: 'bg-purple-100 text-purple-700',
};

export default function ThreatModelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentProject } = useProject();
  const toastCtx = useToast();
  const [model, setModel] = useState<ThreatModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  // Modal states
  const [componentModal, setComponentModal] = useState<{ open: boolean; editing: Component | null }>({ open: false, editing: null });
  const [threatModal, setThreatModal] = useState<{ open: boolean; editing: Threat | null }>({ open: false, editing: null });
  const [mitigationModal, setMitigationModal] = useState<{ open: boolean; editing: Mitigation | null }>({ open: false, editing: null });
  const [dataFlowModal, setDataFlowModal] = useState<{ open: boolean; editing: DataFlow | null }>({ open: false, editing: null });

  // Form states
  const [componentForm, setComponentForm] = useState({ name: '', description: '', type: 'process', technology: '', criticality: 'medium' });
  const [threatForm, setThreatForm] = useState({ title: '', description: '', category: '', strideCategory: '', likelihood: 'medium', impact: 'medium', componentIds: [] as string[] });
  const [mitigationForm, setMitigationForm] = useState({ title: '', description: '', type: 'preventive', priority: 1, effort: 'medium', threatIds: [] as string[] });
  const [dataFlowForm, setDataFlowForm] = useState({ sourceId: '', targetId: '', label: '', protocol: '', authentication: false, encryption: false });

  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchThreatModel();
  }, [params.id]);

  const fetchThreatModel = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/threat-modeling/${params.id}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Failed to fetch threat model');

      const data = await res.json();
      setModel(data);
    } catch (err) {
      console.error('Failed to fetch threat model:', err);
      setError('Failed to load threat model');
    } finally {
      setLoading(false);
    }
  };

  // Run analysis
  const runAnalysis = async (methodology: string) => {
    setAnalyzing(methodology);
    try {
      const res = await fetch(`${API_URL}/threat-modeling/${params.id}/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ methodology }),
      });

      if (!res.ok) throw new Error(`Failed to run ${methodology} analysis`);

      const data = await res.json();
      toastCtx.success('Analysis Complete', `${methodology.toUpperCase()} analysis generated ${data.threatsGenerated || 0} threats`);
      await fetchThreatModel();
      setActiveTab('threats');
    } catch (err: any) {
      console.error('Analysis failed:', err);
      toastCtx.error('Analysis Failed', err.message || 'Failed to run analysis');
    } finally {
      setAnalyzing(null);
    }
  };

  // Component handlers
  const handleSaveComponent = async () => {
    if (!componentForm.name.trim()) {
      setFormErrors({ name: 'Name is required' });
      return;
    }

    try {
      setSubmitting(true);
      const url = componentModal.editing
        ? `${API_URL}/threat-modeling/components/${componentModal.editing.id}`
        : `${API_URL}/threat-modeling/${params.id}/components`;

      const res = await fetch(url, {
        method: componentModal.editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(componentForm),
      });

      if (!res.ok) throw new Error('Failed to save component');

      await fetchThreatModel();
      setComponentModal({ open: false, editing: null });
      setComponentForm({ name: '', description: '', type: 'process', technology: '', criticality: 'medium' });
    } catch (err) {
      console.error('Failed to save component:', err);
      setFormErrors({ submit: 'Failed to save component' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComponent = async (id: string) => {
    if (!confirm('Delete this component?')) return;

    try {
      await fetch(`${API_URL}/threat-modeling/components/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchThreatModel();
    } catch (err) {
      console.error('Failed to delete component:', err);
    }
  };

  // Data flow handlers
  const handleSaveDataFlow = async () => {
    if (!dataFlowForm.sourceId || !dataFlowForm.targetId) {
      setFormErrors({ flow: 'Source and target are required' });
      return;
    }

    try {
      setSubmitting(true);
      const url = dataFlowModal.editing
        ? `${API_URL}/threat-modeling/data-flows/${dataFlowModal.editing.id}`
        : `${API_URL}/threat-modeling/${params.id}/data-flows`;

      const res = await fetch(url, {
        method: dataFlowModal.editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataFlowForm),
      });

      if (!res.ok) throw new Error('Failed to save data flow');

      await fetchThreatModel();
      setDataFlowModal({ open: false, editing: null });
      setDataFlowForm({ sourceId: '', targetId: '', label: '', protocol: '', authentication: false, encryption: false });
    } catch (err) {
      console.error('Failed to save data flow:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDataFlow = async (id: string) => {
    if (!confirm('Delete this data flow?')) return;

    try {
      await fetch(`${API_URL}/threat-modeling/data-flows/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchThreatModel();
    } catch (err) {
      console.error('Failed to delete data flow:', err);
    }
  };

  // Threat handlers
  const handleSaveThreat = async () => {
    if (!threatForm.title.trim() || !threatForm.description.trim()) {
      setFormErrors({ title: !threatForm.title.trim() ? 'Title is required' : '', description: !threatForm.description.trim() ? 'Description is required' : '' });
      return;
    }

    try {
      setSubmitting(true);
      const url = threatModal.editing
        ? `${API_URL}/threat-modeling/threats/${threatModal.editing.id}`
        : `${API_URL}/threat-modeling/${params.id}/threats`;

      const res = await fetch(url, {
        method: threatModal.editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(threatForm),
      });

      if (!res.ok) throw new Error('Failed to save threat');

      await fetchThreatModel();
      setThreatModal({ open: false, editing: null });
      setThreatForm({ title: '', description: '', category: '', strideCategory: '', likelihood: 'medium', impact: 'medium', componentIds: [] });
    } catch (err) {
      console.error('Failed to save threat:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteThreat = async (id: string) => {
    if (!confirm('Delete this threat?')) return;

    try {
      await fetch(`${API_URL}/threat-modeling/threats/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchThreatModel();
    } catch (err) {
      console.error('Failed to delete threat:', err);
    }
  };

  // Mitigation handlers
  const handleSaveMitigation = async () => {
    if (!mitigationForm.title.trim() || !mitigationForm.description.trim()) {
      setFormErrors({ title: !mitigationForm.title.trim() ? 'Title is required' : '', description: !mitigationForm.description.trim() ? 'Description is required' : '' });
      return;
    }

    try {
      setSubmitting(true);
      const url = mitigationModal.editing
        ? `${API_URL}/threat-modeling/mitigations/${mitigationModal.editing.id}`
        : `${API_URL}/threat-modeling/${params.id}/mitigations`;

      const res = await fetch(url, {
        method: mitigationModal.editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mitigationForm),
      });

      if (!res.ok) throw new Error('Failed to save mitigation');

      await fetchThreatModel();
      setMitigationModal({ open: false, editing: null });
      setMitigationForm({ title: '', description: '', type: 'preventive', priority: 1, effort: 'medium', threatIds: [] });
    } catch (err) {
      console.error('Failed to save mitigation:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMitigation = async (id: string) => {
    if (!confirm('Delete this mitigation?')) return;

    try {
      await fetch(`${API_URL}/threat-modeling/mitigations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await fetchThreatModel();
    } catch (err) {
      console.error('Failed to delete mitigation:', err);
    }
  };

  const openEditComponent = (component: Component) => {
    setComponentForm({
      name: component.name,
      description: component.description || '',
      type: component.type,
      technology: component.technology || '',
      criticality: component.criticality || 'medium',
    });
    setComponentModal({ open: true, editing: component });
  };

  const openEditThreat = (threat: Threat) => {
    setThreatForm({
      title: threat.title,
      description: threat.description,
      category: threat.category,
      strideCategory: threat.strideCategory || '',
      likelihood: threat.likelihood || 'medium',
      impact: threat.impact || 'medium',
      componentIds: threat.components.map(c => c.component.id),
    });
    setThreatModal({ open: true, editing: threat });
  };

  const openEditMitigation = (mitigation: Mitigation) => {
    setMitigationForm({
      title: mitigation.title,
      description: mitigation.description,
      type: mitigation.type,
      priority: mitigation.priority || 1,
      effort: mitigation.effort || 'medium',
      threatIds: mitigation.threats.map(t => t.threat.id),
    });
    setMitigationModal({ open: true, editing: mitigation });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
        {error || 'Threat model not found'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={model.name}
        description={model.description}
        backHref="/dashboard/threat-modeling"
        breadcrumbs={[
          { label: currentProject?.name || 'Project', href: '/dashboard' },
          { label: 'Threat Modeling', href: '/dashboard/threat-modeling' },
          { label: model.name },
        ]}
        context={{
          type: 'threat-model',
          status: model.status.toUpperCase(),
          metadata: {
            Methodology: model.methodology.toUpperCase(),
            Components: String(model.components.length),
            Threats: String(model.threats.length),
          },
        }}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => runAnalysis('stride')}
              disabled={analyzing !== null}
            >
              {analyzing === 'stride' ? 'Analyzing...' : 'Run STRIDE'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => runAnalysis('pasta')}
              disabled={analyzing !== null}
            >
              {analyzing === 'pasta' ? 'Analyzing...' : 'Run PASTA'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => runAnalysis('linddun')}
              disabled={analyzing !== null}
            >
              {analyzing === 'linddun' ? 'Analyzing...' : 'Run LINDDUN'}
            </Button>
            <Link href={`/dashboard/threat-modeling/${model.id}/diagram`}>
              <Button variant="secondary">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
                View Diagram
              </Button>
            </Link>
          </>
        }
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{model.components.length}</div>
            <div className="text-sm text-gray-500">Components</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{model.dataFlows.length}</div>
            <div className="text-sm text-gray-500">Data Flows</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-red-600">{model.threats.length}</div>
            <div className="text-sm text-gray-500">Threats</div>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-green-600">{model.mitigations.length}</div>
            <div className="text-sm text-gray-500">Mitigations</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="components">Components ({model.components.length})</TabsTrigger>
          <TabsTrigger value="dataflows">Data Flows ({model.dataFlows.length})</TabsTrigger>
          <TabsTrigger value="threats">Threats ({model.threats.length})</TabsTrigger>
          <TabsTrigger value="mitigations">Mitigations ({model.mitigations.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400">
                {model.description || 'No description provided.'}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Created:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{new Date(model.createdAt).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-gray-500">Updated:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{new Date(model.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components">
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>System Components</CardTitle>
              <Button size="sm" onClick={() => { setComponentForm({ name: '', description: '', type: 'process', technology: '', criticality: 'medium' }); setComponentModal({ open: true, editing: null }); }}>
                Add Component
              </Button>
            </CardHeader>
            <CardContent>
              {model.components.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No components defined yet. Add your first component to start mapping your system.</p>
              ) : (
                <div className="space-y-3">
                  {model.components.map((component) => (
                    <div key={component.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">{component.name}</div>
                        <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                          <Badge variant="outline" size="sm">{component.type}</Badge>
                          {component.technology && <span>{component.technology}</span>}
                          {component.criticality && (
                            <Badge variant={component.criticality === 'critical' ? 'danger' : 'secondary'} size="sm">
                              {component.criticality}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEditComponent(component)}>Edit</Button>
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteComponent(component.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Flows Tab */}
        <TabsContent value="dataflows">
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Data Flows</CardTitle>
              <Button size="sm" onClick={() => { setDataFlowForm({ sourceId: '', targetId: '', label: '', protocol: '', authentication: false, encryption: false }); setDataFlowModal({ open: true, editing: null }); }} disabled={model.components.length < 2}>
                Add Data Flow
              </Button>
            </CardHeader>
            <CardContent>
              {model.components.length < 2 ? (
                <p className="text-gray-500 text-center py-8">Add at least 2 components before creating data flows.</p>
              ) : model.dataFlows.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No data flows defined yet. Add data flows to show how data moves between components.</p>
              ) : (
                <div className="space-y-3">
                  {model.dataFlows.map((flow) => (
                    <div key={flow.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">{flow.source.name}</span>
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="font-medium text-gray-900 dark:text-white">{flow.target.name}</span>
                        {flow.label && <span className="text-sm text-gray-500">({flow.label})</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {flow.protocol && <Badge variant="outline" size="sm">{flow.protocol}</Badge>}
                        {flow.encryption && <Badge variant="success" size="sm">Encrypted</Badge>}
                        {flow.authentication && <Badge variant="primary" size="sm">Auth</Badge>}
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteDataFlow(flow.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Threats Tab */}
        <TabsContent value="threats">
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Identified Threats</CardTitle>
              <Button size="sm" onClick={() => { setThreatForm({ title: '', description: '', category: '', strideCategory: '', likelihood: 'medium', impact: 'medium', componentIds: [] }); setThreatModal({ open: true, editing: null }); }}>
                Add Threat
              </Button>
            </CardHeader>
            <CardContent>
              {model.threats.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No threats identified yet. Analyze your components and data flows to identify potential threats.</p>
              ) : (
                <div className="space-y-3">
                  {model.threats.map((threat) => (
                    <div key={threat.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{threat.title}</div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{threat.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${threatStatusColors[threat.status]}`}>
                              {threat.status}
                            </span>
                            {threat.strideCategory && <Badge variant="outline" size="sm">{threat.strideCategory.replace('_', ' ')}</Badge>}
                            {threat.likelihood && <Badge variant="secondary" size="sm">L: {threat.likelihood}</Badge>}
                            {threat.impact && <Badge variant="secondary" size="sm">I: {threat.impact}</Badge>}
                            {threat.riskScore && <Badge variant={threat.riskScore > 15 ? 'danger' : threat.riskScore > 8 ? 'warning' : 'success'} size="sm">Risk: {threat.riskScore}</Badge>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditThreat(threat)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteThreat(threat.id)}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mitigations Tab */}
        <TabsContent value="mitigations">
          <Card variant="bordered">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Mitigations</CardTitle>
              <Button size="sm" onClick={() => { setMitigationForm({ title: '', description: '', type: 'preventive', priority: 1, effort: 'medium', threatIds: [] }); setMitigationModal({ open: true, editing: null }); }}>
                Add Mitigation
              </Button>
            </CardHeader>
            <CardContent>
              {model.mitigations.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No mitigations defined yet. Add mitigations to address identified threats.</p>
              ) : (
                <div className="space-y-3">
                  {model.mitigations.map((mitigation) => (
                    <div key={mitigation.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{mitigation.title}</div>
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{mitigation.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" size="sm">{mitigation.type}</Badge>
                            <Badge variant={mitigation.implementationStatus === 'implemented' ? 'success' : 'secondary'} size="sm">
                              {mitigation.implementationStatus}
                            </Badge>
                            {mitigation.priority && <Badge variant="primary" size="sm">P{mitigation.priority}</Badge>}
                            {mitigation.threats.length > 0 && (
                              <span className="text-xs text-gray-500">Addresses {mitigation.threats.length} threat(s)</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditMitigation(mitigation)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteMitigation(mitigation.id)}>Delete</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Component Modal */}
      <Modal isOpen={componentModal.open} onClose={() => setComponentModal({ open: false, editing: null })} size="md">
        <ModalHeader>{componentModal.editing ? 'Edit Component' : 'Add Component'}</ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveComponent(); }}>
            <FormField>
              <Label htmlFor="comp-name" required>Name</Label>
              <Input id="comp-name" value={componentForm.name} onChange={(e) => setComponentForm({ ...componentForm, name: e.target.value })} placeholder="e.g., Web Server" />
              <FormError message={formErrors.name} />
            </FormField>
            <FormField>
              <Label htmlFor="comp-type">Type</Label>
              <Select id="comp-type" value={componentForm.type} onChange={(e) => setComponentForm({ ...componentForm, type: e.target.value })} options={componentTypes} />
            </FormField>
            <FormField>
              <Label htmlFor="comp-tech">Technology</Label>
              <Input id="comp-tech" value={componentForm.technology} onChange={(e) => setComponentForm({ ...componentForm, technology: e.target.value })} placeholder="e.g., Node.js, PostgreSQL" />
            </FormField>
            <FormField>
              <Label htmlFor="comp-crit">Criticality</Label>
              <Select id="comp-crit" value={componentForm.criticality} onChange={(e) => setComponentForm({ ...componentForm, criticality: e.target.value })} options={criticalityLevels} />
            </FormField>
            <FormField>
              <Label htmlFor="comp-desc">Description</Label>
              <Textarea id="comp-desc" value={componentForm.description} onChange={(e) => setComponentForm({ ...componentForm, description: e.target.value })} rows={3} />
            </FormField>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setComponentModal({ open: false, editing: null })}>Cancel</Button>
          <Button onClick={handleSaveComponent} loading={submitting}>Save</Button>
        </ModalFooter>
      </Modal>

      {/* Data Flow Modal */}
      <Modal isOpen={dataFlowModal.open} onClose={() => setDataFlowModal({ open: false, editing: null })} size="md">
        <ModalHeader>{dataFlowModal.editing ? 'Edit Data Flow' : 'Add Data Flow'}</ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveDataFlow(); }}>
            <FormField>
              <Label htmlFor="flow-source" required>Source</Label>
              <Select id="flow-source" value={dataFlowForm.sourceId} onChange={(e) => setDataFlowForm({ ...dataFlowForm, sourceId: e.target.value })} options={[{ value: '', label: 'Select source...' }, ...model.components.map(c => ({ value: c.id, label: c.name }))]} />
            </FormField>
            <FormField>
              <Label htmlFor="flow-target" required>Target</Label>
              <Select id="flow-target" value={dataFlowForm.targetId} onChange={(e) => setDataFlowForm({ ...dataFlowForm, targetId: e.target.value })} options={[{ value: '', label: 'Select target...' }, ...model.components.map(c => ({ value: c.id, label: c.name }))]} />
            </FormField>
            <FormField>
              <Label htmlFor="flow-label">Label</Label>
              <Input id="flow-label" value={dataFlowForm.label} onChange={(e) => setDataFlowForm({ ...dataFlowForm, label: e.target.value })} placeholder="e.g., User credentials" />
            </FormField>
            <FormField>
              <Label htmlFor="flow-protocol">Protocol</Label>
              <Input id="flow-protocol" value={dataFlowForm.protocol} onChange={(e) => setDataFlowForm({ ...dataFlowForm, protocol: e.target.value })} placeholder="e.g., HTTPS, gRPC" />
            </FormField>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dataFlowForm.encryption} onChange={(e) => setDataFlowForm({ ...dataFlowForm, encryption: e.target.checked })} className="rounded" />
                <span className="text-sm">Encrypted</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={dataFlowForm.authentication} onChange={(e) => setDataFlowForm({ ...dataFlowForm, authentication: e.target.checked })} className="rounded" />
                <span className="text-sm">Authenticated</span>
              </label>
            </div>
            <FormError message={formErrors.flow} />
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDataFlowModal({ open: false, editing: null })}>Cancel</Button>
          <Button onClick={handleSaveDataFlow} loading={submitting}>Save</Button>
        </ModalFooter>
      </Modal>

      {/* Threat Modal */}
      <Modal isOpen={threatModal.open} onClose={() => setThreatModal({ open: false, editing: null })} size="lg">
        <ModalHeader>{threatModal.editing ? 'Edit Threat' : 'Add Threat'}</ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveThreat(); }}>
            <FormField>
              <Label htmlFor="threat-title" required>Title</Label>
              <Input id="threat-title" value={threatForm.title} onChange={(e) => setThreatForm({ ...threatForm, title: e.target.value })} placeholder="e.g., SQL Injection in login form" />
              <FormError message={formErrors.title} />
            </FormField>
            <FormField>
              <Label htmlFor="threat-desc" required>Description</Label>
              <Textarea id="threat-desc" value={threatForm.description} onChange={(e) => setThreatForm({ ...threatForm, description: e.target.value })} rows={3} placeholder="Describe the threat and attack scenario..." />
              <FormError message={formErrors.description} />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <Label htmlFor="threat-stride">STRIDE Category</Label>
                <Select id="threat-stride" value={threatForm.strideCategory} onChange={(e) => setThreatForm({ ...threatForm, strideCategory: e.target.value })} options={[{ value: '', label: 'Select...' }, ...strideCategories]} />
              </FormField>
              <FormField>
                <Label htmlFor="threat-cat">Category</Label>
                <Input id="threat-cat" value={threatForm.category} onChange={(e) => setThreatForm({ ...threatForm, category: e.target.value })} placeholder="e.g., Injection, Auth" />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <Label htmlFor="threat-like">Likelihood</Label>
                <Select id="threat-like" value={threatForm.likelihood} onChange={(e) => setThreatForm({ ...threatForm, likelihood: e.target.value })} options={likelihoodLevels} />
              </FormField>
              <FormField>
                <Label htmlFor="threat-impact">Impact</Label>
                <Select id="threat-impact" value={threatForm.impact} onChange={(e) => setThreatForm({ ...threatForm, impact: e.target.value })} options={impactLevels} />
              </FormField>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setThreatModal({ open: false, editing: null })}>Cancel</Button>
          <Button onClick={handleSaveThreat} loading={submitting}>Save</Button>
        </ModalFooter>
      </Modal>

      {/* Mitigation Modal */}
      <Modal isOpen={mitigationModal.open} onClose={() => setMitigationModal({ open: false, editing: null })} size="lg">
        <ModalHeader>{mitigationModal.editing ? 'Edit Mitigation' : 'Add Mitigation'}</ModalHeader>
        <ModalBody>
          <Form onSubmit={(e) => { e.preventDefault(); handleSaveMitigation(); }}>
            <FormField>
              <Label htmlFor="mit-title" required>Title</Label>
              <Input id="mit-title" value={mitigationForm.title} onChange={(e) => setMitigationForm({ ...mitigationForm, title: e.target.value })} placeholder="e.g., Implement parameterized queries" />
              <FormError message={formErrors.title} />
            </FormField>
            <FormField>
              <Label htmlFor="mit-desc" required>Description</Label>
              <Textarea id="mit-desc" value={mitigationForm.description} onChange={(e) => setMitigationForm({ ...mitigationForm, description: e.target.value })} rows={3} placeholder="Describe the mitigation approach..." />
              <FormError message={formErrors.description} />
            </FormField>
            <div className="grid grid-cols-3 gap-4">
              <FormField>
                <Label htmlFor="mit-type">Type</Label>
                <Select id="mit-type" value={mitigationForm.type} onChange={(e) => setMitigationForm({ ...mitigationForm, type: e.target.value })} options={mitigationTypes} />
              </FormField>
              <FormField>
                <Label htmlFor="mit-priority">Priority</Label>
                <Select id="mit-priority" value={mitigationForm.priority.toString()} onChange={(e) => setMitigationForm({ ...mitigationForm, priority: parseInt(e.target.value) })} options={[{ value: '1', label: 'P1 - Critical' }, { value: '2', label: 'P2 - High' }, { value: '3', label: 'P3 - Medium' }, { value: '4', label: 'P4 - Low' }]} />
              </FormField>
              <FormField>
                <Label htmlFor="mit-effort">Effort</Label>
                <Select id="mit-effort" value={mitigationForm.effort} onChange={(e) => setMitigationForm({ ...mitigationForm, effort: e.target.value })} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
              </FormField>
            </div>
          </Form>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setMitigationModal({ open: false, editing: null })}>Cancel</Button>
          <Button onClick={handleSaveMitigation} loading={submitting}>Save</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
