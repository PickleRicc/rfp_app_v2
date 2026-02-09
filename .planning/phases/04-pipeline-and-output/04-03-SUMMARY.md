---
phase: 04-pipeline-and-output
plan: 03
subsystem: quality-control
tags: [excel, checklist, outline, exceljs, framework-10.1]
dependency-graph:
  requires: [04-01, 04-02]
  provides: [checklist-generation, outline-view]
  affects: [04-04, 04-05]
tech-stack:
  added: []
  patterns: [excel-generation, hierarchical-outline]
key-files:
  created:
    - lib/generation/pipeline/checklist-generator.ts
    - lib/generation/pipeline/outline-generator.ts
  modified:
    - lib/generation/pipeline/index.ts
decisions:
  - Simple list validation for Excel dropdowns (avoid ExcelJS bugs)
  - Color-code status cells for visual scanning
  - 4-level heading hierarchy matching framework
metrics:
  duration: ~4 min
  completed: 2026-02-09
---

# Phase 4 Plan 03: Checklist and Outline Summary

**One-liner:** Excel checklist generator with Framework Part 10.1 categories plus hierarchical outline extractor for proposal structure review.

## What Was Built

### Checklist Generator (checklist-generator.ts)

Quality checklist Excel generation per Framework Part 10.1:

- **FRAMEWORK_CHECKLIST constant** with 4 locked categories:
  - COMPLIANCE: Section L requirements, page limits, format specs, cover letter, compliance matrix
  - CONTENT: Requirement coverage, win themes, past performance relevance, staffing alignment, claim validation
  - FORMATTING: TOC accuracy, exhibit numbering, headers/footers, orphan headings, table captions
  - FINAL_CHECKS: Spelling, acronyms, track changes, PDF matching, file naming

- **generateChecklist()** function:
  - Creates Excel workbook with ExcelJS
  - Status dropdown validation (PASS/FAIL/N/A/NEEDS REVIEW)
  - Color-coded status cells (green=pass, red=fail, yellow=needs review)
  - Accepts optional autoCheckResults map for pre-checked items
  - Returns buffer for direct file writing

### Outline Generator (outline-generator.ts)

Document structure extraction for quick review:

- **generateOutline()** function:
  - Builds hierarchical structure from section inputs
  - Supports 4 heading levels
  - Tracks page estimates per section
  - Counts exhibits for summary stats

- **formatOutlineAsText()** function:
  - Text-based output for display or export
  - Visual markers for heading levels
  - Summary footer with total pages and exhibit count

- **flattenOutline()** helper:
  - Returns flat list of all sections
  - Useful for TOC generation

### Pipeline Index Updates

All pipeline exports now accessible from single path:
```typescript
import {
  generateChecklist,
  FRAMEWORK_CHECKLIST,
  generateOutline,
  formatOutlineAsText,
  flattenOutline,
  // ... plus existing page-tracker, content-condenser, pdf-converter
} from '@/lib/generation/pipeline';
```

## Implementation Decisions

1. **Simple list validation for dropdowns** - Used `'"PASS,FAIL,N/A,NEEDS REVIEW"'` string format to avoid ExcelJS validation bugs discovered in research

2. **Color-coded status cells** - Light green (#D9EAD3) for pass, light red (#F4CCCC) for fail, light yellow (#FFF2CC) for needs review

3. **4-level heading hierarchy** - Matches existing framework pattern (1=volume, 2=section, 3/4=subsection)

4. **Validation after formatting** - Apply data validation to cells after all other styling per ExcelJS best practices

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

- ExcelJS already installed per STACK.md (v4.4.0)
- Pre-existing TypeScript errors in Next.js route handlers (params need await) - not related to this work
- All new files compile successfully with project tsconfig

## Commits

| Hash | Message |
|------|---------|
| c253d59 | feat(04-03): create checklist-generator with Framework Part 10.1 categories |
| d9f10e6 | feat(04-03): create outline-generator for structure view |
| 172be7c | feat(04-03): update pipeline index with checklist and outline exports |

## Verification Results

- TypeScript compilation: PASS (no errors for pipeline files)
- FRAMEWORK_CHECKLIST categories: 4/4 (COMPLIANCE, CONTENT, FORMATTING, FINAL_CHECKS)
- Outline heading levels: 4/4 supported
- All exports accessible from lib/generation/pipeline: PASS

## Next Phase Readiness

Ready for Plan 04-04 (Package Builder):
- Checklist generation available for inclusion in submission package
- Outline available for quick reference generation
- Pipeline module complete for integration
