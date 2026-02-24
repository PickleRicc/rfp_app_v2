---
phase: 06-multi-document-ingestion
plan: 02
subsystem: upload-and-classification
tags: [upload, inngest, ai-classification, ui, solicitation]
dependency_graph:
  requires: [06-01-SUMMARY.md]
  provides:
    - POST /api/solicitations/[id]/upload (bulk file upload for solicitation packages)
    - solicitationDocumentClassifier Inngest function (AI classification into 11 doc types)
    - SolicitationUploader component (multi-file drag-drop with per-file progress)
    - DocumentClassificationTable component (colored badges, reclassify dropdown)
    - /solicitations/new page (3-step guided flow)
  affects:
    - 06-03 (solicitation.classification.complete event triggers reconciliation)
    - Any page that navigates to /solicitations/new
tech_stack:
  added: []
  patterns:
    - Inngest step functions with 5 steps per event (log-start, classify, update, log-completion, check-all-classified)
    - Per-file FormData upload with error isolation (failures in errors[], successes in documents[])
    - Polling pattern (3s interval, 2 min max) for classification status
    - Optimistic UI update on reclassify
    - Click-to-open reclassify dropdown with backdrop dismiss
    - extractJSON helper pattern from stage0-classifier.ts (strip markdown code blocks before JSON.parse)
key_files:
  created:
    - app/api/solicitations/[id]/upload/route.ts
    - lib/inngest/functions/solicitation-classifier.ts
    - app/components/solicitation/SolicitationUploader.tsx
    - app/components/solicitation/DocumentClassificationTable.tsx
    - app/solicitations/new/page.tsx
  modified:
    - app/api/inngest/route.ts (added solicitationDocumentClassifier to serve handler)
decisions:
  - "extractTextFromFile falls back to file.text() on PDF service failure — avoids hard blocking on service unavailability"
  - "check-all-classified counts both 'classified' and 'failed' as done — prevents reconciliation from being blocked by one bad doc"
  - "TypeBadge uses fixed/backdrop pattern for dropdown — no Radix dependency needed"
  - "Polling uses 3s interval with 40 attempt max (2 min) — matches Inngest cold-start + Claude latency"
metrics:
  duration: ~6 min
  completed_date: "2026-02-24"
  tasks: 2
  files_created: 5
  files_modified: 1
---

# Phase 6 Plan 02: Multi-File Upload and AI Classification Summary

**One-liner:** Multi-file drag-drop upload endpoint with per-file text extraction, Inngest AI classifier for 11 government doc types (base_rfp through other_unclassified), and guided 3-step solicitation creation UI with colored classification table.

## What Was Built

### Task 1: Bulk Upload API and Inngest Classification Function

**`POST /api/solicitations/[id]/upload`**

New endpoint that accepts multipart/form-data with multiple files (field name: `files`). Distinct from the existing `/api/upload` route — this is specifically for solicitation package uploads.

Implementation details:
- Auth: `requireStaffOrResponse()` + `X-Company-Id` header
- Tier 1 gate check: reads `tier1_complete` from `company_profiles` (same pattern as existing upload route)
- Verifies solicitation ownership via `(id, company_id)` match
- Accepts `.pdf`, `.docx`, `.doc`, `.xlsx`, `.xls`, `.txt` — rejects others with error message
- Per-file text extraction:
  - PDF: sends to `PDF_SERVICE_URL/extract-text`, falls back to `file.text()` on service failure
  - DOCX/XLSX/TXT: `file.text()` (basic extraction — XML content is AI-readable)
- Creates `solicitation_documents` record with `processing_status='extracting'`, then sends `solicitation.document.uploaded` Inngest event
- After all files: updates `solicitation.document_count` and sets `status='classifying'`
- Returns `{ success, documents: [{id, filename, status}...], errors: [{filename, error}...] }` — failures are isolated so processing continues for valid files

**`lib/inngest/functions/solicitation-classifier.ts`** — `solicitationDocumentClassifier`

Listens to `solicitation.document.uploaded` events. Five steps:

1. **log-start**: Sets `processing_status='extracting'`, logs to `processing_logs`
2. **classify-document**: Calls Claude with first 15,000 chars of extracted text. Prompt asks Claude to classify into one of the 11 government types, extract `amendment_number` (e.g., "Amendment 0001"), `effective_date`, `solicitation_number_detected`, provide `confidence` (high/medium/low), and `reasoning`. Uses `extractJSON` helper to strip markdown code blocks.
3. **update-classification**: Writes `document_type`, `document_type_label`, `classification_confidence`, `classification_reasoning`, `amendment_number`, `effective_date` to `solicitation_documents`. Sets `processing_status='classified'`.
4. **log-completion**: Appends to `processing_logs` with classification metadata
5. **check-all-classified**: Queries all docs for the solicitation. If all are `classified` or `failed`, updates solicitation `status='reconciling'` and sends `solicitation.classification.complete` event (consumed by Plan 03).

