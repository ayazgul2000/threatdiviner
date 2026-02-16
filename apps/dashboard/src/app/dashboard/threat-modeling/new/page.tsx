'use client';

import Link from 'next/link';
import { MethodCard, Icons } from '@/components/threat-modeling/MethodCard';

export default function NewThreatModelPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Threat Model</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Choose how you want to create your threat model
          </p>
        </div>
      </div>

      {/* Method Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <MethodCard
          href="/dashboard/threat-modeling/new/manual"
          icon={<Icons.Manual />}
          title="Manual Entry"
          description="Start from scratch with a blank diagram. Add components and data flows manually using the visual editor."
        />

        <MethodCard
          href="/dashboard/threat-modeling/new/wizard"
          icon={<Icons.Wizard />}
          title="Guided Wizard"
          description="Answer a series of questions about your system to automatically generate an architecture diagram."
          badge="Recommended"
        />

        <MethodCard
          href="/dashboard/threat-modeling/new/import"
          icon={<Icons.Import />}
          title="Import"
          description="Import from OpenAPI specs, Terraform configurations, or existing Draw.io diagrams."
        />

        <MethodCard
          href="/dashboard/threat-modeling/new/ai"
          icon={<Icons.AI />}
          title="AI-Powered"
          description="Describe your system in natural language and let AI generate the architecture diagram for you."
        />

        <MethodCard
          href="/dashboard/threat-modeling/new/template"
          icon={<Icons.Template />}
          title="Templates"
          description="Start from pre-built architecture patterns for common scenarios like AWS, Azure, or microservices."
        />
      </div>

      {/* Help Section */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Not sure where to start?
        </h3>
        <p className="text-blue-700 dark:text-blue-300 text-sm mb-4">
          We recommend using the <strong>Guided Wizard</strong> if you're new to threat modeling.
          It will walk you through questions about your system and automatically generate a diagram
          based on your answers.
        </p>
        <Link
          href="/dashboard/threat-modeling/new/wizard"
          className="inline-flex items-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          Start with Guided Wizard
          <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
