export { default as DiagramCanvas } from './DiagramCanvas';
export type {
  DiagramCanvasProps,
  DiagramComponent,
  DiagramDataFlow,
} from './DiagramCanvas';

export { default as ShapePalette } from './ShapePalette';
export type { ShapePaletteProps, ShapeItem } from './ShapePalette';

export { default as PropertyPanel } from './PropertyPanel';
export type {
  PropertyPanelProps,
  ComponentFormData,
  DataFlowFormData,
  TrustBoundaryFormData,
} from './PropertyPanel';

export { default as VersionManager, useVersionManager } from './VersionManager';
export type { VersionManagerProps, DiagramVersion } from './VersionManager';

export { default as LockManager, useLockManager } from './LockManager';
export type { LockManagerProps, LockInfo } from './LockManager';

export { GapFillDialog } from './GapFillDialog';
export type { Gap, GapDetectionResult } from './GapFillDialog';
