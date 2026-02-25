---
phase: 07-compliance-extraction
plan: "02"
subsystem: compliance-extraction-ui-and-routing
tags: [compliance, ui, document-routing, classification, inngest, react]
dependency_graph:
  requires:
    - 07-01 (compliance_extractions table, extraction engine, API endpoints)
  provides:
    - Compliance tab UI with 9-category accordion display
    - Targeted document routing (documents routed by type to extraction functions)
    - Procurement-vehicle-agnostic document classification (TOR/RFQ/RFP → base_rfp)
    - Per-section re-extract + Re-extract All
  affects:
    - 08-tier2-data-call (compliance data now visible and editable before Tier 2)
tech_stack:
  patterns:
    - Document routing via EXTRACTION_ROUTING config + getDocumentsForCategory helper
    - shouldExtract() guard for per-category Inngest step skipping
    - Accordion UI with per-section loading states
key_files:
  created:
    - .planning/phases/07-compliance-extraction/07-UAT.md
  modified:
    - lib/inngest/functions/solicitation-compliance-extractor.ts (document routing, per-category re-extract)
    - lib/inngest/functions/solicitation-classifier.ts (procurement-agnostic classification prompt)
    - lib/supabase/solicitation-types.ts (Base RFP → Base Solicitation label)
    - app/api/solicitations/[id]/compliance/route.ts (pass category in re-extract event)
    - app/components/solicitation/ComplianceExtractionView.tsx (Re-extract All button)
decisions:
  - "Document routing: each extraction category gets only relevant doc types via primary → fallback → always → universal fallback"
  - "Amendments only appended to base-solicitation categories (section_l, section_m, admin_data, etc.), NOT standalone attachments (sow_pws, security_reqs)"
  - "sow_pws gets both soo_sow_pws + base_rfp as primary (SOW may be embedded in base solicitation)"
  - "Classifier prompt is procurement-vehicle-agnostic: TOR, RFQ, RFP, TORP, fair opportunity all → base_rfp"
  - "soo_sow_pws classification restricted to STANDALONE attachments only"
  - "Amendment classification requires explicit modification intent (SF30, Amendment No.), not just solicitation number reference"
  - "Per-section re-extract passes category in Inngest event; shouldExtract() guard skips non-matching steps"
  - "UI label changed from 'Base RFP' to 'Base Solicitation' for procurement-vehicle agnosticism"
metrics:
  completed_date: "2026-02-25"
  tasks: 2 (planned) + unplanned routing/classification fixes
  files: 6
---

# Phase 07 Plan 02: Compliance UI + Document Routing Summary

Compliance tab UI with 9-category accordion display, plus targeted document routing and procurement-agnostic classification fixes discovered during testing.

## What Was Built

### Compliance Tab UI (07-02 planned work)
- ComplianceExtractionView component (2150+ lines) with 9 accordion sections
- Section L: volume structure table, required attachments/forms, formatting rules
- Section M: evaluation factors as indented tree with colored weight badges
- Admin Data: key-value pairs + CLIN structure table
- Rating Scales, SOW/PWS, Cost/Price, Past Performance, Key Personnel, Security Requirements
- Confidence indicators (green/amber/red left borders)
- Inline editing with User Override badge + revert
- Skeleton loaders during extraction
- Per-section Re-extract + Re-extract All button
- Error states with Retry and Add Manually options

### Document Routing (unplanned — discovered during testing)
- `EXTRACTION_ROUTING` config maps each of 9 categories to primary/fallback/always doc types
- `getDocumentsForCategory()` helper: primary → fallback → always → universal fallback
- Amendments only routed to base-solicitation categories, not standalone attachments
- `[doc-routing]` diagnostic logs show per-category doc counts and routing decisions

### Classification Fixes (unplanned — discovered during testing)
- `base_rfp` description now covers RFP, RFQ, TOR, TORP, fair opportunity notices
- `soo_sow_pws` restricted to standalone attachments (not embedded in main solicitation)
- `amendment` requires explicit modification intent (SF30, Amendment No.)
- UI label: "Base RFP" → "Base Solicitation"

### Per-Section Re-extract (UAT gap fix)
- API route passes `category` in Inngest event payload
- Inngest function reads optional `targetCategory`, `shouldExtract()` skips non-matching steps
- "Re-extract All" button triggers full pipeline without category filter

## UAT Results

16 tests: 15 passed, 1 issue (fixed in-session)
- Issue #12: Re-extract triggered all sections → fixed with per-category routing

## Commits

- 556851a — feat(07): targeted document routing + procurement-agnostic classification
- ae0f902 — test(07): complete UAT - 15 passed, 1 issue
- 4f39155 — fix(07): per-section re-extract + Re-extract All button
