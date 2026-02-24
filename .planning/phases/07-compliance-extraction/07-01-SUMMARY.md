---
phase: 07-compliance-extraction
plan: "01"
subsystem: compliance-extraction-backend
tags: [inngest, anthropic, compliance, section-l, section-m, admin-data, rating-scales, supabase]
dependency_graph:
  requires:
    - 06-multi-document-ingestion (solicitation_documents with extracted_text, solicitation-reconciler.ts)
  provides:
    - compliance_extractions table with 4-category extraction pipeline
    - solicitationComplianceExtractor Inngest function (event-driven, auto-triggers after reconciliation)
    - GET/PATCH compliance API endpoints
  affects:
    - 08-tier2-data-call (consumes compliance_extractions as structured input)
tech_stack:
  added:
    - compliance_extractions Supabase table (JSONB field_value, RLS enabled)
  patterns:
    - Inngest 6-step pipeline with per-category error isolation
    - Anthropic structured JSON extraction with extractJSON helper
    - User override preservation with original_ai_value revert
key_files:
  created:
    - supabase_tables/supabase-compliance-extraction-migration.sql
    - lib/supabase/compliance-types.ts
    - lib/ingestion/compliance-extractor.ts
    - lib/inngest/functions/solicitation-compliance-extractor.ts
    - app/api/solicitations/[id]/compliance/route.ts
  modified:
    - lib/inngest/functions/solicitation-reconciler.ts (event trigger added in finalize step)
    - app/api/inngest/route.ts (solicitationComplianceExtractor registered)
decisions:
  - "Each extraction category runs in its own Inngest step — failure in Section L does not prevent Section M extraction"
  - "User override preservation: is_user_override=true rows are skipped during re-extraction via upsertExtractions()"
  - "extraction_status tracked per-field (not per-solicitation) — UI can show loading state per category independently"
  - "Event trigger only fires when reconciliation status is ready (not failed) — prevents spurious extraction on failed solicitations"
  - "original_ai_value set only on first override — subsequent edits to an already-overridden field preserve the original AI value for clean revert"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-02-24"
  tasks: 3
  files: 7
---

# Phase 07 Plan 01: Compliance Extraction Backend Summary

Complete backend for Phase 7 compliance extraction: `compliance_extractions` table with 4-category AI extraction pipeline via Inngest, triggered automatically after Phase 6 reconciliation, with GET/PATCH REST API serving and editing extracted data.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Database schema and TypeScript types | 2c0446f | supabase-compliance-extraction-migration.sql, compliance-types.ts |
| 2 | Compliance extraction engine and Inngest pipeline | 7dd6a05 | compliance-extractor.ts, solicitation-compliance-extractor.ts, solicitation-reconciler.ts, route.ts |
| 3 | Compliance extraction API endpoints | 33fa0f0 | app/api/solicitations/[id]/compliance/route.ts |

## What Was Built

### Database Schema (`compliance_extractions` table)
- One row per extracted field per solicitation (e.g., "volume_structure", "naics_code")
- `category` CHECK constraint: section_l | section_m | admin_data | rating_scales
- `field_value` JSONB — flexible storage for strings, arrays, nested objects
- `confidence` CHECK constraint: high | medium | low
- `is_user_override` + `original_ai_value` for edit/revert cycle
- `extraction_status` per field: pending | extracting | completed | failed
- 3 indexes: solicitation lookup, category grouping, source document reference
- RLS with permissive authenticated-user policy (IF NOT EXISTS pattern)

### TypeScript Types (`lib/supabase/compliance-types.ts`)
- `ExtractionCategory`, `ExtractionConfidence`, `ExtractionStatus` union types
- `EXTRACTION_CATEGORY_LABELS`, `EXTRACTION_CATEGORY_ICONS`, `CONFIDENCE_COLORS` display constants
- `ComplianceExtraction` interface (mirrors DB table exactly)
- `ComplianceExtractionsByCategory` grouped API response type
- `SectionLFields`, `SectionMFields`, `AdminDataFields`, `RatingScaleFields` typed value structures

