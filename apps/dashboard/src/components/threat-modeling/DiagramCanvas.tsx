'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';

// mxGraph type definitions
declare const mxGraph: any;
declare const mxRubberband: any;
declare const mxKeyHandler: any;
declare const mxUndoManager: any;
declare const mxEvent: any;
declare const mxUtils: any;
declare const mxCodec: any;
declare const mxConstants: any;
declare const mxEdgeStyle: any;
declare const mxClient: any;
declare const mxGraphHandler: any;
declare const mxCellRenderer: any;

export interface DiagramComponent {
  id: string;
  name: string;
  type: string;
  technology?: string;
  criticality?: string;
  positionX: number;
  positionY: number;
  metadata?: Record<string, unknown>;
}

export interface DiagramDataFlow {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  protocol?: string;
  authentication?: boolean;
  encryption?: boolean;
}

export interface DiagramCanvasProps {
  components: DiagramComponent[];
  dataFlows: DiagramDataFlow[];
  xmlContent?: string;
  readOnly?: boolean;
  onSelectionChange?: (selectedIds: string[]) => void;
  onComponentUpdate?: (component: DiagramComponent) => void;
  onDataFlowUpdate?: (dataFlow: DiagramDataFlow) => void;
  onXmlChange?: (xml: string) => void;
  onComponentAdd?: (component: Partial<DiagramComponent>) => void;
  onDataFlowAdd?: (dataFlow: Partial<DiagramDataFlow>) => void;
  onDelete?: (ids: string[]) => void;
}

// Component type to shape mapping
const COMPONENT_SHAPES: Record<string, { shape: string; fillColor: string; strokeColor: string }> = {
  process: { shape: 'rectangle', fillColor: '#E3F2FD', strokeColor: '#1976D2' },
  datastore: { shape: 'cylinder', fillColor: '#E8F5E9', strokeColor: '#388E3C' },
  data_store: { shape: 'cylinder', fillColor: '#E8F5E9', strokeColor: '#388E3C' },
  external_entity: { shape: 'rectangle', fillColor: '#FFF3E0', strokeColor: '#F57C00' },
  trust_boundary: { shape: 'swimlane', fillColor: '#FCE4EC', strokeColor: '#C2185B' },
  web_application: { shape: 'rectangle', fillColor: '#E3F2FD', strokeColor: '#1976D2' },
  api: { shape: 'rectangle', fillColor: '#E8EAF6', strokeColor: '#3F51B5' },
  database: { shape: 'cylinder', fillColor: '#E8F5E9', strokeColor: '#388E3C' },
  service: { shape: 'rectangle', fillColor: '#F3E5F5', strokeColor: '#7B1FA2' },
  gateway: { shape: 'hexagon', fillColor: '#FFF8E1', strokeColor: '#FFA000' },
};

