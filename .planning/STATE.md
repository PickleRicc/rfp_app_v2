# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Generated proposals indistinguishable from expert government proposal writers — the kind that win contracts.
**Current focus:** Phase 8 — Tier 2 Dynamic Data Call

## Current Position

Phase: 8 of 10 (Tier 2 Dynamic Data Call)
Plan: 2 of 3 in current phase
Status: Phase 8 Plan 02 COMPLETE — Data Call accordion UI (DataCallView container, OpportunityDetailsSection, PastPerformanceSection, TechnicalApproachSection). Plan 03 (Key Personnel + Compliance Verification) next.
Last activity: 2026-02-25 — Phase 8 P02: Data Call accordion UI complete.

Progress: [████████░░] ~62%

## Performance Metrics

**Velocity:**
- Total plans completed (v2.0): 9
- Average duration: ~8 min
- Total execution time: ~68 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 5. Tier 1 Enterprise Intake | 3 done | ~38 min | ~13 min |
| 6. Multi-Document Ingestion | 5 done | ~25 min | ~5 min |
| 7. Compliance Extraction | 2 of 2 done | ~12 min | ~6 min |
| 8. Tier 2 Dynamic Data Call | 1 done | ~6 min | ~6 min |
| 9. Draft Generation | TBD | - | - |
| 10. End-to-End Validation | TBD | - | - |

*Updated after each plan completion*
| Phase 05 P01 | 15 | 3 tasks | 4 files |
| Phase 05 P02 | 8 | 3 tasks | 5 files |
| Phase 05 P03 | 15 | 3 tasks | 7 files |
| Phase 06 P01 | 3 | 3 tasks | 5 files |
| Phase 06 P02 | 6 | 2 tasks | 6 files |
| Phase 06 P03 | 6 | 2 tasks | 6 files |
| Phase 06 P04 | 5 | 2 tasks | 6 files |
| Phase 06 P05 | 5 | 1 tasks | 1 files |
| Phase 07 P01 | 6 | 3 tasks | 7 files |
| Phase 07 P02 | — | 2+fixes | 6 files |
| Phase 08 P01 | 6 | 2 tasks | 5 files |
| Phase 08 P02 | 4 | 2 tasks | 5 files |

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
- [Phase 06 P04]: EnhancedDocumentTable wraps DocumentClassificationTable rather than forking it — preserves Plan 02 reclassify behavior
- [Phase 06 P04]: fetchTemplateFields only queries template-eligible types — mirrors Inngest reconciler pre-filter to avoid wasteful API calls
- [Phase 06 P04]: ReconciliationView groups by target_document_id — shows which base document each amendment/Q&A modified
- [Phase 06 P04]: AmandmentChainView shows "Base Document — No Amendments" simplified view when no amendments exist — avoids empty chain UI
- [Phase 06 P04]: Undo button shows expand/collapse only when text exists — reduces visual clutter for metadata-only changes
- [Phase 06 P04]: Human verified full end-to-end flow (all 11 verification steps) — complete multi-document ingestion pipeline confirmed working
- [Phase 06-05]: Supersession writes scoped inside insertError else-block — only written when document_reconciliations insert succeeds, preventing is_superseded=true without corresponding reconciliation records
- [Phase 06-05]: Base document marked superseded only when supersedes_section change_type exists — additive_section or general_modification changes do not trigger is_superseded
- [Phase 07-01]: Each extraction category runs in its own Inngest step — failure in Section L does not prevent Section M extraction (error isolation)
- [Phase 07-01]: User override preservation: is_user_override=true rows are skipped during re-extraction in upsertExtractions()
- [Phase 07-01]: extraction_status tracked per-field (not per-solicitation) — UI can show loading state per category independently
- [Phase 07-01]: Event trigger only fires when reconciliation status is ready — prevents spurious extraction on failed solicitations
- [Phase 07-01]: original_ai_value set only on first override — subsequent edits preserve the original AI value for clean revert
- [Phase 08-01]: generateDataCallSchema() fetches only completed extractions — pending/failed rows do not pollute the schema
- [Phase 08-01]: POST upload auto-creates data_call_response row if absent — file uploads work before first form save
- [Phase 08-01]: Past performance default count is 3 when extraction lacks references_required — matches industry norm
- [Phase 08-01]: Key personnel dynamic_count defaults to 0 (not a fixed number) — accurate when RFP specifies no named positions
- [Phase 08-02]: DataCallView uses JSON.stringify dirty detection — simple and reliable for nested form state
- [Phase 08-02]: PastPerformanceSection initializes from section.dynamic_count when data array is empty — respects extraction count on first render
- [Phase 08-02]: renderSection is a standalone function outside component — avoids hook-in-conditional pattern

### Pending Todos

None.

### Blockers/Concerns

- Pre-existing build error in route handlers (params need await in Next.js 16) — not blocking current work
- TypeScript errors in various route files — pre-existing, not related to v2.0
- SAM.gov Entity API (api.sam.gov) needs API key before real registration lookup works — mock in place

## Session Continuity

Last session: 2026-02-25
Stopped at: Completed 08-02-PLAN.md — Data Call accordion UI complete
Resume file: Phase 8 Plan 03 — Key Personnel + Compliance Verification sections

---
*State updated: 2026-02-25 (Phase 8 P02 complete — Data Call accordion UI: DataCallView, OpportunityDetailsSection, PastPerformanceSection, TechnicalApproachSection, Data Call tab on solicitation page)*
