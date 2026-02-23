---
phase: 05-tier-1-enterprise-intake
plan: 01
subsystem: database
tags: [supabase, postgresql, typescript, validation, sam-gov, uei, naics, cage, next-api]

# Dependency graph
requires: []
provides:
  - "Additive Supabase migration adding 10 Tier 1 columns to company_profiles table"
  - "ISOCMMIStatus and DCAAApprovedSystems TypeScript interfaces"
  - "Extended CompanyProfile interface with all Tier 1 blueprint fields"
  - "Validation library: validateUEI, validateNAICS, validateCAGE, validateWordCount, checkSAMStatus"
  - "Server-side UEI and CAGE validation in POST and PUT handlers of company profile API"
affects:
  - 05-tier-1-enterprise-intake (plans 02 and 03 — UI and gate enforcement depend on this data layer)
  - 06-multi-document-ingestion (proposal generation uses Tier 1 fields from company_profiles)
  - 09-draft-generation (win themes, differentiators, corporate overview feed into draft prompts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive-only SQL migrations using ALTER TABLE ADD COLUMN IF NOT EXISTS — never drop or recreate tables"
    - "JSONB columns for structured optional objects (iso_cmmi_status, dcaa_approved_systems) — queried as atomic units"
    - "TEXT[] arrays for list-type fields queried together with profile (socioeconomic_certs, enterprise_win_themes)"
    - "tier1_complete BOOLEAN flag as gateway sentinel — enforced by Plan 03 gate logic"
    - "Validation library as pure functions — same code runs server-side (API) and client-side (UX feedback)"
    - "Mock async service stubs with TODO for real API integration (checkSAMStatus / SAM.gov Entity API)"

key-files:
  created:
    - "supabase_tables/supabase-tier1-enterprise-migration.sql"
    - "lib/validation/tier1-validators.ts"
  modified:
    - "lib/supabase/company-types.ts"
    - "app/api/company/profile/route.ts"

key-decisions:
  - "TEXT[] for socioeconomic_certs instead of join table — standardized SAM.gov values always queried with profile for proposal generation"
  - "JSONB for iso_cmmi_status and dcaa_approved_systems — structured objects queried atomically, schema enforced by TypeScript types"
  - "All new CompanyProfile fields marked optional (?) — existing rows preserved with null/default values"
  - "checkSAMStatus is a mock returning Active for valid UEI format — real SAM.gov Entity API deferred until API key available"
  - "UEI validation enforces SAM.gov rule: no letters O or I (use 0 and 1 to avoid visual confusion)"
  - "Validation library is pure functions with no side effects — usable server-side and client-side without modification"
  - "tier1_complete defaults to false on every POST insert — only Plan 03 gate logic should set it true"

patterns-established:
  - "Validation-before-write pattern: API validates UEI/CAGE before any database operation, returns 400 with descriptive error"
  - "Additive migration pattern: every migration uses IF NOT EXISTS — safe to re-run"

requirements-completed: [TIER1-01, TIER1-02, TIER1-03, TIER1-04, TIER1-05]

# Metrics
duration: 15min
completed: 2026-02-23
---

# Phase 5 Plan 01: Tier 1 Enterprise Intake — Data Layer Summary

**Additive Supabase migration extending company_profiles with 10 Tier 1 blueprint fields, TypeScript interfaces for ISO/CMMI and DCAA systems, pure validation library for SAM.gov UEI/NAICS/CAGE formats, and server-side validation in the company profile API.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-23T16:13:32Z
- **Completed:** 2026-02-23T16:28:00Z
- **Tasks:** 3 of 3
- **Files modified:** 4

## Accomplishments

- Created additive migration adding 10 new columns to `company_profiles` (business_size, socioeconomic_certs, corporate_overview, core_services_summary, enterprise_win_themes, key_differentiators_summary, standard_management_approach, iso_cmmi_status, dcaa_approved_systems, tier1_complete)
- Created validation library with 5 exports covering all government contractor registration formats and word count limits — ready for both server and client use
- Updated `CompanyProfile` TypeScript interface with all Tier 1 fields and added `ISOCMMIStatus` / `DCAAApprovedSystems` interfaces
- Updated company profile API (POST and PUT handlers) to validate UEI and CAGE before database write, returning 400 with descriptive errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Tier 1 schema migration and update TypeScript types** - `0c881c3` (feat)
2. **Task 2: Create Tier 1 validation library** - `bccfd01` (feat)
3. **Task 3: Update company profile API route for Tier 1 fields** - `941af86` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase_tables/supabase-tier1-enterprise-migration.sql` - Additive ALTER TABLE migration adding 10 Tier 1 columns with CHECK constraints and indexes
- `lib/validation/tier1-validators.ts` - Pure validation functions: validateUEI, validateNAICS, validateCAGE, validateWordCount, checkSAMStatus (mock)
- `lib/supabase/company-types.ts` - Added ISOCMMIStatus and DCAAApprovedSystems interfaces; extended CompanyProfile with 10 optional Tier 1 fields
- `app/api/company/profile/route.ts` - Added UEI/CAGE validation in POST and PUT; added Tier 1 field defaults in POST insert

## Decisions Made

- TEXT[] for `socioeconomic_certs` and `enterprise_win_themes` rather than join tables — these are standardized enumerated values always fetched together with the profile for proposal generation; a join table would add query complexity with no benefit
- JSONB for `iso_cmmi_status` and `dcaa_approved_systems` — these are structured boolean maps treated as atomic units; TypeScript types enforce the shape at compile time
- All 10 new CompanyProfile fields marked optional (`?`) — existing database rows retain null/default values without migration breakage
- `tier1_complete` defaults to `false` on every POST — only Plan 03 gate logic should evaluate completeness and flip this flag
- `checkSAMStatus` implemented as a format-validity mock — real SAM.gov Entity API (api.sam.gov) deferred until API key is provisioned; TODO comment included for easy handoff
- UEI validation rejects letters O and I per actual SAM.gov specification (avoids visual confusion with digits 0 and 1)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit app/api/company/profile/route.ts` (single-file check) produced path alias errors for `@/lib/*` imports — pre-existing project condition noted in STATE.md. Full project check (`npx tsc --noEmit`) showed no errors in the route file. Not a new issue.

## User Setup Required

None — no external service configuration required for this plan. The SAM.gov API mock (checkSAMStatus) requires no API key. When real SAM.gov integration is ready, see the TODO comment in `lib/validation/tier1-validators.ts`.

## Next Phase Readiness

- Data layer complete — Plan 02 (UI) can build against the CompanyProfile type and API route
- Validation library ready for client-side import in Plan 02 form components (UEI/CAGE inline validation)
- Plan 03 (gate enforcement) has `tier1_complete` column ready to read and set
- No blockers

---
*Phase: 05-tier-1-enterprise-intake*
*Completed: 2026-02-23*
