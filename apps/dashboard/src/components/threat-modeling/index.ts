// Draw.io Embed (replaces mxGraph DiagramCanvas and ShapePalette)
export { default as DrawioEmbed } from './DrawioEmbed';
export type { DrawioEmbedProps, DrawioEmbedRef } from './DrawioEmbed';

export { default as VersionManager, useVersionManager } from './VersionManager';
export type { VersionManagerProps, DiagramVersion } from './VersionManager';

export { default as LockManager, useLockManager } from './LockManager';
export type { LockManagerProps, LockInfo } from './LockManager';

export { GapFillDialog } from './GapFillDialog';
export type { Gap, GapDetectionResult } from './GapFillDialog';

export { AnalysisProgressModal } from './AnalysisProgressModal';
export type { AnalysisStage, AnalysisProgress } from './AnalysisProgressModal';

export { MethodCard, Icons } from './MethodCard';

// Wizard components
export { WizardProgress, WizardStep, WizardPreview } from './wizard';

// Import components
export { FileUploader, ImportPreview } from './import';

// AI components
export { AiPreview, DescriptionInput } from './ai';

// Template components
export { TemplateCard, CategoryFilter, TemplatePreview } from './template';