export default function DiagramCanvas({
  components,
  dataFlows,
  xmlContent,
  readOnly = false,
  onSelectionChange,
  onComponentUpdate,
  onDataFlowUpdate,
  onXmlChange,
  onComponentAdd,
  onDataFlowAdd,
  onDelete,
}: DiagramCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const undoManagerRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mxLoaded, setMxLoaded] = useState(false);

  // Load mxGraph library
  useEffect(() => {
    const loadMxGraph = async () => {
      if (typeof window !== 'undefined' && !window.mxGraph) {
        try {
          // Dynamic import for mxGraph
          const mx = await import('mxgraph');
          const mxgraph = mx.default({
            mxBasePath: '/mxgraph',
          });

          // Expose mxGraph globals
          (window as any).mxGraph = mxgraph.mxGraph;
          (window as any).mxRubberband = mxgraph.mxRubberband;
          (window as any).mxKeyHandler = mxgraph.mxKeyHandler;
          (window as any).mxUndoManager = mxgraph.mxUndoManager;
          (window as any).mxEvent = mxgraph.mxEvent;
          (window as any).mxUtils = mxgraph.mxUtils;
          (window as any).mxCodec = mxgraph.mxCodec;
          (window as any).mxConstants = mxgraph.mxConstants;
          (window as any).mxEdgeStyle = mxgraph.mxEdgeStyle;
          (window as any).mxClient = mxgraph.mxClient;
          (window as any).mxGraphHandler = mxgraph.mxGraphHandler;
          (window as any).mxCellRenderer = mxgraph.mxCellRenderer;

          setMxLoaded(true);
        } catch (error) {
          console.error('Failed to load mxGraph:', error);
        }
      } else if (typeof window !== 'undefined' && window.mxGraph) {
        setMxLoaded(true);
      }
    };

    loadMxGraph();
  }, []);

  // Initialize graph
  useEffect(() => {
    if (!containerRef.current || !mxLoaded || isInitialized) return;

    try {
      // Check if mxGraph is available
      if (typeof mxClient === 'undefined') {
        console.error('mxGraph not loaded');
        return;
      }

      // Create graph instance
      const graph = new mxGraph(containerRef.current);
      graphRef.current = graph;

      // Configure graph
      configureGraph(graph);

      // Set up undo manager
      const undoManager = new mxUndoManager();
      undoManagerRef.current = undoManager;

      const listener = (_sender: any, evt: any) => {
        undoManager.undoableEditHappened(evt.getProperty('edit'));
      };

      graph.getModel().addListener(mxEvent.UNDO, listener);
      graph.getView().addListener(mxEvent.UNDO, listener);

      // Set up selection listener
      graph.getSelectionModel().addListener(mxEvent.CHANGE, () => {
        const cells = graph.getSelectionCells();
        const ids = cells.map((cell: any) => cell.id).filter(Boolean);
        onSelectionChange?.(ids);
      });

      // Set up keyboard shortcuts
      setupKeyboardShortcuts(graph, undoManager);

      // Enable rubberband selection
      new mxRubberband(graph);

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize graph:', error);
    }
  }, [mxLoaded, isInitialized, onSelectionChange]);

  // Load data when graph is ready
  useEffect(() => {
    if (!graphRef.current || !isInitialized) return;

    const graph = graphRef.current;

    // Load from XML if provided, otherwise from components/dataFlows
    if (xmlContent) {
      loadFromXml(graph, xmlContent);
    } else {
      loadFromData(graph, components, dataFlows);
    }
  }, [isInitialized, components, dataFlows, xmlContent]);

  const configureGraph = (graph: any) => {
    // Basic configuration
    graph.setConnectable(!readOnly);
    graph.setAllowDanglingEdges(false);
    graph.setDisconnectOnMove(false);
    graph.setCellsEditable(!readOnly);
    graph.setCellsMovable(!readOnly);
    graph.setCellsResizable(!readOnly);
    graph.setCellsDeletable(!readOnly);
    graph.setDropEnabled(!readOnly);
    graph.setSplitEnabled(false);

    // Enable panning
    graph.setPanning(true);
    graph.panningHandler.useLeftButtonForPanning = true;

    // Enable grid
    graph.gridSize = 10;
    graph.setGridEnabled(true);

    // Configure default styles
    const style = graph.getStylesheet().getDefaultVertexStyle();
    style[mxConstants.STYLE_ROUNDED] = true;
    style[mxConstants.STYLE_FONTSIZE] = 12;
    style[mxConstants.STYLE_FONTSTYLE] = 0;

    const edgeStyle = graph.getStylesheet().getDefaultEdgeStyle();
    edgeStyle[mxConstants.STYLE_EDGE] = mxEdgeStyle.OrthConnector;
    edgeStyle[mxConstants.STYLE_ROUNDED] = true;
    edgeStyle[mxConstants.STYLE_STROKEWIDTH] = 2;

    // Register custom shapes for different component types
    registerCustomShapes(graph);

    // Configure tooltips
    graph.setTooltips(true);

    // Enable zoom with mouse wheel
    mxEvent.addMouseWheelListener((evt: any, up: boolean) => {
      if (mxEvent.isControlDown(evt)) {
        if (up) {
          graph.zoomIn();
        } else {
          graph.zoomOut();
        }
        mxEvent.consume(evt);
      }
    });
  };

  const registerCustomShapes = (_graph: any) => {
    // Register styles for each component type
    Object.entries(COMPONENT_SHAPES).forEach(([type, config]) => {
      const style: Record<string, any> = {};
      style[mxConstants.STYLE_SHAPE] = config.shape;
      style[mxConstants.STYLE_FILLCOLOR] = config.fillColor;
      style[mxConstants.STYLE_STROKECOLOR] = config.strokeColor;
      style[mxConstants.STYLE_STROKEWIDTH] = 2;
      style[mxConstants.STYLE_ROUNDED] = true;
      style[mxConstants.STYLE_FONTSIZE] = 12;
      style[mxConstants.STYLE_VERTICAL_ALIGN] = mxConstants.ALIGN_MIDDLE;
      style[mxConstants.STYLE_ALIGN] = mxConstants.ALIGN_CENTER;

      _graph.getStylesheet().putCellStyle(type, style);
    });

    // Edge styles
    const secureEdge: Record<string, any> = {};
    secureEdge[mxConstants.STYLE_STROKECOLOR] = '#388E3C';
    secureEdge[mxConstants.STYLE_STROKEWIDTH] = 2;
    secureEdge[mxConstants.STYLE_DASHED] = false;
    _graph.getStylesheet().putCellStyle('secureEdge', secureEdge);

    const insecureEdge: Record<string, any> = {};
    insecureEdge[mxConstants.STYLE_STROKECOLOR] = '#D32F2F';
    insecureEdge[mxConstants.STYLE_STROKEWIDTH] = 2;
    insecureEdge[mxConstants.STYLE_DASHED] = true;
    _graph.getStylesheet().putCellStyle('insecureEdge', insecureEdge);
  };

  const setupKeyboardShortcuts = (graph: any, undoManager: any) => {
    const keyHandler = new mxKeyHandler(graph);

    // Ctrl+Z - Undo
    keyHandler.bindControlKey(90, () => {
      if (!readOnly) {
        undoManager.undo();
      }
    });

    // Ctrl+Shift+Z - Redo
    keyHandler.bindControlShiftKey(90, () => {
      if (!readOnly) {
        undoManager.redo();
      }
    });

    // Ctrl+Y - Redo (alternative)
    keyHandler.bindControlKey(89, () => {
      if (!readOnly) {
        undoManager.redo();
      }
    });

    // Delete key
    keyHandler.bindKey(46, () => {
      if (!readOnly) {
        const cells = graph.getSelectionCells();
        if (cells.length > 0) {
          const ids = cells.map((cell: any) => cell.id).filter(Boolean);
          onDelete?.(ids);
          graph.removeCells(cells);
        }
      }
    });

    // Ctrl+A - Select all
    keyHandler.bindControlKey(65, () => {
      graph.selectAll();
    });

    // Ctrl+S - Save (trigger XML export)
    keyHandler.bindControlKey(83, (evt: KeyboardEvent) => {
      evt.preventDefault();
      const xml = exportToXml(graph);
      onXmlChange?.(xml);
    });
  };

  const loadFromData = (graph: any, comps: DiagramComponent[], flows: DiagramDataFlow[]) => {
    const parent = graph.getDefaultParent();
    const cellMap = new Map<string, any>();

    graph.getModel().beginUpdate();
    try {
      // Clear existing cells
      graph.removeCells(graph.getChildVertices(parent));

      // Add components as vertices
      comps.forEach((comp) => {
        const style = comp.type?.toLowerCase() || 'process';
        const width = 120;
        const height = 60;
        const x = comp.positionX || Math.random() * 500;
        const y = comp.positionY || Math.random() * 400;

        const cell = graph.insertVertex(
          parent,
          comp.id,
          comp.name,
          x,
          y,
          width,
          height,
          style
        );

        // Store metadata
        cell.componentData = comp;
        cellMap.set(comp.id, cell);
      });

      // Add data flows as edges
      flows.forEach((flow) => {
        const source = cellMap.get(flow.sourceId);
        const target = cellMap.get(flow.targetId);

        if (source && target) {
          const edgeStyle = flow.encryption ? 'secureEdge' : 'insecureEdge';
          const edge = graph.insertEdge(
            parent,
            flow.id,
            flow.label || '',
            source,
            target,
            edgeStyle
          );
          edge.dataFlowData = flow;
        }
      });
    } finally {
      graph.getModel().endUpdate();
    }
  };

  const loadFromXml = (graph: any, xml: string) => {
    try {
      const doc = mxUtils.parseXml(xml);
      const codec = new mxCodec(doc);
      codec.decode(doc.documentElement, graph.getModel());
    } catch (error) {
      console.error('Failed to parse XML:', error);
    }
  };

  const exportToXml = useCallback((graph: any): string => {
    const encoder = new mxCodec();
    const node = encoder.encode(graph.getModel());
    return mxUtils.getXml(node);
  }, []);

  // Public methods exposed via ref
  const zoomIn = useCallback(() => {
    graphRef.current?.zoomIn();
  }, []);

  const zoomOut = useCallback(() => {
    graphRef.current?.zoomOut();
  }, []);

  const zoomToFit = useCallback(() => {
    graphRef.current?.fit();
  }, []);

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  const getXml = useCallback((): string => {
    if (!graphRef.current) return '';
    return exportToXml(graphRef.current);
  }, [exportToXml]);

  const selectAll = useCallback(() => {
    graphRef.current?.selectAll();
  }, []);

  const clearSelection = useCallback(() => {
    graphRef.current?.clearSelection();
  }, []);

  // Expose methods for parent components
  React.useImperativeHandle(
    React.useRef({ zoomIn, zoomOut, zoomToFit, undo, redo, getXml, selectAll, clearSelection }),
    () => ({ zoomIn, zoomOut, zoomToFit, undo, redo, getXml, selectAll, clearSelection }),
    [zoomIn, zoomOut, zoomToFit, undo, redo, getXml, selectAll, clearSelection]
  );

  return (
    <div className="relative w-full h-full min-h-[600px] border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-10 flex gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1">
        <button
          onClick={zoomIn}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Zoom In"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
        <button
          onClick={zoomOut}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Zoom Out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <button
          onClick={zoomToFit}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          title="Fit to View"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <div className="w-px bg-gray-200 dark:bg-gray-600 mx-1" />
        {!readOnly && (
          <>
            <button
              onClick={undo}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Undo (Ctrl+Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <button
              onClick={redo}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              title="Redo (Ctrl+Shift+Z)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{
          backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Loading state */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-900/80">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="text-sm text-gray-500">Loading diagram editor...</span>
          </div>
        </div>
      )}

      {/* Read-only indicator */}
      {readOnly && isInitialized && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
          View Only
        </div>
      )}
    </div>
  );
}

// Extend Window interface for mxGraph globals
declare global {
  interface Window {
    mxGraph: any;
    mxRubberband: any;
    mxKeyHandler: any;
    mxUndoManager: any;
    mxEvent: any;
    mxUtils: any;
    mxCodec: any;
    mxConstants: any;
    mxEdgeStyle: any;
    mxClient: any;
    mxGraphHandler: any;
    mxCellRenderer: any;
  }
}
