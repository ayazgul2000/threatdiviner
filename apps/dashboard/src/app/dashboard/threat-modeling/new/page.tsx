'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Form,
  FormField,
  Label,
  Input,
  Textarea,
  Select,
  FormError,
  FormActions,
} from '@/components/ui';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const methodologies = [
  { value: 'stride', label: 'STRIDE - Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation' },
  { value: 'pasta', label: 'PASTA - Process for Attack Simulation and Threat Analysis' },
  { value: 'linddun', label: 'LINDDUN - Privacy Threat Modeling' },
  { value: 'custom', label: 'Custom - Define your own categories' },
];

export default function NewThreatModelPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    methodology: 'stride',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.length > 200) {
      newErrors.name = 'Name must be less than 200 characters';
    }

    if (formData.description && formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/threat-modeling`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create threat model');
      }

      const model = await res.json();
      router.push(`/dashboard/threat-modeling/${model.id}`);
    } catch (err) {
      console.error('Failed to create:', err);
      setErrors({ submit: err instanceof Error ? err.message : 'Failed to create threat model' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/threat-modeling"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Threat Model</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Create a new threat model for your system
          </p>
        </div>
      </div>

      {/* Form */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Threat Model Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form onSubmit={handleSubmit}>
            <FormField>
              <Label htmlFor="name" required>Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., User Authentication System"
                error={errors.name}
              />
              <FormError message={errors.name} />
            </FormField>

            <FormField>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the system or feature being analyzed..."
                rows={4}
                error={errors.description}
              />
              <FormError message={errors.description} />
            </FormField>

            <FormField>
              <Label htmlFor="methodology">Methodology</Label>
              <Select
                id="methodology"
                value={formData.methodology}
                onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
                options={methodologies}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {formData.methodology === 'stride' && (
                  'STRIDE helps identify threats across 6 categories: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege.'
                )}
                {formData.methodology === 'pasta' && (
                  'PASTA is a risk-centric threat modeling methodology with 7 stages focusing on business objectives and technical scope.'
                )}
                {formData.methodology === 'linddun' && (
                  'LINDDUN focuses on privacy threats: Linking, Identifying, Non-repudiation, Detecting, Data Disclosure, Unawareness, Non-compliance.'
                )}
                {formData.methodology === 'custom' && (
                  'Define your own threat categories tailored to your specific security requirements.'
                )}
              </p>
            </FormField>

            {errors.submit && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
                {errors.submit}
              </div>
            )}

            <FormActions>
              <Link href="/dashboard/threat-modeling">
                <Button variant="secondary" type="button">Cancel</Button>
              </Link>
              <Button type="submit" loading={submitting}>
                Create Threat Model
              </Button>
            </FormActions>
          </Form>
        </CardContent>
      </Card>

      {/* Methodology Guide */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Define Components</p>
                <p>Add the key components of your system: processes, data stores, external entities, and trust boundaries.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Map Data Flows</p>
                <p>Connect components with data flows showing how information moves through your system.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Identify Threats</p>
                <p>Analyze each component and data flow to identify potential security threats.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                4
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Plan Mitigations</p>
                <p>Define countermeasures for each threat and track their implementation status.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
