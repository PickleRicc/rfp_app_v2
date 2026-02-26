---
status: complete
phase: 09-draft-generation
source: [09-01-SUMMARY.md, 09-02-SUMMARY.md, 09-03-SUMMARY.md]
started: 2026-02-26T03:30:00Z
updated: 2026-02-26T04:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Draft Tab Visible
expected: In a solicitation detail page, a "Draft" tab appears in the tab bar (after Data Call). It uses a Send icon.
result: pass

### 2. Strategy Confirmation Screen
expected: Clicking the Draft tab shows a read-only strategy summary with 6 cards: Opportunity Overview (prime/sub role badge, contract type, NAICS, set-aside, teaming partners), Win Themes & Differentiators, Volume Structure table, Evaluation Factors table, Key Personnel table, and Past Performance count. A "Confirm & Generate" button appears at the bottom.
result: pass

### 3. Back to Data Call Link
expected: A "Back to Data Call" text link is visible on the strategy confirmation screen. Clicking it navigates to the Data Call tab.
result: pass

### 4. Confirm & Generate Triggers Draft
expected: Clicking "Confirm & Generate" immediately starts generation (no additional confirmation dialog). The view transitions to a generating state with a volume-by-volume progress checklist.
result: pass

### 5. Volume Progress Updates
expected: During generation, each volume in the checklist shows a spinning loader while in progress, then a green checkmark when complete. Volumes complete one at a time.
result: pass

### 6. Volume Preview
expected: After generation completes, each volume card has a "Preview" toggle. Expanding it shows rendered content that references your company data (not generic placeholder text for all fields).
result: pass

### 7. Download DOCX
expected: Each completed volume has a "Download DOCX" button. Clicking it downloads a .docx file with the volume name in the filename.
result: issue
reported: "download button causes an error and takes me to a page that says: {error: X-Company-Id header is required}. Then after fix, 404 Volume not ready for download because file_path is null (storage bucket missing)"
severity: major

### 8. Page Limit Status Bars
expected: Each volume card shows a page limit progress bar. Color coding: green (under limit), yellow (approaching limit), red (over limit). The bar shows estimated pages vs. the RFP page limit.
result: pass

### 9. Compliance Matrix
expected: Below the volume cards, a "Compliance Matrix" section displays a table mapping Section M evaluation factors to the generated volume sections.
result: issue
reported: "Compliance Matrix says 'No evaluation factors were extracted from Section M' but we have Section M criteria in our Compliance Section"
severity: major

### 10. Regenerate Draft
expected: After generation completes, a "Regenerate Draft" button is visible. Clicking it replaces the old draft entirely (no version history) and restarts generation.
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Each completed volume has a Download DOCX button that downloads a .docx file"
  status: fixed
  reason: "User reported: download button causes 400 error (X-Company-Id header missing from browser navigation), then 404 (file_path null — storage bucket not created)"
  severity: major
  test: 7
  root_cause: "1) <a> tag navigation cannot send custom headers — replaced with fetch-based download. 2) Supabase storage bucket 'proposal-drafts' not created — button now disabled when file_path is null"
  artifacts:
    - path: "app/components/draft/DraftGenerationView.tsx"
      issue: "Used <a href> instead of fetch() for download; no guard for null file_path"
  missing:
    - "Create 'proposal-drafts' storage bucket in Supabase project"
  fix_commits: ["0a497e8", "cb5e83e"]

- truth: "Compliance matrix displays a table mapping Section M evaluation factors to generated volume sections"
  status: fixed
  reason: "User reported: shows 'No evaluation factors extracted from Section M' despite having Section M data"
  severity: major
  test: 9
  root_cause: "assembleComplianceMatrixData() took sectionMExtraction[0].field_value blindly — section_m has multiple rows (evaluation_factors, evaluation_methodology, etc.) and index 0 was not the evaluation_factors row"
  artifacts:
    - path: "lib/generation/draft/prompt-assembler.ts"
      issue: "Grabbed first section_m row instead of finding evaluation_factors by field_name"
  missing:
    - "Regenerate draft to populate compliance matrix with fixed code"
  fix_commits: ["024c4b3"]
