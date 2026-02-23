---
phase: 05-tier-1-enterprise-intake
plan: 02
subsystem: frontend
tags: [react, nextjs, tailwind, tier1, forms, validation, sam-gov, uei, naics]

# Dependency graph
requires:
  - "05-01 (Tier 1 data layer: CompanyProfile types, tier1-validators, API routes)"
provides:
  - "3-tab Tier 1 Enterprise Intake UI at /company/profile"
  - "Tier1TabLayout: reusable sticky tab navigation wrapper"
  - "CorporateIdentityTab: full identity, registration, business classification, company details, contacts"
  - "VehiclesCertificationsTab: vehicles, ISO/CMMI/DCAA toggles, facility clearance, cert records"
  - "CapabilitiesPositioningTab: corporate overview, core services, win themes, differentiators, management approach"
affects:
  - 05-tier-1-enterprise-intake (plan 03 — gate enforcement reads tier1_complete, can now assess UI completeness)
  - future phases — all proposal generation draws from company profile fields captured here

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-tab independent form state: each tab uses useState, initializes from parent-fetched profile data, does NOT sync back to parent on every keystroke — switching tabs preserves unsaved work"
    - "Inline validation on blur: UEI, CAGE, NAICS fields call validators on blur, display red error text below field, block save on invalid state"
    - "SAM status badge: triggered after valid UEI blur via async checkSAMStatus mock, displays green/yellow/red pill beside field label"
    - "Toggle switch buttons: use role=switch + aria-checked for accessible toggles without importing UI library"
    - "Live word count indicator component: color-coded gray/yellow/red with over-max blocking save and under-min advisory warnings"
    - "Tag/list input pattern: add-on-Enter or button click, removable pill tags (used for DBA names, win themes, core values)"

key-files:
  created:
    - "app/components/tier1/Tier1TabLayout.tsx"
    - "app/components/tier1/CorporateIdentityTab.tsx"
    - "app/components/tier1/VehiclesCertificationsTab.tsx"
    - "app/components/tier1/CapabilitiesPositioningTab.tsx"
  modified:
    - "app/company/profile/page.tsx"

key-decisions:
  - "Each tab manages its own local form state — switching tabs preserves unsaved work in memory without lifting state to parent"
  - "CorporateIdentityTab handles primary_naics as a direct field (with title text beside it) even though it is not yet in CompanyProfile type — cast as any pending a minor type extension if needed"
  - "VehiclesCertificationsTab saves facility clearance via POST certifications API (upsert) as part of the main Save button flow, not as a separate inline save"
  - "WordCountIndicator is an inline sub-component in CapabilitiesPositioningTab — not extracted to shared lib since it is only used in this tab"
  - "Toggle switches implemented as button[role=switch] elements — avoids importing a UI component library while maintaining accessibility"

patterns-established:
  - "Tab form state isolation pattern: parent fetches once, passes as initialData prop, each tab initializes on mount and saves independently"
  - "Validation-before-save pattern: client-side validation runs in validateForm() before any API call, errors set in state, submit blocked"

requirements-completed: [TIER1-01, TIER1-03, TIER1-04, TIER1-06]

# Metrics
duration: ~8min
completed: 2026-02-23
---

# Phase 5 Plan 02: Tier 1 Enterprise Intake UI Summary

**3-tab Tier 1 enterprise intake form replacing the old profile page — Corporate Identity (registration, classification, contacts), Vehicles & Certifications (contract vehicles, ISO/CMMI/DCAA toggles, facility clearance), and Capabilities & Positioning (narrative fields with live word count enforcement and win theme tags).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-23T16:19:07Z
- **Completed:** 2026-02-23T16:27:00Z
- **Tasks:** 3 of 3
- **Files created/modified:** 5

## Accomplishments

- Created `Tier1TabLayout.tsx` — sticky tab bar with blue active indicator, supports any tab array, renders children below tabs
- Created `CorporateIdentityTab.tsx` — 5-section form covering the full Corporate Identity blueprint: Company Identity, Government Registration (UEI/CAGE with inline validation + SAM status badge), Business Classification (NAICS validation, business size, socioeconomic cert toggle grid), Company Details (address, financials), and Primary Contacts
- Created `VehiclesCertificationsTab.tsx` — contract vehicle add/display cards, ISO/CMMI/ITIL toggle switches with CMMI level selects, DCAA system toggle grid, facility clearance conditional form, and formal socioeconomic certification records
- Created `CapabilitiesPositioningTab.tsx` — live word count indicators on all narrative fields, enterprise win themes tag input with 3-theme recommendation, over-max word count blocks save, migrated elevator pitch / descriptions / core values from old page
- Rewrote `app/company/profile/page.tsx` as a thin wrapper: fetches profile once, renders `Tier1TabLayout` with 3 tab components, re-fetches on each tab's save callback

## Task Commits

Each task was committed atomically:

1. **Task 1: Tab layout and Corporate Identity tab** — `5bd099e` (feat)
2. **Task 2: Vehicles & Certifications tab** — `82efe65` (feat)
3. **Task 3: Capabilities & Positioning tab** — `80b652a` (feat)

## Files Created/Modified

- `app/components/tier1/Tier1TabLayout.tsx` — Sticky tab navigation wrapper, exported as named export `Tier1TabLayout`
- `app/components/tier1/CorporateIdentityTab.tsx` — Corporate Identity form with UEI/CAGE/NAICS validation, SAM badge, socioeconomic cert checkboxes
- `app/components/tier1/VehiclesCertificationsTab.tsx` — Contract vehicles, ISO/CMMI/DCAA toggles, facility clearance, cert records
- `app/components/tier1/CapabilitiesPositioningTab.tsx` — Narrative capability fields with live word count, win themes, migrated pitch/description fields
- `app/company/profile/page.tsx` — Rewritten as 3-tab intake page (complete replacement of old single-form profile)

## Decisions Made

- Each tab manages its own local form state: initializes from `initialData` prop on mount, saves independently via its own Save button, does not sync changes back to parent in real time — switching tabs preserves unsaved work in browser memory
- `primary_naics` and `primary_naics_title` are passed through as extra fields in the PUT payload even though they are not yet in the `CompanyProfile` TypeScript type — the API and database column exist from the migration; a type extension can be added in Plan 03 if needed
- Toggle switches are `button[role=switch]` elements rather than a third-party toggle library — maintains accessibility with zero added dependencies
- `WordCountIndicator` is an internal sub-component inside `CapabilitiesPositioningTab` — it is tab-specific and does not warrant extraction to a shared library at this stage
- Facility clearance is saved via the POST certifications API (upsert behavior) as part of the main Save button flow, not as a separate inline save, to simplify UX

## Deviations from Plan

None — plan executed exactly as written. The three tab components and the rewritten profile page were built precisely to the spec.

## Issues Encountered

- Pre-existing TypeScript errors in `.next/types/validator.ts` (params-need-await in Next.js 16 dynamic route handlers) produced output during `npx tsc --noEmit` but are unrelated to this plan. Zero errors in any of the five files created or modified by this plan. Confirmed by checking that no tier1 or profile/page path appeared in compiler error output.

## Next Phase Readiness

- All Tier 1 UI is complete — Plan 03 (tier1_complete gate enforcement) can build against the CompanyProfile type and the profile page is ready to show completion status
- The per-tab save architecture means gate logic can query individual field presence rather than checking a single form submission event
- No blockers

---
*Phase: 05-tier-1-enterprise-intake*
*Completed: 2026-02-23*
