---
phase: 06-multi-document-ingestion
plan: 03
subsystem: reconciliation-engine
tags: [inngest, anthropic, reconciliation, amendments, qa-parsing, template-detection, api]
dependency_graph:
  requires: [06-01-SUMMARY.md, 06-02-SUMMARY.md]
  provides:
    - reconcileAmendments: AI-powered amendment vs base-RFP comparison
    - parseQAModifications: Q&A answer parsing for requirement changes
    - detectTemplateFields: fillable template field mapping with auto-fill suggestions
    - solicitationReconciler Inngest function (triggered on solicitation.classification.complete)
    - GET/PATCH /api/solicitations/[id]/reconciliations (list + toggle is_active)
    - GET/PATCH /api/solicitations/[id]/documents/[docId] (fetch + reclassify/reorder)
  affects:
    - 06-04 (UI plan reads reconciliation data via the new API endpoints)
    - Proposal generation (uses is_active reconciliation records as current truth)
tech_stack:
  added: []
  patterns:
    - Anthropic AI with extractJSON helper for structured JSON parsing (same as stage0-classifier)
    - Inngest step.run() 5-step pipeline with per-document error isolation
    - Amendment chain: chronological sort by amendment_number, compare each against base
    - Q&A provenance: all results tagged source_type='qa_response' per user decision
    - Template pre-filter: TEMPLATE_ELIGIBLE_TYPES set + filename hint check before AI call
    - Auto-fill resolution: dot-notation path mapping to company_profiles / solicitations columns
    - Company-scoped API: requireStaffOrResponse() + X-Company-Id + ownership verification
key_files:
  created:
    - lib/ingestion/reconciliation-engine.ts
    - lib/ingestion/template-detector.ts
    - lib/inngest/functions/solicitation-reconciler.ts
    - app/api/solicitations/[id]/reconciliations/route.ts
    - app/api/solicitations/[id]/documents/[docId]/route.ts
  modified:
    - app/api/inngest/route.ts
decisions:
  - "Amendment chain compares each amendment against original base document — lineage tracking (is_superseded/superseded_by) handled by Inngest step, not the engine function"
  - "Only all-documents-failed sets solicitation status to 'failed' — partial failures log per-doc and continue"
  - "Manual reclassification always resets classification_confidence to 'high' — user review is more certain than AI"
  - "Template detection pre-filters by document_type (5 types) + filename hint before calling Anthropic — avoids unnecessary API calls"
  - "Auto-fill resolveAutoFillValue handles arrays (naics_codes) by using first element"
metrics:
  duration: ~6 min
  completed_date: "2026-02-24"
  tasks: 2
  files_created: 5
  files_modified: 1
---

# Phase 6 Plan 03: Reconciliation Engine Summary

**One-liner:** AI-powered reconciliation pipeline using Anthropic to compare amendments against base RFP, parse Q&A modifications, detect fillable templates with auto-fill suggestions — orchestrated via Inngest with 5-step error-isolated processing.

## What Was Built

### Reconciliation Engine Library (Task 1)

Created `lib/ingestion/reconciliation-engine.ts` exporting two AI functions:

**`reconcileAmendments(baseDocument, amendments[])`**
- Sorts amendments chronologically by amendment_number
- For each amendment, calls Anthropic with base document text (20000 chars) + amendment text (15000 chars)
- Prompts Claude to identify superseded sections, new requirements, removed requirements, and general modifications
- Returns `ReconciliationResult[]` with change_type, section_reference, original_text, replacement_text
- All results tagged source_type: 'amendment' for provenance

**`parseQAModifications(qaDocument, baseDocument)`**
- Calls Anthropic with Q&A text (15000 chars) + base document text (15000 chars)
- Specifically prompts for 5 high-impact modification types: scope changes, page limit changes, eval criteria changes, submission instruction changes, new requirements
- Returns `ReconciliationResult[]` tagged source_type: 'qa_response' per user decision for clear provenance

Created `lib/ingestion/template-detector.ts` exporting:

