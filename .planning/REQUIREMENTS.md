# Requirements: ClicklessAI — RFP Proposal Generator

**Defined:** 2026-02-23
**Core Value:** Generated proposals indistinguishable from expert government proposal writers — the kind that win contracts.

## v2.0 Requirements

Requirements for production readiness per ClicklessAI Blueprint and consultant (Mary Morris) feedback.

### Enterprise Intake — Tier 1 (TIER1)

- [x] **TIER1-01**: User can enter corporate identity (legal entity name, UEI, CAGE, primary NAICS, business size, socioeconomic certifications)
- [x] **TIER1-02**: System validates UEI format, NAICS codes, and performs SAM.gov cross-reference checks
- [x] **TIER1-03**: User can enter active contract vehicles, ISO/CMMI/ITIL status, facility clearance level, DCAA-approved systems
- [x] **TIER1-04**: User can enter corporate overview, core services, enterprise win themes, key differentiators, standard management approach
- [x] **TIER1-05**: Tier 1 data persists across all proposals for a given customer
- [x] **TIER1-06**: System enforces min/max word counts and completeness checks on capability fields

### Multi-Document Ingestion (INGEST)

- [x] **INGEST-01**: User can upload 10-20+ files per solicitation (PDF, DOCX, XLSX) grouped by solicitation number
- [x] **INGEST-02**: System auto-classifies document types (base RFP, SOO/SOW/PWS, amendment, Q&A, pricing template, DD254, clauses, CDRLs, wage determination, provisions)
- [x] **INGEST-03**: System reconciles amendments against base documents, flags superseded language, and ensures latest version controls
- [x] **INGEST-04**: System parses government Q&A responses and identifies answers that modify scope, page limits, evaluation criteria, or submission instructions
- [x] **INGEST-05**: System identifies fillable templates (staffing plans, cost summaries, past perf forms) and maps required fields
- [x] **INGEST-06**: System tracks document version lineage showing which amendment/Q&A changed which requirement

### Compliance Extraction (EXTRACT)

- [x] **EXTRACT-01**: System extracts Section L data (volume structure, page limits per volume, required attachments, forms/certs, formatting rules)
- [x] **EXTRACT-02**: System extracts Section M data (evaluation factors/subfactors, methodology LPTA vs tradeoff, experience thresholds, key personnel requirements)
- [x] **EXTRACT-03**: System extracts admin data (NAICS code, size standard, set-aside designation, contract type, period of performance, CLIN structure)
- [x] **EXTRACT-04**: System captures rating scales and relative weightings from evaluation criteria

### Dynamic Data Call — Tier 2 (TIER2)

- [x] **TIER2-01**: System auto-generates RFP-specific data call form based on extraction results (fields vary per RFP)
- [x] **TIER2-02**: User can confirm opportunity details (prime/sub role, teaming partners, contract type, NAICS size confirmation)
- [x] **TIER2-03**: User can provide past performance references (count driven by RFP-extracted requirements)
- [x] **TIER2-04**: User can upload key personnel resumes, certifications, and Letters of Commitment
- [x] **TIER2-05**: User can provide technical approach inputs (summary of approach, tools/platforms, staffing model, assumptions, risks)
- [x] **TIER2-06**: System collects compliance verification data (org certs, individual certs, facility clearance, NIST 800-171 score, required attachments)

### Draft Generation (DRAFT)

- [x] **DRAFT-01**: System presents human confirmation gate before draft generation (prime/sub, teaming, strategy validation)
- [x] **DRAFT-02**: System generates compliant draft from combined Tier 1 + Tier 2 + extraction data
- [ ] **DRAFT-03**: Draft follows volume structure specified in Section L of the specific RFP
- [ ] **DRAFT-04**: Draft addresses every evaluation factor identified in Section M
- [ ] **DRAFT-05**: Draft respects all formatting constraints from RFP (page limits, font sizes, margin requirements)
- [ ] **DRAFT-06**: System identifies required fill-in templates and maps customer data to correct fields

