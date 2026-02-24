# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Generated proposals indistinguishable from expert government proposal writers — the kind that win contracts.
**Current focus:** Phase 6 — Multi-Document Ingestion

## Current Position

Phase: 6 of 10 (Multi-Document Ingestion)
Plan: 3 of 4 in current phase (COMPLETE)
Status: Phase 6 in progress
Last activity: 2026-02-24 — 06-03 complete: reconciliation engine, template detector, Inngest reconciler function, and API endpoints for listing/toggling reconciliations and reclassifying documents.

Progress: [█████░░░░░] ~28%

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 4
- Average duration: 10 min
- Total execution time: ~41 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Tier 1 Enterprise Intake | 3 done | ~38 min | ~13 min |
| 6. Multi-Document Ingestion | 3 done | ~20 min | ~7 min |
| 7. Compliance Extraction | TBD | - | - |
| 8. Tier 2 Dynamic Data Call | TBD | - | - |
| 9. Draft Generation | TBD | - | - |
| 10. End-to-End Validation | TBD | - | - |

*Updated after each plan completion*
| Phase 05 P01 | 15 | 3 tasks | 4 files |
| Phase 05 P02 | 8 | 3 tasks | 5 files |
| Phase 05 P03 | 15 | 3 tasks | 7 files |
| Phase 06 P01 | 3 | 3 tasks | 5 files |
| Phase 06 P02 | 6 | 2 tasks | 6 files |
| Phase 06 P03 | 6 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v2.0 init: Two-tier data intake (Tier 1 enterprise foundation, Tier 2 per-bid) — mirrors real proposal shops
- v2.0 init: Exclude past performance and resumes from Tier 1 — per-opportunity assets (Tier 2 only)
- v2.0 init: Human confirmation gate before draft generation — no draft without customer strategy validation
- v2.0 init: ARL test case first, METC second — ARL exercises every capability
- 05-01: TEXT[] for socioeconomic_certs and enterprise_win_themes — standardized SAM.gov values always queried with profile, join table adds complexity with no benefit
- 05-01: JSONB for iso_cmmi_status and dcaa_approved_systems — structured boolean maps treated atomically, TypeScript enforces shape
- 05-01: tier1_complete defaults false on every POST — only Plan 03 gate logic should evaluate and flip this flag
- 05-01: checkSAMStatus is a format-validity mock — real SAM.gov Entity API deferred until API key provisioned
- 05-01: UEI rejects O and I per SAM.gov spec — avoids visual confusion with 0 and 1
- 05-02: Each tab manages its own local form state — switching tabs preserves unsaved work in browser memory without parent state lifting
- 05-02: Toggle switches as button[role=switch] — accessible without UI component library dependency
- 05-02: WordCountIndicator is tab-internal sub-component — no shared lib extraction at this stage
- 05-03: Upload gate checks pre-computed tier1_complete flag (single-column SELECT) not live completeness recalculation — avoids joins/scoring on every upload
- 05-03: isTier1Complete threshold is 80 (not 100) with Corporate Identity floor — informational fields (ISO/CMMI, DCAA) can remain blank without blocking gate
- 05-03: tier1_complete auto-syncs after every profile PUT — eliminates separate mark-complete UX step
- [Phase 06]: solicitations UNIQUE (company_id, solicitation_number) prevents duplicate packages per company
- [Phase 06]: solicitation_documents.superseded_by is a self-referencing FK tracking version lineage within the same table
- [Phase 06]: template_field_mappings.tag ('action_required' | 'reference_only') distinguishes critical fills from informational fields
- [Phase 06 P02]: extractTextFromFile falls back to file.text() on PDF service failure — avoids hard blocking on PDF service unavailability
- [Phase 06 P02]: check-all-classified counts both 'classified' and 'failed' as done — prevents reconciliation from being blocked by one bad document
- [Phase 06 P02]: Polling uses 3s interval with 40 attempt max (2 min) — matches Inngest cold-start + Claude latency budget
- [Phase 06]: Amendment chain compares each amendment against original base document — lineage via is_superseded/superseded_by handled by Inngest step
- [Phase 06]: Only all-documents-failed sets solicitation status to 'failed' — partial failures log per-doc and continue
- [Phase 06]: Manual reclassification always resets classification_confidence to 'high' — user review is more certain than AI

### Pending Todos

None.

### Blockers/Concerns

- Pre-existing build error in route handlers (params need await in Next.js 16) — not blocking current work
- TypeScript errors in various route files — pre-existing, not related to v2.0
- SAM.gov Entity API (api.sam.gov) needs API key before real registration lookup works — mock in place

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 06-03-PLAN.md — reconciliation engine, template detector, Inngest reconciler, and API endpoints
Resume file: 06-04-PLAN.md (reconciliation review UI)

---
*State updated: 2026-02-24 (06-03 complete)*
