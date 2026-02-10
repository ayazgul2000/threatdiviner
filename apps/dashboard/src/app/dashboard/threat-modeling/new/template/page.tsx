'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, Button } from '@/components/ui';
import { FormField, Label, Input, Textarea, Select, FormError } from '@/components/ui/form';
import { TemplateCard, CategoryFilter, TemplatePreview } from '@/components/threat-modeling/template';
import { threatModelingApi, TemplateListItem, TemplateDetails } from '@/lib/api';
import { useProject } from '@/contexts/project-context';

export default function TemplatePage() {
  const router = useRouter();
  const { currentProject, projects } = useProject();

  // Template listing state
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selection state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<TemplateDetails | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Form state
  const [modelName, setModelName] = useState('');
  const [modelDescription, setModelDescription] = useState('');
  const [methodology, setMethodology] = useState('stride');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Set default project when available
  useEffect(() => {
    if (currentProject && !selectedProjectId) {
      setSelectedProjectId(currentProject.id);
    }
  }, [currentProject, selectedProjectId]);

  // Fetch templates and categories
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [templatesData, categoriesData] = await Promise.all([
          threatModelingApi.templates.list({
            category: selectedCategory || undefined,
            search: searchQuery || undefined,
          }),
          threatModelingApi.templates.getCategories(),
        ]);

        setTemplates(templatesData);
        setCategories(categoriesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedCategory, searchQuery]);

  // Update model name when template is selected
  useEffect(() => {
    if (selectedTemplate && !modelName) {
      setModelName(`${selectedTemplate.name} - My Instance`);
      setModelDescription(selectedTemplate.description || '');
    }
  }, [selectedTemplate, modelName]);

  // Handle template selection
  const handleSelectTemplate = (template: TemplateListItem) => {
    setSelectedTemplate(template);
    setFormError(null);
  };

  // Handle preview
  const handlePreview = async (template: TemplateListItem) => {
    setIsPreviewOpen(true);
    setIsPreviewLoading(true);

    try {
      const details = await threatModelingApi.templates.get(template.id);
      setPreviewTemplate(details);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template details');
      setIsPreviewOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Handle create from preview
  const handleUseTemplate = (template: TemplateDetails) => {
    const listItem: TemplateListItem = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      tags: template.tags,
      previewImageUrl: template.previewImageUrl,
      componentCount: template.componentCount,
      dataFlowCount: template.dataFlowCount,
      isPublic: template.isPublic,
    };
    setSelectedTemplate(listItem);
    setIsPreviewOpen(false);
  };

  // Handle create threat model
  const handleCreate = async () => {
    setFormError(null);

    if (!selectedTemplate) {
      setFormError('Please select a template');
      return;
    }

    if (!modelName.trim()) {
      setFormError('Please enter a name for your threat model');
      return;
    }

    if (!selectedProjectId) {
      setFormError('Please select a project');
      return;
    }

    setIsCreating(true);

    try {
      const result = await threatModelingApi.templates.create(selectedTemplate.id, {
        projectId: selectedProjectId,
        name: modelName.trim(),
        description: modelDescription.trim() || undefined,
        methodology,
      });

      router.push(`/dashboard/threat-modeling/${result.threatModel.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create threat model');
      setIsCreating(false);
    }
  };

  // Handle reset selection
  const handleReset = () => {
    setSelectedTemplate(null);
    setModelName('');
    setModelDescription('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Templates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Start from pre-built architecture patterns
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card variant="bordered" className="border-red-300 dark:border-red-700">
          <CardContent className="flex items-center gap-3 py-3">
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <CategoryFilter
            categories={categories}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            loading={isLoading}
          />

          {/* Templates Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="text-center py-12">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No templates found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {searchQuery || selectedCategory
                    ? 'Try adjusting your search or filter'
                    : 'No templates are available yet. Check back later or use Manual Entry.'}
                </p>
                {(searchQuery || selectedCategory) && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                    }}
                    className="mt-4"
                  >
                    Clear Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  selected={selectedTemplate?.id === template.id}
                  onSelect={handleSelectTemplate}
                  onPreview={handlePreview}
                />
              ))}
            </div>
          )}
        </div>

        {/* Creation Form */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Create Threat Model
          </h2>

          {!selectedTemplate ? (
            <Card variant="bordered" className="bg-gray-50 dark:bg-gray-800/50">
              <CardContent className="text-center py-8">
                <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Select a template from the left to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card variant="bordered">
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b dark:border-gray-700">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedTemplate.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedTemplate.componentCount} components, {selectedTemplate.dataFlowCount} flows
                      </p>
                    </div>
                    <button
                      onClick={handleReset}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Change
                    </button>
                  </div>

                  <FormField>
                    <Label required>Name</Label>
                    <Input
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="e.g., My E-Commerce Platform"
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

                  {formError && <FormError message={formError} />}

                  <div className="flex gap-3 pt-4">
                    <Button variant="secondary" onClick={handleReset} disabled={isCreating}>
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleCreate}
                      disabled={isCreating || !modelName.trim() || !selectedProjectId}
                      className="flex-1"
                    >
                      {isCreating ? (
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
                        `Create from Template`
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
                      {selectedTemplate.componentCount} components
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {selectedTemplate.dataFlowCount} data flows
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Pre-configured diagram layout
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <TemplatePreview
        template={previewTemplate}
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setPreviewTemplate(null);
        }}
        onUse={handleUseTemplate}
        loading={isPreviewLoading}
      />
    </div>
  );
}
