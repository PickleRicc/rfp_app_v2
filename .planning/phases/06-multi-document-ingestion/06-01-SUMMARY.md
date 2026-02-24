---
phase: 06-multi-document-ingestion
plan: 01
subsystem: data-layer
tags: [database, migrations, api, types, solicitations]
dependency_graph:
  requires: [05-03-SUMMARY.md]
  provides:
    - solicitations table (company-scoped solicitation packages)
    - solicitation_documents table (individual files in a package)
    - document_reconciliations table (amendment/Q&A change tracking)
    - template_field_mappings table (fillable field detection)
    - TypeScript types for all tables
    - Solicitation CRUD API
  affects:
    - 06-02 (document upload uses solicitations and solicitation_documents)
    - 06-03 (classification writes to solicitation_documents)
    - 06-04 (reconciliation writes to document_reconciliations)
tech_stack:
  added: []
  patterns:
    - Additive SQL migration (IF NOT EXISTS throughout, safe to re-run)
    - UNIQUE constraint on (company_id, solicitation_number) prevents duplicates
    - Self-referencing FK (superseded_by) for document version lineage
    - Company-scoped API using X-Company-Id header + ownership verification
    - TypeScript types mirroring DB schema with JSDoc documentation
    - DOCUMENT_TYPE_LABELS and DOCUMENT_TYPE_COLORS constants for UI
key_files:
  created:
    - supabase_tables/supabase-solicitation-ingestion-migration.sql
    - lib/supabase/solicitation-types.ts
    - app/api/solicitations/route.ts
    - app/api/solicitations/[id]/route.ts
    - app/api/solicitations/[id]/documents/route.ts
  modified: []
decisions:
  - "solicitations(company_id, solicitation_number) UNIQUE prevents duplicate packages per company"
  - "solicitation_documents.superseded_by is a self-referencing FK — tracks version lineage within the same table"
  - "document_reconciliations.source_type CHECK ('amendment' | 'qa_response') — provenance tracking mirrors user decision from planning context"
  - "template_field_mappings.tag CHECK ('action_required' | 'reference_only') — distinguishes critical fills from informational fields per user decision"
  - "RLS enabled on all 4 tables with permissive authenticated-user policies — row-level filtering enforced in API layer via company_id check"
  - "PATCH [id] builds update payload dynamically — only provided fields are updated"
  - "GET [id]/documents sorts amendments first by amendment_number, then others by sort_order in application layer — Supabase lacks conditional ORDER BY"
  - "Pre-existing Next.js 16 params-must-be-Promise TS error affects all [id] routes — not introduced by this plan, documented in STATE.md blockers"
metrics:
  duration: ~3 min
  completed_date: "2026-02-24"
  tasks: 3
  files_created: 5
  files_modified: 0
---

# Phase 6 Plan 01: Multi-Document Ingestion Data Layer Summary

**One-liner:** Four-table SQL schema (solicitations, solicitation_documents, document_reconciliations, template_field_mappings) with TypeScript types and CRUD API for government solicitation package ingestion.

## What Was Built

### Database Schema (Task 1)

Created `supabase_tables/supabase-solicitation-ingestion-migration.sql` with 4 new tables:

**solicitations** — One row per procurement package, keyed by `(company_id, solicitation_number)`. Status pipeline: `uploading -> classifying -> reconciling -> ready | failed`.

**solicitation_documents** — Individual files within a package. Stores document type taxonomy (11 types: base_rfp, soo_sow_pws, amendment, qa_response, pricing_template, dd254, clauses, cdrls, wage_determination, provisions, other_unclassified), AI classification confidence, amendment lineage via `is_superseded` and self-referencing `superseded_by` FK, and extracted text.

**document_reconciliations** — Change tracking for amendments and Q&A responses. Records what original text was superseded, what the replacement is, and which section was affected. `is_active` boolean lets users undo a reconciliation. `source_type` distinguishes formal amendments from informal Q&A clarifications.

**template_field_mappings** — Fillable fields detected in pricing templates, DD254, etc. `auto_fill_source` maps to company_profiles columns for pre-population. `tag` distinguishes action-required fields from reference-only fields.

All tables have RLS enabled, 8 performance indexes, and use IF NOT EXISTS for safe re-runs.

### TypeScript Types (Task 2)

Created `lib/supabase/solicitation-types.ts` exporting:
- Type unions: `SolicitationStatus`, `SolicitationDocumentType`, `ClassificationConfidence`, `DocumentProcessingStatus`, `ReconciliationChangeType`, `ReconciliationSourceType`, `TemplateFieldType`, `TemplateFieldTag`
- Constants: `DOCUMENT_TYPE_LABELS` (for badge text), `DOCUMENT_TYPE_COLORS` (Tailwind CSS classes)
- Interfaces: `Solicitation`, `SolicitationDocument`, `DocumentReconciliation`, `TemplateFieldMapping`
- Convenience types: `SolicitationWithDocuments`, `CreateSolicitationRequest`, `UpdateSolicitationRequest`

### Solicitation CRUD API (Task 3)

Three route files following existing auth patterns:

**`GET /api/solicitations`** — List company solicitations (company-scoped via X-Company-Id, ordered by created_at DESC).

**`POST /api/solicitations`** — Create solicitation. Validates non-empty solicitation_number, checks for duplicates (returns 409 with existing_id on conflict).

**`GET /api/solicitations/[id]`** — Fetch single solicitation with documents joined, ordered by sort_order + document_type.

**`PATCH /api/solicitations/[id]`** — Update title, agency, or status. Dynamic payload — only provided fields are updated. Validates status against allowed enum.

**`GET /api/solicitations/[id]/documents`** — List all documents for a solicitation. Amendments sorted first by amendment_number, remaining documents by sort_order. Includes classification data, processing status, amendment info.

All endpoints use `requireStaffOrResponse()` auth and verify company ownership before returning or modifying data.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

### Files Exist
- `supabase_tables/supabase-solicitation-ingestion-migration.sql` — FOUND
- `lib/supabase/solicitation-types.ts` — FOUND
- `app/api/solicitations/route.ts` — FOUND
- `app/api/solicitations/[id]/route.ts` — FOUND
- `app/api/solicitations/[id]/documents/route.ts` — FOUND

### Commits Exist
- f84d36b — feat(06-01): create multi-document ingestion database migration
- 7291663 — feat(06-01): create TypeScript types for solicitation ingestion
- 0c34b3c — feat(06-01): create solicitation CRUD API endpoints

## Self-Check: PASSED
