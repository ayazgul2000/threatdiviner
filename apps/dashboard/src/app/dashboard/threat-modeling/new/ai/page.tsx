'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';
import { FormField, Label, Input, Textarea, Select, FormError } from '@/components/ui/form';
import { DescriptionInput, AiPreview } from '@/components/threat-modeling/ai';
import { useAiCreation } from '@/hooks';
import { useProject } from '@/contexts/project-context';

export default function AiPage() {
  const router = useRouter();
  const { currentProject, projects } = useProject();
  const aiFlow = useAiCreation();

  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [methodology, setMethodology] = useState('stride');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [refinementInput, setRefinementInput] = useState('');

  // Set default project when available
  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject, selectedProjectId]);

  // Update model name when generation result is loaded
  useEffect(() => {
    if (aiFlow.generationResult && !modelName) {
      setModelName(aiFlow.generationResult.title);
      setModelDescription(aiFlow.generationResult.description);
    }
  }, [aiFlow.generationResult, modelName]);

  // Handle AI generation
  const handleGenerate = async (
    description: string,
    options?: { systemType?: string; industry?: string }
  ) => {
    await aiFlow.generate(description, options);
  };

  // Handle refinement
  const handleRefine = async () => {
    if (!refinementInput.trim()) return;
    await aiFlow.refine(refinementInput.trim());
    setRefinementInput('');
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

    const result = await aiFlow.createThreatModel({
      projectId: selectedProjectId,
      name: modelName.trim(),
      description: modelDescription.trim() || undefined,
      methodology,
    });

    if (result) {
      router.push(`/dashboard/threat-modeling/${result.threatModel.id}`);
    }
  };

  // Reset and start over
  const handleReset = () => {
    aiFlow.reset();
    setModelName('');
    setModelDescription('');
    setRefinementInput('');
  };

  // Check if AI is available
  if (aiFlow.isAvailable === false) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI-Powered</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Describe your system in natural language
            </p>
          </div>
        </div>

        {/* AI Not Available */}
        <Card variant="bordered" className="border-yellow-300 dark:border-yellow-700">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              AI Service Unavailable
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              The AI service is currently not configured or unavailable. Please check your AI provider settings
              or try again later.
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={() => aiFlow.checkAvailability()}>
                Check Again
              </Button>
              <Link href="/dashboard/threat-modeling/new/manual">
                <Button variant="primary">
                  Use Manual Entry Instead
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state for availability check
  if (aiFlow.isAvailable === null) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI-Powered</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Describe your system in natural language
            </p>
          </div>
        </div>

        {/* Loading */}
        <Card variant="bordered">
          <CardContent className="text-center py-12">
            <svg className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">Checking AI service availability...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI-Powered</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Describe your system in natural language
          </p>
        </div>
      </div>

      {/* Error Display */}
      {aiFlow.error && (
        <Card variant="bordered" className="border-red-300 dark:border-red-700">
          <CardContent className="flex items-center gap-3 py-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-600 dark:text-red-400">{aiFlow.error}</span>
            <button
              onClick={handleReset}
              className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Start over
            </button>
          </CardContent>
        </Card>
      )}

      {/* Description Input or Generation Result */}
      {!aiFlow.generationResult ? (
        <Card variant="bordered">
          <CardContent className="py-6">
            <DescriptionInput onGenerate={handleGenerate} isLoading={aiFlow.isGenerating} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI Generation Result
              </h2>
              <button
                onClick={handleReset}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Start over
              </button>
            </div>
            <AiPreview result={aiFlow.generationResult} />

            {/* Refinement Section */}
            <Card variant="bordered" className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="py-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Refine with AI
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Not quite right? Tell the AI what to change.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={refinementInput}
                    onChange={(e) => setRefinementInput(e.target.value)}
                    placeholder="e.g., Add a Redis cache layer..."
                    disabled={aiFlow.isRefining}
                    className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !aiFlow.isRefining && refinementInput.trim()) {
                        handleRefine();
                      }
                    }}
                  />
                  <Button
                    variant="secondary"
                    onClick={handleRefine}
                    disabled={aiFlow.isRefining || !refinementInput.trim()}
                    size="sm"
                  >
                    {aiFlow.isRefining ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      'Refine'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
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

                {(formError || aiFlow.error) && (
                  <FormError message={formError || aiFlow.error || undefined} />
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" onClick={handleReset} disabled={aiFlow.isCreating}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleCreate}
                    disabled={aiFlow.isCreating || !modelName.trim() || !selectedProjectId}
                    className="flex-1"
                  >
                    {aiFlow.isCreating ? (
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
                      `Create with ${aiFlow.generationResult.components.length} Components`
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
                    {aiFlow.generationResult.components.length} components
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {aiFlow.generationResult.dataFlows.length} data flows
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {aiFlow.generationResult.boundaries.length} trust boundaries
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    {aiFlow.generationResult.suggestedThreats.length} suggested threats to review
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
