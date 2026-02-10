'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import { FormField, Label, Input, Textarea, Select, FormError } from '@/components/ui/form';
import { WizardProgress, WizardStep, WizardPreview } from '@/components/threat-modeling/wizard';
import { useWizardFlow } from '@/hooks';
import { useProject } from '@/contexts/project-context';
import { cn } from '@/lib/utils';

export default function WizardPage() {
  const router = useRouter();
  const { currentProject, projects } = useProject();
  const wizard = useWizardFlow();

  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [methodology, setMethodology] = useState('stride');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

  // Set default project when available
  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject, selectedProjectId]);

  // Start wizard on mount
  useEffect(() => {
    wizard.start();
  }, []);

  // Handle option selection
  const handleSelectOption = async (value: string) => {
    setSelectedValue(value);
    await wizard.selectOption(value);
    setSelectedValue(null);
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

    const result = await wizard.createThreatModel({
      projectId: selectedProjectId,
      name: modelName.trim(),
      description: modelDescription.trim() || undefined,
      methodology,
    });

    if (result) {
      router.push(`/dashboard/threat-modeling/${result.threatModel.id}`);
    }
  };

  // Loading state
  if (wizard.isLoading && !wizard.currentQuestion) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader />
        <Card variant="bordered">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Loading wizard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state (no questions available)
  if (wizard.error && !wizard.currentQuestion && !wizard.isComplete) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader />
        <Card variant="bordered">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Wizard Unavailable
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {wizard.error}
            </p>
            <Link href="/dashboard/threat-modeling/new/manual">
              <Button variant="primary">Use Manual Entry Instead</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Wizard complete - show preview and creation form
  if (wizard.isComplete) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <PageHeader />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generated Architecture
            </h2>
            {wizard.preview ? (
              <WizardPreview preview={wizard.preview} isLoading={wizard.isPreviewLoading} />
            ) : wizard.isPreviewLoading ? (
              <WizardPreview preview={{ globalProperties: {}, nodes: [], boundaries: [], links: [], path: [] }} isLoading />
            ) : (
              <Card variant="bordered">
                <CardContent className="py-8 text-center text-gray-500 dark:text-gray-400">
                  No preview available
                </CardContent>
              </Card>
            )}
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

                {(formError || wizard.error) && (
                  <FormError message={formError || wizard.error || undefined} />
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      wizard.goBack();
                    }}
                    disabled={wizard.isCreating}
                  >
                    Back
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreate}
                    disabled={wizard.isCreating || !modelName.trim() || !selectedProjectId}
                    className="flex-1"
                  >
                    {wizard.isCreating ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      'Create Threat Model'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Question flow
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader />

      {/* Progress */}
      <WizardProgress
        currentStep={wizard.history.length}
        totalSteps={wizard.history.length + (wizard.currentQuestion?.isTerminal ? 0 : 1)}
      />

      {/* Current Question */}
      <Card variant="bordered">
        <CardContent className="py-6">
          {wizard.currentQuestion && (
            <WizardStep
              question={wizard.currentQuestion}
              onSelect={handleSelectOption}
              isLoading={wizard.isLoading}
              selectedValue={selectedValue || undefined}
            />
          )}

          {wizard.error && (
            <div className="mt-4">
              <FormError message={wizard.error} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={wizard.history.length > 1 ? wizard.goBack : undefined}
          disabled={wizard.history.length <= 1 || wizard.isLoading}
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Button>

        <Button
          variant="ghost"
          onClick={() => {
            wizard.reset();
            wizard.start();
          }}
          disabled={wizard.isLoading}
        >
          Start Over
        </Button>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Guided Wizard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Answer questions to generate your architecture
        </p>
      </div>
    </div>
  );
}
