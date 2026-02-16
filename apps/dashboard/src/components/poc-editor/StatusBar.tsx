'use client';

import { useMemo } from 'react';
import { useEditorStore } from './store/editor-store';
import type { CanvasNodeData } from './types';
import { Map, Grid3X3, Download, Upload, RotateCcw, Home } from 'lucide-react';
import Link from 'next/link';

export function StatusBar() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const showMinimap = useEditorStore((s) => s.showMinimap);
  const showGrid = useEditorStore((s) => s.showGrid);
  const toggleMinimap = useEditorStore((s) => s.toggleMinimap);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const exportDesign = useEditorStore((s) => s.exportDesign);
  const resetCanvas = useEditorStore((s) => s.resetCanvas);

  const stats = useMemo(() => {
    let components = 0;
    let zones = 0;
    let actors = 0;
    let incompleteEdges = 0;
    let noZoneComponents = 0;

    for (const node of nodes) {
      const data = node.data as CanvasNodeData;
      if (data.kind === 'component') {
        components++;
        const hasParent = node.parentId && nodes.some((n) => n.id === node.parentId);
        if (!hasParent) noZoneComponents++;
      }
      if (data.kind === 'zone') zones++;
      if (data.kind === 'actor') actors++;
    }

    for (const edge of edges) {
      const edata = edge.data as { protocol?: string } | undefined;
      if (!edata || edata.protocol === 'none') incompleteEdges++;
    }

    return { components, zones, actors, connections: edges.length, incompleteEdges, noZoneComponents };
  }, [nodes, edges]);

  const handleExport = () => {
    const data = exportDesign();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-design-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const design = JSON.parse(ev.target?.result as string);
          useEditorStore.getState().importDesign(design);
        } catch {
          // silently fail on bad JSON
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="h-8 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between px-3 text-[11px] text-gray-500 dark:text-gray-400">
      {/* Left: stats */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/threat-modeling"
          className="flex items-center gap-1 hover:text-blue-500 transition-colors"
          title="Back to Threat Models"
        >
          <Home className="w-3 h-3" />
        </Link>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <span>{stats.components} components</span>
        <span>{stats.zones} zones</span>
        <span>{stats.actors} actors</span>
        <span>{stats.connections} connections</span>
        {stats.incompleteEdges > 0 && (
          <span className="text-red-500 font-medium">
            {stats.incompleteEdges} incomplete
          </span>
        )}
        {stats.noZoneComponents > 0 && (
          <span className="text-yellow-500 font-medium">
            {stats.noZoneComponents} unzoned
          </span>
        )}
      </div>

      {/* Right: toggles & actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleMinimap}
          className={`p-1 rounded transition-colors ${showMinimap ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          title="Toggle minimap"
        >
          <Map className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={toggleGrid}
          className={`p-1 rounded transition-colors ${showGrid ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
          title="Toggle grid"
        >
          <Grid3X3 className="w-3.5 h-3.5" />
        </button>
        <span className="text-gray-300 dark:text-gray-600 mx-1">|</span>
        <button
          onClick={handleExport}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Export design"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleImport}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Import design"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetCanvas}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
          title="Clear canvas"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
