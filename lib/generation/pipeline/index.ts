/**
 * Pipeline Module - Proposal generation pipeline utilities
 *
 * This module provides services for managing the proposal generation pipeline:
 * - Page tracking and limit enforcement
 * - Content condensing for page compliance
 * - PDF conversion
 * - Quality checklist generation
 * - Outline view extraction
 */

// Page tracking with auto-condensing
export {
  PageTracker,
  createVolumeTrackers,
  type PageAllocation,
  type PageLimitStatus,
  type AddSectionResult,
  type CondenseCallback,
  type VolumeLimits,
} from './page-tracker';

// Content condensing
export {
  condenseContent,
  condenseContentCallback,
  condenseContentMultiPass,
  type CondensingResult,
  type CondenseCallbackResult,
} from './content-condenser';

// PDF conversion
export * from './pdf-converter';
export * from './temp-files';

// Quality and structure
export {
  generateChecklist,
  FRAMEWORK_CHECKLIST,
  type ChecklistItem,
  type ChecklistCategory,
  type ChecklistResult,
} from './checklist-generator';

export {
  generateOutline,
  formatOutlineAsText,
  flattenOutline,
  type OutlineItem,
  type OutlineResult,
  type SectionInput,
} from './outline-generator';

// Package assembly
export {
  buildPackage,
  type VolumeFile,
  type GraphicFile,
  type PackageManifest,
  type PackageBuildResult,
} from './package-builder';
