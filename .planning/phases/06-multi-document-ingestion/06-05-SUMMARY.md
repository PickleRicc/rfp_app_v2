---
phase: 06-multi-document-ingestion
plan: 05
subsystem: reconciliation-engine
tags: [inngest, reconciliation, amendments, supersession, gap-closure]
dependency_graph:
  requires: [06-03-SUMMARY.md]
  provides:
    - is_superseded and superseded_by writes on solicitation_documents after reconciliation
  affects:
    - AmendmentChainView (faded/strikethrough styling now activates for superseded nodes)
    - EnhancedDocumentTable (Superseded badge now appears for is_superseded=true documents)
tech_stack:
  added: []
  patterns:
    - Supersession writes placed inside successful insert else-block — avoids partial state on reconciliation failure
    - Per-UPDATE error logging without pipeline blocking — consistent with existing reconciler error isolation pattern
key_files:
  created: []
  modified:
    - lib/inngest/functions/solicitation-reconciler.ts
decisions:
  - "Supersession writes are scoped inside the insertError else-block — only written when reconciliation records successfully commit, preventing is_superseded=true without corresponding document_reconciliations records"
  - "Earlier amendments superseded_by points to amendments[i+1] (immediate successor) not the latest amendment — preserves exact version lineage"
  - "Base document marked superseded only when supersedes_section change_type exists — additive_section or general_modification changes do not trigger is_superseded"
metrics:
  duration: ~5 min
  completed_date: "2026-02-24"
  tasks: 1
  files_created: 0
  files_modified: 1
---

# Phase 6 Plan 05: Gap Closure — is_superseded/superseded_by Writes Summary

**One-liner:** Closed document-level supersession write gap in reconciliation Inngest function — base documents and earlier amendments now receive is_superseded=true and superseded_by FK after successful reconciliation insert.

## What Was Built

### Gap Closed: Document-Level Supersession Writes (Task 1)

Modified the `reconcile-amendments` step in `lib/inngest/functions/solicitation-reconciler.ts` to write document-level supersession state after successful reconciliation record insertion.

**Root cause of gap:** The reconciler correctly created `document_reconciliations` records (tracking per-section changes), but never updated the document-level `is_superseded` and `superseded_by` fields on `solicitation_documents`. The UI components (`AmendmentChainView`, `EnhancedDocumentTable`) already read these fields correctly — they just had no data to display.

**Logic added inside the `if (!insertError)` block (after `totalRecords = results.length`):**

1. **Base document supersession:**
   - Checks if any reconciliation result has `change_type === 'supersedes_section'`
   - If so, UPDATEs `solicitation_documents` SET `is_superseded = true`, `superseded_by = latestAmendment.id` WHERE `id = baseDoc.id`
   - "Latest amendment" is `amendments[amendments.length - 1]` (array already sorted chronologically by amendment_number in the fetch-documents step)

2. **Earlier amendment supersession:**
   - If `amendments.length > 1`, loops through all amendments except the last
   - For each `amendments[i]`: UPDATEs `is_superseded = true`, `superseded_by = amendments[i + 1].id`
   - Points to immediate successor (not latest) — preserves exact version lineage

**Placement decision:** Both writes are inside the `else` branch of the `insertError` check. This ensures supersession state is only written when the `document_reconciliations` insert succeeded — prevents `is_superseded=true` on a document with no corresponding reconciliation records.

**Error handling:** Each UPDATE captures its own error variable and logs via `console.error` without blocking pipeline progress — consistent with the existing reconciler isolation pattern.

## Deviations from Plan

None — plan executed exactly as written. The example code structure from the plan was followed directly, with the addition of error handling variables (`baseSupersededError`, `amendSupersededError`) and corresponding error logs for observability.

## Self-Check

### Files Exist
- `lib/inngest/functions/solicitation-reconciler.ts` — FOUND (modified)

### Commits Exist
- 507c5e9 — feat(06-05): add is_superseded and superseded_by writes to reconcile-amendments step

## Self-Check: PASSED
