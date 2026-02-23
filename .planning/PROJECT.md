# ClicklessAI — RFP Proposal Generator

## What This Is

A production-grade proposal generation platform for government IT contractors. Users onboard with enterprise data (Tier 1), upload multi-document solicitation packages, the system extracts compliance requirements using Claude AI, generates a dynamic data call (Tier 2), and produces submission-ready proposal volumes as polished DOCX files. Built for Impyrian, designed to service paying customers.

## Core Value

Generated proposals must be indistinguishable from those written by expert government proposal writers — the kind that win contracts.

## Current Milestone: v2.0 Production Readiness

**Goal:** Transform from single-document prototype to production-grade multi-document solicitation system with two-tier data intake, AI compliance extraction, and end-to-end validation against real RFP packages.

**Target features:**
- Two-tier data intake (enterprise foundation + RFP-specific data call)
- Multi-document solicitation ingestion with amendment reconciliation
- AI-powered Section L/M compliance extraction
- Dynamic Tier 2 data call generation
- Upgraded draft generation from combined data sources
- End-to-end validation against ARL and METC test packages

## Requirements

### Validated

<!-- Shipped and confirmed working from v1.0 Framework Alignment -->

- ✓ Multi-stage document processing pipeline (classifier → analyzer → generator) — v1.0
- ✓ RFP document upload and text extraction (PDF, DOCX) — v1.0
- ✓ AI-powered requirement extraction and categorization — v1.0
- ✓ Multi-company support with company profiles — v1.0
- ✓ DOCX proposal generation with professional styling — v1.0
- ✓ Volume structure (Technical, Management, Past Performance, Price) — v1.0
- ✓ Executive summary generation — v1.0
- ✓ Technical approach with task area breakdown — v1.0
- ✓ Management approach with org structure — v1.0
- ✓ Transition plan generation — v1.0
- ✓ Past performance citations — v1.0
- ✓ Resume templates — v1.0
- ✓ Compliance matrix (Excel) — v1.0
- ✓ Exhibit system with sequential numbering — v1.0
- ✓ Win theme integration — v1.0
- ✓ Company logo integration (cover page, headers) — v1.0 Phase 1
- ✓ TOC with field codes, Table of Exhibits — v1.0 Phase 1
- ✓ Headers/footers with branding and proprietary notice — v1.0 Phase 1
- ✓ Heading variants, emphasis styles, list/table styles — v1.0 Phase 2
- ✓ Deliverables subsections and benefits callout boxes — v1.0 Phase 2
- ✓ Org charts, process diagrams, timeline/Gantt charts — v1.0 Phase 3
- ✓ Exhibit cross-reference validation — v1.0 Phase 3

### Active

<!-- Current milestone: v2.0 Production Readiness -->

See REQUIREMENTS.md for detailed REQ-IDs and traceability.

### Out of Scope

- Mobile app — desktop/browser workflow is sufficient for proposal writers
- Real-time collaboration — single-user tool, proposals reviewed externally
- Template designer UI — templates managed in code
- OCR for scanned PDFs — require text-based PDFs
- Full past performance library in Tier 1 — per consultant, these are per-opportunity assets (Tier 2 only)
- Resume bank in Tier 1 — dynamic, opportunity-specific (Tier 2 only)

## Context

**Existing codebase:** Brownfield Next.js 16 app with working document processing pipeline and DOCX generation. v1.0 achieved ~90% framework alignment (logos, styles, exhibits, pipeline utilities built).

**Blueprint:** `ClicklessAI_Blueprint.md` defines the v2.0 production readiness specification based on consultant (Mary Morris) feedback and real RFP test packages.

**Consultant feedback:** Mary Morris (Enterprise Proposal Manager) identified two-tier data architecture, multi-document ingestion, and AI compliance extraction as critical gaps blocking production readiness.

**Test packages:** Two real solicitation packages provided for validation:
- **Test Case A (ARL):** 18+ files, Seaport-NxG task order, CPFF, amendment reconciliation, contractor-generated PWS
- **Test Case B (METC):** 9 files, GSA schedule, WOSB set-aside, Q&A-driven page limit changes

**Target users:** Government IT contractors (initially Impyrian) who respond to federal RFPs. Goal: service paying customers.

## Constraints

- **Tech stack:** Next.js 16, React 19, TypeScript, Supabase, Inngest, Anthropic Claude API, docx library
- **Document format:** DOCX primary output (Word editing required before submission)
- **Framework compliance:** All output must conform to Proposal_Response_Generation_Framework.md
- **Production readiness:** Must pass 10 acceptance criteria defined in Blueprint §6
- **Test validation:** Must successfully process both ARL and METC solicitation packages end-to-end

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-tier data intake (Tier 1 enterprise, Tier 2 per-bid) | Consultant recommendation — mirrors real proposal shops, reduces onboarding friction | — Pending |
| Exclude past perf/resumes from Tier 1 | Per-opportunity assets that vary by bid — collecting at onboarding adds friction | — Pending |
| Human confirmation gate before draft generation | Preserves compliance integrity — no draft without customer validation | — Pending |
| ARL test case first, METC second | ARL exercises every capability (18+ files, amendments, contractor PWS, complex CLINs) | — Pending |
| Full v2.0 scope in single milestone | Blueprint workstreams are interdependent — partial delivery doesn't reach production readiness | — Pending |

---
*Last updated: 2026-02-23 after v2.0 milestone initialization*
