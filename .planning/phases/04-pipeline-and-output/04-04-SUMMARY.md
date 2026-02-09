---
phase: 04-pipeline-and-output
plan: 04
subsystem: packaging
tags: [archiver, zip, download, package-builder, framework-9.1]

# Dependency graph
requires:
  - phase: 04-02
    provides: PDF conversion and temp file utilities
  - phase: 04-03
    provides: Checklist generation for Final_Submission
provides:
  - ZIP package assembly per Framework Part 9.1 PACKAGE_STRUCTURE
  - Download API endpoint for proposal packages
affects: [04-05, final-delivery, user-download]

# Tech tracking
tech-stack:
  added: []
  patterns: [archiver-zip, buffer-streaming, uint8array-response]

key-files:
  created:
    - lib/generation/pipeline/package-builder.ts
    - app/api/download/[proposalId]/route.ts
  modified:
    - lib/generation/pipeline/index.ts

key-decisions:
  - "Pre-generated PDFs in manifest (no on-demand conversion)"
  - "Maximum compression (zlib level 9) for ZIP"
  - "Uint8Array conversion for NextResponse body"
  - "maxDuration 300 for Vercel large package support"

patterns-established:
  - "buildPackage pattern: manifest input -> ZIP buffer output"
  - "Graceful PDF error tracking: log warnings but don't fail download"
  - "sanitizeFilename for cross-platform ZIP compatibility"

# Metrics
duration: 3min
completed: 2026-02-09
---

# Phase 4 Plan 04: Package Builder Summary

**ZIP package assembly per Framework Part 9.1 with download API using pre-generated PDFs from proposal storage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-09T13:04:31Z
- **Completed:** 2026-02-09T13:07:14Z
- **Tasks:** 3
- **Files created:** 2
- **Files modified:** 1

## Accomplishments

- Package builder following exact Framework Part 9.1 PACKAGE_STRUCTURE
- ZIP download endpoint at /api/download/[proposalId]
- Integration with checklist-generator for Submission_Checklist.xlsx
- Proper archiver error/warning handling
- Automatic temp directory cleanup via withTempDirectory

## Task Commits

Each task was committed atomically:

1. **Task 1: Create package-builder.ts** - `cc7ed67` (feat)
2. **Task 2: Create download API endpoint** - `540ea9f` (feat)
3. **Task 3: Update pipeline index exports** - `b40fb03` (feat)

## Framework Part 9.1 Structure

The package builder creates this exact structure:

```
/Proposal_[Solicitation#]/
  ├── Volume_I_Technical.docx
  ├── Volume_II_Management.docx
  ├── ...
  ├── Appendix_*.docx
  ├── Graphics/
  │   ├── OrgChart.png
  │   ├── TransitionTimeline.png
  │   └── ProcessDiagram.png
  └── Final_Submission/
      ├── [Pre-generated PDF versions]
      └── Submission_Checklist.xlsx
```

## Key Interfaces

### VolumeFile
```typescript
interface VolumeFile {
  name: string;           // e.g., 'Volume_I_Technical.docx'
  docxBuffer: Buffer;     // DOCX content
  pdfBuffer?: Buffer;     // Pre-generated PDF
  pdfError?: string;      // Error if PDF generation failed
  type: 'volume' | 'appendix' | 'matrix';
}
```

### PackageManifest
```typescript
interface PackageManifest {
  solicitationNumber: string;
  volumes: VolumeFile[];
  graphics: GraphicFile[];
}
```

### PackageBuildResult
```typescript
interface PackageBuildResult {
  success: boolean;
  zipBuffer?: Buffer;
  error?: string;
  manifest: { rootFolder, volumes, appendices, graphics, finalSubmission };
  pdfErrors?: string[];  // Volumes where PDF generation failed
}
```

## Implementation Details

1. **Pre-generated PDFs:** Per CONTEXT.md locked decision, PDFs are generated during proposal creation (stage2-response-generator), NOT during package download. The package-builder only assembles existing content.

2. **Archiver handling:** Explicitly handles both 'warning' and 'error' events per research pitfalls. ENOENT warnings are logged but non-fatal; other warnings are treated as errors.

3. **NextResponse compatibility:** Buffer converted to Uint8Array since NextResponse body requires BodyInit type.

4. **Vercel configuration:** maxDuration = 300 (5 minutes) for large package generation.

## Files Created/Modified

- `lib/generation/pipeline/package-builder.ts` - ZIP package assembly (207 lines)
- `app/api/download/[proposalId]/route.ts` - Download endpoint (126 lines)
- `lib/generation/pipeline/index.ts` - Added package-builder exports

## Decisions Made

- **Pre-generated PDFs:** Honor CONTEXT.md decision - no on-demand PDF conversion
- **Max compression:** zlib level 9 for smallest ZIP file size
- **Buffer to Uint8Array:** Required for NextResponse body type compatibility
- **Filename sanitization:** Replace invalid chars, spaces to underscores, limit 100 chars

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed NextResponse Buffer incompatibility**
- **Found during:** Task 2 verification
- **Issue:** `new NextResponse(buffer)` fails - Buffer not assignable to BodyInit
- **Fix:** Convert to Uint8Array: `new Uint8Array(buffer)`
- **Files modified:** app/api/download/[proposalId]/route.ts
- **Verification:** TypeScript compiles successfully
- **Committed in:** 540ea9f

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor fix for type compatibility, plan otherwise executed as written.

## Verification Results

- TypeScript compilation: PASS (no errors for new files)
- Package structure: Framework Part 9.1 compliant
- ZIP contains: Graphics/, Final_Submission/ subdirectories
- Checklist inclusion: Submission_Checklist.xlsx in Final_Submission/
- Download endpoint: Returns proper headers (Content-Type, Content-Disposition)

## Pipeline Module Complete

The pipeline barrel export now includes all Phase 4 functionality:

```typescript
import {
  // Page tracking
  PageTracker, createVolumeTrackers,
  // Content condensing
  condenseContent, condenseContentCallback, condenseContentMultiPass,
  // PDF conversion
  convertToPdf, checkLibreOfficeAvailable,
  // Temp files
  withTempDirectory, createTempFile,
  // Checklist
  generateChecklist, FRAMEWORK_CHECKLIST,
  // Outline
  generateOutline, formatOutlineAsText, flattenOutline,
  // Package assembly
  buildPackage, VolumeFile, GraphicFile, PackageManifest, PackageBuildResult,
} from '@/lib/generation/pipeline';
```

## Next Phase Readiness

Ready for Plan 04-05 (Output Verification):
- Package builder available for end-to-end testing
- All pipeline utilities complete
- Download endpoint ready for integration

---
*Phase: 04-pipeline-and-output*
*Completed: 2026-02-09*
