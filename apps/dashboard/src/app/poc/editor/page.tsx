'use client';

import { ReactFlowProvider } from '@xyflow/react';
import { EditorLayout } from '@/components/poc-editor';

/**
 * POC System Design Editor — Full-screen canvas for designing system architectures.
 *
 * Route: /poc/editor
 * Isolated from existing threat modeling code.
 */
export default function PocEditorPage() {
  return (
    <ReactFlowProvider>
      <EditorLayout />
    </ReactFlowProvider>
  );
}
