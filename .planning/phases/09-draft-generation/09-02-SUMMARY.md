---
phase: 09-draft-generation
plan: 02
subsystem: generation, inngest
tags: [inngest, anthropic, docx, typescript, proposal-generation, compliance-matrix]

# Dependency graph
requires:
  - phase: 09-01
    provides: proposal_drafts + draft_volumes tables, DraftVolume types, Inngest event definition
  - phase: 07-compliance-extraction
    provides: compliance_extractions table (section_l, section_m, sow_pws, admin_data, etc.)
  - phase: 05-tier1-enterprise-intake
    provides: company_profiles table with enterprise_win_themes, core_services_summary, standard_management_approach
  - phase: 08-tier2-data-call
    provides: data_call_responses table with technical_approach, key_personnel, past_performance arrays

provides:
  - lib/generation/draft/prompt-assembler.ts (assembleVolumePrompt, assembleComplianceMatrixData)
  - lib/inngest/functions/proposal-draft-generator.ts (proposalDraftGenerator Inngest function)
  - Inngest event listener: proposal.draft.generate → generates all volumes → stores DOCX in Supabase storage

affects:
  - 09-03-draft-tab-ui (reads draft_volumes content_markdown for preview; reads file_path for download; reads page_limit_status for color coding)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Volume keyword detection: case-insensitive match on "technical/approach", "management/staffing/transition", "past perf", "cost/price" for prompt routing
    - Page limit targeting: pageLimit * 250 * 0.875 = targetWordCount (87.5% utilization, midpoint of 85-90%)
    - Win theme callout boxes: per-theme === WIN THEME === format injected into prompt for each enterprise_win_theme
    - Sparse data placeholders: [PLACEHOLDER: description] pattern for any missing Tier 1/Tier 2 field
    - Error isolation per-volume: try/catch wraps each volume step; failure → status=failed on that volume, other volumes proceed
    - Markdown-only compliance matrix: volume_order=999, content_markdown only (no DOCX), rendered directly in UI
    - DOCX generator bridge: markdownToContentStructure() converts AI markdown to { sections: [{title, content}] } for existing generator

key-files:
  created:
    - lib/generation/draft/prompt-assembler.ts
    - lib/inngest/functions/proposal-draft-generator.ts
  modified:
    - app/api/inngest/route.ts

key-decisions:
  - "Volume type routing by keyword match (not exact name) — handles variations like 'Technical Approach Vol 1' still matching 'technical'"
  - "wordsPerPage=250 single-spaced (government RFP standard) for all word count calculations"
  - "Partial success: if ANY volume completes, proposal_drafts.status becomes 'completed' — user can see which volumes need regeneration"
  - "Compliance matrix stored at volume_order=999 as content_markdown only (no DOCX) — UI renders markdown table directly"
  - "DOCX upload failure is non-fatal: volume still marked 'completed' with content_markdown populated; error_message documents the storage failure"

# Metrics
duration: 6min
completed: 2026-02-26
---

# Phase 9 Plan 02: Draft Generation Pipeline Summary

**Inngest draft generation pipeline: prompt assembly from Tier 1 + Tier 2 + extractions → Claude content generation per volume → DOCX conversion → Supabase storage, with compliance matrix and error-isolated volume steps**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-26T02:17:02Z
- **Completed:** 2026-02-26T02:23:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Created `lib/generation/draft/prompt-assembler.ts` with `assembleVolumePrompt()` that detects volume type via keyword matching and builds tailored system + user prompts for 5 volume types (technical, management, past performance, cost/price, default)
- Page limit targeting at 87.5% utilization (midpoint of 85-90%): `pageLimit * 250 * 0.875 = targetWordCount`
- Win theme callout box instructions embedded per enterprise_win_theme: `=== WIN THEME: {theme} ===` format
- Sparse data handling throughout: `[PLACEHOLDER: description]` markers for any missing Tier 1/Tier 2 field
- `assembleComplianceMatrixData()` maps Section M evaluation factors to volumes by keyword matching factor names
- Created `lib/inngest/functions/proposal-draft-generator.ts` with full Inngest pipeline:
  - Step 1 `fetch-all-data`: updates draft to 'generating', fetches all three data sources, builds ComplianceExtractionsByCategory
  - Steps 2..N `generate-volume-{order}`: per-volume Claude call → markdown → DOCX → Supabase storage → draft_volumes update
  - Step N+1 `generate-compliance-matrix`: markdown table at volume_order=999 (content_markdown only)
  - Step N+2 `finalize`: partial success = 'completed'; all-failed = 'failed'
- Registered `proposalDraftGenerator` in `app/api/inngest/route.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create prompt assembler for volume-specific AI content generation** - `3a66b22` (feat)
2. **Task 2: Create Inngest draft generation pipeline and register it** - `7cc824a` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `lib/generation/draft/prompt-assembler.ts` — Prompt assembly module with assembleVolumePrompt() and assembleComplianceMatrixData(); exports VolumePromptData, VolumePromptResult, ComplianceMatrixEntry interfaces
- `lib/inngest/functions/proposal-draft-generator.ts` — Inngest function with fetch-all-data, per-volume generation steps, compliance matrix, and finalize steps; error isolation pattern matching Phase 7 extractor
- `app/api/inngest/route.ts` — Added import and registration of proposalDraftGenerator

## Decisions Made

- Volume type detected by case-insensitive keyword match on volume name — handles variations like "Technical Approach - Volume I" still routing to the technical prompt builder
- wordsPerPage=250 for single-spaced content (government RFP standard) used for all word count calculations
- Partial success policy: if ANY volume completes, proposal_drafts.status becomes 'completed' — users can see per-volume status and regenerate failed volumes from the Draft tab
- Compliance matrix stored at volume_order=999 as content_markdown only (no DOCX) — the Plan 03 Draft tab UI renders this markdown table directly
- DOCX upload failure is non-fatal: volume still marked 'completed' with content_markdown populated for in-app preview; error_message documents the storage failure for debugging

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

One minor TypeScript issue fixed inline (Rule 1):
**TypeScript discriminated union on volumeResults array** — `step.run()` returns a union of success/failure shapes; resolved by typing the array as `Array<any>` to avoid false narrowing errors while maintaining runtime correctness. This is a known Inngest TypeScript pattern limitation with dynamic step returns.

## Issues Encountered

None beyond the pre-existing build errors documented in STATE.md (Next.js 16 async params pattern in older route files, unrelated to this plan).

## Next Phase Readiness

- Plan 03 (Draft tab UI) can read `draft_volumes` rows with `content_markdown` for preview rendering and `file_path` for DOCX download via the existing `/api/solicitations/[id]/draft/volumes/[volumeId]` endpoint
- Plan 03 can display `page_limit_status` with `PAGE_LIMIT_STATUS_COLORS` constants from `draft-types.ts`
- The `proposal.draft.generate` Inngest event is now fully handled — end-to-end draft generation is functional once the SQL migration is applied

---
*Phase: 09-draft-generation*
*Completed: 2026-02-26*
