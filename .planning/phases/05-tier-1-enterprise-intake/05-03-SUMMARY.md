---
phase: 05-tier-1-enterprise-intake
plan: 03
subsystem: api
tags: [typescript, nextjs, completeness-scoring, upload-gate, progress-bar, react, supabase, validation]

# Dependency graph
requires:
  - "05-01 (Tier 1 data layer: CompanyProfile types, tier1-validators, tier1_complete flag, API routes)"
  - "05-02 (Tier 1 UI: 3-tab profile page, per-tab save callbacks, CapabilitiesPositioningTab narrative fields)"
provides:
  - "Tier 1 completeness calculator scoring profiles 0-100 across 3 weighted sections"
  - "GET /api/company/tier1-status endpoint returning score, sections, missing fields, and isComplete flag"
  - "Tier1CompletenessBar React component with color-coded progress and missing field hints"
  - "Mandatory Tier 1 gate on RFP upload: returns 403 with TIER1_INCOMPLETE code when tier1_complete is false"
  - "Auto-sync of tier1_complete flag after every profile PUT save — no manual mark-complete step"
affects:
  - 06-multi-document-ingestion (upload route now has Tier 1 gate — any document upload flow must handle TIER1_INCOMPLETE 403)
  - 09-draft-generation (isTier1Complete logic sets precedent for draft generation gate)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-computed boolean flag as gate sentinel: tier1_complete is checked on upload (single column SELECT) rather than recalculating completeness on every request — auto-synced by profile PUT handler"
    - "Weighted section scoring: completeness divided into Corporate Identity (35pts), Vehicles & Certs (25pts), Capabilities (40pts) — partial completion is tracked and surfaced"
    - "80-point completion threshold with mandatory identity floor: isTier1Complete requires score >= 80 AND valid UEI, CAGE, SAM Active, business_size — prevents passing on capabilities alone"
    - "Color-coded progress bar: red 0-39%, yellow 40-79%, green 80-100% — visual cue matches government contractor pipeline urgency"

key-files:
  created:
    - "lib/validation/tier1-completeness.ts"
    - "app/api/company/tier1-status/route.ts"
    - "app/components/tier1/Tier1CompletenessBar.tsx"
  modified:
    - "app/api/upload/route.ts"
    - "app/api/company/profile/route.ts"
    - "app/company/profile/page.tsx"
    - "lib/supabase/company-types.ts"

key-decisions:
  - "Upload gate checks pre-computed tier1_complete flag (single column) not live completeness calculation — avoids expensive recalculation on every upload request"
  - "isTier1Complete threshold is 80 (not 100) with mandatory Corporate Identity floor — allows informational fields (ISO/CMMI, DCAA) to remain incomplete without blocking the gate"
  - "tier1_complete auto-syncs after every profile PUT — eliminates a separate 'mark complete' UX step that would add friction and error risk"
  - "Vehicles & Certs section always awards full ISO/CMMI and DCAA points — these are informational fields, not gatekeeping requirements"
  - "socioeconomic_certs check respects Large Business carve-out: score awarded when has certs OR business_size is 'Large'"

patterns-established:
  - "Gate-with-precomputed-flag pattern: expensive validation computed on write, cheap boolean checked on read — apply to all future upload/generation gates"
  - "Section-based completeness scoring: weighted subsections with human-readable missing field messages linked to profile tab navigation"

requirements-completed: [TIER1-05, TIER1-06]

# Metrics
duration: ~15min
completed: 2026-02-23
---

# Phase 5 Plan 03: Tier 1 Enterprise Intake — Completeness & Gate Summary

**Tier 1 completeness calculator (0-100 weighted score across 3 sections), color-coded progress bar, /api/company/tier1-status endpoint, and mandatory RFP upload gate blocking requests when tier1_complete is false — flag auto-syncs after every profile save.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-23T16:28:00Z
- **Completed:** 2026-02-23
- **Tasks:** 3 of 3 (including human-verify checkpoint — approved)
- **Files modified:** 7

## Accomplishments