### Extraction Engine (`lib/ingestion/compliance-extractor.ts`)
- `extractSectionL()` — volumes/page limits, required attachments/forms, formatting rules
- `extractSectionM()` — evaluation factors/subfactors, methodology, thresholds, key personnel
- `extractAdminData()` — NAICS code, size standard, set-aside, contract type, PoP, CLINs
- `extractRatingScales()` — rating scale definitions per factor, relative weightings
- Each function: Anthropic claude-sonnet-4-5, max_tokens 4096, temperature 0
- Government proposal analyst system prompt per function
- `extractJSON` helper strips markdown code blocks from Anthropic responses
- Returns empty array on parse failure (never throws to caller)
- `confidence` derived from Claude's explicit `"found": true/false` field in response

### Inngest Pipeline (`lib/inngest/functions/solicitation-compliance-extractor.ts`)
- Triggered by `solicitation.reconciliation.complete` event (sent by reconciler on ready status)
- Step 1 `fetch-documents`: load reconciled/classified docs, build text corpus (base docs first, skip superseded)
- Step 2 `extract-section-l`: call extractSectionL, upsert results, log to processing_logs
- Step 3 `extract-section-m`: call extractSectionM, upsert results, log to processing_logs
- Step 4 `extract-admin-data`: call extractAdminData, upsert results, log to processing_logs
- Step 5 `extract-rating-scales`: call extractRatingScales, upsert results, log to processing_logs
- Step 6 `finalize`: count completed/failed, log summary
- Error isolation: each step catches its own errors, returns {failed: true} instead of throwing
- User override preservation: `upsertExtractions()` skips rows where `is_user_override=true`

### Reconciler Event Trigger (modification to `solicitation-reconciler.ts`)
Added `inngest.send({ name: 'solicitation.reconciliation.complete', data: { solicitationId } })` in the finalize step, guarded by `if (finalSolicitationStatus === 'ready')`.

### API Endpoints (`app/api/solicitations/[id]/compliance/route.ts`)
- **GET**: Returns extractions grouped by category as `ComplianceExtractionsByCategory`, includes `extraction_status` per row for UI loading states
- **PATCH op1 (edit)**: Updates `field_value`, sets `is_user_override=true`, captures `original_ai_value` on first override only
- **PATCH op2 (re-extract)**: Resets non-overridden rows to `pending`, sends `solicitation.compliance.re-extract` Inngest event
- **PATCH op3 (revert)**: Restores `original_ai_value` to `field_value`, clears `is_user_override`
- Auth: `requireStaffOrResponse()` + X-Company-Id header + solicitation ownership check
- Async params pattern for Next.js 15+

## Event Chain

```
solicitation.classification.complete
  → solicitation-reconciler (Phase 6)
    → finalize step → solicitation.reconciliation.complete (only when status=ready)
      → solicitation-compliance-extractor (Phase 7)
        → 4 parallel extraction steps → compliance_extractions table
          → solicitation.compliance.re-extract (on-demand per-category re-extraction via PATCH API)
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files created:
- supabase_tables/supabase-compliance-extraction-migration.sql — FOUND
- lib/supabase/compliance-types.ts — FOUND
- lib/ingestion/compliance-extractor.ts — FOUND
- lib/inngest/functions/solicitation-compliance-extractor.ts — FOUND
- app/api/solicitations/[id]/compliance/route.ts — FOUND

Commits:
- 2c0446f — feat(07-01): database schema and TypeScript types
- 7dd6a05 — feat(07-01): compliance extraction engine and Inngest pipeline function
- 33fa0f0 — feat(07-01): compliance extraction API endpoints (GET and PATCH)

TypeScript: 0 errors in new files (pre-existing project errors unchanged).
