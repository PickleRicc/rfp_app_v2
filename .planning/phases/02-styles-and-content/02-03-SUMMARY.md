---
phase: 02-styles-and-content
plan: 03
subsystem: content-generation
tags: [compliance-matrix, page-estimation, docx]

# Dependency graph
requires:
  - phase: 01-logos-and-branding
    provides: Foundation for document generation system
provides:
  - Compliance matrix with estimated page numbers based on section content
  - Page estimation utilities for calculating document page numbers
  - Section-to-page mapping with fuzzy title matching
affects: [future-compliance-features, volume-generation, page-tracking]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Content-based page estimation for proposal documents"
    - "Fuzzy section title matching for page number lookup"
    - "Optional sections parameter with graceful fallback"

key-files:
  created: []
  modified:
    - lib/generation/planning/page-estimator.ts
    - lib/generation/volumes/compliance-matrix.ts

key-decisions:
  - "Use character count and paragraph count heuristics for page estimation"
  - "Display page numbers in 'Section X.X (pg Y)' format"
  - "Fuzzy match section titles for robust page number lookup"
  - "Add table note explaining page numbers are estimates"

patterns-established:
  - "Page estimation: ~3000 chars/page, ~3 paragraphs/page"
  - "Front matter accounting: cover + TOC + cover letter = 4 pages"
  - "Optional parameter pattern for backward compatibility"

# Metrics
duration: 3min
completed: 2026-02-04
---

# Phase 2 Plan 3: Page Number Estimation Summary

**Compliance matrix displays estimated page numbers using section-based calculation with graceful fallback to TBD**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-04T15:27:00Z
- **Completed:** 2026-02-04T15:30:02Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Page estimation logic calculates page numbers from section content size
- Compliance matrix integrates page numbers with "Section X.X (pg Y)" display format
- Fuzzy section title matching enables robust page number lookup
- Graceful fallback to TBD when sections not provided

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement page estimation logic** - `23cf759` (feat)
2. **Task 2: Update compliance matrix to use page estimates** - `e1ff500` (feat)

## Files Created/Modified
- `lib/generation/planning/page-estimator.ts` - Added estimateSectionPages, calculateSectionPageNumbers, and getSectionPageNumber functions with page estimation constants
- `lib/generation/volumes/compliance-matrix.ts` - Integrated page estimation, added formatAddressedIn helper, modified generateComplianceMatrix to accept sections parameter

## Decisions Made

**Page estimation heuristics:**
- **Decision:** Use 3000 characters per page and 3 paragraphs per page as estimation baseline
- **Rationale:** Provides reasonable approximation for typical proposal formatting with 1-inch margins and 11pt font

**Display format:**
- **Decision:** Show page numbers as "Section X.X (pg Y)" in compliance matrix
- **Rationale:** Clear, concise format that matches industry standard proposal conventions

**Fuzzy matching:**
- **Decision:** Implement fuzzy title matching for section lookup (case-insensitive, partial matches)
- **Rationale:** Handles variations in section title formatting between mappings and section definitions

**Optional sections parameter:**
- **Decision:** Make sections parameter optional with graceful fallback to TBD
- **Rationale:** Maintains backward compatibility, allows compliance matrix to work without section data

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Compliance matrix ready for integration with volume generation
- Page estimation system ready for use in other document components
- Framework Section 2.3 (Compliance Matrix) requirements satisfied
- No blockers for continuing with remaining Phase 2 plans

---
*Phase: 02-styles-and-content*
*Completed: 2026-02-04*
