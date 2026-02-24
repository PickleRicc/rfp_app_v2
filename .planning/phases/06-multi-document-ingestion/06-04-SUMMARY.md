---
phase: 06-multi-document-ingestion
plan: 04
subsystem: reconciliation-ui
tags: [ui, reconciliation, amendments, templates, solicitations-list, navigation]
dependency_graph:
  requires: [06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md]
  provides:
    - /solicitations — solicitations list page with status badges and navigation
    - /solicitations/[id] — solicitation detail page with three-tab layout
    - ReconciliationView component — strikethrough, source badges, undo/restore
    - AmendmentChainView component — visual chain with active/superseded states
    - TemplateFieldsPanel component — fillable templates with field type hints and auto-fill
    - Solicitations nav link in AppHeader
  affects:
    - Proposal generation (users verify reconciled state before draft)
    - AppHeader navigation (Solicitations link added)
tech_stack:
  added: []
  patterns:
    - Tier1TabLayout reused for tabbed solicitation detail page
    - EnrichedReconciliation extends DocumentReconciliation with source/target filenames
    - AmendmentChainView builds ordered chain (base_rfp -> amendments by amendment_number)
    - TemplateFieldsPanel groups fields by document with document-level Action Required/Reference Only tag
    - fetchTemplateFields only queries template-eligible document types (5 types) — avoids unnecessary API calls
    - Optimistic UI update on reconciliation toggle and document reclassify
    - EnhancedDocumentTable wraps DocumentClassificationTable with Fillable/Superseded badge strip
key_files:
  created:
    - app/solicitations/[id]/page.tsx
    - app/components/solicitation/ReconciliationView.tsx
    - app/components/solicitation/AmendmentChainView.tsx
    - app/components/solicitation/TemplateFieldsPanel.tsx
    - app/solicitations/page.tsx
  modified:
    - app/components/AppHeader.tsx (added Solicitations nav link)
decisions:
  - "EnhancedDocumentTable wraps DocumentClassificationTable rather than forking it — preserves Plan 02 reclassify behavior while adding Fillable/Superseded badge strip above"
  - "fetchTemplateFields only fetches docs with template-eligible types (5 types) — mirrors the pre-filter in the Inngest reconciler to avoid wasteful API calls"
  - "ReconciliationView groups by target_document_id — shows which base document each amendment/Q&A modified"
  - "AmendmentChainView shows 'Base Document — No Amendments' simplified view when no amendments exist — avoids empty chain UI"
  - "Undo button shows expand/collapse only when text exists — reduces visual clutter for metadata-only changes"
requirements-completed: [INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06]
metrics:
  duration: ~30 min
  completed_date: "2026-02-24"
  tasks: 3
  files_created: 5
  files_modified: 1
---

# Phase 6 Plan 04: Reconciliation Review UI Summary

**One-liner:** Solicitation detail page with three-tab layout (Documents/Reconciliation/Templates) showing amendment chain visualization, inline strikethrough for superseded text with undo/restore, Q&A-sourced tagging, fillable template field listings with data type hints and auto-fill suggestions, and a solicitations list page with full nav integration.

## What Was Built

### Task 1: Solicitation Detail Page and Reconciliation/Amendment Views

**`app/solicitations/[id]/page.tsx`**

Tabbed solicitation detail page using the Tier1TabLayout pattern from Phase 5.

- Header: solicitation number (large), agency/title subtitle, pipeline status badge, document count, "Upload More Documents" link
- Fetches solicitation data from `GET /api/solicitations/{id}` and reconciliation records from `GET /api/solicitations/{id}/reconciliations` on load
- Fetches template fields per document (template-eligible types only) via `GET /api/solicitations/{id}/documents/{docId}`
- Three tabs: Documents, Reconciliation, Templates
- Reclassify handler PATCHes `/api/solicitations/{id}/documents/{docId}` and updates local state optimistically
- Toggle reconciliation handler PATCHes `/api/solicitations/{id}/reconciliations` with `{ reconciliation_id, is_active }` and updates local state optimistically

**Documents tab includes:**
- AmendmentChainView (above classification table)
- EnhancedDocumentTable — wraps DocumentClassificationTable, adds a badge strip showing Fillable (rose) and Superseded (red strikethrough) badges above the full table

**`app/components/solicitation/ReconciliationView.tsx`**

