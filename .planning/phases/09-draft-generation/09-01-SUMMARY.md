---
phase: 09-draft-generation
plan: 01
subsystem: api, database
tags: [supabase, inngest, typescript, next.js, docx, proposal-generation]

# Dependency graph
requires:
  - phase: 08-tier2-data-call
    provides: data_call_responses table with status='completed' prerequisite for draft triggering
  - phase: 07-compliance-extraction
    provides: compliance_extractions table with section_l volume_structure and section_m evaluation_factors
  - phase: 05-tier1-enterprise-intake
    provides: company_profiles table with win themes, differentiators, and corporate identity fields

provides:
  - proposal_drafts table with status lifecycle and UNIQUE(solicitation_id, company_id) constraint
  - draft_volumes table with per-volume status, page limit tracking, and Supabase storage path
  - StrategyConfirmation interface assembling read-only summary from Tier 1 + Tier 2 + extractions
  - GET /api/solicitations/[id]/draft endpoint returning DraftGetResponse
  - POST /api/solicitations/[id]/draft endpoint validating data call, creating records, sending Inngest event
  - GET /api/solicitations/[id]/draft/volumes/[volumeId] endpoint serving DOCX binary download

affects:
  - 09-02-draft-generation-pipeline (Inngest pipeline writes to proposal_drafts and draft_volumes using these tables)
  - 09-03-draft-tab-ui (Draft tab UI reads DraftGetResponse from GET endpoint; uses DraftStatus/VolumeStatus/PageLimitStatus display constants)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Strategy assembly pattern: query three data sources (Tier 1 profiles, Tier 2 data call, extractions) and merge into single typed interface
    - Regeneration overwrite pattern: upsert draft row + delete/recreate volumes (no versioning per CONTEXT.md decision)
    - Binary DOCX download: Supabase storage download → ArrayBuffer → NextResponse with correct Content-Type and Content-Disposition headers
    - Default volume fallback: if Section L extracts no volume_structure, fall back to 4-volume default (Technical Approach, Management, Past Performance, Cost/Price)

key-files:
  created:
    - supabase_tables/supabase-draft-generation-migration.sql
    - lib/supabase/draft-types.ts
    - app/api/solicitations/[id]/draft/route.ts
    - app/api/solicitations/[id]/draft/volumes/[volumeId]/route.ts
  modified: []

key-decisions:
  - "Regeneration overwrites existing draft (no versioning) — upsert proposal_drafts + delete/recreate draft_volumes on each POST trigger"
  - "Default 4-volume fallback (Technical Approach, Management, Past Performance, Cost/Price) when Section L extraction has no volume_structure"
  - "Volume download verifies company ownership via JOIN (draft_volumes → proposal_drafts.company_id) — prevents cross-company data access"
  - "Strategy confirmation assembled at GET time from live data (not cached) — always reflects latest Tier 1/Tier 2/extraction state"
  - "Page limit tracking uses database-level CHECK (under | warning | over) matching CONTEXT.md color coding spec"

patterns-established:
  - "Three-source assembly: separate Supabase queries for Tier 1, Tier 2, and extractions — merged in application layer into StrategyConfirmation"
  - "Draft trigger validation gate: POST returns 400 with clear message if data_call_responses.status != completed"
  - "Inngest event naming: proposal.draft.generate with { solicitationId, companyId, draftId } payload"

requirements-completed: [DRAFT-01, DRAFT-02]

# Metrics
duration: 4min
completed: 2026-02-26
---

# Phase 9 Plan 01: Draft Generation Data Layer Summary

**SQL schema + TypeScript types + REST API foundation for proposal draft generation: strategy confirmation endpoint assembling Tier 1/Tier 2/extraction data, draft trigger POST validating data call completion, and DOCX volume download endpoint**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-26T02:09:16Z
- **Completed:** 2026-02-26T02:13:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `proposal_drafts` and `draft_volumes` tables with proper CHECK constraints, FK references, UNIQUE constraint (one draft per solicitation per company), RLS policies, and indexes
- Exported all TypeScript types (DraftStatus, VolumeStatus, PageLimitStatus, ProposalDraft, DraftVolume, StrategyConfirmation, DraftGetResponse) plus display constants for Plans 02 and 03
- Built GET endpoint that assembles StrategyConfirmation from three independent Supabase queries (company_profiles for Tier 1 identity/themes, data_call_responses for Tier 2 opportunity details/personnel, compliance_extractions for Section L volumes and Section M eval factors)
- Built POST endpoint with data call completion gate (400 rejection), draft record upsert, volume deletion for regeneration, volume creation from Section L, and Inngest event dispatch
- Built volume DOCX download endpoint with ownership verification via JOIN and correct DOCX MIME type/Content-Disposition headers

## Task Commits

Each task was committed atomically:

1. **Task 1: Database schema and TypeScript types for draft generation** - `541caf8` (feat)
2. **Task 2: Strategy confirmation, draft trigger, status, and download API endpoints** - `f7c517e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `supabase_tables/supabase-draft-generation-migration.sql` - proposal_drafts and draft_volumes tables with CHECK constraints, FK references, UNIQUE constraints, RLS policies, and indexes
- `lib/supabase/draft-types.ts` - TypeScript types for all draft generation interfaces and display constants
- `app/api/solicitations/[id]/draft/route.ts` - GET (strategy confirmation assembly) and POST (draft trigger + Inngest event) handlers
- `app/api/solicitations/[id]/draft/volumes/[volumeId]/route.ts` - DOCX binary download handler with company ownership verification

## Decisions Made
- Regeneration overwrites existing draft (no versioning) per CONTEXT.md: "Regenerate Draft button replaces the old draft (no versioning)"
- Default 4-volume structure used as fallback when Section L extraction has no volume_structure — prevents blocking users when extraction is partial
- Volume download JOIN on proposal_drafts.company_id prevents cross-company data access without requiring a separate solicitation ownership query
- Strategy assembled live at GET time (not cached) — always reflects latest data call edits or profile updates

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in unrelated route files (non-async params pattern from older Next.js) are documented in STATE.md and were not caused by this plan.

## User Setup Required

None — no external service configuration required. The `proposal.draft.generate` Inngest event is defined but the handler function is created in Plan 02.

## Next Phase Readiness
- Plan 02 (Inngest generation pipeline) can use `proposal_drafts` and `draft_volumes` tables, write volume content and DOCX paths, and listen for the `proposal.draft.generate` event
- Plan 03 (Draft tab UI) can call GET /api/solicitations/[id]/draft for DraftGetResponse and use all exported display constants
- SQL migration must be applied to Supabase before Plans 02 or 03 can function end-to-end

---
*Phase: 09-draft-generation*
*Completed: 2026-02-26*
