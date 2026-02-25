---
phase: 08-tier2-dynamic-data-call
plan: "02"
subsystem: ui
tags: [accordion, form, data-call, past-performance, technical-approach, opportunity-details]
dependency_graph:
  requires: [08-01]
  provides: [08-03]
  affects: [proposal-generation]
tech_stack:
  added: []
  patterns: [accordion-multi-open, dirty-detection-json-stringify, beforeunload-guard, dynamic-card-count]
key_files:
  created:
    - app/components/datacall/DataCallView.tsx
    - app/components/datacall/OpportunityDetailsSection.tsx
    - app/components/datacall/PastPerformanceSection.tsx
    - app/components/datacall/TechnicalApproachSection.tsx
  modified:
    - app/solicitations/[id]/page.tsx
decisions:
  - "DataCallView uses JSON.stringify dirty detection — simple and reliable for nested form state"
  - "PastPerformanceSection initializes from section.dynamic_count when data array is empty — respects extraction count on first render"
  - "renderSection is a standalone function outside component — avoids hook-in-conditional pattern"
  - "TechnicalApproachSection description banner only renders when section.description is truthy — no empty blue box"
metrics:
  duration_minutes: 4
  completed: 2026-02-25
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 8 Plan 02: Tier 2 Data Call UI (Accordion Form) Summary

**One-liner:** Accordion-based Data Call tab with fetch/save/dirty-detection container, Opportunity Details form (6 pre-filled extraction fields), dynamic Past Performance cards (add/remove), and Technical Approach 5-textarea section — all with inline RFP citations.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | DataCallView container and Opportunity Details section | 437d663 | DataCallView.tsx, OpportunityDetailsSection.tsx, page.tsx |
| 2 | Past Performance and Technical Approach sections | ffa44fd | PastPerformanceSection.tsx, TechnicalApproachSection.tsx |

## What Was Built

### Task 1: DataCallView Container and Opportunity Details

**`app/components/datacall/DataCallView.tsx`** — main Data Call accordion container:

- **Props:** `{ solicitationId: string, companyId: string }`
- **On mount:** fetches GET `/api/solicitations/{id}/data-call` with `X-Company-Id` header, merges response data with extraction defaults
- **Multi-open accordion:** `openSections: Set<string>` — each section header toggle adds/removes from set independently
- **Section icons:** Briefcase, Trophy, Users, Lightbulb, ShieldCheck mapped by section id
- **Section completion:** `isSectionComplete()` checks all `required: true` fields are non-empty; past_performance checks each card's required fields; key_personnel auto-completes when empty array (no positions required)
- **Save Progress button:** calls PUT with full formData, updates `savedData` on success, disabled when `!isDirty`
- **Dirty detection:** `JSON.stringify(formData) !== JSON.stringify(savedData)`
- **beforeunload guard:** registers/cleans up on mount/unmount, fires only when `isDirty`
- **Section router:** opportunity_details → OpportunityDetailsSection, past_performance → PastPerformanceSection, technical_approach → TechnicalApproachSection, key_personnel/compliance_verification → placeholder divs
- **Error/loading states:** Skeleton Loader2 spinner and retry-button error card following ComplianceExtractionView pattern

**`app/components/datacall/OpportunityDetailsSection.tsx`** — 6-field opportunity details form:

- **Props:** `{ section: DataCallSection, data: OpportunityDetails, onChange }`
- **Fields rendered:** prime_or_sub (select: Prime/Sub/Teaming Partner), teaming_partners (textarea one-per-line), contract_type (text, pre-filled from extraction), naics_code (text, pre-filled), size_standard (text, pre-filled), set_aside (text, pre-filled)
- **RFP citations:** shown as `<span className="text-xs italic text-muted-foreground">` below each label when `field.rfp_citation` is not null
- **Required fields:** marked with red asterisk after label
- **Styling:** labeled inputs with `gap-2 space-y-1`, `border-border` inputs, `focus:ring-2 focus:ring-blue-500`

**`app/solicitations/[id]/page.tsx`** updates:

- Added `ClipboardCheck` to lucide imports
- Added `DataCallView` import from `@/app/components/datacall/DataCallView`
- Added `{ id: "data-call", label: "Data Call", icon: <ClipboardCheck className="h-4 w-4" /> }` to TABS array
- Added `{activeTab === "data-call" && solicitation && selectedCompanyId && (<DataCallView ... />)}` render block

### Task 2: Past Performance and Technical Approach Sections

**`app/components/datacall/PastPerformanceSection.tsx`** — dynamic reference card list:

- **Props:** `{ section, data, onChange, files, companyId, solicitationId }`
- **Dynamic count:** initializes from `section.dynamic_count ?? 3` pre-numbered cards when `data` array is empty
- **RefCard sub-component:** bordered panel with "Reference N" header, Trash2 remove button (hidden when only 1 card remains)
- **9 fields per card:** project_name, client_agency, contract_number, contract_value, period_of_performance, relevance_summary, contact_name, contact_email, contact_phone — each with RFP citation and required/optional marking
- **2-column layout** for contract_number/contract_value; 3-column for contact row
- **Info banner:** `section.description` shown with `border-l-4 border-blue-400 bg-blue-50` at top when present
- **Dynamic count citation:** `section.dynamic_count_source` shown as muted italic text below banner
- **Add Reference button:** dashed border button below last card, adds blank `emptyRef()` to array

**`app/components/datacall/TechnicalApproachSection.tsx`** — 5-textarea narrative section:

- **Props:** `{ section, data, onChange }`
- **Fields:** approach_summary (required, 5 rows), tools_and_platforms, staffing_model, assumptions, risks (all optional, 4 rows, `min-height: 100px`, `resize-y`)
- **Info banner:** `section.description` shown when truthy (SOW task area names injected by generator)
- **RFP citations and required marks:** consistent with OpportunityDetailsSection pattern

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- app/components/datacall/DataCallView.tsx: FOUND
- app/components/datacall/OpportunityDetailsSection.tsx: FOUND
- app/components/datacall/PastPerformanceSection.tsx: FOUND
- app/components/datacall/TechnicalApproachSection.tsx: FOUND
- app/solicitations/[id]/page.tsx (modified): FOUND

### Commits Exist
- 437d663: FOUND (Task 1 — DataCallView + OpportunityDetailsSection + page.tsx)
- ffa44fd: FOUND (Task 2 — PastPerformanceSection + TechnicalApproachSection)

### TypeScript
- Zero new errors introduced in modified/created files
- Pre-existing route handler param errors in validator.ts are unchanged (noted in STATE.md)

## Self-Check: PASSED