Grouped reconciliation display:
- Groups records by `target_document_id` with section dividers labeled "Changes to: {filename}"
- Source badge: "Amendment" (amber) or "Q&A Response" (green) per `source_type` — implementing user decision for Q&A provenance tagging
- Change type badge (Supersedes Section, Modifies Page Limit, etc.)
- Section reference and source document filename
- "Overridden by user" label when `is_active=false`
- Expand/collapse for text display (only shown when original_text or replacement_text exists)
- Original text: inline strikethrough when `is_active=true` — implements user decision "Inline strikethrough for superseded text"
- Replacement text: left accent border (amber for amendments, green for Q&A) when `is_active=true`
- Undo/Restore toggle button — implements user decision "Users can override reconciliation with undo/restore action"

**`app/components/solicitation/AmendmentChainView.tsx`**

Horizontal scrollable amendment chain:
- Chain nodes: base_rfp documents first, then amendments sorted by `amendment_number`
- Latest node (last in chain) gets green border + "ACTIVE" badge
- Superseded nodes: faded (opacity-60) with strikethrough filename
- Node content: type badge, filename, amendment_number, effective_date, change count from reconciliations
- Arrow separators between nodes
- Summary stats: amendment count, total reconciliation changes, Q&A-sourced count
- Simplified "Base Document — No Amendments" view when no amendments exist

### Task 2: Template Fields Panel and Solicitations List Page

**`app/components/solicitation/TemplateFieldsPanel.tsx`**

Per-document template field display:
- "Fillable" badge on each document header (rose) — user decision
- Document-level "Action Required" (red) or "Reference Only" (gray) tag based on whether any field has `tag='action_required'`
- Field table columns: field name, type hint (icon + text: text/number/date/boolean/selection), required indicator (red AlertCircle for required), auto-fill suggestion, section reference
- Auto-fill display: sparkle icon + source column name + current value in green chip — user decision "system suggests auto-populated values from other uploaded docs"
- Empty state: "No fillable templates detected in this solicitation package"

**`app/solicitations/page.tsx`**

Solicitations list at `/solicitations`:
- Fetches via `GET /api/solicitations` with `X-Company-Id` from `useCompany()`
- Table columns: solicitation number (link to `/solicitations/{id}`), title and agency subtitle, status badge, document count, created date
- Status badges: uploading=blue, classifying=amber, reconciling=purple, ready=green, failed=red
- No-company warning, loading spinner, error state with retry, empty state with illustration and "New Solicitation" CTA
- "New Solicitation" button (prominent, links to `/solicitations/new`)

**`app/components/AppHeader.tsx`**

Added "Solicitations" link to the secondary nav bar (alongside Upload RFP, Documents, Company Data, All Companies).

## Task 3: Human Verification — APPROVED

Task 3 was a `checkpoint:human-verify` gate. The user reviewed the complete multi-document ingestion flow end-to-end and approved all 11 verification steps:

1. /solicitations list navigates and shows solicitations or empty state
2. "New Solicitation" flow creates a solicitation package
3. Multi-file drop zone accepts 3+ files with per-file progress (uploading -> processing -> classified)
4. Classification table shows colored type badges; low-confidence items show warning icon
5. Document reclassification via dropdown on type badge works correctly
6. Solicitation detail page /solicitations/{id} loads with all three tabs
7. Documents tab: amendment chain view renders (or simplified "no amendments" view); Fillable/Superseded badges appear
8. Reconciliation tab: superseded text shows inline strikethrough, Amendment/Q&A source badges visible, undo/restore toggle functions
9. Templates tab: fillable template fields listed with data type hints and auto-fill suggestions
10. Action Required/Reference Only document-level tags present on template panel
11. "Solicitations" nav link visible in app header

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- `app/solicitations/[id]/page.tsx` — FOUND
- `app/components/solicitation/ReconciliationView.tsx` — FOUND
- `app/components/solicitation/AmendmentChainView.tsx` — FOUND
- `app/components/solicitation/TemplateFieldsPanel.tsx` — FOUND
- `app/solicitations/page.tsx` — FOUND
- `app/components/AppHeader.tsx` (modified) — FOUND

### Commits Exist
- `0fa6b11` — feat(06-04): create solicitation detail page and reconciliation/amendment views
- `d91c3d9` — feat(06-04): create template fields panel, solicitations list page, and nav link

### Line Count Verification
- app/solicitations/[id]/page.tsx: 375 lines (min: 80) — PASS
- app/components/solicitation/ReconciliationView.tsx: 286 lines (min: 100) — PASS
- app/components/solicitation/AmendmentChainView.tsx: 159 lines (min: 60) — PASS
- app/components/solicitation/TemplateFieldsPanel.tsx: 213 lines (min: 60) — PASS
- app/solicitations/page.tsx: 222 lines (min: 40) — PASS

## Self-Check: PASSED
