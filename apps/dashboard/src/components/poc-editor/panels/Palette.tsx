'use client';

import { useState, useMemo, useCallback } from 'react';
import { useEditorStore } from '../store/editor-store';
import {
  PALETTE_CATEGORIES,
  STARTER_PALETTE_ITEMS,
  ZONE_PRESETS,
  ACTOR_PRESETS,
  INLINE_CONTROL_PRESETS,
} from '../constants';
import type { PaletteCategory } from '../types';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Server,
  Database,
  HardDrive,
  Globe,
  Zap,
  Box,
  Key,
  Activity,
  BarChart3,
  Brain,
  Mail,
  Shield,
  Cloud,
  Square,
  User,
  Layers,
  ArrowLeftRight,
} from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  compute: Server,
  database: Database,
  storage: HardDrive,
  network: Globe,
  serverless: Zap,
  container: Box,
  identity: Key,
  monitoring: Activity,
  analytics: BarChart3,
  'ai-ml': Brain,
  messaging: Mail,
  security: Shield,
  'cdn-edge': Cloud,
  generic: Square,
};

type PaletteTab = 'components' | 'zones' | 'actors' | 'controls';

export function Palette() {
  const paletteSearch = useEditorStore((s) => s.paletteSearch);
  const setPaletteSearch = useEditorStore((s) => s.setPaletteSearch);
  const setPaletteDragItem = useEditorStore((s) => s.setPaletteDragItem);
  const [activeTab, setActiveTab] = useState<PaletteTab>('components');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['compute', 'database']));

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Filter palette items by search
  const filteredItems = useMemo(() => {
    const query = paletteSearch.toLowerCase().trim();
    if (!query) return STARTER_PALETTE_ITEMS;
    return STARTER_PALETTE_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.keywords.some((kw) => kw.includes(query)) ||
        item.vendor.includes(query),
    );
  }, [paletteSearch]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    for (const item of filteredItems) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, [filteredItems]);

  const onDragStart = useCallback(
    (e: React.DragEvent, type: string, payload: string) => {
      e.dataTransfer.setData('application/poc-editor-type', type);
      e.dataTransfer.setData('application/poc-editor-payload', payload);
      e.dataTransfer.effectAllowed = 'move';
      setPaletteDragItem(payload);
    },
    [setPaletteDragItem],
  );

  const onDragEnd = useCallback(() => {
    setPaletteDragItem(null);
  }, [setPaletteDragItem]);

  const tabs: { key: PaletteTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'components', label: 'Components', icon: Server },
    { key: 'zones', label: 'Zones', icon: Layers },
    { key: 'actors', label: 'Actors', icon: User },
    { key: 'controls', label: 'Controls', icon: ArrowLeftRight },
  ];

  return (
    <div className="w-60 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Palette</h2>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={paletteSearch}
            onChange={(e) => setPaletteSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors
                ${activeTab === tab.key
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }
              `}
            >
              <TabIcon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'components' && (
          <div className="p-2 space-y-1">
            {PALETTE_CATEGORIES.map((cat) => {
              const items = groupedItems[cat.id];
              if (!items || items.length === 0) return null;
              const CatIcon = CATEGORY_ICONS[cat.id] || Square;
              const isExpanded = expandedCategories.has(cat.id);

              return (
                <div key={cat.id}>
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    )}
                    <CatIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1 text-left">
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{items.length}</span>
                  </button>

                  {/* Items */}
                  {isExpanded && (
                    <div className="ml-5 space-y-0.5">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) =>
                            onDragStart(e, 'component', JSON.stringify(item))
                          }
                          onDragEnd={onDragEnd}
                          className="flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                        >
                          <CatIcon className="w-3 h-3 text-gray-400 group-hover:text-blue-500" />
                          <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'zones' && (
          <div className="p-2 space-y-1">
            {ZONE_PRESETS.map((zone) => (
              <div
                key={zone.type}
                draggable
                onDragStart={(e) =>
                  onDragStart(e, 'zone', JSON.stringify(zone))
                }
                onDragEnd={onDragEnd}
                className="flex items-center gap-2 px-2 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div
                  className="w-4 h-4 rounded border-2"
                  style={{
                    borderColor: zone.color,
                    backgroundColor: `${zone.color}15`,
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {zone.label}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">
                    Trust L{zone.trustLevel} — {zone.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'actors' && (
          <div className="p-2 space-y-1">
            {ACTOR_PRESETS.map((actor) => (
              <div
                key={actor.type}
                draggable
                onDragStart={(e) =>
                  onDragStart(e, 'actor', JSON.stringify(actor))
                }
                onDragEnd={onDragEnd}
                className="flex items-center gap-2 px-2 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <User className="w-4 h-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {actor.label}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">{actor.description}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'controls' && (
          <div className="p-2">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 px-2 py-1 mb-2">
              Drag onto an existing connection line to insert inline controls.
            </p>
            <div className="space-y-1">
              {INLINE_CONTROL_PRESETS.map((control) => (
                <div
                  key={control.type}
                  draggable
                  onDragStart={(e) =>
                    onDragStart(e, 'inline-control', JSON.stringify(control))
                  }
                  onDragEnd={onDragEnd}
                  className="flex items-center gap-2 px-2 py-2 rounded cursor-grab active:cursor-grabbing hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Shield className="w-4 h-4 text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {control.label}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">{control.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-[10px] text-gray-400 dark:text-gray-500">
        {filteredItems.length} components available
      </div>
    </div>
  );
}