- Created `lib/validation/tier1-completeness.ts` with three exports: `calculateTier1Completeness` (returns score, sections, isComplete), `getTier1MissingFields` (human-readable list with tab navigation hints), and `isTier1Complete` (80-point threshold + Corporate Identity floor)
- Created `GET /api/company/tier1-status` endpoint that fetches profile, queries contract vehicle and NAICS counts, calls the calculator, and returns completeness data ready for client rendering
- Created `Tier1CompletenessBar` React component with color-coded progress (red/yellow/green), section breakdown scores, missing field bullet list with tab hints, and green checkmark when complete
- Enforced Tier 1 gate in `app/api/upload/route.ts`: single-column query on `tier1_complete`, returns 403 with `TIER1_INCOMPLETE` code when false — existing upload logic unchanged for complete profiles
- Added auto-sync of `tier1_complete` flag to `app/api/company/profile/route.ts` PUT handler: recalculates after every save, updates flag only when it changes, returns `tier1Complete` in response — no manual mark-complete step required
- Human verified: end-to-end flow from empty profile through completion to successful upload confirmed working

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Tier 1 completeness calculator and status API** — `2e0d2a8` (feat)
2. **Task 2: Enforce mandatory Tier 1 gate on RFP upload and auto-set tier1_complete flag** — `f8a499b` (feat)
3. **Task 3: Verify complete Tier 1 Enterprise Intake flow** — APPROVED by human (checkpoint, no code commit)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `lib/validation/tier1-completeness.ts` — Completeness calculator: calculateTier1Completeness, getTier1MissingFields, isTier1Complete; Tier1Completeness type interface
- `app/api/company/tier1-status/route.ts` — GET endpoint: fetches profile + vehicle/NAICS counts, returns score, sections, missingFields, isComplete
- `app/components/tier1/Tier1CompletenessBar.tsx` — Color-coded progress bar: red/yellow/green, section breakdown, missing field hints, green checkmark when complete
- `app/api/upload/route.ts` — Added Tier 1 gate: single-column tier1_complete check, 403 + TIER1_INCOMPLETE on failure
- `app/api/company/profile/route.ts` — Added auto-sync: recalculates and updates tier1_complete after every PUT save
- `app/company/profile/page.tsx` — Integrated Tier1CompletenessBar above tab layout
- `lib/supabase/company-types.ts` — Added Tier1Completeness interface

## Decisions Made

- Upload gate uses pre-computed `tier1_complete` flag (single-column SELECT) rather than live completeness recalculation — avoids joins and scoring logic on every upload request; flag is kept current by the profile save handler
- Completion threshold is 80 (not 100) with a mandatory Corporate Identity floor (valid UEI, CAGE, SAM Active, business_size) — informational fields like ISO/CMMI certification levels can remain blank without blocking the gate
- ISO/CMMI and DCAA sections always receive full points — these describe current state informatively; blocking upload on their absence would penalize new or small companies unfairly
- `socioeconomic_certs` scoring includes a Large Business carve-out: Large businesses typically don't hold small business certifications, so the section score is awarded when `business_size == 'Large'` even with no certs set

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript route handler errors (Next.js 16 params-need-await) produced output during `npx tsc --noEmit` but are unrelated to this plan's files. Zero errors in the files created or modified by this plan.

## User Setup Required

None — no external service configuration required. The Tier 1 gate and completeness calculator operate entirely within existing Supabase + Next.js infrastructure.

## Next Phase Readiness

- Tier 1 Enterprise Intake is fully complete: data layer (05-01), UI (05-02), and gate enforcement (05-03)
- Phase 6 (Multi-Document Ingestion) must handle the TIER1_INCOMPLETE 403 response in any upload client code
- The `isTier1Complete` logic and gate-with-precomputed-flag pattern are ready to serve as a template for the draft generation gate in Phase 9
- No blockers

## Self-Check

**Files verified:**
- `lib/validation/tier1-completeness.ts` — FOUND (committed in 2e0d2a8)
- `app/api/company/tier1-status/route.ts` — FOUND (committed in 2e0d2a8)
- `app/components/tier1/Tier1CompletenessBar.tsx` — FOUND (committed in 2e0d2a8)
- `app/api/upload/route.ts` — FOUND (committed in f8a499b)
- `app/api/company/profile/route.ts` — FOUND (committed in f8a499b)

**Commits verified:**
- `2e0d2a8` feat(05-03): create Tier 1 completeness calculator, status API, and progress bar — FOUND
- `f8a499b` feat(05-03): enforce Tier 1 gate on upload and auto-update tier1_complete flag — FOUND

## Self-Check: PASSED

---
*Phase: 05-tier-1-enterprise-intake*
*Completed: 2026-02-23*
