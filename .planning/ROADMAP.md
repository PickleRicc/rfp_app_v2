# Roadmap: ClicklessAI — v2.0 Production Readiness

## Overview

This roadmap transforms ClicklessAI from a single-document prototype to a production-grade multi-document solicitation system. The six phases follow the data flow of a real proposal shop: enterprise onboarding (Tier 1) → multi-document ingestion → AI compliance extraction → dynamic data call (Tier 2) → draft generation from combined sources → end-to-end validation against real RFP packages. Completing this milestone makes the system ready for paying customers.

v1.0 completed phases 1–4 (framework alignment). v2.0 begins at phase 5.

## Phases

**Phase Numbering:**
- Integer phases (5–10): v2.0 Production Readiness work
- Decimal phases (X.1, X.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 5: Tier 1 Enterprise Intake** - One-time onboarding captures stable corporate data that persists across all proposals (completed 2026-02-23)
- [x] **Phase 6: Multi-Document Ingestion** - System accepts full solicitation packages, classifies documents, and reconciles amendments (completed 2026-02-24)
- [ ] **Phase 7: Compliance Extraction** - AI extracts Section L/M requirements and admin data from reconciled package
- [ ] **Phase 8: Tier 2 Dynamic Data Call** - System generates RFP-specific intake form driven by extraction results
- [ ] **Phase 9: Draft Generation** - System produces compliant first draft from Tier 1 + Tier 2 + extraction data
- [ ] **Phase 10: End-to-End Validation** - System successfully processes both ARL and METC test packages end-to-end

## Phase Details

### Phase 5: Tier 1 Enterprise Intake
**Goal**: A customer can complete one-time enterprise onboarding and have that data available for every subsequent proposal
**Depends on**: Nothing (first v2.0 phase; existing v1.0 pipeline continues to function independently)
**Requirements**: TIER1-01, TIER1-02, TIER1-03, TIER1-04, TIER1-05, TIER1-06
**Success Criteria** (what must be TRUE):
  1. User can enter and save all corporate identity fields (legal entity name, UEI, CAGE, primary NAICS, business size, socioeconomic certifications) in one form
  2. System rejects invalid UEI format and invalid NAICS codes before saving, and surface SAM.gov cross-reference status
  3. User can enter contract vehicles, ISO/CMMI/ITIL certifications, facility clearance level, and DCAA-approved system status
  4. User can enter corporate overview, core services, enterprise win themes, key differentiators, and standard management approach text
  5. Tier 1 data entered for a company is pre-populated (not re-entered) when that company starts a new proposal
**Plans**: 3 plans
Plans:
- [ ] 05-01-PLAN.md — Schema migration, TypeScript types, validation library, API updates
- [ ] 05-02-PLAN.md — 3-tab Tier 1 Enterprise Intake UI (Corporate Identity, Vehicles & Certs, Capabilities)
- [ ] 05-03-PLAN.md — Completeness tracking, mandatory gate enforcement, human verification

### Phase 6: Multi-Document Ingestion
**Goal**: User can upload an entire solicitation package and the system produces a unified, reconciled requirement set with no outdated language carried forward
**Depends on**: Phase 5
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04, INGEST-05, INGEST-06
**Success Criteria** (what must be TRUE):
  1. User can upload 10–20+ files (PDF, DOCX, XLSX) in a single solicitation upload session grouped under one solicitation number
  2. Every uploaded document is automatically labeled with its document type (base RFP, SOO/SOW/PWS, amendment, Q&A, pricing template, DD254, clauses, CDRLs, wage determination, provisions) without user input
  3. When an amendment supersedes language in a base document, the superseded text is flagged and only the latest version is used downstream
  4. Q&A responses that modify scope, page limits, evaluation criteria, or submission instructions are identified and tagged so downstream extraction reflects the changes
  5. Fillable templates (staffing plans, cost summaries, past performance forms) are identified and their required fields mapped
**Plans**: 5 plans
Plans:
- [x] 06-01-PLAN.md — Database schema (solicitations, solicitation_documents, reconciliations, template fields), TypeScript types, solicitation CRUD API
- [x] 06-02-PLAN.md — Multi-file drag-drop upload UI, bulk upload API, AI document classification via Inngest
- [x] 06-03-PLAN.md — Amendment reconciliation engine, Q&A modification parser, fillable template detector, reconciliation Inngest function
- [x] 06-04-PLAN.md — Solicitation detail UI (reconciliation view, amendment chain, template fields panel), solicitations list page, human verification
- [ ] 06-05-PLAN.md — Gap closure: write is_superseded/superseded_by on solicitation_documents in reconciler

### Phase 7: Compliance Extraction
**Goal**: After ingestion, the system automatically surfaces all compliance obligations — volumes, page limits, eval factors, admin data — with no manual review required to drive the Tier 2 data call
**Depends on**: Phase 6
**Requirements**: EXTRACT-01, EXTRACT-02, EXTRACT-03, EXTRACT-04
**Success Criteria** (what must be TRUE):
  1. System displays extracted Section L data: volume names, page limits per volume, required attachments, required forms and certifications, and formatting rules
  2. System displays extracted Section M data: all evaluation factors and subfactors, evaluation methodology (LPTA or tradeoff), experience thresholds, and key personnel requirements
  3. System displays extracted admin data: NAICS code, size standard, set-aside designation, contract type, period of performance, and CLIN structure
  4. System shows rating scales and relative factor weightings from the evaluation criteria section
**Plans**: 2 plans
Plans:
- [ ] 07-01-PLAN.md — Extraction data layer (DB schema, types, AI extraction engine, Inngest pipeline, API endpoints)
- [ ] 07-02-PLAN.md — Compliance tab UI (accordion display, inline editing, confidence indicators, amendment impact, human verification)

### Phase 8: Tier 2 Dynamic Data Call
**Goal**: User is presented with an RFP-specific intake form — driven by what that particular RFP requires — and can complete it before draft generation begins
**Depends on**: Phase 7
**Requirements**: TIER2-01, TIER2-02, TIER2-03, TIER2-04, TIER2-05, TIER2-06
**Success Criteria** (what must be TRUE):
  1. After extraction completes, the system generates a data call form whose fields reflect what the specific RFP requires (e.g., correct number of past performance references, specific certification types)
  2. User can confirm opportunity-level details: prime or sub role, teaming partners, contract type, and NAICS size standard for this opportunity
  3. User can provide past performance references with the count and fields matching what the RFP extracted
  4. User can upload key personnel resumes, certifications, and Letters of Commitment as required by the RFP
  5. User can enter technical approach inputs: summary of approach, tools and platforms, staffing model, assumptions, and risks
  6. User can provide compliance verification data: org certifications, individual certifications, facility clearance confirmation, NIST 800-171 score, and required attachments
**Plans**: TBD

### Phase 9: Draft Generation
**Goal**: User confirms strategy at a human gate, then receives a compliant first draft that follows the RFP's volume structure, addresses every evaluation factor, and respects all formatting constraints
**Depends on**: Phase 8
**Requirements**: DRAFT-01, DRAFT-02, DRAFT-03, DRAFT-04, DRAFT-05, DRAFT-06
**Success Criteria** (what must be TRUE):
  1. Before generation begins, user is presented with a confirmation screen showing prime/sub role, teaming partners, contract type, and strategy — and must explicitly confirm before draft proceeds
  2. Generated draft is built from Tier 1 corporate data, Tier 2 opportunity data, and extracted RFP requirements — not from a generic template
  3. Draft volume structure matches the volume names and order specified in Section L of the specific RFP
  4. Each evaluation factor identified in Section M has corresponding content in the draft with explicit responsive coverage
  5. Draft content fits within page limits extracted from the RFP; system flags sections approaching or exceeding limits
  6. Required fill-in templates (staffing plans, cost summaries, past performance forms) are populated with customer data mapped to the correct template fields
**Plans**: TBD

### Phase 10: End-to-End Validation
**Goal**: Both ARL and METC test packages pass through the complete pipeline and produced drafts meet the acceptance criteria defined in the Blueprint
**Depends on**: Phase 9
**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04
**Success Criteria** (what must be TRUE):
  1. ARL test package (18+ files) is fully ingested with every document correctly classified, all amendment changes reconciled, and no outdated language in the output
  2. METC test package (9 files) is fully ingested with GSA-specific rules applied, WOSB set-aside recognized, and Q&A-driven page limit expansion (25 → 75 pages) reflected in extraction
  3. Generated ARL draft passes compliance matrix coverage check: correct volume structure, all Section M evaluation factors addressed, page limits respected
  4. Extraction accuracy for both test cases meets 95%+ benchmark when compared against manual analysis of Section L, Section M, and admin data
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 5 → 6 → 7 → 8 → 9 → 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Tier 1 Enterprise Intake | 3/3 | Complete    | 2026-02-23 |
| 6. Multi-Document Ingestion | 5/5 | Complete   | 2026-02-24 |
| 7. Compliance Extraction | 0/2 | Not started | - |
| 8. Tier 2 Dynamic Data Call | 0/TBD | Not started | - |
| 9. Draft Generation | 0/TBD | Not started | - |
| 10. End-to-End Validation | 0/TBD | Not started | - |

---
*v1.0 roadmap (phases 1–4): Complete as of 2026-02-09*
*v2.0 roadmap created: 2026-02-23*