**`app/api/inngest/route.ts`** — Added `solicitationDocumentClassifier` to the serve handler's functions array.

### Task 2: Multi-File Upload UI and Classification Display Table

**`SolicitationUploader.tsx`**

Multi-file drag-and-drop upload component with per-file status tracking:
- Props: `{ solicitationId, onUploadComplete }`
- Large drag-drop zone matching existing upload-section.tsx design language (rounded-xl, border-dashed, bg-card)
- Accepts `.pdf,.docx,.doc,.xlsx,.xls,.txt` (multiple files)
- Per-file status states: `queued` (gray), `uploading` (blue pulse), `processing` (amber pulse), `classified` (green), `failed` (red)
- File list shows: icon (FileText/Loader2/CheckCircle2/AlertCircle), filename, size, status badge, X button (queued only)
- Deduplicates files by name on add — won't re-add the same filename
- POST all queued files in one FormData request with X-Company-Id header
- Maps response back to individual file entries (success → processing, error → failed)
- Polls `GET /api/solicitations/{id}/documents` every 3s (max 40 attempts = 2 min) for classification updates
- Calls `onUploadComplete()` when all tracked document IDs reach `classified` or `failed`

**`DocumentClassificationTable.tsx`**

Table view for classified documents:
- Props: `{ solicitationId, documents, onReclassify }`
- Columns: Filename + reasoning snippet, Type badge, Confidence, Amendment #, Status
- Type badge via `DOCUMENT_TYPE_COLORS` from solicitation-types.ts — colored per document type
- TypeBadge click opens dropdown with all 11 types, each showing colored dot + label
- `AlertTriangle` warning icon shown **only** for `low` confidence (medium/high show text only, not icons)
- Amendment # column shows value for amendment docs, dash otherwise
- Sort: base_rfp first (order 0), amendments second (order 1), then others by defined order
- `other_unclassified` docs show dashed-border badge with "Classify this document" prompt text

**`app/solicitations/new/page.tsx`**

3-step guided flow for new solicitation creation:
- **Step 1 (Create)**: Solicitation number (required), title (optional), agency (optional). POST to `/api/solicitations`, handles 409 conflict (duplicate number). Shows "Company not selected" warning.
- **Step 2 (Upload)**: Shows `SolicitationUploader`. `onUploadComplete` callback fetches final document list from `/api/solicitations/{id}/documents`.
- **Step 3 (Review)**: Shows `DocumentClassificationTable`. Reclassify handler PATCHes `/api/solicitations/{id}/documents/{docId}` and updates local state optimistically. "Continue to Reconciliation" button routes to `/solicitations/{id}` (Plan 04's detail page).
- Step indicator bar shows current step (numbered, green checkmark for completed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `f.file.name` type error in SolicitationUploader addFiles callback**
- **Found during:** Task 2, TypeScript check
- **Issue:** `addFiles` receives `File[]` but the filter lambda used `f.file.name` (treating `File` as `UploadFileEntry`). Should be `f.name`.
- **Fix:** Changed `.filter((f) => !existingNames.has(f.file.name))` to `.filter((f) => !existingNames.has(f.name))`
- **Files modified:** `app/components/solicitation/SolicitationUploader.tsx`
- **Commit:** Included in b1d298a

### External Changes Observed

During execution, `app/api/inngest/route.ts` was modified externally (by a parallel Plan 03 agent) to add `solicitationReconciler`. The `lib/inngest/functions/solicitation-reconciler.ts` file also appeared. These are Plan 03 artifacts pre-created ahead of schedule. Left in place — they do not affect Plan 02 functionality and the file compiles cleanly.

## Self-Check

### Files Exist
- `app/api/solicitations/[id]/upload/route.ts` — FOUND
- `lib/inngest/functions/solicitation-classifier.ts` — FOUND
- `app/api/inngest/route.ts` — FOUND (modified)
- `app/components/solicitation/SolicitationUploader.tsx` — FOUND
- `app/components/solicitation/DocumentClassificationTable.tsx` — FOUND
- `app/solicitations/new/page.tsx` — FOUND

### Commits Exist
- `4ad61db` — feat(06-02): create bulk upload API endpoint and Inngest classification function
- `b1d298a` — feat(06-02): create multi-file upload UI and classification display table

### Line Count Verification
- SolicitationUploader.tsx: 430 lines (min: 100) — PASS
- DocumentClassificationTable.tsx: 271 lines (min: 80) — PASS
- app/solicitations/new/page.tsx: 389 lines (min: 50) — PASS
- app/api/solicitations/[id]/upload/route.ts: 253 lines — PASS
- lib/inngest/functions/solicitation-classifier.ts: 213 lines — PASS

## Self-Check: PASSED
