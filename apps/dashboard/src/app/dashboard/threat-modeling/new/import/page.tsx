'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';
import { FormField, Label, Input, Textarea, Select, FormError } from '@/components/ui/form';
import { FileUploader, ImportPreview } from '@/components/threat-modeling/import';
import { useImport } from '@/hooks';
import { useProject } from '@/contexts/project-context';
import { cn } from '@/lib/utils';
import { repositoriesApi } from '@/lib/api';

type ImportMode = 'file' | 'repository';

interface Repository {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  connection?: {
    provider: string;
  };
}

export default function ImportPage() {
  const router = useRouter();
  const { currentProject, projects } = useProject();
  const importFlow = useImport();

  const [mode, setMode] = useState<ImportMode>('file');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [methodology, setMethodology] = useState('stride');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Set default project when available
  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject, selectedProjectId]);

  // Load repositories when switching to repo mode
  useEffect(() => {
    if (mode === 'repository' && repositories.length === 0 && currentProject) {
      loadRepositories();
    }
  }, [mode, currentProject]);

  // Update model name when preview is loaded
  useEffect(() => {
    if (importFlow.preview && !modelName) {
      setModelName(importFlow.preview.title);
    }
  }, [importFlow.preview, modelName]);

  const loadRepositories = async () => {
    if (!currentProject) return;
    setIsLoadingRepos(true);
    setRepoError(null);
    try {
      const repos = await repositoriesApi.list(currentProject.id);
      setRepositories(repos);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    await importFlow.parseFile(file);
  };

  // Handle repository selection and parsing
  const handleParseRepository = async () => {
    if (!selectedRepoId) return;
    await importFlow.parseRepository(selectedRepoId);
  };

  // Handle create threat model
  const handleCreate = async () => {
    setFormError(null);

    if (!modelName.trim()) {
      setFormError('Please enter a name for your threat model');
      return;
    }

    if (!selectedProjectId) {
      setFormError('Please select a project');
      return;
    }

    const result = await importFlow.createThreatModel({
      projectId: selectedProjectId,
      name: modelName.trim(),
      description: modelDescription.trim() || undefined,
      methodology,
    });

    if (result) {
      router.push(`/dashboard/threat-modeling/${result.threatModel.id}`);
    }
  };

  // Reset and go back to file upload
  const handleReset = () => {
    importFlow.reset();
    setModelName('');
    setModelDescription('');
    setSelectedRepoId('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/threat-modeling/new"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Import</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Import from files or linked repositories
          </p>
        </div>
      </div>

      {/* Error Display */}
      {(importFlow.error || repoError) && (
        <Card variant="bordered" className="border-red-300 dark:border-red-700">
          <CardContent className="flex items-center gap-3 py-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-600 dark:text-red-400">{importFlow.error || repoError}</span>
            <button
              onClick={handleReset}
              className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Try again
            </button>
          </CardContent>
        </Card>
      )}

      {/* Import Mode Selection or Preview */}
      {!importFlow.preview ? (
        <Card variant="bordered">
          <CardContent className="py-6">
            {/* Mode Tabs */}
            <div className="flex border-b dark:border-gray-700 mb-6">
              <button
                onClick={() => setMode('file')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  mode === 'file'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Upload File
                </span>
              </button>
              <button
                onClick={() => setMode('repository')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  mode === 'repository'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  From Repository
                </span>
              </button>
            </div>

            {/* File Upload Mode */}
            {mode === 'file' && (
              <FileUploader onFileSelect={handleFileSelect} isLoading={importFlow.isParsing} />
            )}

            {/* Repository Mode */}
            {mode === 'repository' && (
              <div className="space-y-4">
                {isLoadingRepos ? (
                  <div className="text-center py-8">
                    <svg className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading repositories...</p>
                  </div>
                ) : repositories.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No repositories linked yet</p>
                    <Link href="/dashboard/repos">
                      <Button variant="secondary">Link a Repository</Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <FormField>
                      <Label required>Select Repository</Label>
                      <Select
                        value={selectedRepoId}
                        onChange={(e) => setSelectedRepoId(e.target.value)}
                        options={repositories.map((r) => ({
                          value: r.id,
                          label: `${r.fullName} (${r.connection?.provider || 'github'})`,
                        }))}
                        placeholder="Choose a repository..."
                      />
                    </FormField>

                    {/* Show selected repo branch info */}
                    {selectedRepoId && (
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>
                          Scanning branch:{' '}
                          <code className="text-blue-600 dark:text-blue-400 font-mono">
                            {repositories.find(r => r.id === selectedRepoId)?.defaultBranch || 'main'}
                          </code>
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      We'll scan the repository for OpenAPI specs (.yaml, .json), Terraform files (.tf),
                      and Draw.io diagrams (.drawio, .xml).
                    </p>

                    <Button
                      variant="primary"
                      onClick={handleParseRepository}
                      disabled={!selectedRepoId || importFlow.isParsing}
                      className="w-full"
                    >
                      {importFlow.isParsing ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Scanning Repository...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          Scan Repository
                        </span>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Import Preview
              </h2>
              <button
                onClick={handleReset}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                {mode === 'file' ? 'Choose different file' : 'Choose different repo'}
              </button>
            </div>
            {importFlow.filename && (
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {importFlow.filename}
              </div>
            )}
            <ImportPreview preview={importFlow.preview} />
          </div>

          {/* Creation Form */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Create Threat Model
            </h2>
            <Card variant="bordered">
              <CardContent className="space-y-4">
                <FormField>
                  <Label required>Name</Label>
                  <Input
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g., E-Commerce Platform"
                  />
                </FormField>

                <FormField>
                  <Label>Description</Label>
                  <Textarea
                    value={modelDescription}
                    onChange={(e) => setModelDescription(e.target.value)}
                    placeholder="Brief description of your system..."
                    rows={3}
                  />
                </FormField>

                <FormField>
                  <Label required>Project</Label>
                  <Select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    options={projects.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Select a project"
                  />
                </FormField>

                <FormField>
                  <Label>Methodology</Label>
                  <Select
                    value={methodology}
                    onChange={(e) => setMethodology(e.target.value)}
                    options={[
                      { value: 'stride', label: 'STRIDE' },
                      { value: 'pasta', label: 'PASTA' },
                      { value: 'dread', label: 'DREAD' },
                    ]}
                  />
                </FormField>

                {(formError || importFlow.error) && (
                  <FormError message={formError || importFlow.error || undefined} />
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={handleReset} disabled={importFlow.isCreating}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreate}
                    disabled={importFlow.isCreating || !modelName.trim() || !selectedProjectId}
                    className="flex-1"
                  >
                    {importFlow.isCreating ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      `Create with ${importFlow.preview.components.length} Components`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card variant="bordered" className="bg-gray-50 dark:bg-gray-800/50">
              <CardContent className="py-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  What will be created:
                </h3>
                <ul className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {importFlow.preview.components.length} components
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {importFlow.preview.dataFlows.length} data flows
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Empty diagram (add visually later)
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
