'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';

// Shape category configuration
export interface ShapeItem {
  id: string;
  drawioStyle: string;
  displayName: string;
  category: string;
  threagileType: string;
  iconUrl?: string;
  defaultInternetFacing?: boolean;
  defaultEncryption?: string;
  defaultAuthentication?: string;
}

export interface ShapePaletteProps {
  shapes: ShapeItem[];
  isLoading?: boolean;
  error?: string | null;
  onShapeDragStart?: (shape: ShapeItem, event: React.DragEvent) => void;
  onShapeClick?: (shape: ShapeItem) => void;
  onRefresh?: () => void;
}

// Category display names and icons
const CATEGORY_CONFIG: Record<string, { name: string; icon: string; order: number }> = {
  aws: { name: 'AWS', icon: '☁️', order: 1 },
  azure: { name: 'Azure', icon: '☁️', order: 2 },
  gcp: { name: 'Google Cloud', icon: '☁️', order: 3 },
  generic: { name: 'Generic', icon: '📦', order: 4 },
  network: { name: 'Network', icon: '🌐', order: 5 },
  security: { name: 'Security', icon: '🔒', order: 6 },
  storage: { name: 'Storage', icon: '💾', order: 7 },
  compute: { name: 'Compute', icon: '⚙️', order: 8 },
};

// Default shapes when API returns empty
const DEFAULT_SHAPES: ShapeItem[] = [
  { id: 'default-process', drawioStyle: 'process', displayName: 'Process', category: 'generic', threagileType: 'process' },
  { id: 'default-datastore', drawioStyle: 'datastore', displayName: 'Data Store', category: 'generic', threagileType: 'datastore' },
  { id: 'default-external', drawioStyle: 'external_entity', displayName: 'External Entity', category: 'generic', threagileType: 'external-entity' },
  { id: 'default-boundary', drawioStyle: 'trust_boundary', displayName: 'Trust Boundary', category: 'generic', threagileType: 'trust-boundary' },
  { id: 'default-webapp', drawioStyle: 'web_application', displayName: 'Web Application', category: 'generic', threagileType: 'web-application' },
  { id: 'default-api', drawioStyle: 'api', displayName: 'API', category: 'generic', threagileType: 'api' },
  { id: 'default-database', drawioStyle: 'database', displayName: 'Database', category: 'generic', threagileType: 'database' },
  { id: 'default-service', drawioStyle: 'service', displayName: 'Service', category: 'generic', threagileType: 'service' },
  { id: 'default-gateway', drawioStyle: 'gateway', displayName: 'Gateway', category: 'generic', threagileType: 'gateway' },
];

const RECENT_SHAPES_KEY = 'threatdiviner-recent-shapes';
const MAX_RECENT_SHAPES = 5;