**`detectTemplateFields(document)`**
- Pre-filters to 5 document types (pricing_template, cdrls, other_unclassified, dd254, provisions) + filename hints
- Calls Anthropic with document text (15000 chars) + auto-fill reference mapping
- Prompts Claude to determine if document is a fillable template, then extract field_name, field_type, is_required, section_reference, auto_fill_source, tag
- Returns null if not a template, empty array if template with no identifiable fields, or `TemplateFieldResult[]`
- Auto-fill sources map to company_profiles columns (legal_name, cage_code, uei, etc.) and solicitations columns

### Solicitation Reconciler Inngest Function (Task 2)

Created `lib/inngest/functions/solicitation-reconciler.ts`:

Triggered by `solicitation.classification.complete` event (emitted by solicitation-classifier from Plan 02).

**5-Step Pipeline:**

1. `fetch-documents` — Load all classified docs, separate into: baseDocuments, amendments, qaDocuments, templateCandidates. Set solicitation status to 'reconciling'.

2. `reconcile-amendments` — If amendments + base exist: calls `reconcileAmendments()`, inserts records into `document_reconciliations` with `is_active: true`, marks amendment docs as 'reconciled'. Logs to processing_logs.

3. `parse-qa-modifications` — For each Q&A doc: calls `parseQAModifications()`, inserts records with source_type='qa_response', marks Q&A docs as 'reconciled'. Per-document error isolation continues on individual failures.

4. `detect-templates` — For each template candidate: calls `detectTemplateFields()`, if fields found inserts into `template_field_mappings` with resolved auto_fill_value (via `resolveAutoFillValue()` helper). Marks docs as 'reconciled'.

5. `finalize` — Updates remaining 'classified' docs to 'reconciled'. Checks if all docs failed — sets solicitation to 'failed' only if all failed, otherwise 'ready'.

**Registered** in `app/api/inngest/route.ts` alongside existing functions.

### Reconciliations API (Task 2)

**`GET /api/solicitations/[id]/reconciliations`** — Lists all document_reconciliations for a solicitation. Enriches each record with source_document_filename and target_document_filename (fetched via in-clause). Returns array ordered by created_at ASC.

**`PATCH /api/solicitations/[id]/reconciliations`** — Toggles is_active on a single record. Body: `{ reconciliation_id, is_active }`. Implements undo/restore pattern per user decision. Returns human-readable message describing the action taken.

### Document API (Task 2)

**`GET /api/solicitations/[id]/documents/[docId]`** — Returns a single document with its reconciliation records (where it is source OR target) and template field mappings.

**`PATCH /api/solicitations/[id]/documents/[docId]`** — Supports reclassification (document_type + auto-derived label + resets confidence to 'high'), explicit confidence updates, and sort_order reordering. Validates document_type against the 11-type enum.

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Additions (Rule 2)

**1. [Rule 2 - Missing Validation] sort_order must be non-negative**
- **Found during:** Task 2 (document PATCH endpoint)
- **Fix:** Added `body.sort_order < 0` check returning 400
- **Files modified:** `app/api/solicitations/[id]/documents/[docId]/route.ts`

**2. [Rule 2 - Missing Validation] "No fields to update" guard on document PATCH**
- **Found during:** Task 2
- **Fix:** Returns 400 if only `updated_at` is in the payload (no meaningful fields provided)
- **Files modified:** `app/api/solicitations/[id]/documents/[docId]/route.ts`

## Self-Check

### Files Exist
- `lib/ingestion/reconciliation-engine.ts` — FOUND
- `lib/ingestion/template-detector.ts` — FOUND
- `lib/inngest/functions/solicitation-reconciler.ts` — FOUND
- `app/api/solicitations/[id]/reconciliations/route.ts` — FOUND
- `app/api/solicitations/[id]/documents/[docId]/route.ts` — FOUND
- `app/api/inngest/route.ts` (modified) — FOUND

### Commits Exist
- 28dc4b5 — feat(06-03): create reconciliation engine and template detector libraries
- 75c38cc — feat(06-03): create reconciliation Inngest function and supporting API endpoints

## Self-Check: PASSED
