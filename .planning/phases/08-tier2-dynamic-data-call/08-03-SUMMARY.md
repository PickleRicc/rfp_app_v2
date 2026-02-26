---
phase: 08-tier2-dynamic-data-call
plan: "03"
subsystem: ui
tags: [file-upload, key-personnel, compliance-verification, validation-gate, accordion, data-call]

requires:
  - phase: 08-02
    provides: DataCallView container, accordion form with OpportunityDetails, PastPerformance, TechnicalApproach sections

provides:
  - KeyPersonnelSection with inline file uploads (resume, certs, LOC per card)
  - ComplianceVerificationSection with cert toggles, NIST score, facility clearance, attachment uploads
  - Complete Data Call validation gate with per-section error display
  - Summary panel showing section completion count and last saved timestamp
  - Full 5-section Data Call form with real components (no placeholders)

affects: [draft-generation, phase-09]

tech-stack:
  added: []
  patterns: [inline-file-upload-click-to-browse, multi-file-per-card, upload-state-per-field-key, toggle-switch-button-role-switch, submit-time-validation]

key-files:
  created:
    - app/components/datacall/KeyPersonnelSection.tsx
    - app/components/datacall/ComplianceVerificationSection.tsx
  modified:
    - app/components/datacall/DataCallView.tsx

key-decisions:
  - "FileUploadButton uses hidden input ref.click() pattern — click-to-browse only, no drag-drop per CONTEXT.md"
  - "Upload state tracked per field_key string in Record<string, boolean> — enables independent spinners per file slot"
  - "MultiFileUpload appends existingFiles.length to baseFieldKey for each new cert — preserves index-stable field keys"
  - "PersonnelCard manages its own uploadingFields and uploadErrors state — avoids prop-drilling upload state up to parent"
  - "ToggleSwitch uses button[role=switch] pattern from Tier 1 VehiclesCertificationsTab — accessible without UI library"
  - "AttachmentUpload reads field.key as fieldKey — required_attachments keyed by field.key from schema"
  - "validateDataCall runs only on Complete Data Call click, not inline — per CONTEXT.md save/submit separation"
  - "Sections with validation errors auto-expand on Complete Data Call — surface errors without manual accordion navigation"

requirements-completed: [TIER2-04, TIER2-06]

metrics:
  duration_minutes: 8
  completed: 2026-02-26
  tasks_completed: 2
  files_created: 2
  files_modified: 1
---

# Phase 8 Plan 03: Key Personnel + Compliance Verification + Validation Gate Summary

**KeyPersonnelSection with per-card file uploads (resume/certs/LOC), ComplianceVerificationSection with cert toggles and attachment uploads, Complete Data Call validation gate — completing the full 5-section Tier 2 Data Call form.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-02-25T (prior session)
- **Completed:** 2026-02-26T00:00:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — awaiting human verification)
- **Files modified:** 3

## Accomplishments

- KeyPersonnelSection renders dynamic extraction-driven position cards with inline file uploads for resume, certification documents (multi-file), and Letter of Commitment
- ComplianceVerificationSection renders org cert toggles, individual cert textarea, facility clearance toggle, NIST 800-171 score field, and required attachment uploads — all driven by schema fields
- Complete Data Call validation gate checks all required fields and files across all 5 sections, auto-expands sections with errors, and shows per-section error details
- Summary panel shows status badge, section completion count, and last-saved timestamp above the accordion

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | KeyPersonnelSection and ComplianceVerificationSection with file uploads | 2976981 | KeyPersonnelSection.tsx, ComplianceVerificationSection.tsx |
| 2 | Complete Data Call button, validation gate, section wiring, summary panel | 73d29dc | DataCallView.tsx |
| 3 | Human verification of full Data Call flow | pending checkpoint | — |

## Files Created/Modified

- `app/components/datacall/KeyPersonnelSection.tsx` — Key personnel cards with per-card file uploads (resume required, certs optional/multi, LOC conditional on schema)
- `app/components/datacall/ComplianceVerificationSection.tsx` — Compliance form with toggle switches, NIST score, facility clearance, and required attachment uploads
- `app/components/datacall/DataCallView.tsx` — Updated with real section routing (no placeholders), Complete Data Call button, validation logic, summary panel, file state management

## Decisions Made

- Click-to-browse file upload only (no drag-drop) per CONTEXT.md — hidden input triggered by Browse button ref.click()
- Upload state tracked per field_key (not per card) — each file slot has independent spinner
- PersonnelCard manages its own upload state — prevents prop-drilling and keeps card self-contained
- ToggleSwitch uses `button[role=switch]` pattern matching Tier 1 — accessible without UI library dependency
- Validation runs on submit only (Complete Data Call click) — allows partial saves without blocking
- Sections with errors auto-expand when validation fires — surfaces issues without manual navigation

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Full Tier 2 Data Call form is complete pending human verification (Task 3)
- After human approval, Phase 9 (Draft Generation) can begin
- All 6 TIER2 requirements satisfied (TIER2-01 through TIER2-06)
- File uploads create Supabase storage entries via existing upload API from Plan 01
- Save/load cycle works via PUT/GET data call API from Plan 01

---
*Phase: 08-tier2-dynamic-data-call*
*Completed: 2026-02-26*