export default function ShapePalette({
  shapes,
  isLoading = false,
  error = null,
  onShapeDragStart,
  onShapeClick,
  onRefresh,
}: ShapePaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['generic']));
  const [recentShapeIds, setRecentShapeIds] = useState<string[]>([]);

  // Load recent shapes from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(RECENT_SHAPES_KEY);
        if (stored) {
          setRecentShapeIds(JSON.parse(stored));
        }
      } catch {
        // Ignore localStorage errors
      }
    }
  }, []);

  // Save recent shape to localStorage
  const addRecentShape = useCallback((shapeId: string) => {
    setRecentShapeIds((prev) => {
      const updated = [shapeId, ...prev.filter((id) => id !== shapeId)].slice(0, MAX_RECENT_SHAPES);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(RECENT_SHAPES_KEY, JSON.stringify(updated));
        } catch {
          // Ignore localStorage errors
        }
      }
      return updated;
    });
  }, []);

  // Use default shapes if API returns empty
  const effectiveShapes = shapes.length > 0 ? shapes : DEFAULT_SHAPES;

  // Group shapes by category
  const categorizedShapes = useMemo(() => {
    const groups: Record<string, ShapeItem[]> = {};
    effectiveShapes.forEach((shape) => {
      const category = shape.category || 'generic';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(shape);
    });
    return groups;
  }, [effectiveShapes]);

  // Sort categories by order
  const sortedCategories = useMemo(() => {
    return Object.keys(categorizedShapes).sort((a, b) => {
      const orderA = CATEGORY_CONFIG[a]?.order ?? 999;
      const orderB = CATEGORY_CONFIG[b]?.order ?? 999;
      return orderA - orderB;
    });
  }, [categorizedShapes]);

  // Filter shapes by search query
  const filteredShapes = useMemo(() => {
    if (!searchQuery.trim()) return categorizedShapes;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, ShapeItem[]> = {};

    Object.entries(categorizedShapes).forEach(([category, items]) => {
      const matchingItems = items.filter(
        (shape) =>
          shape.displayName.toLowerCase().includes(query) ||
          shape.threagileType.toLowerCase().includes(query) ||
          shape.drawioStyle.toLowerCase().includes(query)
      );
      if (matchingItems.length > 0) {
        filtered[category] = matchingItems;
      }
    });

    return filtered;
  }, [categorizedShapes, searchQuery]);

  // Recent shapes
  const recentShapes = useMemo(() => {
    return recentShapeIds
      .map((id) => effectiveShapes.find((s) => s.id === id))
      .filter((s): s is ShapeItem => s !== undefined);
  }, [recentShapeIds, effectiveShapes]);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Handle drag start
  const handleDragStart = (shape: ShapeItem, event: React.DragEvent) => {
    event.dataTransfer.setData('application/json', JSON.stringify(shape));
    event.dataTransfer.effectAllowed = 'copy';
    addRecentShape(shape.id);
    onShapeDragStart?.(shape, event);
  };

  // Handle shape click
  const handleShapeClick = (shape: ShapeItem) => {
    addRecentShape(shape.id);
    onShapeClick?.(shape);
  };

  // Get category display info
  const getCategoryInfo = (category: string) => {
    return CATEGORY_CONFIG[category] || { name: category, icon: '📁', order: 999 };
  };

  // Render a single shape item
  const renderShapeItem = (shape: ShapeItem) => (
    <div
      key={shape.id}
      draggable
      onDragStart={(e) => handleDragStart(shape, e)}
      onClick={() => handleShapeClick(shape)}
      className="flex items-center gap-2 p-2 rounded cursor-grab hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      title={`${shape.displayName}\nType: ${shape.threagileType}\nStyle: ${shape.drawioStyle}`}
    >
      {shape.iconUrl ? (
        <img src={shape.iconUrl} alt={shape.displayName} className="w-6 h-6 object-contain" />
      ) : (
        <div className="w-6 h-6 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-300">
          {shape.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <span className="text-sm truncate">{shape.displayName}</span>
    </div>
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="w-64 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-64 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="text-red-500 dark:text-red-400 text-sm">
          <p className="font-semibold">Error loading shapes</p>
          <p className="mt-1">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 px-3 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  // Empty state
  if (effectiveShapes.length === 0) {
    return (
      <div className="w-64 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="font-medium">No shapes configured</p>
          <p className="text-xs mt-1">Contact your administrator to add shape mappings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200">Components</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Drag to add to diagram</p>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Shape list */}
      <div className="flex-1 overflow-y-auto">
        {/* Recent shapes */}
        {recentShapes.length > 0 && !searchQuery && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleCategory('__recent__')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                <span>🕐</span>
                <span>Recent</span>
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${
                  expandedCategories.has('__recent__') ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedCategories.has('__recent__') && (
              <div className="px-3 pb-3">{recentShapes.map(renderShapeItem)}</div>
            )}
          </div>
        )}

        {/* Categories */}
        {(searchQuery ? Object.keys(filteredShapes) : sortedCategories).map((category) => {
          const items = filteredShapes[category];
          if (!items || items.length === 0) return null;

          const categoryInfo = getCategoryInfo(category);
          const isExpanded = expandedCategories.has(category) || !!searchQuery;

          return (
            <div key={category} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                  <span>{categoryInfo.icon}</span>
                  <span>{categoryInfo.name}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({items.length})</span>
                </span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && <div className="px-3 pb-3">{items.map(renderShapeItem)}</div>}
            </div>
          );
        })}

        {/* No results */}
        {searchQuery && Object.keys(filteredShapes).length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            <p className="text-sm">No components match "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
