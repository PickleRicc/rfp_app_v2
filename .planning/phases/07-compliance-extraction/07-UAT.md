---
status: complete
phase: 07-compliance-extraction
source: [07-01-SUMMARY.md, 07-02-PLAN.md]
started: 2026-02-24T20:00:00Z
updated: 2026-02-25T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Compliance tab visible on solicitation detail page
expected: Navigate to /solicitations, open a solicitation. Tab bar shows 4 tabs: Documents, Reconciliation, Compliance, Templates. Compliance tab has a Shield icon.
result: pass

### 2. Empty state before extraction
expected: Click Compliance tab on a solicitation that hasn't been extracted yet. Should show message about extraction not started. If solicitation status is "ready", an "Extract Now" button should appear.
result: pass

### 3. Extraction triggers and skeleton loaders display
expected: Click "Extract Now" (or trigger extraction). Accordion sections appear with skeleton loaders (animated gray bars) while extraction runs. Each section header shows category name and a spinner.
result: pass

### 4. All 9 accordion sections render after extraction
expected: After extraction completes, 9 accordion sections appear (all expanded by default): Section L, Section M, Admin Data, Rating Scales, SOW/PWS, Cost/Price, Past Performance, Key Personnel, Security Requirements. Each has a header with icon, label, and status indicator.
result: pass

### 5. Section L content displays correctly
expected: Section L accordion shows volume structure (table with Volume Name, Page Limit, Format/Rules), required attachments list, required forms/certifications list, and formatting rules (font, margins, spacing).
result: pass

### 6. Section M content displays correctly
expected: Section M accordion shows evaluation factors as indented tree — top-level factors with colored weight badges (green for "Most Important", blue for "Equal"), subfactors indented below. Evaluation methodology (LPTA/Best Value/Tradeoff) shown.
result: pass

### 7. Admin Data content displays correctly
expected: Admin Data accordion shows key-value pairs: NAICS Code, Size Standard, Set-Aside, Contract Type, Period of Performance. CLIN structure table if present.
result: pass

### 8. Confidence indicators show correct colors
expected: Extracted values have a colored left border — green for high confidence, amber for medium, red for low.
result: pass

### 9. Inline editing works
expected: Click any extracted value — it switches to edit mode (input/textarea appears). Edit the value, press Enter or click away to save. A purple "User Override" badge appears next to the saved value.
result: pass

### 10. Revert override works
expected: Click "Revert" next to an overridden value. It restores the original AI-extracted value, and the "User Override" badge disappears.
result: pass

### 11. Missing values show "Not found" placeholder
expected: Fields where the AI found nothing show gray italic "Not found" text. Clicking "Not found" opens inline edit mode so you can manually enter a value.
result: pass

### 12. Re-extract per section works
expected: Click "Re-extract" on any accordion section header. That section shows a skeleton/spinner while re-extracting. Other sections remain visible and unchanged.
result: issue
reported: "Currently, re-extract extracts all sections when clicked, not an individual section. We need a button for re-extracting all sections and re-extract for individual sections."
severity: major

### 13. Document routing logs show targeted routing
expected: Check Inngest or server console logs during extraction. Each category should show "[doc-routing]" logs with doc counts per type — e.g., section_l gets base_rfp + amendments, sow_pws gets soo_sow_pws + base_rfp, security_reqs gets dd254 + base_rfp + clauses. Categories should NOT all show the same doc count.
result: pass

### 14. Document classification identifies TOR/RFQ as base_rfp
expected: Upload a Task Order Request (TOR) or RFQ document. After classification, it should be labeled "Base Solicitation" (not "SOO/SOW/PWS" or "Amendment"). Check the Documents tab classification badges.
result: pass

### 15. Standalone SOO/SOW classified correctly
expected: A standalone Statement of Objectives PDF (separate from the main solicitation) should classify as "SOO/SOW/PWS", not "Amendment".
result: pass

### 16. Error state for failed extraction
expected: If an extraction category fails, that accordion section shows an error message with "Retry" button and "Add manually" option.
result: pass

## Summary

total: 16
passed: 15
issues: 1
pending: 0
skipped: 0

## Gaps

- truth: "Re-extract button on each accordion section triggers re-extraction for just that category, not all categories"
  status: failed
  reason: "User reported: Currently, re-extract extracts all sections when clicked, not an individual section. We need a button for re-extracting all sections and re-extract for individual sections."
  severity: major
  test: 12
  root_cause: "API route sends solicitation.reconciliation.complete event without category param. Inngest function always runs all 9 extraction steps regardless."
  artifacts:
    - path: "app/api/solicitations/[id]/compliance/route.ts"
      issue: "Line ~315: inngest.send() sends { solicitationId } without category"
    - path: "lib/inngest/functions/solicitation-compliance-extractor.ts"
      issue: "Event data type has no optional category field; all 9 steps always execute"
  missing:
    - "Pass category in Inngest event payload from API route"
    - "Add optional category to event data type in Inngest function"
    - "Skip extraction steps that don't match the requested category"
    - "Add a separate 'Re-extract All' button in the UI header"
  debug_session: ""