### End-to-End Validation (VALID)

- [ ] **VALID-01**: System processes ARL test case (18+ files) with correct classification, amendment reconciliation, and extraction
- [ ] **VALID-02**: System processes METC test case (9 files) with GSA-specific rules and Q&A-driven page limit changes
- [ ] **VALID-03**: Generated ARL draft passes compliance matrix coverage check (correct volume structure, eval factor coverage)
- [ ] **VALID-04**: Extraction accuracy meets 95%+ benchmark against manual analysis of test cases

## v1.0 Requirements (Complete)

All v1.0 Framework Alignment requirements are validated. See PROJECT.md Validated section for full list.

**Summary:** 34 requirements complete across Document Architecture, Traceability, Styles, Exhibits, Templates, Content, Formatting, Pipeline, and Output categories.

**Remaining v1.0 items (carried forward or superseded):**
- TRACE-04 (accurate page numbers) — superseded by DRAFT-05 page limit enforcement
- STYLE-02, STYLE-04, STYLE-06, STYLE-07, STYLE-08 — completed in v1.0 Phase 2 gap closure plans
- CONTENT-05, CONTENT-06 — completed in v1.0 Phase 2
- PIPE-02 (page allocation) — superseded by DRAFT-05
- OUTPUT-02, OUTPUT-04, OUTPUT-05, OUTPUT-06 — completed in v1.0 Phase 4

## Future Requirements

Deferred beyond v2.0.

- **ADV-01**: Acronym management (define on first use, glossary)
- **ADV-02**: Color team review version with highlighted themes and comments
- **ADV-03**: Automated Section L format verification (beyond extraction)
- **ADV-04**: Alt text for accessibility on all exhibits
- **ADV-05**: Real-time collaboration features
- **ADV-06**: Pricing calculation engine (currently manual)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile app | Desktop workflow sufficient for proposal writers |
| Template designer UI | Templates managed in code |
| OCR for scanned PDFs | Require text-based PDFs |
| Past performance library in Tier 1 | Per consultant: per-opportunity asset, Tier 2 only |
| Resume bank in Tier 1 | Per consultant: dynamic, opportunity-specific, Tier 2 only |
| Real-time collaboration | Single-user tool, external review process |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TIER1-01 | Phase 5 | Complete |
| TIER1-02 | Phase 5 | Complete |
| TIER1-03 | Phase 5 | Complete |
| TIER1-04 | Phase 5 | Complete |
| TIER1-05 | Phase 5 | Complete |
| TIER1-06 | Phase 5 | Complete |
| INGEST-01 | Phase 6 | Complete |
| INGEST-02 | Phase 6 | Complete |
| INGEST-03 | Phase 6 | Complete |
| INGEST-04 | Phase 6 | Complete |
| INGEST-05 | Phase 6 | Complete |
| INGEST-06 | Phase 6 | Complete |
| EXTRACT-01 | Phase 7 | Complete |
| EXTRACT-02 | Phase 7 | Complete |
| EXTRACT-03 | Phase 7 | Complete |
| EXTRACT-04 | Phase 7 | Complete |
| TIER2-01 | Phase 8 | Complete |
| TIER2-02 | Phase 8 | Complete |
| TIER2-03 | Phase 8 | Complete |
| TIER2-04 | Phase 8 | Complete |
| TIER2-05 | Phase 8 | Complete |
| TIER2-06 | Phase 8 | Complete |
| DRAFT-01 | Phase 9 | Complete |
| DRAFT-02 | Phase 9 | Complete |
| DRAFT-03 | Phase 9 | Pending |
| DRAFT-04 | Phase 9 | Pending |
| DRAFT-05 | Phase 9 | Pending |
| DRAFT-06 | Phase 9 | Pending |
| VALID-01 | Phase 10 | Pending |
| VALID-02 | Phase 10 | Pending |
| VALID-03 | Phase 10 | Pending |
| VALID-04 | Phase 10 | Pending |

**Coverage:**
- v2.0 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 — traceability populated by roadmapper*
