---
status: testing
phase: 06-multi-document-ingestion
source: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md]
started: 2026-02-24T18:00:00Z
updated: 2026-02-24T18:00:00Z
---

## Current Test

number: 5
name: AI document classification with colored badges (retry)
expected: |
  The app header/nav bar shows a "Solicitations" link alongside existing nav items (Upload RFP, Documents, Company Data, All Companies). Clicking it navigates to /solicitations.
awaiting: user response

## Tests

### 1. Solicitations nav link in app header
expected: The app header/nav bar shows a "Solicitations" link alongside existing nav items. Clicking it navigates to /solicitations.
result: issue
reported: "I dont see a Solicitation button linked to that page"
severity: major

### 2. Solicitations list page
expected: /solicitations shows a table of solicitation packages (or empty state with "No solicitations yet" message and "New Solicitation" CTA). If solicitations exist, each row shows: solicitation number (clickable), title, agency, status badge (colored: uploading=blue, classifying=amber, reconciling=purple, ready=green, failed=red), document count, created date.
result: pass

### 3. Create new solicitation
expected: Clicking "New Solicitation" navigates to /solicitations/new. Step 1: form with solicitation number (required), title (optional), agency (optional). Clicking "Create Solicitation" creates the package. If you enter a duplicate solicitation number for the same company, you get a 409 conflict error.
result: pass

### 4. Multi-file drag-drop upload
expected: After creating a solicitation, Step 2 shows a large drag-drop zone. You can drag 3+ files (PDF, DOCX, TXT) into the zone or click to select. Each file appears in a list with filename, size, and status badge. Clicking "Upload All" uploads all files. Each file shows individual progress: queued (gray) -> uploading (blue pulse) -> processing (amber) -> classified (green). Failed files show red badge.
result: pass

### 5. AI document classification with colored badges
expected: After upload completes, Step 3 shows a classification table. Each document has a colored type badge (e.g., blue for Base RFP, purple for SOO/SOW/PWS, amber for Amendment). Low-confidence classifications show a warning icon (triangle). Other/Unclassified documents show a neutral badge with "Classify this document" prompt.
result: issue
reported: "The system is saying wrong solicitation number although I verified I was using the right one so it wont let me properly upload and classify the docs"
severity: major

### 6. Reclassify document via dropdown
expected: Clicking a document type badge in the classification table opens a dropdown with all 11 document types. Selecting a different type updates the badge immediately (optimistic UI). The confidence resets to "high" since user manually classified it.
result: [pending]

### 7. Solicitation detail page with tabs
expected: Navigating to /solicitations/{id} shows the solicitation detail page with: header (solicitation number, agency, status badge, document count), and three tabs: Documents, Reconciliation, Templates.
result: [pending]

### 8. Amendment chain view on Documents tab
expected: The Documents tab shows an amendment chain visualization above the classification table. If amendments exist: horizontal chain showing base RFP -> Amendment 1 -> Amendment 2, with the latest amendment marked "ACTIVE" (green). Superseded documents appear faded with strikethrough. If no amendments: shows "Base Document — No Amendments" simplified view.
result: [pending]

### 9. Fillable and Superseded badges on Documents tab
expected: Documents that are fillable templates show a "Fillable" badge (rose). Documents where is_superseded=true show a "Superseded" badge (red with strikethrough styling). These badges appear above or alongside the classification table.
result: [pending]

### 10. Reconciliation tab — strikethrough and source badges
expected: The Reconciliation tab shows changes grouped by target document ("Changes to: {filename}"). Each reconciliation shows: source badge ("Amendment" in amber or "Q&A Response" in green), change type badge (e.g., "Supersedes Section", "Modifies Page Limit"), section reference, original text with strikethrough, and replacement text with a colored left border accent.
result: [pending]

### 11. Reconciliation undo/restore toggle
expected: Each reconciliation record has an Undo/Restore button. Clicking "Undo" removes the strikethrough from original text and marks the change as "Overridden by user". Clicking "Restore" re-applies the strikethrough. The toggle updates immediately.
result: [pending]

### 12. Templates tab — fillable fields with type hints
expected: The Templates tab lists each fillable template document with a "Fillable" badge and an "Action Required" (red) or "Reference Only" (gray) tag. Below each document: a table of fields showing field name, type hint (text/number/date/boolean/selection), required indicator (red for required), auto-fill suggestion (source + current value if available), and section reference.
result: [pending]

### 13. Empty states
expected: When no reconciliation changes exist, the Reconciliation tab shows "No reconciliation changes detected". When no fillable templates exist, the Templates tab shows "No fillable templates detected in this solicitation package".
result: [pending]

## Summary

total: 13
passed: 3
issues: 2
pending: 8
skipped: 0

## Gaps

- truth: "Solicitations nav link visible in app header"
  status: failed
  reason: "User reported: I dont see a Solicitation button linked to that page"
  severity: major
  test: 1
  root_cause: "Agent added link to unused AppHeader.tsx instead of active header.tsx"
  artifacts:
    - path: "app/components/layout/header.tsx"
      issue: "Missing Solicitations nav link"
  missing:
    - "Add Solicitations to navigation array in header.tsx"
  debug_session: ""
  resolution: "Fixed in commit c5752d6 — added to correct header component"

- truth: "Upload and classification pipeline works end-to-end"
  status: failed
  reason: "User reported: wrong solicitation number error preventing upload"
  severity: major
  test: 5
  root_cause: "All solicitation API routes used sync params pattern but Next.js 15+ requires Promise<params>"
  artifacts:
    - path: "app/api/solicitations/[id]/upload/route.ts"
      issue: "params not awaited"
    - path: "app/api/solicitations/[id]/route.ts"
      issue: "params not awaited"
    - path: "app/api/solicitations/[id]/documents/route.ts"
      issue: "params not awaited"
    - path: "app/api/solicitations/[id]/documents/[docId]/route.ts"
      issue: "params not awaited"
    - path: "app/api/solicitations/[id]/reconciliations/route.ts"
      issue: "params not awaited"
  missing:
    - "Use Promise<{ id: string }> and await params in all handlers"
  debug_session: ""
  resolution: "Fixed in commit f8ee61f — all 8 handlers across 5 files updated"
