'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import mermaid from 'mermaid';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
} from '@/components/ui';
import { CardSkeleton } from '@/components/ui/skeletons';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface DiagramData {
  mermaid: string;
}

interface ThreatModel {
  id: string;
  name: string;
  methodology: string;
  status: string;
}

export default function ThreatModelDiagramPage() {
  const params = useParams();
  const [model, setModel] = useState<ThreatModel | null>(null);
  const [diagram, setDiagram] = useState<DiagramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [diagramType, setDiagramType] = useState<'flowchart' | 'sequence'>('flowchart');
  const diagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis',
      },
      securityLevel: 'strict',
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [params.id]);

  useEffect(() => {
    if (diagram && diagramRef.current) {
      renderDiagram();
    }
  }, [diagram, diagramType]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [modelRes, diagramRes] = await Promise.all([
        fetch(`${API_URL}/threat-modeling/${params.id}`, { credentials: 'include' }),
        fetch(`${API_URL}/threat-modeling/${params.id}/diagram`, { credentials: 'include' }),
      ]);

      if (!modelRes.ok || !diagramRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const modelData = await modelRes.json();
      const diagramData = await diagramRes.json();

      setModel(modelData);
      setDiagram(diagramData);
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Failed to load diagram');
    } finally {
      setLoading(false);
    }
  };

  const renderDiagram = async () => {
    if (!diagramRef.current || !diagram) return;

    try {
      diagramRef.current.innerHTML = '';
      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, diagram.mermaid);
      diagramRef.current.innerHTML = svg;
    } catch (err) {
      console.error('Failed to render diagram:', err);
      diagramRef.current.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <p>Failed to render diagram</p>
          <pre class="mt-4 text-left text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-auto">${diagram.mermaid}</pre>
        </div>
      `;
    }
  };

  const handleExport = async (format: 'svg' | 'png') => {
    if (!diagramRef.current) return;

    const svg = diagramRef.current.querySelector('svg');
    if (!svg) return;

    if (format === 'svg') {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      downloadBlob(blob, `threat-model-${params.id}.svg`);
    } else {
      // PNG export
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const svgData = new XMLSerializer().serializeToString(svg);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width * 2;
        canvas.height = img.height * 2;
        ctx.scale(2, 2);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `threat-model-${params.id}.png`);
          }
        }, 'image/png');
      };

      img.src = url;
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMermaid = () => {
    if (diagram) {
      navigator.clipboard.writeText(diagram.mermaid);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/dashboard/threat-modeling/${params.id}`}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{model.name} - Diagram</h1>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{model.methodology.toUpperCase()}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handleCopyMermaid}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Mermaid
          </Button>
          <Button variant="secondary" onClick={() => handleExport('svg')}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export SVG
          </Button>
          <Button variant="secondary" onClick={() => handleExport('png')}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Export PNG
          </Button>
        </div>
      </div>

      {/* Diagram Card */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Data Flow Diagram</CardTitle>
        </CardHeader>
        <CardContent>
          {!diagram?.mermaid || diagram.mermaid.includes('No components') ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              <p className="text-lg font-medium">No diagram available</p>
              <p className="mt-2">Add components and data flows to generate the diagram.</p>
              <Link href={`/dashboard/threat-modeling/${params.id}`}>
                <Button className="mt-4">Add Components</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-auto bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div ref={diagramRef} className="flex justify-center min-h-[400px]" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mermaid Code */}
      {diagram?.mermaid && !diagram.mermaid.includes('No components') && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Mermaid Source</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto text-sm font-mono">
              {diagram.mermaid}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle>Legend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Process</div>
                <div className="text-sm text-gray-500">Rounded rectangle</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Data Store</div>
                <div className="text-sm text-gray-500">Cylinder shape</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">External Entity</div>
                <div className="text-sm text-gray-500">Rectangle</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border-2 border-dashed border-red-400 dark:border-red-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">Trust Boundary</div>
                <div className="text-sm text-gray-500">Dashed rectangle</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
